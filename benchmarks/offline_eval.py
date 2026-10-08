"""
Offline Evaluation Suite for Code Retrieval.

Measures Precision@K, Recall@K, Mean Reciprocal Rank (MRR), and Latency
across a golden evaluation dataset of code search queries.

Compares 4 retrieval paradigms:
1. Naive Dense Vector Retrieval (semantic similarity)
2. BM25Okapi Keyword Retrieval (lexical/symbol matching)
3. Hybrid Search (Dense + BM25 merged with RRF k=60)
4. Graph-Augmented RAG (Topological call-graph expansion)
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ast_chunker import default_ast_chunker, ASTChunk  # noqa: E402
from app.services.embedder import local_dense_embed, local_hash_embed  # noqa: E402
from app.services.graph import build_graph, expand_one_hop  # noqa: E402
from app.services.hybrid_search import BM25Okapi, reciprocal_rank_fusion  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_DATASET = ROOT_DIR / "benchmarks" / "data" / "golden_eval_dataset.json"
DEFAULT_OUTPUT = ROOT_DIR / "benchmarks" / "results" / "offline_eval_results.json"


@dataclass
class QueryEvalResult:
    query_id: str
    query: str
    category: str
    mode: str
    retrieved_symbols: list[str]
    expected_symbols: list[str]
    precision_at_k: dict[int, float]
    recall_at_k: dict[int, float]
    reciprocal_rank: float
    latency_ms: float


@dataclass
class ParadigmSummary:
    mode: str
    query_count: int
    mean_precision_at_1: float
    mean_precision_at_3: float
    mean_precision_at_5: float
    mean_precision_at_8: float
    mean_recall_at_1: float
    mean_recall_at_3: float
    mean_recall_at_5: float
    mean_recall_at_8: float
    mean_reciprocal_rank: float
    latency_p50_ms: float
    latency_p95_ms: float
    latency_mean_ms: float


class OfflineEvaluationHarness:
    """Evaluation runner comparing dense, BM25, hybrid, and graph retrieval."""

    def __init__(self, codebase_root: Optional[Path] = None) -> None:
        self.codebase_root = codebase_root or (BACKEND_DIR / "app")
        self.chunks: list[ASTChunk] = []
        self.bm25 = BM25Okapi()
        self.embeddings: dict[str, list[float]] = {}
        self.graph = None
        self._build_index()

    def _build_index(self) -> None:
        """Parse codebase files into AST chunks and construct BM25, vector, and graph indices."""
        all_chunks: list[ASTChunk] = []
        repo_id = "eval_repo"

        for py_path in sorted(self.codebase_root.glob("**/*.py")):
            try:
                rel_path = str(py_path.relative_to(ROOT_DIR))
            except ValueError:
                rel_path = py_path.name
            file_chunks = default_ast_chunker.chunk_file(py_path, repo_id, rel_path)
            all_chunks.extend(file_chunks)

        self.chunks = all_chunks
        doc_ids = [c.id for c in all_chunks]
        documents = [c.to_document() for c in all_chunks]
        metadatas = [c.to_metadata() for c in all_chunks]

        # 1. Build BM25 index
        self.bm25.index_documents(doc_ids, documents, metadatas)

        # 2. Build local dense embeddings (all-MiniLM-L6-v2 ONNX)
        logger.info("Computing dense embeddings for %d code chunks...", len(all_chunks))
        chunk_docs = [chunk.to_document() for chunk in all_chunks]
        dense_vecs = local_dense_embed(chunk_docs)
        for chunk, vec in zip(all_chunks, dense_vecs):
            self.embeddings[chunk.id] = vec

        # 3. Build NetworkX call graph
        self.graph = build_graph([c.to_graph_dict() for c in all_chunks])
        logger.info(
            "Evaluation index constructed: %d chunks, %d graph nodes, %d edges.",
            len(self.chunks),
            self.graph.number_of_nodes(),
            self.graph.number_of_edges(),
        )

    def _cosine_sim(self, v1: list[float], v2: list[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        return max(0.0, dot)

    def retrieve_dense(self, query: str, top_k: int = 8) -> tuple[list[ASTChunk], float]:
        t0 = time.perf_counter()
        q_vec = local_dense_embed([query])[0]
        scored: list[tuple[ASTChunk, float]] = []

        for chunk in self.chunks:
            chunk_vec = self.embeddings.get(chunk.id, [])
            if chunk_vec:
                sim = self._cosine_sim(q_vec, chunk_vec)
                scored.append((chunk, sim))

        scored.sort(key=lambda item: (-item[1], item[0].id))
        latency = (time.perf_counter() - t0) * 1000
        return [item[0] for item in scored[:top_k]], latency

    def retrieve_bm25(self, query: str, top_k: int = 8) -> tuple[list[ASTChunk], float]:
        t0 = time.perf_counter()
        ranked_hits = self.bm25.search(query, top_k=top_k)
        chunk_map = {c.id: c for c in self.chunks}
        results = [chunk_map[doc_id] for doc_id, _ in ranked_hits if doc_id in chunk_map]
        latency = (time.perf_counter() - t0) * 1000
        return results, latency

    def retrieve_hybrid_rrf(self, query: str, top_k: int = 8, k: int = 60, dense_weight: float = 1.0, bm25_weight: float = 1.0) -> tuple[list[ASTChunk], float]:
        t0 = time.perf_counter()
        # Dense ranking
        q_vec = local_dense_embed([query])[0]
        dense_scored = [
            (c.id, self._cosine_sim(q_vec, self.embeddings[c.id]))
            for c in self.chunks
            if c.id in self.embeddings
        ]
        dense_scored.sort(key=lambda x: -x[1])
        dense_ranked = dense_scored[:top_k * 2]

        # BM25 ranking
        bm25_ranked = self.bm25.search(query, top_k=top_k * 2)

        # Merge with Reciprocal Rank Fusion
        fused = reciprocal_rank_fusion([dense_ranked, bm25_ranked], k=k, weights=[dense_weight, bm25_weight])
        chunk_map = {c.id: c for c in self.chunks}
        results = [chunk_map[doc_id] for doc_id, _ in fused if doc_id in chunk_map]
        latency = (time.perf_counter() - t0) * 1000
        return results[:top_k], latency

    def retrieve_graph(self, query: str, top_k: int = 8) -> tuple[list[ASTChunk], float]:
        t0 = time.perf_counter()
        # Seed discovery via dense vector search
        seeds, _ = self.retrieve_dense(query, top_k=5)
        seed_ids = [s.id for s in seeds]

        # Graph 1-hop expansion
        neighbour_ids = expand_one_hop(self.graph, seed_ids)
        chunk_map = {c.id: c for c in self.chunks}

        seen = set(seed_ids)
        combined: list[ASTChunk] = list(seeds)
        for nid in sorted(neighbour_ids):
            if nid not in seen and nid in chunk_map:
                seen.add(nid)
                combined.append(chunk_map[nid])

        latency = (time.perf_counter() - t0) * 1000
        return combined[:top_k], latency

    def evaluate_query(
        self,
        query_item: dict[str, Any],
        mode: str,
        k_values: tuple[int, ...] = (1, 3, 5, 8),
    ) -> QueryEvalResult:
        query_text = query_item["query"]
        expected_symbols = set(query_item["expected_symbols"])

        if mode == "dense":
            chunks, latency = self.retrieve_dense(query_text, top_k=max(k_values))
        elif mode == "bm25":
            chunks, latency = self.retrieve_bm25(query_text, top_k=max(k_values))
        elif mode == "hybrid":
            chunks, latency = self.retrieve_hybrid_rrf(query_text, top_k=max(k_values), k=60)
        elif mode == "graph":
            chunks, latency = self.retrieve_graph(query_text, top_k=max(k_values))
        else:
            raise ValueError(f"Unknown retrieval mode: {mode}")

        retrieved_symbols = [c.name.split(".")[-1] for c in chunks]

        # Compute Precision@K and Recall@K
        precision_at_k: dict[int, float] = {}
        recall_at_k: dict[int, float] = {}

        for k in k_values:
            slice_symbols = set(retrieved_symbols[:k])
            hits = len(slice_symbols & expected_symbols)
            precision_at_k[k] = hits / k if k > 0 else 0.0
            recall_at_k[k] = hits / len(expected_symbols) if expected_symbols else 0.0

        # Compute Reciprocal Rank (RR)
        rr = 0.0
        for rank_idx, sym in enumerate(retrieved_symbols, start=1):
            if sym in expected_symbols:
                rr = 1.0 / rank_idx
                break

        return QueryEvalResult(
            query_id=query_item["query_id"],
            query=query_text,
            category=query_item.get("category", "general"),
            mode=mode,
            retrieved_symbols=retrieved_symbols,
            expected_symbols=list(expected_symbols),
            precision_at_k=precision_at_k,
            recall_at_k=recall_at_k,
            reciprocal_rank=rr,
            latency_ms=latency,
        )

    def run_benchmark(
        self,
        dataset_path: Path,
        modes: tuple[str, ...] = ("dense", "bm25", "hybrid", "graph"),
    ) -> tuple[dict[str, list[QueryEvalResult]], dict[str, ParadigmSummary]]:
        with open(dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        queries = data.get("queries", [])

        results_by_mode: dict[str, list[QueryEvalResult]] = {m: [] for m in modes}
        summaries: dict[str, ParadigmSummary] = {}

        for mode in modes:
            for q in queries:
                res = self.evaluate_query(q, mode=mode)
                results_by_mode[mode].append(res)

            q_results = results_by_mode[mode]
            n = len(q_results)

            latencies = sorted(r.latency_ms for r in q_results)
            p50 = latencies[int(n * 0.50)] if latencies else 0.0
            p95 = latencies[min(n - 1, int(n * 0.95))] if latencies else 0.0
            mean_lat = sum(latencies) / n if n > 0 else 0.0

            summary = ParadigmSummary(
                mode=mode,
                query_count=n,
                mean_precision_at_1=round(sum(r.precision_at_k[1] for r in q_results) / n, 4),
                mean_precision_at_3=round(sum(r.precision_at_k[3] for r in q_results) / n, 4),
                mean_precision_at_5=round(sum(r.precision_at_k[5] for r in q_results) / n, 4),
                mean_precision_at_8=round(sum(r.precision_at_k[8] for r in q_results) / n, 4),
                mean_recall_at_1=round(sum(r.recall_at_k[1] for r in q_results) / n, 4),
                mean_recall_at_3=round(sum(r.recall_at_k[3] for r in q_results) / n, 4),
                mean_recall_at_5=round(sum(r.recall_at_k[5] for r in q_results) / n, 4),
                mean_recall_at_8=round(sum(r.recall_at_k[8] for r in q_results) / n, 4),
                mean_reciprocal_rank=round(sum(r.reciprocal_rank for r in q_results) / n, 4),
                latency_p50_ms=round(p50, 2),
                latency_p95_ms=round(p95, 2),
                latency_mean_ms=round(mean_lat, 2),
            )
            summaries[mode] = summary

        return results_by_mode, summaries


def print_ascii_table(summaries: dict[str, ParadigmSummary]) -> None:
    """Print clean ASCII summary table without emojis."""
    header = (
        "+-----------------------+----------+----------+----------+----------+--------+-------------------+\n"
        "| Retrieval Paradigm    | P@1      | P@5      | R@5      | R@8      | MRR    | Latency (p50/p95) |\n"
        "+-----------------------+----------+----------+----------+----------+--------+-------------------+"
    )
    print(header)
    for mode, s in summaries.items():
        name_map = {
            "dense": "Dense Vector Only",
            "bm25": "BM25 Keyword Only",
            "hybrid": "Hybrid (Dense+BM25 RRF)",
            "graph": "Graph-Augmented RAG",
        }
        display_name = name_map.get(mode, mode).ljust(21)
        p1 = f"{s.mean_precision_at_1 * 100:.1f}%".rjust(8)
        p5 = f"{s.mean_precision_at_5 * 100:.1f}%".rjust(8)
        r5 = f"{s.mean_recall_at_5 * 100:.1f}%".rjust(8)
        r8 = f"{s.mean_recall_at_8 * 100:.1f}%".rjust(8)
        mrr = f"{s.mean_reciprocal_rank:.4f}".rjust(6)
        lat = f"{s.latency_p50_ms:.1f}ms / {s.latency_p95_ms:.1f}ms".rjust(17)
        print(f"| {display_name} | {p1} | {p5} | {r5} | {r8} | {mrr} | {lat} |")
    print("+-----------------------+----------+----------+----------+----------+--------+-------------------+")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CodeSage offline retrieval evaluation suite.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET, help="Path to golden dataset")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output path for benchmark results")
    args = parser.parse_args()

    logger.info("Initializing CodeSage Offline Evaluation Harness...")
    harness = OfflineEvaluationHarness()

    logger.info("Evaluating golden queries from %s...", args.dataset)
    results_by_mode, summaries = harness.run_benchmark(args.dataset)

    print("\n======================= CODESAGE RETRIEVAL EVALUATION RESULTS =======================")
    print_ascii_table(summaries)
    print("=====================================================================================\n")

    # Save results to output
    args.output.parent.mkdir(parents=True, exist_ok=True)
    serializable = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset": str(args.dataset),
        "summaries": {k: asdict(v) for k, v in summaries.items()},
        "query_evaluations": {
            mode: [asdict(r) for r in q_list]
            for mode, q_list in results_by_mode.items()
        },
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(serializable, f, indent=2)
    logger.info("Detailed benchmark evaluation saved to %s", args.output)


if __name__ == "__main__":
    main()
