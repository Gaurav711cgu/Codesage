"""
End-to-End integration test for RAG retrieval and graph expansion.
"""
import pytest
import networkx as nx
from app.services import graph as graph_svc
from app.models.schemas import RetrievedChunk


def test_retrieval_verifier_and_expansion():
    # Construct a sample graph
    G = nx.DiGraph()
    G.add_node("func_a", name="func_a", file="main.py", type="function")
    G.add_node("func_b", name="func_b", file="utils.py", type="function")
    G.add_edge("func_a", "func_b")
    graph_json = graph_svc.serialise_graph(G)

    # Test graph retrieval and node resolution
    g_loaded = graph_svc.get_graph("test_repo", graph_json)
    assert g_loaded.number_of_nodes() == 2
    assert g_loaded.number_of_edges() == 1

    # Verify candidate node matching
    candidates = graph_svc.expand_one_hop(g_loaded, ["func_a"])
    assert candidates == {"func_b"}
