"""
Unit & Integration Tests for Distributed Backend Engineering Patterns:
  1. Circuit Breaker Pattern (Resilience)
  2. Singleflight Request Coalescing (Concurrency)
  3. Idempotency Key Middleware (Reliability)
  4. Prometheus RED Metrics Exporter (Observability)
"""
import asyncio
import pytest
from fastapi.testclient import TestClient

from app.core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState
from app.core.singleflight import SingleFlightGroup
from app.main import app

client = TestClient(app)


# ─── 1. Circuit Breaker Tests ──────────────────────────────────────────────────

def test_circuit_breaker_closed_to_open():
    breaker = CircuitBreaker(name="test_cb", failure_threshold=2, recovery_timeout=0.2)

    def failing_func():
        raise ValueError("Downstream API Error")

    # Call 1: Failure 1
    with pytest.raises(ValueError):
        breaker.call_sync(failing_func)
    assert breaker.state == CircuitState.CLOSED

    # Call 2: Failure 2 (Trips to OPEN)
    with pytest.raises(ValueError):
        breaker.call_sync(failing_func)
    assert breaker.state == CircuitState.OPEN

    # Call 3: Blocked by OPEN state
    with pytest.raises(CircuitBreakerOpenError):
        breaker.call_sync(failing_func)


def test_circuit_breaker_recovery():
    breaker = CircuitBreaker(name="test_recovery", failure_threshold=1, recovery_timeout=0.1)

    def failing_func():
        raise RuntimeError("Fail")

    def success_func():
        return "OK"

    # Fail -> OPEN
    with pytest.raises(RuntimeError):
        breaker.call_sync(failing_func)
    assert breaker.state == CircuitState.OPEN

    # Wait for recovery timeout
    import time
    time.sleep(0.15)
    assert breaker.state == CircuitState.HALF_OPEN

    # Success in HALF_OPEN -> CLOSED
    res = breaker.call_sync(success_func)
    assert res == "OK"
    assert breaker.state == CircuitState.CLOSED


# ─── 2. Singleflight Coalescing Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_singleflight_coalescing():
    group = SingleFlightGroup()
    execution_count = 0

    async def heavy_work():
        nonlocal execution_count
        execution_count += 1
        await asyncio.sleep(0.05)
        return "shared_result"

    # Spawn 10 concurrent requests for the exact same key
    tasks = [group.do("repo1:query1", heavy_work) for _ in range(10)]
    results = await asyncio.gather(*tasks)

    # Assert heavy_work executed ONCE
    assert execution_count == 1
    # Assert all 10 callers received identical shared_result
    assert all(r == "shared_result" for r in results)


# ─── 3. Idempotency Key Middleware Tests ─────────────────────────────────────

def test_idempotency_middleware():
    key = "test-key-uuid-9999"

    # Request 1 (Initial)
    res1 = client.post(
        "/api/v1/code/review",
        json={"code": "def add(a, b): return a + b"},
        headers={"Idempotency-Key": key},
    )
    assert res1.status_code == 200
    data1 = res1.json()

    # Request 2 (Retry with same Idempotency-Key)
    res2 = client.post(
        "/api/v1/code/review",
        json={"code": "def add(a, b): return a + b"},
        headers={"Idempotency-Key": key},
    )
    assert res2.status_code == 200
    assert res2.headers.get("X-Cache-Lookup") == "Hit-Idempotent"
    assert res2.json() == data1


# ─── 4. Prometheus Metrics Exporter Tests ────────────────────────────────────

def test_prometheus_metrics_endpoint():
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "text/plain" in res.headers["content-type"]

    body = res.text
    assert "codesagez_http_requests_total" in body
    assert "codesagez_cache_hits_total" in body
    assert "codesagez_cache_misses_total" in body
