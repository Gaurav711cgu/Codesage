"""
Retrieval tracer service — per-query observability and structured trace logging.
"""
from dataclasses import dataclass, field
import hashlib
import logging
from typing import Literal

logger = logging.getLogger("codesagez.retrieval")


@dataclass
class RetrievalTrace:
    query: str
    repo_id: str
    mode: Literal["naive", "graph"]
    seed_count: int
    neighbour_count: int
    final_count: int
    latency_ms: int
    embedding_provider: str
    graph_nodes: int = 0
    graph_edges: int = 0
    top_scores: list[float] = field(default_factory=list)
    exact_symbol_hit: bool = False


class RetrievalTracer:
    """Emits structured log and trace events for every retrieval invocation."""

    def record(self, trace: RetrievalTrace) -> None:
        query_hash = hashlib.md5(trace.query.encode("utf-8")).hexdigest()[:8]
        top_score = max(trace.top_scores) if trace.top_scores else 0.0

        logger.info(
            "retrieval_event repo_id=%s mode=%s seeds=%d neighbours=%d final=%d latency=%dms top_score=%.4f symbol_hit=%s provider=%s query_hash=%s",
            trace.repo_id,
            trace.mode,
            trace.seed_count,
            trace.neighbour_count,
            trace.final_count,
            trace.latency_ms,
            top_score,
            trace.exact_symbol_hit,
            trace.embedding_provider,
            query_hash,
            extra={
                "query_hash": query_hash,
                "repo_id": trace.repo_id,
                "mode": trace.mode,
                "seed_count": trace.seed_count,
                "neighbour_count": trace.neighbour_count,
                "final_count": trace.final_count,
                "latency_ms": trace.latency_ms,
                "exact_symbol_hit": trace.exact_symbol_hit,
                "top_score": top_score,
                "embedding_provider": trace.embedding_provider,
                "graph_nodes": trace.graph_nodes,
                "graph_edges": trace.graph_edges,
            },
        )


tracer = RetrievalTracer()
