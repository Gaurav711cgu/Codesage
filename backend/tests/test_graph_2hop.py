"""
Unit tests for 2-hop topological call graph expansion in graph_svc.
"""
import networkx as nx
import pytest
from app.services.graph import expand_one_hop, expand_two_hop


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
