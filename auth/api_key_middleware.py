"""
CodeSage-MCP API Key Middleware & Token Bucket Rate Limiter
"""
import time
from typing import Dict
import asyncio

class RateLimitExceeded(Exception):
    pass

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_update = time.monotonic()
        self.lock = asyncio.Lock()

    async def consume(self, tokens: int = 1) -> bool:
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
            self.last_update = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

class APIKeyMiddleware:
    def __init__(self, default_rpm: int = 60):
        self.buckets: Dict[str, TokenBucket] = {}
        self.default_rpm = default_rpm
        self.refill_rate = default_rpm / 60.0

    async def check_key(self, api_key: str) -> bool:
        if not api_key:
            return False
            
        if api_key not in self.buckets:
            self.buckets[api_key] = TokenBucket(capacity=10, refill_rate=self.refill_rate)
            
        allowed = await self.buckets[api_key].consume(1)
        if not allowed:
            raise RateLimitExceeded(f"Rate limit exceeded for key. Max {self.default_rpm} RPM.")
        return True
