"""
RepoBench-R retrieval evaluation.

Measures Recall@5 and Recall@10 for both naive and graph-augmented retrieval
on the RepoBench-R task (retrieve correct cross-file context given a code line).

Run after the system is fully deployed and repos are indexed:

  python training/eval_repobench.py \
      --retrieval_mode naive \
      --output benchmarks/results/repobench_naive.json

  python training/eval_repobench.py \
      --retrieval_mode graph \
      --output benchmarks/results/repobench_graph.json

Requires: pip install repobench requests
The backend must be running at BACKEND_URL (default http://localhost:8000).
"""

import argparse
import json
import logging
import os
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def get_indexed_repos() -> list[dict]:
    resp = requests.get(f"{BACKEND_URL}/api/v1/repos", timeout=10)
    resp.raise_for_status()
    return [r for r in resp.json()["data"] if r["status"] == "complete"]


def query_retrieval(repo_id: str, query: str, mode: str) -> list[dict]:
    """
    Hit the query endpoint with SSE and collect only the retrieval_done event.
    Parses SSE manually (text/event-stream).
    """
    url = f"{BACKEND_URL}/api/v1/repo/query"
    payload = {"repo_id": repo_id, "query": query, "retrieval_mode": mode}

    chunks = []
    try:
        with requests.post(url, json=payload, stream=True, timeout=30) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines(decode_unicode=True):
                if raw_line.startswith("event: retrieval_done"):
                    continue
                if raw_line.startswith("data: ") and "chunks" in raw_line:
                    data = json.loads(raw_line[6:])
                    chunks = data.get("chunks", [])
                    break   # we only need retrieval_done, skip LLM tokens
    except Exception as exc:
        logger.warning("Query failed: %s", exc)
    return chunks


def recall_at_k(retrieved_ids: list[str], gold_id: str, k: int) -> int:
    return int(gold_id in retrieved_ids[:k])


def main():
    parser = argparse.ArgumentParser(description="RepoBench-R evaluation")
    parser.add_argument("--retrieval_mode", required=True,
                        choices=["naive", "graph"])
    parser.add_argument("--output", required=True)
    parser.add_argument("--max_queries", type=int, default=None,
                        help="Limit queries for testing (default: all)")
    args = parser.parse_args()

    try:
        from repobench.data import get_repobench_data
    except ImportError:
        raise SystemExit(
            "repobench not installed. Run: pip install repobench\n"
            "See: https://github.com/Leolty/repobench"
        )

    # Load RepoBench-R cross-file Python tasks
    logger.info("Loading RepoBench-R data…")
    rb_data = get_repobench_data(
        task="retrieval",
        language="python",
        level="cross_file_first",
    )

    repos = get_indexed_repos()
    if not repos:
        raise SystemExit(
            "No indexed repos found. Index at least one repo first via "
            f"POST {BACKEND_URL}/api/v1/repo/ingest"
        )
    logger.info("Using indexed repo: %s (id: %s)", repos[0]["name"], repos[0]["id"])
    repo_id = repos[0]["id"]

    queries = rb_data if args.max_queries is None else rb_data[:args.max_queries]
    logger.info("Evaluating %d queries (mode: %s)…", len(queries), args.retrieval_mode)

    recall_5_scores:  list[int] = []
    recall_10_scores: list[int] = []
    latencies:        list[int] = []

    for i, item in enumerate(queries):
        query      = item.get("query_line", item.get("code_line", ""))
        gold_file  = item.get("gold_file", "")
        gold_func  = item.get("gold_function", "")
        gold_id    = f"{repo_id}::{gold_file}::{gold_func}" if gold_func else gold_file

        t0 = time.perf_counter()
        chunks = query_retrieval(repo_id, query, args.retrieval_mode)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        latencies.append(latency_ms)

        retrieved_ids = [c.get("name", "") for c in chunks]

        # Also check file-level match (some queries are file-granularity)
        retrieved_files = [c.get("file", "") for c in chunks]
        hit5  = recall_at_k(retrieved_ids, gold_func, 5)  or \
                (gold_file in retrieved_files[:5])
        hit10 = recall_at_k(retrieved_ids, gold_func, 10) or \
                (gold_file in retrieved_files[:10])

        recall_5_scores.append(int(hit5))
        recall_10_scores.append(int(hit10))

        if (i + 1) % 50 == 0:
            r5  = sum(recall_5_scores)  / len(recall_5_scores)  * 100
            r10 = sum(recall_10_scores) / len(recall_10_scores) * 100
            logger.info("Progress %d/%d  R@5=%.1f%%  R@10=%.1f%%",
                        i + 1, len(queries), r5, r10)

    n = len(queries)
    recall_5  = round(sum(recall_5_scores)  / n * 100, 2)
    recall_10 = round(sum(recall_10_scores) / n * 100, 2)
    p50_ms = sorted(latencies)[n // 2]
    p95_ms = sorted(latencies)[int(n * 0.95)]

    logger.info("=== RepoBench-R Results ===")
    logger.info("Mode:       %s", args.retrieval_mode)
    logger.info("Recall@5:   %.2f%%", recall_5)
    logger.info("Recall@10:  %.2f%%", recall_10)
    logger.info("Latency p50: %dms  p95: %dms", p50_ms, p95_ms)

    output = {
        "retrieval_mode": args.retrieval_mode,
        "num_queries":    n,
        "recall_at_5":    recall_5,
        "recall_at_10":   recall_10,
        "latency_p50_ms": p50_ms,
        "latency_p95_ms": p95_ms,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2))
    logger.info("Results saved to %s", out_path)


if __name__ == "__main__":
    main()
