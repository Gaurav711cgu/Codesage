"""
Retrieval service — naive and graph-augmented modes.

Naive:
  Embed query → ChromaDB top-5 → return as-is.

Graph-augmented:
  Embed query → ChromaDB top-5 seeds →
  Load NetworkX graph → expand 1-hop (successors + predecessors) →
  Fetch neighbour docs from ChromaDB by ID →
  Re-score with:
      seed score     = 0.6 × vector_similarity + 0.4 × 1.0
      neighbour score = 0.6 × 0.0             + 0.4 × 0.5
  Sort, deduplicate, take top-8.
"""
import logging
import time
from dataclasses import dataclass, field

from app.models.schemas import RetrievedChunk
from app.services import chromadb_client, graph as graph_svc
from app.services.gemini import embed_query

logger = logging.getLogger(__name__)

# Score weights (PRD §3.3)
_W_VECTOR = 0.6
_W_GRAPH  = 0.4
_SEED_GRAPH_SCORE     = 1.0
_NEIGHBOUR_GRAPH_SCORE = 0.5

TOP_SEEDS      = 5
TOP_FINAL      = 8
GRAPH_TOP_FINAL = 8


@dataclass
class _RankedChunk:
    id: str
    name: str
    file: str
    lines: list[int]
    chunk_type: str   # "seed" | "neighbor"
    vector_sim: float
    final_score: float = field(default=0.0)


def _cosine_distance_to_similarity(distance: float) -> float:
    """ChromaDB returns cosine distance (0=identical, 2=opposite). Convert to [0,1]."""
    return max(0.0, 1.0 - distance)


def _parse_chroma_results(
    result: dict,
    chunk_type: str,
) -> list[_RankedChunk]:
    """Flatten ChromaDB query result into _RankedChunk list."""
    chunks: list[_RankedChunk] = []
    if not result.get("ids") or not result["ids"][0]:
        return chunks

    ids       = result["ids"][0]
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[0.0] * len(ids)])[0]

    for doc_id, meta, dist in zip(ids, metadatas, distances):
        sim = _cosine_distance_to_similarity(dist)
        lines_raw = meta.get("start_line", 0)
        end_raw   = meta.get("end_line", 0)
        chunks.append(
            _RankedChunk(
                id=doc_id,
                name=meta.get("name", ""),
                file=meta.get("file", ""),
                lines=[int(lines_raw), int(end_raw)],
                chunk_type=chunk_type,
                vector_sim=sim,
            )
        )
    return chunks


def retrieve_naive(
    repo_id: str,
    query_embedding: list[float],
    n_results: int = TOP_SEEDS,
) -> tuple[list[RetrievedChunk], int]:
    """
    Naive vector retrieval from the _functions collection.
    Returns (chunks, latency_ms).
    """
    t0 = time.perf_counter()
    result = chromadb_client.query_collection(
        repo_id, "_functions", query_embedding, n_results=n_results
    )
    ranked = _parse_chroma_results(result, "seed")

    chunks = [
        RetrievedChunk(
            name=r.name,
            file=r.file,
            lines=r.lines,
            type="seed",
            score=round(r.vector_sim, 4),
        )
        for r in ranked
    ]
    latency = int((time.perf_counter() - t0) * 1000)
    return chunks, latency


def retrieve_graph_augmented(
    repo_id: str,
    query_embedding: list[float],
    graph_data_json: str | None = None,
) -> tuple[list[RetrievedChunk], int]:
    """
    Graph-augmented retrieval.
    graph_data_json is only needed on first call after a server restart;
    subsequent calls use the module-level cache.
    Returns (chunks, latency_ms).
    """
    t0 = time.perf_counter()

    # Step 1 — vector seeds
    seed_result = chromadb_client.query_collection(
        repo_id, "_functions", query_embedding, n_results=TOP_SEEDS
    )
    seeds = _parse_chroma_results(seed_result, "seed")

    if not seeds:
        return [], int((time.perf_counter() - t0) * 1000)

    seed_ids = [s.id for s in seeds]

    # Score seeds
    for s in seeds:
        s.final_score = _W_VECTOR * s.vector_sim + _W_GRAPH * _SEED_GRAPH_SCORE

    # Step 2 — graph expansion
    try:
        G = graph_svc.get_graph(repo_id, graph_data_json)
        neighbour_ids = list(graph_svc.expand_one_hop(G, seed_ids))
    except Exception as exc:
        logger.warning("Graph expansion failed, falling back to naive: %s", exc)
        return retrieve_naive(repo_id, query_embedding, TOP_FINAL)

    # Step 3 — fetch neighbour documents by ID (no vector search needed)
    neighbour_chunks: list[_RankedChunk] = []
    if neighbour_ids:
        get_result = chromadb_client.get_documents_by_ids(
            repo_id, "_functions", neighbour_ids
        )
        ids       = get_result.get("ids", [])
        metadatas = get_result.get("metadatas", [])
        for doc_id, meta in zip(ids, metadatas):
            neighbour_chunks.append(
                _RankedChunk(
                    id=doc_id,
                    name=meta.get("name", ""),
                    file=meta.get("file", ""),
                    lines=[int(meta.get("start_line", 0)), int(meta.get("end_line", 0))],
                    chunk_type="neighbor",
                    vector_sim=0.0,
                    final_score=_W_VECTOR * 0.0 + _W_GRAPH * _NEIGHBOUR_GRAPH_SCORE,
                )
            )

    # Step 4 — merge, deduplicate, sort, top-8
    seen: set[str] = set(seed_ids)
    all_chunks = list(seeds)
    for nc in neighbour_chunks:
        if nc.id not in seen:
            seen.add(nc.id)
            all_chunks.append(nc)

    all_chunks.sort(key=lambda c: c.final_score, reverse=True)
    top = all_chunks[:GRAPH_TOP_FINAL]

    chunks = [
        RetrievedChunk(
            name=r.name,
            file=r.file,
            lines=r.lines,
            type=r.chunk_type,  # type: ignore[arg-type]
            score=round(r.final_score, 4),
        )
        for r in top
    ]
    latency = int((time.perf_counter() - t0) * 1000)
    return chunks, latency


def retrieve(
    repo_id: str,
    query: str,
    mode: str = "graph",
    graph_data_json: str | None = None,
) -> tuple[list[RetrievedChunk], int]:
    """
    High-level retrieval entry point used by the query API route.
    Embeds the query, dispatches to the correct strategy.
    """
    query_embedding = embed_query(query)
    if mode == "graph":
        return retrieve_graph_augmented(repo_id, query_embedding, graph_data_json)
    return retrieve_naive(repo_id, query_embedding)
