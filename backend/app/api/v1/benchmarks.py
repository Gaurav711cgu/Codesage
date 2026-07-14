"""
Benchmarks endpoint — reads committed result JSON files and serves them.
All null values are preserved; the frontend renders "Pending measurement".
No computation happens at request time.
"""
import json
import logging
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["benchmarks"])

# Results live two directories above this file: /codesagez/benchmarks/results/
# and /codesagez/training/results/
_REPO_ROOT = Path(__file__).resolve().parents[5]
_BENCH_RESULTS  = _REPO_ROOT / "benchmarks" / "results"
_TRAIN_RESULTS  = _REPO_ROOT / "training" / "results"


def _load_json(path: Path) -> dict | None:
    """Load a JSON file, returning None if missing or malformed."""
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


@router.get("/benchmarks")
async def get_benchmarks():
    # ── Fine-tuning metrics ───────────────────────────────────────────────────
    base_cb      = _load_json(_TRAIN_RESULTS / "base_codeblu.json")
    ft_cb        = _load_json(_TRAIN_RESULTS / "finetuned_codeblu.json")
    base_he      = _load_json(_TRAIN_RESULTS / "base_humaneval.json")
    ft_he        = _load_json(_TRAIN_RESULTS / "finetuned_humaneval.json")
    train_log    = _load_json(_TRAIN_RESULTS / "training_log.json")

    def _score(data: dict | None, key: str):
        if data is None:
            return None
        return data.get(key)

    base_codebleu  = _score(base_cb,  "codebleu")
    ft_codebleu    = _score(ft_cb,    "codebleu")
    base_humaneval = _score(base_he,  "pass_at_1")
    ft_humaneval   = _score(ft_he,    "pass_at_1")

    cb_delta = (
        round(ft_codebleu - base_codebleu, 2)
        if ft_codebleu is not None and base_codebleu is not None
        else None
    )
    he_delta = (
        round(ft_humaneval - base_humaneval, 2)
        if ft_humaneval is not None and base_humaneval is not None
        else None
    )

    fine_tuning = {
        "model": "Qwen2.5-Coder-1.5B-Instruct",
        "training_samples": 8000,
        "epochs": train_log.get("epochs_completed") if train_log else None,
        "primary_metric": {
            "name": "CodeBLEU (held-out CommitPack test set, n=1000)",
            "base":      base_codebleu,
            "finetuned": ft_codebleu,
            "delta":     cb_delta,
        },
        "secondary_metric": {
            "name": "HumanEval Pass@1 (catastrophic forgetting check)",
            "base":           base_humaneval,
            "finetuned":      ft_humaneval,
            "delta":          he_delta,
            "interpretation": train_log.get("humaneval_interpretation") if train_log else None,
        },
        "eval_date": train_log.get("eval_date") if train_log else None,
        "results_file": "training/results/finetuned_codeblu.json",
    }

    # ── RAG metrics ───────────────────────────────────────────────────────────
    repobench = _load_json(_BENCH_RESULTS / "repobench_graph.json")
    repobench_naive = _load_json(_BENCH_RESULTS / "repobench_naive.json")
    internal  = _load_json(_BENCH_RESULTS / "rag_eval_results.json")

    def _rb(data, key):
        return data.get(key) if data else None

    rag = {
        "repobench": {
            "naive_recall_at_10": _rb(repobench_naive, "recall_at_10"),
            "graph_recall_at_10": _rb(repobench,       "recall_at_10"),
            "delta": (
                round(
                    _rb(repobench, "recall_at_10") - _rb(repobench_naive, "recall_at_10"), 2
                )
                if repobench and repobench_naive
                   and _rb(repobench, "recall_at_10") is not None
                   and _rb(repobench_naive, "recall_at_10") is not None
                else None
            ),
        },
        "internal": {
            "single_function": {
                "naive":    _rb(internal, "single_function_naive"),
                "graph":    _rb(internal, "single_function_graph"),
                "naive_ci": _rb(internal, "single_function_naive_ci"),
                "graph_ci": _rb(internal, "single_function_graph_ci"),
            },
            "cross_file": {
                "naive":    _rb(internal, "cross_file_naive"),
                "graph":    _rb(internal, "cross_file_graph"),
                "naive_ci": _rb(internal, "cross_file_naive_ci"),
                "graph_ci": _rb(internal, "cross_file_graph_ci"),
            },
            "call_chain": {
                "naive":    _rb(internal, "call_chain_naive"),
                "graph":    _rb(internal, "call_chain_graph"),
                "naive_ci": _rb(internal, "call_chain_naive_ci"),
                "graph_ci": _rb(internal, "call_chain_graph_ci"),
            },
        },
        "eval_date": _rb(internal, "eval_date"),
    }

    # ── System performance ────────────────────────────────────────────────────
    perf = _load_json(_BENCH_RESULTS / "performance.json")

    ingestion = {
        "avg_seconds_50k_loc": _rb(perf, "ingestion_avg_s") if perf else None,
        "p95_seconds_50k_loc": _rb(perf, "ingestion_p95_s") if perf else None,
        "test_repos": ["fastapi", "httpx", "celery"],
    }
    retrieval_latency = {
        "naive_p50_ms":      _rb(perf, "naive_p50_ms")  if perf else None,
        "naive_p95_ms":      _rb(perf, "naive_p95_ms")  if perf else None,
        "graph_p50_ms":      _rb(perf, "graph_p50_ms")  if perf else None,
        "graph_p95_ms":      _rb(perf, "graph_p95_ms")  if perf else None,
        "measurement_queries": 100,
    }

    return JSONResponse(content={
        "data": {
            "fine_tuning":        fine_tuning,
            "rag":                rag,
            "ingestion":          ingestion,
            "retrieval_latency":  retrieval_latency,
        },
        "error": None,
    })
