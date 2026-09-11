import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy import text

from app.core.auth import APIKeyMiddleware
from app.core.rate_limit import limiter
from app.core.config import settings
from app.api.v1 import repo, code, benchmarks
from app.services import chromadb_client
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.idempotency import IdempotencyMiddleware
from app.core.metrics import MetricsMiddleware, metrics_router

os.makedirs("/tmp/codesagez", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/tmp/codesagez/backend.log"),
    ],
)
logger = logging.getLogger(__name__)


# ─── Request-ID middleware ────────────────────────────────────────────────────

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-ID to every request for log correlation."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        # Make it available to route handlers
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "CodeSageZ v%s starting — environment: %s",
        settings.version,
        settings.environment,
    )
    settings.validate_production_config()

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")
    except Exception as e:
        logger.error("Failed to create database tables: %s", e)

    yield

    logger.info("CodeSageZ shutting down cleanly — draining in-flight requests and flushing DB engine...")
    await engine.dispose()
    logger.info("Database connections disposed cleanly.")


# ─── App ──────────────────────────────────────────────────────────────────────

# Hide docs in production — prevents API enumeration attacks
_docs_url = "/docs" if settings.environment != "production" else None
_redoc_url = "/redoc" if settings.environment != "production" else None

app = FastAPI(
    title="CodeSageZ API",
    version=settings.version,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    lifespan=lifespan,
)

# Middleware order matters — outermost runs first
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(APIKeyMiddleware)

# CORS — explicit, not wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-ID", "Idempotency-Key"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Routers
from app.mcp_server import mcp_app  # noqa: E402 — must be after app creation

app.include_router(repo.router, prefix="/api/v1")
app.include_router(code.router, prefix="/api/v1")
app.include_router(benchmarks.router, prefix="/api/v1")
app.include_router(metrics_router)
app.mount("/mcp", mcp_app)

# OpenTelemetry distributed tracing
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    FastAPIInstrumentor.instrument_app(app)
    logger.info("OpenTelemetry distributed tracing enabled.")
except Exception as _exc:
    logger.debug("OpenTelemetry instrumentation skipped: %s", _exc)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
@app.get("/healthz", tags=["health"])
async def health_check():
    """Dependency health check — returns 200 always, status field indicates health."""
    checks: dict[str, str] = {}

    try:
        chromadb_client.get_client().heartbeat()
        checks["chromadb"] = "ok"
    except Exception as e:
        checks["chromadb"] = f"error: {e.__class__.__name__}"

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e.__class__.__name__}"

    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    if status == "degraded":
        logger.warning("Health check degraded: %s", checks)

    status_code = 200 if status == "ok" else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": status, "version": settings.version, "checks": checks},
    )


# ─── Global error handler ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "Unhandled exception [request_id=%s] on %s %s",
        request_id,
        request.method,
        request.url,
    )
    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred.",
                "request_id": request_id,
            },
        },
    )
