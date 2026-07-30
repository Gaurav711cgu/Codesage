"""
Retrieval service — naive and graph-augmented modes with verification and tracing.

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
import re
import time
from dataclasses import dataclass, field

from app.models.schemas import RetrievedChunk
from app.services import chromadb_client, graph as graph_svc
from app.services.embedder import _get_provider, embed_query
from app.services.retrieval_tracer import RetrievalTrace, tracer
from app.services.retrieval_verifier import verifier

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
    content: str = ""
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

    for doc_id, document, meta, dist in zip(ids, documents, metadatas, distances):
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
                content=document or "",
            )
        )
    return chunks


def _symbol_candidates(repo_id: str, query_text: str) -> list[_RankedChunk]:
    """Find functions named explicitly in the query."""
    query_names = {
        token
        for token in re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b", query_text)
        if "_" in token or "." in token
    }
    query_names.update(
        token
        for token in re.findall(r"`([A-Za-z_][A-Za-z0-9_.]*)`", query_text)
    )
    if not query_names:
        return []

    candidates: list[_RankedChunk] = []
    seen: set[str] = set()
    for query_name in sorted(query_names)[:8]:
        result = chromadb_client.get_documents_by_metadata(
            repo_id, "_functions", {"name": query_name}
        )
        if not isinstance(result, dict):
            continue
        for doc_id, document, meta in zip(
            result.get("ids", []),
            result.get("documents", []),
            result.get("metadatas", []),
        ):
            if doc_id in seen:
                continue
            seen.add(doc_id)
            candidates.append(
                _RankedChunk(
                    id=doc_id,
                    name=str(meta.get("name", "")),
                    file=str(meta.get("file", "")),
                    lines=[int(meta.get("start_line", 0)), int(meta.get("end_line", 0))],
                    chunk_type="seed",
                    vector_sim=1.0,
                    content=document or "",
                )
            )
    return candidates


def _retrieve_seeds(repo_id: str, query_text: str, n_results: int) -> tuple[list[_RankedChunk], bool]:
    """Merge exact-symbol hits with vector search. Returns (seeds, exact_symbol_hit_flag)."""
    query_vec = embed_query(query_text)
    result = chromadb_client.query_collection(
        repo_id, "_functions", query_embedding=query_vec, n_results=n_results
    )
    vector_hits = sorted(
        _parse_chroma_results(result, "seed"),
        key=lambda chunk: (-chunk.vector_sim, chunk.id),
    )
    exact_hits = sorted(_symbol_candidates(repo_id, query_text), key=lambda chunk: chunk.id)

    if exact_hits:
        return exact_hits[:n_results], True

    return vector_hits[:n_results], False


def retrieve_naive(
    repo_id: str,
    query_text: str,
    n_results: int = TOP_SEEDS,
) -> tuple[list[RetrievedChunk], int]:
    """Naive vector retrieval from the _functions collection. Returns (chunks, latency_ms)."""
    t0 = time.perf_counter()
    ranked, exact_hit = _retrieve_seeds(repo_id, query_text, n_results)

    chunks = [
        RetrievedChunk(
            name=r.name,
            file=r.file,
            lines=r.lines,
            type="seed",
            score=round(r.vector_sim, 4),
            content=r.content,
        )
        for r in ranked
    ]
    latency = int((time.perf_counter() - t0) * 1000)

    tracer.record(
        RetrievalTrace(
            query=query_text,
            repo_id=repo_id,
            mode="naive",
            seed_count=len(chunks),
            neighbour_count=0,
            final_count=len(chunks),
            latency_ms=latency,
            embedding_provider=_get_provider(),
            top_scores=[c.score for c in chunks],
            exact_symbol_hit=exact_hit,
        )
    )
    return chunks, latency


def retrieve_graph_augmented(
    repo_id: str,
    query_text: str,
    graph_data_json: str | None = None,
) -> tuple[list[RetrievedChunk], int]:
    """Graph-augmented retrieval. Returns (chunks, latency_ms)."""
    t0 = time.perf_counter()

    # Step 1 — vector seeds
    seeds, exact_hit = _retrieve_seeds(repo_id, query_text, TOP_SEEDS)

    if not seeds:
        latency = int((time.perf_counter() - t0) * 1000)
        tracer.record(
            RetrievalTrace(
                query=query_text,
                repo_id=repo_id,
                mode="graph",
                seed_count=0,
                neighbour_count=0,
                final_count=0,
                latency_ms=latency,
                embedding_provider=_get_provider(),
                exact_symbol_hit=exact_hit,
            )
        )
        return [], latency

    seed_ids = [s.id for s in seeds]

    for s in seeds:
        s.final_score = _W_VECTOR * s.vector_sim + _W_GRAPH * _SEED_GRAPH_SCORE

    # Step 2 — graph expansion
    graph_nodes, graph_edges = 0, 0
    try:
        G = graph_svc.get_graph(repo_id, graph_data_json)
        graph_nodes = G.number_of_nodes()
        graph_edges = G.number_of_edges()
        neighbour_ids = sorted(graph_svc.expand_one_hop(G, seed_ids))
    except Exception as exc:
        logger.warning("Graph expansion failed, falling back to naive: %s", exc)
        return retrieve_naive(repo_id, query_text, TOP_FINAL)

    # Step 3 — fetch neighbour documents by ID
    neighbour_chunks: list[_RankedChunk] = []
    if neighbour_ids:
        get_result = chromadb_client.get_documents_by_ids(
            repo_id, "_functions", neighbour_ids
        )
        ids       = get_result.get("ids", [])
        metadatas = get_result.get("metadatas", [])
        documents = get_result.get("documents", [])
        for doc_id, document, meta in zip(ids, documents, metadatas):
            neighbour_chunks.append(
                _RankedChunk(
                    id=doc_id,
                    name=meta.get("name", ""),
                    file=meta.get("file", ""),
                    lines=[int(meta.get("start_line", 0)), int(meta.get("end_line", 0))],
                    chunk_type="neighbor",
                    vector_sim=0.0,
                    content=document or "",
                    final_score=_W_VECTOR * 0.0 + _W_GRAPH * _NEIGHBOUR_GRAPH_SCORE,
                )
            )

    neighbour_chunks.sort(key=lambda chunk: chunk.id)

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
            content=r.content,
        )
        for r in top
    ]
    latency = int((time.perf_counter() - t0) * 1000)

    tracer.record(
        RetrievalTrace(
            query=query_text,
            repo_id=repo_id,
            mode="graph",
            seed_count=len(seeds),
            neighbour_count=len(neighbour_chunks),
            final_count=len(chunks),
            latency_ms=latency,
            embedding_provider=_get_provider(),
            graph_nodes=graph_nodes,
            graph_edges=graph_edges,
            top_scores=[c.score for c in chunks],
            exact_symbol_hit=exact_hit,
        )
    )
    return chunks, latency


def retrieve(
    repo_id: str,
    query: str,
    mode: str = "graph",
    graph_data_json: str | None = None,
) -> tuple[list[RetrievedChunk], int]:
    """
    High-level retrieval entry point with verification and fallback.
    """
    if mode == "graph":
        chunks, latency = retrieve_graph_augmented(repo_id, query, graph_data_json)
    else:
        chunks, latency = retrieve_naive(repo_id, query)

    # Quality Verification Loop
    verification = verifier.verify(chunks, mode)
    if verification.action == "fallback_naive" and mode == "graph":
        logger.info("Verification action 'fallback_naive': %s", verification.reason)
        return retrieve_naive(repo_id, query)
    elif verification.action == "empty":
        return [], latency

    return chunks, latency
