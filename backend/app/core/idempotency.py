"""
Idempotency Key Middleware for reliable API retries (Stripe-tier engineering standard).

Stores and replays HTTP response payloads for requests containing an 'Idempotency-Key' header.
Prevents duplicate ingestion or state mutations on client network retries.
"""
import logging
import time
from typing import Callable, Dict, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

logger = logging.getLogger(__name__)

IDEMPOTENCY_HEADER = "idempotency-key"
DEFAULT_EXPIRATION_SECONDS = 86400  # 24 hours


import json
try:
    import redis
    _redis_available = True
except ImportError:
    _redis_available = False

from app.core.config import settings

class IdempotencyStore:
    def __init__(self, expiration_seconds: int = DEFAULT_EXPIRATION_SECONDS) -> None:
        self.expiration_seconds = expiration_seconds
        self._store: Dict[str, Tuple[int, bytes, Dict[str, str], float]] = {}
        self._redis_client = None
        if _redis_available and getattr(settings, "redis_url", None):
            try:
                self._redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=False)
                logger.info("IdempotencyStore initialized with Redis backend at %s", settings.redis_url)
            except Exception as exc:
                logger.warning("Could not connect to Redis at %s, using in-memory idempotency: %s", settings.redis_url, exc)

    def get(self, key: str) -> Tuple[int, bytes, Dict[str, str]] | None:
        if self._redis_client:
            try:
                val = self._redis_client.get(f"idemp:{key}")
                if val:
                    data = json.loads(val.decode("utf-8"))
                    return data["status_code"], data["body"].encode("utf-8"), data["headers"]
            except Exception as exc:
                logger.debug("Redis idempotency read error: %s", exc)

        # Fallback to local memory
        entry = self._store.get(key)
        if entry is None:
            return None
        status_code, body, headers, expires_at = entry
        if time.time() >= expires_at:
            self._store.pop(key, None)
            return None
        return status_code, body, headers

    def set(self, key: str, status_code: int, body: bytes, headers: Dict[str, str]) -> None:
        if self._redis_client:
            try:
                payload = json.dumps({
                    "status_code": status_code,
                    "body": body.decode("utf-8"),
                    "headers": headers
                })
                self._redis_client.setex(f"idemp:{key}", self.expiration_seconds, payload)
            except Exception as exc:
                logger.debug("Redis idempotency write error: %s", exc)

        expires_at = time.time() + self.expiration_seconds
        self._store[key] = (status_code, body, headers, expires_at)


idempotency_store = IdempotencyStore()


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> StarletteResponse:
        idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)

        # Only apply to state-mutating methods when Idempotency-Key header is present
        if not idempotency_key or request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        # Check for cached idempotent response
        cached = idempotency_store.get(idempotency_key)
        if cached is not None:
            status_code, body, headers = cached
            logger.info("Idempotent cache hit for key %s", idempotency_key[:12])
            res_headers = dict(headers)
            res_headers["X-Cache-Lookup"] = "Hit-Idempotent"
            return StarletteResponse(content=body, status_code=status_code, headers=res_headers)

        # Execute downstream request
        response = await call_next(request)

        # Read response body to cache if successful status (2xx/4xx)
        if 200 <= response.status_code < 500:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")

            # Extract response headers
            headers_dict = {k: v for k, v in response.headers.items()}
            idempotency_store.set(idempotency_key, response.status_code, body, headers_dict)

            headers_dict["X-Cache-Lookup"] = "Miss-Idempotent"
            return StarletteResponse(content=body, status_code=response.status_code, headers=headers_dict)

        return response
