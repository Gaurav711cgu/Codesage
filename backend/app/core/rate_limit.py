"""
SlowAPI Rate Limiter configuration.
Keys rate limit buckets by authenticated X-API-Key header, X-Forwarded-For header,
or client remote IP address to prevent reverse-proxy bucket sharing.
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def get_real_client_identifier(request: Request) -> str:
    """
    Extract key identifier for rate limiting:
    1. Authenticated X-API-Key header
    2. First IP in X-Forwarded-For header (if behind Cloudflare/NGINX/ALB)
    3. Fallback to client remote address
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"key:{api_key}"

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can be a comma-separated list of IPs: "client, proxy1, proxy2"
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}"

    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=get_real_client_identifier,
    storage_uri=settings.redis_url or "memory://",
)
