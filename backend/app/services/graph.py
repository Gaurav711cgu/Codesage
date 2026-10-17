"""
NetworkX call-graph operations with module-level cache per repo_id.

Graph nodes:    function / class IDs (same IDs used in ChromaDB)
Graph edges:    directed — caller → callee  (A calls B  ⟹  edge A→B)
                so: successors(A)   = functions A calls
                    predecessors(A) = functions that call A
"""
import json
import logging
from pathlib import Path
from typing import Optional

import networkx as nx

logger = logging.getLogger(__name__)

# Module-level cache: repo_id → nx.DiGraph
_graph_cache: dict[str, nx.DiGraph] = {}


# ─── Cache management ─────────────────────────────────────────────────────────

def deserialise_graph(graph_data: dict | str) -> nx.DiGraph:
    """Deserialise a node-link dict or JSON string back into an nx.DiGraph."""
    if isinstance(graph_data, str):
        graph_data = json.loads(graph_data)
    return nx.node_link_graph(graph_data)


def get_graph(
    repo_id: str,
    graph_data: Optional[dict | str | list[tuple[str, str]]] = None,
    edges: Optional[list[tuple[str, str]]] = None,
) -> nx.DiGraph:
    """
    Return the cached graph for repo_id.
    If not cached and graph_data (or edges) is provided, deserialise and cache it.
    Raises ValueError if neither source is available.
    """
    if repo_id in _graph_cache:
        return _graph_cache[repo_id]

    source = edges if edges is not None else graph_data
    if source is None:
        raise ValueError(
            f"Graph for repo {repo_id} is not in cache and no graph data or edges were provided."
        )

    if isinstance(source, (dict, str)):
        G = deserialise_graph(source)
    elif isinstance(source, list):
        if source and isinstance(source[0], dict):
            G = nx.node_link_graph(source)
        else:
            G = nx.DiGraph()
            G.add_edges_from(source)
    else:
        raise ValueError(f"Unsupported graph data format: {type(source)}")

    _graph_cache[repo_id] = G
    logger.info(
        "Loaded graph for repo %s: %d nodes, %d edges",
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

def build_cross_language_edges(code_units: list[dict]) -> list[tuple[str, str]]:
    """
    Infer cross-language call edges (e.g., TypeScript frontend components calling
    Python FastAPI backend endpoints or matching function symbols).
    """
    py_names = {
        u["name"]: u["id"]
        for u in code_units
        if u.get("file", "").endswith(".py")
    }
    ts_units = [
        u for u in code_units
        if any(u.get("file", "").endswith(ext) for ext in (".ts", ".tsx", ".js", ".jsx"))
    ]
    edges = []
    for ts_unit in ts_units:
        for call in ts_unit.get("calls", []):
            clean_call = call.split(".")[-1]
            if clean_call in py_names and py_names[clean_call] != ts_unit["id"]:
                edges.append((ts_unit["id"], py_names[clean_call]))
    return edges


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

    # Build multi-tier lookups for scope-aware call resolution
    name_to_id: dict[str, str] = {}
    base_name_to_ids: dict[str, list[str]] = {}
    file_and_base_to_id: dict[tuple[str, str], str] = {}
    class_and_method_to_id: dict[tuple[str, str], str] = {}

    for unit in code_units:
        u_id = unit["id"]
        u_name = unit.get("name", "")
        u_file = unit.get("file", "")
        name_to_id[u_name] = u_id

        # Base name (e.g. "add" from "Calculator.add")
        base_name = u_name.split(".")[-1]
        base_name_to_ids.setdefault(base_name, []).append(u_id)
        file_and_base_to_id[(u_file, base_name)] = u_id

        if "." in u_name:
            parts = u_name.split(".")
            class_and_method_to_id[(parts[0], parts[-1])] = u_id

    # Second pass: add edges from caller → callee using scope resolution
    for unit in code_units:
        caller_id = unit["id"]
        caller_file = unit.get("file", "")
        caller_name = unit.get("name", "")
        caller_class = caller_name.split(".")[0] if "." in caller_name else None

        for callee_raw in unit.get("calls", []):
            callee_id = None
            callee_base = callee_raw.split(".")[-1]

            # 1. Exact match on qualified name
            if callee_raw in name_to_id:
                callee_id = name_to_id[callee_raw]
            # 2. Member call (e.g. "calc.add" or "self.add") matching class method
            elif "." in callee_raw:
                parts = callee_raw.split(".")
                callee_id = class_and_method_to_id.get((parts[0], parts[-1]))
            
            # 3. Intra-class resolution (calling sibling method in same class)
            if not callee_id and caller_class:
                callee_id = class_and_method_to_id.get((caller_class, callee_base))

            # 4. Intra-file resolution (function in same module)
            if not callee_id:
                callee_id = file_and_base_to_id.get((caller_file, callee_base))

            # 5. Global unique base name match
            if not callee_id and callee_base in base_name_to_ids:
                candidates = base_name_to_ids[callee_base]
                if len(candidates) == 1:
                    callee_id = candidates[0]
                else:
                    # Pick candidate with closest file directory match
                    caller_dir = str(Path(caller_file).parent)
                    best_match = None
                    for c_id in candidates:
                        if caller_dir in c_id:
                            best_match = c_id
                            break
                    callee_id = best_match or candidates[0]

            # 6. Fallback to basic name lookup
            if not callee_id:
                callee_id = name_to_id.get(callee_raw)

            if callee_id and callee_id != caller_id:
                G.add_edge(caller_id, callee_id)

    # Third pass: infer cross-language edges (JS/TS -> Python API/symbol match)
    for caller_id, callee_id in build_cross_language_edges(code_units):
        if not G.has_edge(caller_id, callee_id):
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


def expand_two_hop(G: nx.DiGraph, node_ids: list[str], max_degree: int = 50) -> set[str]:
    """
    Return all 2-hop neighbours (direct + transitive caller/callee dependencies)
    of the given seed nodes, excluding the seed nodes themselves.
    Catches transitive call chains (A calls B, B calls C -> retrieves C for A).
    """
    one_hop = expand_one_hop(G, node_ids, max_degree=max_degree)
    two_hop = expand_one_hop(G, list(one_hop), max_degree=max_degree)
    return (one_hop | two_hop) - set(node_ids)


def get_node_metadata(G: nx.DiGraph, node_id: str) -> dict:
    """Return node attribute dict, or empty dict if node not in graph."""
    return dict(G.nodes.get(node_id, {}))

