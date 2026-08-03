"""
RepoBench-R Self-Contained Evaluation Script
=============================================
Downloads RepoBench-R python_cfr (cross-file retrieval) test_easy split
from HuggingFace parquet, then runs retrieval evaluation against the
CodeSageZ backend OR as a standalone embedding-based ranker.

Dataset format:
  - context: list of candidate code snippets
  - gold_snippet_index: index of the correct snippet in context
  - code: the code block needing cross-file context
  - import_statement: imports in the current file
  - next_line: the next line to be predicted

Metric: Recall@K — is the gold snippet within the top-K retrieved?

Run modes:
  1. backend  — queries the running CodeSageZ FastAPI backend
  2. local    — uses TF-IDF cosine similarity as a standalone baseline

Usage:
  python benchmarks/eval_repobench_standalone.py --mode local --max_queries 500
  python benchmarks/eval_repobench_standalone.py --mode backend --max_queries 200 \\
      --backend_url http://localhost:8000 --repo_id <uuid>
"""
import argparse
import json
import logging
import math
import os
import re
import time
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

PARQUET_URL = (
    "https://huggingface.co/api/datasets/tianyang/repobench-r"
    "/parquet/python_cfr/test_easy/0.parquet"
)
PARQUET_CACHE = Path("/tmp/repobench/test_easy.parquet")


# ─── TF-IDF Helpers ──────────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z_]\w*", text.lower())


def build_tfidf(corpus: list[str]) -> tuple[list[dict], dict]:
    """Return (tf_list, idf_dict)."""
    N = len(corpus)
    df: Counter = Counter()
    tfs = []
    for doc in corpus:
        tokens = tokenize(doc)
        tf: Counter = Counter(tokens)
        total = sum(tf.values()) or 1
        tfs.append({t: c / total for t, c in tf.items()})
        df.update(set(tokens))
    idf = {t: math.log((N + 1) / (c + 1)) + 1 for t, c in df.items()}
    return tfs, idf


def tfidf_vec(tf: dict, idf: dict) -> dict:
    return {t: tf.get(t, 0) * idf.get(t, 0) for t in idf}


def cosine(a: dict, b: dict) -> float:
    keys = set(a) & set(b)
    dot = sum(a[k] * b[k] for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb + 1e-9)


def rank_candidates_tfidf(query: str, candidates: list[str]) -> list[int]:
    """Return candidate indices sorted by TF-IDF cosine similarity (desc)."""
    corpus = [query] + candidates
    tfs, idf = build_tfidf(corpus)
    q_vec = tfidf_vec(tfs[0], idf)
    scores = [
        (i, cosine(q_vec, tfidf_vec(tfs[i + 1], idf)))
        for i in range(len(candidates))
    ]
    scores.sort(key=lambda x: x[1], reverse=True)
    return [s[0] for s in scores]


# ─── Backend Query Helper ─────────────────────────────────────────────────────

def backend_retrieve(backend_url: str, repo_id: str, query: str, mode: str) -> list[str]:
    """Query the CodeSageZ backend and return retrieved chunk names."""
    url = f"{backend_url}/api/v1/repo/query"
    payload = {"repo_id": repo_id, "query": query, "retrieval_mode": mode}
    chunks = []
    try:
        with requests.post(url, json=payload, stream=True, timeout=30) as resp:
            resp.raise_for_status()
            for raw_line in resp.iter_lines(decode_unicode=True):
                if raw_line.startswith("data: ") and "chunks" in raw_line:
                    data = json.loads(raw_line[6:])
                    chunks = [c.get("content", "") for c in data.get("chunks", [])]
                    break
    except Exception as exc:
        logger.warning("Backend query failed: %s", exc)
    return chunks


def rank_candidates_backend(
    backend_url: str, repo_id: str, query: str,
    candidates: list[str], mode: str
) -> list[int]:
    """
    Rank candidates using CodeSageZ backend:
    retrieve context, then score each candidate by cosine similarity to retrieved chunks.
    """
    retrieved = backend_retrieve(backend_url, repo_id, query, mode)
    retrieved_text = " ".join(retrieved)
    return rank_candidates_tfidf(retrieved_text or query, candidates)


# ─── Main Evaluation Loop ─────────────────────────────────────────────────────

