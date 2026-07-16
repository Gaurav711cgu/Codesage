"""
NetworkX call-graph operations with module-level cache per repo_id.

Graph nodes:    function / class IDs (same IDs used in ChromaDB)
Graph edges:    directed — caller → callee  (A calls B  ⟹  edge A→B)
                so: successors(A)   = functions A calls
                    predecessors(A) = functions that call A
"""
import json
import logging
from typing import Optional

import networkx as nx

logger = logging.getLogger(__name__)

# Module-level cache: repo_id → nx.DiGraph
_graph_cache: dict[str, nx.DiGraph] = {}


# ─── Cache management ─────────────────────────────────────────────────────────

def get_graph(repo_id: str, graph_data: Optional[dict | str] = None) -> nx.DiGraph:
    """
    Return the cached graph for repo_id.
    If not cached and graph_data is provided, deserialise and cache it.
    Raises ValueError if neither source is available.
    """
    if repo_id in _graph_cache:
        return _graph_cache[repo_id]

    if graph_data is None:
        raise ValueError(
            f"Graph for repo {repo_id} is not in cache and no JSON was provided. "
            "Pass graph_data from the repos.graph_data column."
        )

    if isinstance(graph_data, str):
        graph_data = json.loads(graph_data)

    G = nx.node_link_graph(graph_data)
    _graph_cache[repo_id] = G
    logger.info(
        "Loaded graph for repo %s from JSON: %d nodes, %d edges",
        repo_id,
        G.number_of_nodes(),
        G.number_of_edges(),
    )
    return G


def cache_graph(repo_id: str, G: nx.DiGraph) -> None:
    """Store a freshly built graph in the module cache."""
    _graph_cache[repo_id] = G
    logger.info(
        "Cached graph for repo %s: %d nodes, %d edges",
        repo_id,
        G.number_of_nodes(),
        G.number_of_edges(),
    )


def invalidate_graph(repo_id: str) -> None:
    """Remove the graph from cache (call on repo deletion)."""
    removed = _graph_cache.pop(repo_id, None)
    if removed is not None:
        logger.info("Evicted graph for repo %s from cache", repo_id)


def serialise_graph(G: nx.DiGraph) -> dict:
    """Serialise a DiGraph to a dict for PostgreSQL JSONB storage."""
    return nx.node_link_data(G)


# ─── Graph construction (called by ingestion) ─────────────────────────────────

def build_graph(code_units: list[dict]) -> nx.DiGraph:
    """
    Build a directed call graph from a list of CodeUnit dicts.

    Each CodeUnit must have:
        id        : str  — unique identifier (e.g. "file::function_name")
        calls     : list[str] — names of functions this unit calls
        name      : str  — function/class name

    Edges represent call relationships: caller → callee.
    Nodes that appear in 'calls' but have no corresponding CodeUnit are added
    as stubs so graph traversal never raises KeyError.
    """
    G: nx.DiGraph = nx.DiGraph()

    # First pass: add all known nodes
    for unit in code_units:
        G.add_node(unit["id"], **{
            "name": unit.get("name", ""),
            "file": unit.get("file", ""),
            "type": unit.get("type", "function"),
            "start_line": unit.get("start_line", 0),
            "end_line": unit.get("end_line", 0),
        })

    # Build a name → id lookup for call resolution
    name_to_id: dict[str, str] = {u["name"]: u["id"] for u in code_units}

    # Second pass: add edges from caller → callee
    for unit in code_units:
        caller_id = unit["id"]
        for callee_name in unit.get("calls", []):
            callee_id = name_to_id.get(callee_name)
            if callee_id and callee_id != caller_id:
                G.add_edge(caller_id, callee_id)

    logger.debug(
        "Built call graph: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges()
    )
    return G


# ─── Graph traversal (called by retrieval) ────────────────────────────────────

def expand_one_hop(G: nx.DiGraph, node_ids: list[str], max_degree: int = 50) -> set[str]:
    """
    Return all 1-hop neighbours (successors + predecessors) of the given nodes,
    excluding the seed nodes themselves. Limits edges to prevent context explosion.
    """
    neighbours: set[str] = set()
    for node_id in node_ids:
        if node_id not in G:
            continue
        
        # Take up to max_degree successors
        succs = list(G.successors(node_id))
        neighbours.update(succs[:max_degree])
        
        # Take up to max_degree predecessors
        preds = list(G.predecessors(node_id))
        neighbours.update(preds[:max_degree])
        
    return neighbours - set(node_ids)


def get_node_metadata(G: nx.DiGraph, node_id: str) -> dict:
    """Return node attribute dict, or empty dict if node not in graph."""
    return dict(G.nodes.get(node_id, {}))
