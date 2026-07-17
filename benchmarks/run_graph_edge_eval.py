"""Measure graph expansion on real caller-to-callee edges from indexed repos."""

from __future__ import annotations

import json
import hashlib
import argparse
import sqlite3
import statistics
import sys
import time
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.services import graph as graph_svc, retrieval  # noqa: E402


DB_PATH = BACKEND / "app.db"
OUT_PATH = ROOT / "benchmarks" / "results" / "graph_edge_eval_results.json"
MAX_EDGES_PER_REPO = 40
TARGET_REPOS = {"fastapi", "httpx", "celery"}


def wilson_ci(hits: int, n: int) -> str:
    z = 1.96
    p = hits / n
    denominator = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    margin = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / denominator
    low = max(0.0, round((center - margin) * 100, 1))
    high = min(100.0, round((center + margin) * 100, 1))
    return f"{low}-{high}"


def load_repos() -> list[tuple[str, str, str]]:
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "select name, id, graph_data from repos where status = 'complete'"
        ).fetchall()
    repos = [
        (name, str(uuid.UUID(hex=raw_id.replace("-", ""))), graph_data)
        for name, raw_id, graph_data in rows
        if name.lower() in TARGET_REPOS
    ]
    found = {name.lower() for name, _, _ in repos}
    missing = TARGET_REPOS - found
    if missing:
        raise SystemExit(f"Missing completed benchmark repositories: {', '.join(sorted(missing))}")
    return repos


def percentile(values: list[int], p: float) -> int:
    return sorted(values)[max(0, int(len(values) * p) - 1)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT_PATH)
    args = parser.parse_args()

    rows: list[dict] = []
    latencies = {"naive": [], "graph": []}

    for repo_name, repo_id, graph_data in load_repos():
        graph = graph_svc.get_graph(repo_id, graph_data)
        edges = [
            (source, target)
            for source, target in graph.edges
            if graph.nodes[source].get("name") and graph.nodes[target].get("name")
        ]
        edges.sort(key=lambda edge: hashlib.sha256(
            f"{repo_name}:{edge[0]}:{edge[1]}".encode()
        ).hexdigest())
        edges = edges[:MAX_EDGES_PER_REPO]

        for source, target in edges:
            source_name = graph.nodes[source]["name"]
            target_name = graph.nodes[target]["name"]
            question = f"Which function is directly called by `{source_name}`?"
            result = {"repo": repo_name, "source": source_name, "target": target_name}
            for mode in ("naive", "graph"):
                chunks, latency_ms = retrieval.retrieve(repo_id, question, mode, graph_data)
                result[f"{mode}_hit_at_8"] = int(any(chunk.name == target_name for chunk in chunks[:8]))
                result[f"{mode}_latency_ms"] = latency_ms
                latencies[mode].append(latency_ms)
            rows.append(result)

    def recall(mode: str) -> float:
        return round(100 * sum(row[f"{mode}_hit_at_8"] for row in rows) / len(rows), 1)

    naive_hits = sum(row["naive_hit_at_8"] for row in rows)
    graph_hits = sum(row["graph_hit_at_8"] for row in rows)
    output = {
        "eval_date": time.strftime("%Y-%m-%d"),
        "metric": "direct_callee_recall_at_8",
        "description": "For each real parsed caller-to-callee edge, retrieve context from a question naming the caller and check whether the actual direct callee appears in the top 8 chunks.",
        "repos": sorted({row["repo"] for row in rows}),
        "num_real_edges": len(rows),
        "naive_recall_at_8": recall("naive"),
        "naive_recall_at_8_ci": wilson_ci(naive_hits, len(rows)),
        "graph_recall_at_8": recall("graph"),
        "graph_recall_at_8_ci": wilson_ci(graph_hits, len(rows)),
        "delta_percentage_points": round(recall("graph") - recall("naive"), 1),
        "naive_p50_ms": int(statistics.median(latencies["naive"])),
        "naive_p95_ms": percentile(latencies["naive"], 0.95),
        "graph_p50_ms": int(statistics.median(latencies["graph"])),
        "graph_p95_ms": percentile(latencies["graph"], 0.95),
        "raw_results": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2))
    print(json.dumps({key: value for key, value in output.items() if key != "raw_results"}, indent=2))


if __name__ == "__main__":
    main()
