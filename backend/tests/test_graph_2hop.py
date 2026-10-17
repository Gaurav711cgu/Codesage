"""
Unit tests for 2-hop topological call graph expansion and scope-aware symbol resolution in graph_svc.
"""
import networkx as nx
import pytest
from app.services.graph import expand_one_hop, expand_two_hop, build_graph


def test_expand_two_hop_basic():
    # Construct synthetic graph: A -> B -> C
    G = nx.DiGraph()
    G.add_edge("A", "B")
    G.add_edge("B", "C")

    # 1-hop expansion from B
    nodes_1hop = expand_one_hop(G, ["B"])
    assert set(nodes_1hop) == {"A", "C"}

    # 2-hop expansion from A
    nodes_2hop = expand_two_hop(G, ["A"])
    assert set(nodes_2hop) == {"B", "C"}


def test_expand_two_hop_empty_and_missing():
    G = nx.DiGraph()
    G.add_edge("X", "Y")

    assert expand_two_hop(G, []) == set()
    assert expand_two_hop(G, ["UNKNOWN_NODE"]) == set()


def test_scope_aware_symbol_disambiguation():
    """
    Ensure methods with identical names in different classes are accurately resolved
    without global name collision clobbering.
    """
    code_units = [
        {
            "id": "repo::models/user.py::User.save::10",
            "name": "User.save",
            "file": "models/user.py",
            "type": "method",
            "calls": [],
        },
        {
            "id": "repo::models/post.py::Post.save::10",
            "name": "Post.save",
            "file": "models/post.py",
            "type": "method",
            "calls": [],
        },
        {
            "id": "repo::services/user_service.py::register::5",
            "name": "register",
            "file": "services/user_service.py",
            "type": "function",
            "calls": ["User.save"],
        },
        {
            "id": "repo::models/user.py::User.update_profile::20",
            "name": "User.update_profile",
            "file": "models/user.py",
            "type": "method",
            "calls": ["save"],  # Intra-class sibling call
        },
    ]

    G = build_graph(code_units)

    # 1. User.save and Post.save must both exist as separate nodes
    assert "repo::models/user.py::User.save::10" in G
    assert "repo::models/post.py::Post.save::10" in G

    # 2. register calls User.save
    assert G.has_edge("repo::services/user_service.py::register::5", "repo::models/user.py::User.save::10")

    # 3. User.update_profile sibling call 'save' must resolve to User.save, NEVER Post.save
    assert G.has_edge("repo::models/user.py::User.update_profile::20", "repo::models/user.py::User.save::10")
    assert not G.has_edge("repo::models/user.py::User.update_profile::20", "repo::models/post.py::Post.save::10")
