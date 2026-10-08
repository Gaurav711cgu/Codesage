"""
Tests for Offline Evaluation Suite and Golden Dataset Integrity.
"""
import json
import sys
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from benchmarks.offline_eval import (
    DEFAULT_DATASET,
    OfflineEvaluationHarness,
)


def test_golden_dataset_structure_and_integrity():
    assert DEFAULT_DATASET.exists(), f"Golden dataset {DEFAULT_DATASET} must exist."
    with open(DEFAULT_DATASET, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "queries" in data
    queries = data["queries"]
    assert len(queries) >= 15, "Golden dataset must contain at least 15 comprehensive evaluation queries."

    for q in queries:
        assert "query_id" in q
        assert "query" in q and len(q["query"]) > 5
        assert "expected_symbols" in q and len(q["expected_symbols"]) > 0
        assert "category" in q


def test_evaluation_metrics_computation(tmp_path: Path):
    sample_file = tmp_path / "circuit_breaker.py"
    sample_file.write_text(
        "class CircuitBreaker:\n"
        "    '''Resilient circuit breaker state machine.'''\n"
        "    def call_sync(self):\n"
        "        pass\n"
        "\n"
        "class CircuitState:\n"
        "    CLOSED = 'closed'\n"
        "    OPEN = 'open'\n"
    )
    harness = OfflineEvaluationHarness(codebase_root=tmp_path)

    sample_query = {
        "query_id": "TEST_Q1",
        "query": "circuit breaker state transition failure recovery",
        "expected_symbols": ["CircuitBreaker", "CircuitState"],
        "category": "resilience",
    }

    # Evaluate under hybrid mode
    result = harness.evaluate_query(sample_query, mode="hybrid", k_values=(1, 3, 5, 8))

    assert result.query_id == "TEST_Q1"
    assert result.mode == "hybrid"
    assert 0.0 <= result.reciprocal_rank <= 1.0
    for k in (1, 3, 5, 8):
        assert 0.0 <= result.precision_at_k[k] <= 1.0
        assert 0.0 <= result.recall_at_k[k] <= 1.0
    assert result.latency_ms >= 0.0
