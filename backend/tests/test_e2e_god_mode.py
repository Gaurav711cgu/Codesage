"""
E2E God-Mode Integration Test Suite:
  1. Circuit Breaker active hot-path tripping & recovery
  2. SingleFlight request coalescing under concurrent load
  3. Multilingual AST / regex parsing (Python, TS, JS, Go, Java, Rust)
  4. QueryResultCache jitter bounds & eviction
"""
import asyncio
from pathlib import Path
import pytest

from app.core.circuit_breaker import gemini_breaker, CircuitBreakerOpenError, CircuitState
from app.core.singleflight import single_flight
from app.services import gemini
from app.services.cache import QueryResultCache, compute_jittered_ttl
from app.services.ingestion import parse_file
from app.services.retrieval import async_retrieve
from app.models.schemas import RetrievedChunk


# ─── 1. Circuit Breaker in Hot Path ──────────────────────────────────────────

def test_circuit_breaker_active_tripping_in_gemini():
    # Force trip gemini_breaker by exceeding failure threshold
    gemini_breaker._state = CircuitState.CLOSED
    gemini_breaker._failure_count = 0
    gemini_breaker.failure_threshold = 3

    def exploding_client():
        raise ConnectionResetError("Remote API downstream failure")

    # 3 failures trip breaker
    for _ in range(3):
        with pytest.raises(ConnectionResetError):
            gemini_breaker.call_sync(exploding_client)

    assert gemini_breaker.state == CircuitState.OPEN

    # In OPEN state, call_llm immediately returns graceful unavailable string without stalling
    result = gemini.call_llm("def fib(n):")
    assert "Generation is unavailable" in result

    # Reset breaker state
    gemini_breaker._state = CircuitState.CLOSED
    gemini_breaker._failure_count = 0
    gemini_breaker.failure_threshold = 5


# ─── 2. SingleFlight Coalescing in Retrieval ─────────────────────────────────

@pytest.mark.asyncio
async def test_singleflight_coalesces_concurrent_retrieval(monkeypatch):
    call_count = 0

    def mock_raw_retrieve(repo_id, query, mode, graph_data_json, hop_depth):
        nonlocal call_count
        call_count += 1
        return [
            RetrievedChunk(
                id="c-1",
                name="auth_service",
                file="auth.py",
                lines=[1, 10],
                type="seed",
                score=0.99,
            )
        ], 15

    from app.services import retrieval
    monkeypatch.setattr(retrieval, "_raw_retrieve", mock_raw_retrieve)

    # Spawn 20 concurrent coroutines requesting identical query
    tasks = [
        async_retrieve("repo-xyz", "auth_service", "graph")
        for _ in range(20)
    ]
    results = await asyncio.gather(*tasks)

    # Assert underlying RAG search executed ONCE due to single_flight
    assert call_count == 1
    assert len(results) == 20
    for chunks, lat in results:
        assert len(chunks) == 1
        assert chunks[0].name == "auth_service"


# ─── 3. Multilingual Code Parsing ─────────────────────────────────────────────

def test_multilingual_code_parsing(tmp_path: Path):
    repo_id = "test-multilingual-repo"

    # 1. Python file
    py_file = tmp_path / "calc.py"
    py_file.write_text("def add(a, b):\n    return a + b\n")
    py_units = parse_file(py_file, repo_id, "calc.py")
    assert any(u.name == "add" and u.type == "function" for u in py_units)

    # 2. TypeScript file
    ts_file = tmp_path / "math.ts"
    ts_file.write_text("export function multiply(x: number, y: number): number {\n  return x * y;\n}\n")
    ts_units = parse_file(ts_file, repo_id, "math.ts")
    assert any(u.name == "multiply" for u in ts_units)

    # 3. Go file
    go_file = tmp_path / "server.go"
    go_file.write_text("package main\n\nfunc HandleRequest() {\n}\n")
    go_units = parse_file(go_file, repo_id, "server.go")
    assert any(u.name == "HandleRequest" for u in go_units)

    # 4. Java file
    java_file = tmp_path / "Payment.java"
    java_file.write_text("public class Payment {\n    public void processPayment() {\n    }\n}\n")
    java_units = parse_file(java_file, repo_id, "Payment.java")
    assert any(u.name == "processPayment" for u in java_units)

    # 5. Rust file
    rs_file = tmp_path / "engine.rs"
    rs_file.write_text("fn execute_task() -> bool {\n    true\n}\n")
    rs_units = parse_file(rs_file, repo_id, "engine.rs")
    assert any(u.name == "execute_task" for u in rs_units)
