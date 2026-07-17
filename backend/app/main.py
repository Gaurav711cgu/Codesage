import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.rate_limit import limiter

from app.core.config import settings
from app.api.v1 import repo, code, benchmarks
from app.services import chromadb_client
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.repo import *
from sqlalchemy import text

import os
os.makedirs("/tmp/codesagez", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/tmp/codesagez/backend.log"),
    ]
)
logger = logging.getLogger(__name__)




@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CodeSageZ v%s starting up — environment: %s",
                settings.version, settings.environment)
    settings.validate_production_config()
    
    # Ensure database tables exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.error("Failed to create database tables: %s", e)
        
    yield
    logger.info("CodeSageZ shutting down")


app = FastAPI(
    title="CodeSageZ API",
    version=settings.version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(repo.router, prefix="/api/v1")
app.include_router(code.router, prefix="/api/v1")
app.include_router(benchmarks.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
@app.get("/healthz", tags=["health"])
async def health_check():
    checks = {}
    
    # ChromaDB ping
    try:
        chromadb_client.get_client().heartbeat()
        checks["chromadb"] = "ok"
    except Exception as e:
        checks["chromadb"] = f"error: {e}"
    
    # DB ping
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    
    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    
    if status == "degraded":
        return JSONResponse(status_code=503, content={"status": status, "version": settings.version, "checks": checks})
        
    return {"status": status, "version": settings.version, "checks": checks}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": {"code": "INTERNAL_ERROR", "message": "An internal error occurred."}},
    )
