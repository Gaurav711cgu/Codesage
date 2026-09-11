"""
SlowAPI Rate Limiter configuration.
Keys rate limit buckets by authenticated X-API-Key header, X-Forwarded-For header,
or client remote IP address to prevent reverse-proxy bucket sharing.
"""
import logging
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)

# Usually injected via env var in production (e.g., ALB or NGINX private IP ranges)
# Hardcoded local subnets for demo FAANG architecture purposes
TRUSTED_PROXIES = {"127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}

def is_trusted_proxy(ip: str) -> bool:
    # Basic exact match for local/container dev; in prod use ipaddress module for CIDR
    if ip == "127.0.0.1" or ip.startswith("10.") or ip.startswith("172.") or ip.startswith("192.168."):
        return True
    return False

def get_real_client_identifier(request: Request) -> str:
    """
    Extract key identifier for rate limiting:
    1. Authenticated X-API-Key header
    2. First IP in X-Forwarded-For header ONLY IF direct client is a trusted proxy
    3. Fallback to direct client remote address
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"key:{api_key}"

    remote_ip = request.client.host if request.client else "127.0.0.1"
    
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for and is_trusted_proxy(remote_ip):
        # Only honor X-Forwarded-For if it came through our trusted API Gateway/LB
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}"

    # Fallback to direct connection IP if not proxy or not trusted
    return f"ip:{remote_ip}"


limiter = Limiter(
    key_func=get_real_client_identifier,
    storage_uri=settings.redis_url or "memory://",
)
