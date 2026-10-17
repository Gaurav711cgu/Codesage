"""
Unit tests for Kairos SWE Context Bridge service.
"""
from unittest.mock import patch
import networkx as nx
import pytest

from app.models.schemas import RetrievedChunk
from app.services.graph import cache_graph
from app.services.kairos_bridge import generate_kairos_context, KairosContextBundle


def test_kairos_context_bundle_generation():
    chunk1 = RetrievedChunk(
        name="User",
        file="pydantic/main.py",
        lines=[140, 180],
        type="seed",
        score=0.9,
        content="class User:\n    id: int\n    name: str",
    )
    chunk2 = RetrievedChunk(
        name="validate",
        file="pydantic/validator.py",
        lines=[20, 45],
        type="neighbor",
        score=0.8,
        content="def validate(data):\n    return User(**data)",
    )

    G = nx.DiGraph()
    G.add_node("models::validate", name="validate", file="pydantic/validator.py", start_line=20, end_line=45)
    G.add_node("models::User", name="User", file="pydantic/main.py", start_line=140, end_line=180)
    G.add_edge("models::validate", "models::User")
    cache_graph("pydantic_repo", G)

    with patch("app.services.kairos_bridge.retrieve", return_value=([chunk1, chunk2], 8)):
        bundle = generate_kairos_context(
            repo_id="pydantic_repo",
            query="pydantic-4911: validation error when constructing submodel",
            symbol_name="validate",
            max_chunks=2,
        )

        assert isinstance(bundle, KairosContextBundle)
        assert bundle.repo_id == "pydantic_repo"
        assert len(bundle.ranked_chunks) == 2
        assert "pydantic/main.py" in bundle.prompt_payload
        assert "pydantic/validator.py" in bundle.prompt_payload
        assert "Callees" in bundle.prompt_payload
        assert "User" in bundle.prompt_payload


def test_kairos_context_bundle_without_cached_graph():
    chunk = RetrievedChunk(
        name="fn",
        file="isolated.py",
        lines=[1, 5],
        type="seed",
        score=0.7,
        content="def fn(): pass",
    )

    with patch("app.services.kairos_bridge.retrieve", return_value=([chunk], 3)):
        bundle = generate_kairos_context(
            repo_id="empty_repo",
            query="syntax error",
            max_chunks=1,
        )

        assert bundle.repo_id == "empty_repo"
        assert len(bundle.callers) == 0
        assert len(bundle.callees) == 0
        assert "isolated.py" in bundle.prompt_payload
