"""
Unit tests for Query Result Cache & Cache Jitter (TTL Randomization).
"""
import time
import pytest
from app.models.schemas import RetrievedChunk
from app.services.cache import QueryResultCache, compute_jittered_ttl


def test_compute_jittered_ttl_bounds():
    base_ttl = 3600
    jitter_pct = 0.10
    ttls = [compute_jittered_ttl(base_ttl, jitter_pct) for _ in range(100)]

    min_allowed = base_ttl * (1.0 - jitter_pct)  # 3240.0
    max_allowed = base_ttl * (1.0 + jitter_pct)  # 3960.0

    for ttl in ttls:
        assert min_allowed <= ttl <= max_allowed

    # Verify distribution is non-constant (randomized)
    assert len(set(ttls)) > 50


def test_query_cache_hit_and_miss():
    cache = QueryResultCache()
    repo_id = "test-repo-123"
    query = "def calculate_sum(a, b):"
    mode = "graph"

    # 1. Miss initially
    assert cache.get(repo_id, query, mode) is None

    # 2. Store item
    sample_chunks = [
        RetrievedChunk(
            id="chunk-1",
            name="calculate_sum",
            file="math.py",
            lines=[1, 5],
            type="seed",
            score=0.95,
        )
    ]
    effective_ttl = cache.set(repo_id, query, mode, sample_chunks, latency_ms=12)
    assert 3240.0 <= effective_ttl <= 3960.0

    # 3. Hit
    cached_result = cache.get(repo_id, query, mode)
    assert cached_result is not None
    chunks, lat = cached_result
    assert len(chunks) == 1
    assert chunks[0].name == "calculate_sum"
    assert lat == 12


def test_query_cache_expiration(monkeypatch):
    cache = QueryResultCache()
    repo_id = "test-repo-456"
    query = "process_payment"
    mode = "naive"

    chunks = [
        RetrievedChunk(
            id="chunk-2",
            name="process_payment",
            file="payment.py",
            lines=[10, 25],
            type="seed",
            score=0.88,
        )
    ]
    cache.set(repo_id, query, mode, chunks, latency_ms=5, base_ttl=10, jitter_pct=0.0)

    # Simulate time advancing 15 seconds
    now = time.time()
    monkeypatch.setattr(time, "time", lambda: now + 15)

    # Should be expired
    assert cache.get(repo_id, query, mode) is None


def test_query_cache_invalidation():
    cache = QueryResultCache()
    cache.set("repo-1", "q1", "graph", [], 1)
    cache.set("repo-2", "q2", "graph", [], 1)

    cache.clear()
    assert cache.get("repo-1", "q1", "graph") is None
    assert cache.get("repo-2", "q2", "graph") is None
