"""
Unit tests for CodeSageZ embedding service.
"""
import pytest
from app.services.embedder import embed_query, embed_texts, local_hash_embed


def test_local_hash_embed_dimension():
    vec = local_hash_embed("def process_payment(): pass", dimension=384)
    assert isinstance(vec, list)
    assert len(vec) == 384
    assert all(isinstance(x, float) for x in vec)


def test_local_hash_embed_deterministic():
    text = "def calculate_total(items): return sum(items)"
    v1 = local_hash_embed(text)
    v2 = local_hash_embed(text)
    assert v1 == v2


def test_embed_texts_empty():
    assert embed_texts([]) == []


def test_embed_query_local_mode(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "local")
    vec = embed_query("def foo(): pass")
    assert len(vec) == 384
    assert isinstance(vec, list)


def test_embed_query_gemini_mode():
    vec = embed_query("def process_payment(): pass")
    assert isinstance(vec, list)
    assert len(vec) == 3072
    assert all(isinstance(x, float) for x in vec)
