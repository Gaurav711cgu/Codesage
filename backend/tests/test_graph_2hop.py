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


def test_scope_aware_receiver_heuristics_and_imports():
    """
    Verify receiver heuristics and import matching accurately resolve ambiguous method calls.
    e.g. auth_service.validate() vs payment_service.validate()
    """
    code_units = [
        {
            "id": "repo::services/auth.py::AuthService.validate::10",
            "name": "AuthService.validate",
            "file": "services/auth.py",
            "type": "method",
            "calls": [],
            "imports": [],
        },
        {
            "id": "repo::services/payment.py::PaymentService.validate::10",
            "name": "PaymentService.validate",
            "file": "services/payment.py",
            "type": "method",
            "calls": [],
            "imports": [],
        },
        {
            "id": "repo::controllers/checkout.py::process_order::5",
            "name": "process_order",
            "file": "controllers/checkout.py",
            "type": "function",
            "calls": ["payment_service.validate"],
            "imports": ["from services.payment import PaymentService"],
        },
        {
            "id": "repo::controllers/login.py::do_login::5",
            "name": "do_login",
            "file": "controllers/login.py",
            "type": "function",
            "calls": ["auth_service.validate"],
            "imports": ["from services.auth import AuthService"],
        },
    ]

    G = build_graph(code_units)

    # process_order must connect to PaymentService.validate, NOT AuthService.validate
    assert G.has_edge("repo::controllers/checkout.py::process_order::5", "repo::services/payment.py::PaymentService.validate::10")
    assert not G.has_edge("repo::controllers/checkout.py::process_order::5", "repo::services/auth.py::AuthService.validate::10")

    # do_login must connect to AuthService.validate, NOT PaymentService.validate
    assert G.has_edge("repo::controllers/login.py::do_login::5", "repo::services/auth.py::AuthService.validate::10")
    assert not G.has_edge("repo::controllers/login.py::do_login::5", "repo::services/payment.py::PaymentService.validate::10")


def test_scope_aware_self_and_this_binding():
    """Verify 'self.method' and 'this.method' explicitly bind to the enclosing class."""
    code_units = [
        {
            "id": "repo::calculator.py::Calculator.compute::10",
            "name": "Calculator.compute",
            "file": "calculator.py",
            "type": "method",
            "calls": ["self.add", "self.multiply"],
            "imports": [],
        },
        {
            "id": "repo::calculator.py::Calculator.add::20",
            "name": "Calculator.add",
            "file": "calculator.py",
            "type": "method",
            "calls": [],
            "imports": [],
        },
        {
            "id": "repo::calculator.py::Calculator.multiply::30",
            "name": "Calculator.multiply",
            "file": "calculator.py",
            "type": "method",
            "calls": [],
            "imports": [],
        },
        {
            "id": "repo::other.py::Other.add::10",
            "name": "Other.add",
            "file": "other.py",
            "type": "method",
            "calls": [],
            "imports": [],
        },
    ]

    G = build_graph(code_units)

    # Calculator.compute calling self.add must resolve to Calculator.add, never Other.add
    assert G.has_edge("repo::calculator.py::Calculator.compute::10", "repo::calculator.py::Calculator.add::20")
    assert not G.has_edge("repo::calculator.py::Calculator.compute::10", "repo::other.py::Other.add::10")
    assert G.has_edge("repo::calculator.py::Calculator.compute::10", "repo::calculator.py::Calculator.multiply::30")


def test_expand_two_hop_bounded_by_max_total_nodes():
    """Verify that high-fanout graph traversal caps at max_total_nodes to protect LLM context windows."""
    G = nx.DiGraph()
    # Node S calls 25 distinct functions
    for i in range(25):
        G.add_edge("seed", f"callee_{i:02d}")
        # Each callee calls another function
        G.add_edge(f"callee_{i:02d}", f"transitive_{i:02d}")

    # Standard unbounded traversal would return 50 nodes
    # With max_total_nodes=15, must return exactly 15 nodes
    bounded = expand_two_hop(G, ["seed"], max_degree=25, max_total_nodes=15)
    assert len(bounded) == 15
    # The seed itself should never be included
    assert "seed" not in bounded