def load_dataset() -> list[dict]:
    if not PARQUET_CACHE.exists():
        logger.info("Downloading RepoBench-R test_easy parquet…")
        PARQUET_CACHE.parent.mkdir(parents=True, exist_ok=True)
        resp = requests.get(PARQUET_URL, timeout=120, stream=True)
        resp.raise_for_status()
        with open(PARQUET_CACHE, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("Downloaded to %s", PARQUET_CACHE)
    else:
        logger.info("Using cached parquet at %s", PARQUET_CACHE)

    tbl = pq.read_table(str(PARQUET_CACHE))
    raw = tbl.to_pydict()
    n = len(raw[list(raw.keys())[0]])
    rows = [{k: raw[k][i] for k in raw} for i in range(n)]
    return rows


def evaluate(args: argparse.Namespace) -> dict:
    rows = load_dataset()
    if args.max_queries:
        rows = rows[: args.max_queries]

    logger.info(
        "Evaluating %d queries | mode=%s", len(rows), args.mode
    )

    recall_1, recall_5, recall_10 = [], [], []
    latencies = []
    skipped = 0

    for i, row in enumerate(rows):
        candidates: list[str] = row["context"]
        gold_idx: int = row["gold_snippet_index"]
        query = row["code"] + "\n" + row.get("import_statement", "")

        if not candidates or gold_idx >= len(candidates):
            skipped += 1
            continue

        t0 = time.perf_counter()

        if args.mode == "local":
            ranked = rank_candidates_tfidf(query, candidates)
        else:
            ranked = rank_candidates_backend(
                args.backend_url, args.repo_id, query, candidates, args.mode
            )

        latency_ms = int((time.perf_counter() - t0) * 1000)
        latencies.append(latency_ms)

        recall_1.append(int(gold_idx in ranked[:1]))
        recall_5.append(int(gold_idx in ranked[:5]))
        recall_10.append(int(gold_idx in ranked[:10]))

        if (i + 1) % 100 == 0 or i == len(rows) - 1:
            n = len(recall_5)
            logger.info(
                "Progress %d/%d  R@1=%.1f%%  R@5=%.1f%%  R@10=%.1f%%",
                i + 1, len(rows),
                sum(recall_1) / n * 100,
                sum(recall_5) / n * 100,
                sum(recall_10) / n * 100,
            )

    n = len(recall_5)
    if n == 0:
        raise RuntimeError("No valid queries evaluated")

    sorted_lat = sorted(latencies)
    result = {
        "mode":           args.mode,
        "num_queries":    n,
        "skipped":        skipped,
        "recall_at_1":    round(sum(recall_1) / n * 100, 2),
        "recall_at_5":    round(sum(recall_5) / n * 100, 2),
        "recall_at_10":   round(sum(recall_10) / n * 100, 2),
        "latency_p50_ms": sorted_lat[n // 2],
        "latency_p95_ms": sorted_lat[int(n * 0.95)],
    }

    logger.info("=== RepoBench-R Results ===")
    for k, v in result.items():
        logger.info("  %-20s %s", k, v)

    return result


def main():
    parser = argparse.ArgumentParser(description="RepoBench-R standalone evaluation")
    parser.add_argument(
        "--mode", required=True,
        choices=["local", "graph", "naive", "2hop"],
        help="'local'=TF-IDF baseline (no backend), 'graph'/'naive'/'2hop'=CodeSageZ backend",
    )
    parser.add_argument(
        "--backend_url", default="http://localhost:8000",
        help="CodeSageZ backend URL (needed for graph/naive/2hop modes)",
    )
    parser.add_argument(
        "--repo_id", default=None,
        help="Indexed repo UUID in CodeSageZ (needed for graph/naive/2hop modes)",
    )
    parser.add_argument(
        "--max_queries", type=int, default=None,
        help="Limit number of queries (default: all 4000)",
    )
    parser.add_argument(
        "--output", default=None,
        help="Output JSON file path (default: benchmarks/results/repobench_<mode>.json)",
    )
    args = parser.parse_args()

    if args.mode != "local" and not args.repo_id:
        parser.error("--repo_id is required for backend modes (graph/naive/2hop)")

    result = evaluate(args)

    out_path = Path(
        args.output or f"benchmarks/results/repobench_{args.mode}.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2))
    logger.info("Results written to %s", out_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
