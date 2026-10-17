"""
Tests for BM25Okapi Keyword Search, Reciprocal Rank Fusion (RRF), and Hybrid Retrieval.
"""
import pytest

from app.services.hybrid_search import (
    BM25Okapi,
    BM25IndexManager,
    reciprocal_rank_fusion,
    tokenize_code,
)
from app.services.retrieval import retrieve_hybrid


def test_code_tokenizer_camel_snake_case():
    text = "def calculateMonthlyTax(user_account_id: str): pass"
    tokens = tokenize_code(text)

    # Must contain original lower tokens and split components
    assert "calculatemonthlytax" in tokens
    assert "calculate" in tokens
    assert "monthly" in tokens
    assert "tax" in tokens

    assert "user_account_id" in tokens
    assert "user" in tokens
    assert "account" in tokens
    assert "id" in tokens


def test_bm25_indexing_and_scoring():
    index = BM25Okapi(k1=1.5, b=0.75)
    doc_ids = ["doc_auth", "doc_math", "doc_db"]
    docs = [
        "authenticate user with jwt bearer token and verify credentials signature",
        "calculate matrix multiplication eigenvalues and numeric linear algebra",
        "database connection pool postgresql transaction commit and rollback",
    ]

    index.index_documents(doc_ids, docs)

    # Query with exact keywords
    results = index.search("verify jwt token authentication", top_k=3)
    assert len(results) > 0
    top_doc_id, score = results[0]
    assert top_doc_id == "doc_auth"
    assert score > 0.0

    # Query matching database
    results_db = index.search("postgresql transaction pool", top_k=3)
    assert results_db[0][0] == "doc_db"


def test_bm25_empty_query_and_corpus():
    index = BM25Okapi()
    assert index.search("any query") == []

    index.index_documents(["d1"], ["test code content"])
    assert index.search("") == []


def test_rrf_scoring_formula_and_k_parameter():
    dense_ranks = [("docA", 0.95), ("docB", 0.85), ("docC", 0.70)]
    bm25_ranks = [("docB", 12.5), ("docA", 10.2), ("docD", 8.0)]

    # With k=60
    # docA rank 1 in dense (1/(60+1) = 1/61), rank 2 in bm25 (1/(60+2) = 1/62)
    # Expected docA = 1/61 + 1/62 = 0.016393 + 0.016129 = 0.032522
    # docB rank 2 in dense (1/62), rank 1 in bm25 (1/61)
    # Expected docB = 1/62 + 1/61 = 0.032522 (tie)
    fused = reciprocal_rank_fusion([dense_ranks, bm25_ranks], k=60)

    fused_dict = dict(fused)
    expected_docA = 1.0 / 61 + 1.0 / 62
    assert pytest.approx(fused_dict["docA"], rel=1e-4) == expected_docA
    assert pytest.approx(fused_dict["docB"], rel=1e-4) == expected_docA

    # docC: rank 3 in dense, missing in bm25 -> 1/63
    expected_docC = 1.0 / 63
    assert pytest.approx(fused_dict["docC"], rel=1e-4) == expected_docC

    # docD: missing in dense, rank 3 in bm25 -> 1/63
    expected_docD = 1.0 / 63
    assert pytest.approx(fused_dict["docD"], rel=1e-4) == expected_docD


def test_rrf_monotonicity_and_ranking_stability():
    # Documents ranking high in BOTH lists beat documents ranking high in only ONE list
    dense = [("both_top", 0.99), ("dense_rank2", 0.90), ("dense_rank3", 0.70)]
    bm25 = [("both_top", 15.0), ("bm25_rank2", 14.0), ("bm25_rank3", 10.0)]

    fused = reciprocal_rank_fusion([dense, bm25], k=60)
    top_id, top_score = fused[0]
    assert top_id == "both_top"

    # Both_top score should strictly exceed single-list hits
    scores = dict(fused)
    assert scores["both_top"] > scores["dense_rank2"]
    assert scores["both_top"] > scores["bm25_rank2"]
    # Monotonicity within single lists
    assert scores["dense_rank2"] > scores["dense_rank3"]
    assert scores["bm25_rank2"] > scores["bm25_rank3"]


def test_bm25_manager_caching_and_invalidation(tmp_path):
    manager = BM25IndexManager(storage_dir=tmp_path / "bm25")
    repo_id = "test_repo_123"

    assert manager.get_index(repo_id) is None

    manager.build_and_register(repo_id, ["c1"], ["def foo(): pass"])
    assert manager.get_index(repo_id) is not None

    manager.invalidate(repo_id)
    assert manager.get_index(repo_id) is None


def test_bm25_manager_disk_persistence(tmp_path):
    storage_dir = tmp_path / "bm25_persist"
    manager1 = BM25IndexManager(storage_dir=storage_dir)
    repo_id = "repo_persist_xyz"

    manager1.build_and_register(
        repo_id,
        ["doc_1", "doc_2"],
        ["def calculate_total(items): return sum(items)", "def send_email(): pass"],
    )

    # Instantiate a second manager pointing to the same storage directory
    manager2 = BM25IndexManager(storage_dir=storage_dir)
    loaded_idx = manager2.get_index(repo_id)
    assert loaded_idx is not None
    assert loaded_idx.corpus_size == 2

    # Query the persistent index loaded from disk
    results = loaded_idx.search("calculate total items", top_k=1)
    assert len(results) == 1
    assert results[0][0] == "doc_1"
