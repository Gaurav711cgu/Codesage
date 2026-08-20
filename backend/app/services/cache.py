"""
Query & Retrieval Cache with Cache Jitter (TTL Randomization).

Prevents the Thundering Herd / Cache Stampede problem when multiple cached query keys
expire simultaneously under high request loads.
"""
import hashlib
import json
import logging
import random
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.models.schemas import RetrievedChunk

try:
    import redis
    _redis_available = True
except ImportError:
    _redis_available = False

logger = logging.getLogger(__name__)

DEFAULT_BASE_TTL_SECONDS = 3600
DEFAULT_JITTER_PCT = 0.10


def compute_jittered_ttl(base_ttl_seconds: int = DEFAULT_BASE_TTL_SECONDS, jitter_pct: float = DEFAULT_JITTER_PCT) -> float:
    """
    Calculate effective TTL with random jitter (+/- jitter_pct).
    Example: base_ttl=3600, jitter_pct=0.10 -> returns float in range [3240.0, 3960.0].
    """
    max_jitter = base_ttl_seconds * jitter_pct
    return base_ttl_seconds + random.uniform(-max_jitter, max_jitter)


@dataclass
class _CacheEntry:
    value: list[dict[str, Any]]
    latency_ms: int
    expires_at: float
    effective_ttl: float


class QueryResultCache:
    """
    Dual Redis / In-Memory query result cache with cache jitter.
    If settings.redis_url is configured, connects to Redis. Otherwise falls back to local dict.
    """

    def __init__(self) -> None:
        self._store: dict[str, _CacheEntry] = {}
        self._redis_client = None
        if _redis_available and getattr(settings, "redis_url", None):
            try:
                self._redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                logger.info("QueryResultCache initialized with Redis backend at %s", settings.redis_url)
            except Exception as exc:
                logger.warning("Could not connect to Redis at %s, using in-memory cache: %s", settings.redis_url, exc)

    def _make_key(self, repo_id: str, query: str, mode: str) -> str:
        raw = f"{repo_id}:{mode}:{query.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, repo_id: str, query: str, mode: str) -> tuple[list[RetrievedChunk], int] | None:
        key = self._make_key(repo_id, query, mode)

        if self._redis_client is not None:
            try:
                val = self._redis_client.get(f"qcache:{key}")
                if val:
                    data = json.loads(val)
                    chunks = [RetrievedChunk(**c) for c in data["chunks"]]
                    return chunks, data["latency_ms"]
            except Exception as exc:
                logger.debug("Redis cache read error, falling back to local memory: %s", exc)

        entry = self._store.get(key)
        if entry is None:
            return None

        # Check expiration
        now = time.time()
        if now >= entry.expires_at:
            logger.debug("Cache miss (expired) for key %s (TTL was %.1fs)", key[:8], entry.effective_ttl)
            self._store.pop(key, None)
            return None

        logger.debug("Cache hit for key %s (expires in %.1fs)", key[:8], entry.expires_at - now)
        chunks = [RetrievedChunk(**c) for c in entry.value]
        return chunks, entry.latency_ms

    def set(
        self,
        repo_id: str,
        query: str,
        mode: str,
        chunks: list[RetrievedChunk],
        latency_ms: int,
        base_ttl: int = DEFAULT_BASE_TTL_SECONDS,
        jitter_pct: float = DEFAULT_JITTER_PCT,
    ) -> float:
        """
        Store query results with jittered TTL.
        Returns the calculated effective TTL in seconds.
        """
        key = self._make_key(repo_id, query, mode)
        effective_ttl = compute_jittered_ttl(base_ttl, jitter_pct)
        expires_at = time.time() + effective_ttl

        chunk_dicts = [c.model_dump() for c in chunks]

        if self._redis_client is not None:
            try:
                payload = json.dumps({"chunks": chunk_dicts, "latency_ms": latency_ms})
                self._redis_client.setex(f"qcache:{key}", int(effective_ttl), payload)
            except Exception as exc:
                logger.debug("Redis cache write error, falling back to local memory: %s", exc)

        self._store[key] = _CacheEntry(
            value=chunk_dicts,
            latency_ms=latency_ms,
            expires_at=expires_at,
            effective_ttl=effective_ttl,
        )
        logger.debug(
            "Cached query results for key %s: base_ttl=%ds, effective_ttl=%.1fs",
            key[:8],
            base_ttl,
            effective_ttl,
        )
        return effective_ttl

    def invalidate_repo(self, repo_id: str) -> int:
        """Evict all cached entries for a repository."""
        count = len(self._store)
        self._store.clear()
        logger.info("Evicted %d cache entries for repo %s", count, repo_id)
        return count

    def clear(self) -> None:
        self._store.clear()


# Global cache instance singleton
query_cache = QueryResultCache()
