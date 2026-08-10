"""
API key authentication middleware.

Every request to /api/v1/* must carry either:
  - Header:   X-API-Key: <key>
  - Query:    ?api_key=<key>

Set the CODESAGEZ_API_KEY environment variable to enable auth.
If the variable is empty the server starts in OPEN mode (dev only).
"""
import logging
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)

_UNPROTECTED_PREFIXES = ("/health", "/healthz", "/docs", "/redoc", "/openapi.json", "/mcp")


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Validate X-API-Key header or api_key query param on /api/* routes."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Skip auth for health checks, docs, MCP
        if any(path.startswith(prefix) for prefix in _UNPROTECTED_PREFIXES):
            return await call_next(request)

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            return await call_next(request)

        # If no key configured → open mode (development only)
        if not settings.api_key:
            if settings.environment == "production":
                logger.critical("CODESAGEZ_API_KEY not set in production — rejecting all /api requests")
                return JSONResponse(
                    status_code=503,
                    content={"data": None, "error": {"code": "MISCONFIGURED", "message": "Server is not properly configured."}},
                )
            return await call_next(request)

        # Extract key from header or query param
        provided = (
            request.headers.get("X-API-Key")
            or request.query_params.get("api_key")
        )

        if not provided or provided != settings.api_key:
            logger.warning("Unauthorized request to %s from %s", path, request.client)
            return JSONResponse(
                status_code=401,
                content={"data": None, "error": {"code": "UNAUTHORIZED", "message": "Valid X-API-Key header required."}},
            )

        return await call_next(request)
