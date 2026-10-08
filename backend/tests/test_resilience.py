"""
Tests for Provider Resilience: Circuit Breaker with Exponential Backoff and Full Jitter.
"""
import pytest
import time
from app.core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState
from app.core.resilience import (
    compute_jittered_delay,
    execute_with_resilience_sync,
)
from app.services.embedder import embed_texts, embed_query


def test_exponential_backoff_jitter_bounds():
    base_delay = 0.5
    max_delay = 5.0
    for attempt in range(6):
        delay = compute_jittered_delay(attempt, base_delay, max_delay)
        ceiling = min(max_delay, base_delay * (2 ** attempt))
        assert 0.0 <= delay <= ceiling


def test_execute_with_resilience_sync_success():
    breaker = CircuitBreaker("test_success", failure_threshold=3, recovery_timeout=1.0)
    calls = 0

    def successful_operation():
        nonlocal calls
        calls += 1
        return "success"

    res = execute_with_resilience_sync(successful_operation, breaker=breaker)
    assert res == "success"
    assert calls == 1
    assert breaker.state == CircuitState.CLOSED


def test_execute_with_resilience_sync_retry_then_succeed():
    breaker = CircuitBreaker("test_retry", failure_threshold=5, recovery_timeout=1.0)
    attempts = 0

    def flaky_operation():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ConnectionError("Transient network blip")
        return "recovered"

    res = execute_with_resilience_sync(
        flaky_operation,
        breaker=breaker,
        max_retries=4,
        base_delay=0.01,
        max_delay=0.05,
    )
    assert res == "recovered"
    assert attempts == 3
    assert breaker.state == CircuitState.CLOSED


def test_execute_with_resilience_trips_circuit_breaker_on_repeated_failure():
    breaker = CircuitBreaker("test_trip", failure_threshold=2, recovery_timeout=10.0)

    def failing_op():
        raise RuntimeError("Downstream 503 Service Unavailable")

    with pytest.raises(RuntimeError):
        execute_with_resilience_sync(
            failing_op,
            breaker=breaker,
            max_retries=2,
            base_delay=0.01,
            max_delay=0.02,
        )

    # Second failure sequence pushes over failure threshold of 2
    with pytest.raises(RuntimeError):
        execute_with_resilience_sync(
            failing_op,
            breaker=breaker,
            max_retries=2,
            base_delay=0.01,
            max_delay=0.02,
        )

    assert breaker.state == CircuitState.OPEN

    # Breaker is now OPEN; subsequent call must fast fail with CircuitBreakerOpenError
    with pytest.raises(CircuitBreakerOpenError):
        execute_with_resilience_sync(failing_op, breaker=breaker)


def test_embedding_resilience_fallback_to_local_hash(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "gemini")
    monkeypatch.setattr("app.core.config.settings.gemini_api_key", "test_key")

    # Simulate failing Gemini embed call
    class FailingModels:
        def embed_content(self, *args, **kwargs):
            raise ConnectionError("Upstream API unreachable")

    class MockClient:
        def __init__(self, api_key):
            self.models = FailingModels()

    monkeypatch.setattr("google.genai.Client", MockClient)

    # Calling embed_texts and embed_query should gracefully fall back to local hash embeddings
    vecs = embed_texts(["def process(): pass"])
    assert len(vecs) == 1
    assert len(vecs[0]) == 384  # local hash dimension

    q_vec = embed_query("def process(): pass")
    assert len(q_vec) == 384
