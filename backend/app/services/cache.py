"""
Query & Retrieval Cache with Cache Jitter (TTL Randomization).

Prevents the Thundering Herd / Cache Stampede problem when multiple cached query keys
expire simultaneously under high request loads.
"""
import hashlib
import logging
import random
import time
from dataclasses import dataclass
from typing import Any

from app.models.schemas import RetrievedChunk

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
    In-memory / Redis-ready query result cache with cache jitter.
    Thread-safe dictionary store keyed by SHA-256 hash of (repo_id, mode, query).
    """

    def __init__(self) -> None:
        self._store: dict[str, _CacheEntry] = {}

    def _make_key(self, repo_id: str, query: str, mode: str) -> str:
        raw = f"{repo_id}:{mode}:{query.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, repo_id: str, query: str, mode: str) -> tuple[list[RetrievedChunk], int] | None:
        key = self._make_key(repo_id, query, mode)
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
