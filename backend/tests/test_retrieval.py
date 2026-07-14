"""
Tests for retrieval scoring logic.
Uses mocks for ChromaDB and graph so no external services are needed.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.services.retrieval import (
    _cosine_distance_to_similarity,
    _parse_chroma_results,
    _RankedChunk,
    _W_GRAPH,
    _W_VECTOR,
    _SEED_GRAPH_SCORE,
    _NEIGHBOUR_GRAPH_SCORE,
    GRAPH_TOP_FINAL,
)


# ─── _cosine_distance_to_similarity ──────────────────────────────────────────


def test_similarity_identical():
    # distance 0 → similarity 1.0
    assert _cosine_distance_to_similarity(0.0) == 1.0


def test_similarity_orthogonal():
    # distance 1 → similarity 0.0
    assert _cosine_distance_to_similarity(1.0) == 0.0


def test_similarity_clamped():
    # Should never go below 0
    assert _cosine_distance_to_similarity(2.0) == 0.0
    assert _cosine_distance_to_similarity(99.0) == 0.0


# ─── _parse_chroma_results ────────────────────────────────────────────────────


_MOCK_RESULT = {
    "ids": [["id1", "id2"]],
    "documents": [["doc1", "doc2"]],
    "metadatas": [
        [
            {"name": "func_a", "file": "a.py", "start_line": 1, "end_line": 10},
            {"name": "func_b", "file": "b.py", "start_line": 20, "end_line": 30},
        ]
    ],
    "distances": [[0.1, 0.5]],
}


def test_parse_chroma_returns_correct_count():
    chunks = _parse_chroma_results(_MOCK_RESULT, "seed")
    assert len(chunks) == 2


def test_parse_chroma_similarity_conversion():
    chunks = _parse_chroma_results(_MOCK_RESULT, "seed")
    # distance 0.1 → similarity 0.9
    assert abs(chunks[0].vector_sim - 0.9) < 1e-6
    # distance 0.5 → similarity 0.5
    assert abs(chunks[1].vector_sim - 0.5) < 1e-6


def test_parse_chroma_chunk_type():
    seeds = _parse_chroma_results(_MOCK_RESULT, "seed")
    assert all(c.chunk_type == "seed" for c in seeds)
    neighbours = _parse_chroma_results(_MOCK_RESULT, "neighbor")
    assert all(c.chunk_type == "neighbor" for c in neighbours)


def test_parse_chroma_empty_result():
    empty = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}
    chunks = _parse_chroma_results(empty, "seed")
    assert chunks == []


# ─── Scoring formula ─────────────────────────────────────────────────────────


def test_seed_score_formula():
    # seed final_score = 0.6 × sim + 0.4 × 1.0
    sim = 0.8
    expected = _W_VECTOR * sim + _W_GRAPH * _SEED_GRAPH_SCORE
    assert abs(expected - (0.6 * 0.8 + 0.4 * 1.0)) < 1e-9


def test_neighbour_score_formula():
    # neighbour final_score = 0.6 × 0 + 0.4 × 0.5 = 0.2
    expected = _W_VECTOR * 0.0 + _W_GRAPH * _NEIGHBOUR_GRAPH_SCORE
    assert abs(expected - 0.2) < 1e-9


def test_seed_always_beats_neighbour_when_sim_high():
    # A seed with sim=0.5 should score higher than a plain neighbour (0.2)
    seed_score = _W_VECTOR * 0.5 + _W_GRAPH * _SEED_GRAPH_SCORE
    neighbour_score = _W_VECTOR * 0.0 + _W_GRAPH * _NEIGHBOUR_GRAPH_SCORE
    assert seed_score > neighbour_score


# ─── retrieve_graph_augmented (integration-style with mocks) ─────────────────


@patch("app.services.retrieval.chromadb_client")
@patch("app.services.retrieval.graph_svc")
def test_graph_retrieval_deduplicates(mock_graph, mock_chroma):
    """Neighbour IDs that are already seeds should not appear twice."""
    import networkx as nx
    from app.services.retrieval import retrieve_graph_augmented

    # Seed result from ChromaDB
    mock_chroma.query_collection.return_value = {
        "ids": [["seed1", "seed2"]],
        "documents": [["doc1", "doc2"]],
        "metadatas": [[
            {"name": "fn_a", "file": "a.py", "start_line": 1, "end_line": 5},
            {"name": "fn_b", "file": "b.py", "start_line": 6, "end_line": 10},
        ]],
        "distances": [[0.1, 0.2]],
    }

    # Graph expansion — neighbour is "seed1" (already a seed)
    G = nx.DiGraph()
    G.add_edge("seed2", "seed1")
    mock_graph.get_graph.return_value = G
    mock_graph.expand_one_hop.return_value = {"seed1"}  # same as existing seed

    mock_chroma.get_documents_by_ids.return_value = {
        "ids": ["seed1"],
        "metadatas": [{"name": "fn_a", "file": "a.py",
                       "start_line": 1, "end_line": 5}],
    }

    chunks, _ = retrieve_graph_augmented("repo1", [0.1] * 768)

    # seed1 must appear exactly once
    names = [c.name for c in chunks]
    assert names.count("fn_a") == 1


@patch("app.services.retrieval.chromadb_client")
@patch("app.services.retrieval.graph_svc")
def test_graph_retrieval_respects_top_n(mock_graph, mock_chroma):
    """Result set must not exceed GRAPH_TOP_FINAL chunks."""
    import networkx as nx
    from app.services.retrieval import retrieve_graph_augmented

    n_seeds = 5
    mock_chroma.query_collection.return_value = {
        "ids": [[f"seed{i}" for i in range(n_seeds)]],
        "documents": [[f"doc{i}" for i in range(n_seeds)]],
        "metadatas": [[
            {"name": f"fn{i}", "file": "a.py", "start_line": i, "end_line": i + 1}
            for i in range(n_seeds)
        ]],
        "distances": [[0.1 * i for i in range(n_seeds)]],
    }

    G = nx.DiGraph()
    mock_graph.get_graph.return_value = G
    mock_graph.expand_one_hop.return_value = set(f"nb{i}" for i in range(20))

    mock_chroma.get_documents_by_ids.return_value = {
        "ids": [f"nb{i}" for i in range(20)],
        "metadatas": [
            {"name": f"nbfn{i}", "file": "b.py", "start_line": i, "end_line": i + 1}
            for i in range(20)
        ],
    }

    chunks, _ = retrieve_graph_augmented("repo1", [0.0] * 768)
    assert len(chunks) <= GRAPH_TOP_FINAL
