"""
NetworkX call-graph operations with module-level cache per repo_id.

Graph nodes:    function / class IDs (same IDs used in ChromaDB)
Graph edges:    directed — caller → callee  (A calls B  ⟹  edge A→B)
                so: successors(A)   = functions A calls
                    predecessors(A) = functions that call A
"""
import json
import logging
import re
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


def _load_graph_from_disk(repo_id: str, norm_id: str) -> Optional[nx.DiGraph]:
    """Load graph from SQLite graph_edges table and manifest metadata when not in memory."""
    import sqlite3
    import uuid
    from app.core.config import settings

    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    candidate_dbs = [
        Path(__file__).resolve().parents[3] / "app.db",
        Path(__file__).resolve().parents[2] / "app.db",
        Path(db_path),
        Path("app.db"),
    ]
    target_db = None
    for p in candidate_dbs:
        if p and p.exists():
            try:
                conn = sqlite3.connect(str(p))
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='graph_edges'")
                if cur.fetchone():
                    target_db = p
                    conn.close()
                    break
                conn.close()
            except Exception:
                pass

    if not target_db:
        return None

    resolved_id = repo_id
    try:
        uuid.UUID(repo_id)
    except Exception:
        try:
            conn = sqlite3.connect(str(target_db))
            cur = conn.cursor()
            cur.execute(
                "SELECT id FROM repos WHERE (name = ? OR name LIKE ?) AND status = 'complete' ORDER BY updated_at DESC LIMIT 1",
                (repo_id, f"%{repo_id}%"),
            )
            row = cur.fetchone()
            if row:
                resolved_id = str(row[0])
            conn.close()
        except Exception:
            pass

    actual_norm_id = resolved_id
    try:
        actual_norm_id = str(uuid.UUID(resolved_id))
    except Exception:
        pass
    unhyphen = actual_norm_id.replace("-", "")

    edges: list[tuple[str, str]] = []
    try:
        conn = sqlite3.connect(str(target_db))
        cur = conn.cursor()
        cur.execute(
            "SELECT source, target FROM graph_edges WHERE repo_id = ? OR repo_id = ? OR repo_id = ?",
            (resolved_id, actual_norm_id, unhyphen),
        )
        edges = [(r[0], r[1]) for r in cur.fetchall()]
        conn.close()
    except Exception as exc:
        logger.warning("Failed to query graph_edges from %s: %s", target_db, exc)

    manifest_dirs = [
        Path(__file__).resolve().parents[3] / ".chroma" / "manifests",
        Path(__file__).resolve().parents[2] / ".chroma" / "manifests",
        Path(settings.chroma_persist_dir) / "manifests",
        Path(".chroma/manifests"),
    ]
    manifest_file = None
    for md in manifest_dirs:
        for fid in (actual_norm_id, unhyphen, resolved_id, repo_id):
            cand = md / f"{fid}_manifest.json"
            if cand.exists():
                manifest_file = cand
                break
        if manifest_file:
            break

    if not edges and not manifest_file:
        return None

    G = nx.DiGraph()
    if manifest_file:
        try:
            manifest_data = json.loads(manifest_file.read_text())
            for _, file_info in manifest_data.items():
                for c in file_info.get("chunks_data", []):
                    G.add_node(c["id"], **c)
        except Exception as exc:
            logger.warning("Failed to load manifest %s: %s", manifest_file, exc)

    G.add_edges_from(edges)

    for node in G.nodes():
        if "name" not in G.nodes[node]:
            parts = str(node).split("::")
            if len(parts) >= 4:
                G.nodes[node]["name"] = parts[2]
                G.nodes[node]["file"] = parts[1]
                try:
                    G.nodes[node]["start_line"] = int(parts[3])
                except ValueError:
                    pass
            elif len(parts) == 3:
                G.nodes[node]["name"] = parts[2]
                G.nodes[node]["file"] = parts[1]
            else:
                G.nodes[node]["name"] = str(node)

    return G


def get_graph(
    repo_id: str,
    graph_data: Optional[dict | str | list[tuple[str, str]]] = None,
    edges: Optional[list[tuple[str, str]]] = None,
) -> nx.DiGraph:
    """
    Return the cached graph for repo_id.
    If not cached and graph_data (or edges) is provided, deserialise and cache it.
    If neither is provided, automatically loads from SQLite and manifest.
    Raises ValueError if graph cannot be found.
    """
    import uuid
    norm_id = repo_id
    if len(repo_id) == 32 and "-" not in repo_id:
        try:
            norm_id = str(uuid.UUID(repo_id))
        except Exception:
            pass

    if norm_id in _graph_cache:
        return _graph_cache[norm_id]
    if repo_id in _graph_cache:
        return _graph_cache[repo_id]

    source = edges if edges is not None else graph_data
    if source is None:
        G = _load_graph_from_disk(repo_id, norm_id)
        if G is not None:
            _graph_cache[norm_id] = G
            _graph_cache[repo_id] = G
            logger.info(
                "Loaded graph from disk for repo %s: %d nodes, %d edges",
                repo_id,
                G.number_of_nodes(),
                G.number_of_edges(),
            )
            return G
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

    _graph_cache[norm_id] = G
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
    file_and_base_to_ids: dict[tuple[str, str], list[str]] = {}
    class_and_method_to_id: dict[tuple[str, str], str] = {}
    module_and_symbol_to_id: dict[tuple[str, str], str] = {}

    class_to_id: dict[tuple[str, str], str] = {}
    for unit in code_units:
        if unit.get("type") == "class":
            class_to_id[(unit.get("file", ""), unit.get("name", ""))] = unit["id"]

    for unit in code_units:
        u_id = unit["id"]
        u_name = unit.get("name", "")
        u_file = unit.get("file", "")
        name_to_id[u_name] = u_id

        # Structural containment: connect Class -> Class.method
        p_cls = unit.get("parent_class")
        if p_cls:
            cls_id = class_to_id.get((u_file, p_cls))
            if not cls_id:
                for (f, cname), cid in class_to_id.items():
                    if cname == p_cls:
                        cls_id = cid
                        break
            if cls_id and cls_id != u_id:
                G.add_edge(cls_id, u_id)

        mod_name = Path(u_file).stem
        base_name = u_name.split(".")[-1]

        base_name_to_ids.setdefault(base_name, []).append(u_id)
        file_and_base_to_ids.setdefault((u_file, base_name), []).append(u_id)
        module_and_symbol_to_id[(mod_name, base_name)] = u_id

        if "." in u_name:
            parts = u_name.split(".")
            cls_name, m_name = parts[0], parts[-1]
            class_and_method_to_id[(cls_name, m_name)] = u_id
            module_and_symbol_to_id[(mod_name, f"{cls_name}.{m_name}")] = u_id

    # Second pass: add edges from caller → callee using scope resolution
    for unit in code_units:
        caller_id = unit["id"]
        caller_file = unit.get("file", "")
        caller_name = unit.get("name", "")
        caller_imports = unit.get("imports", [])
        caller_class = caller_name.split(".")[0] if "." in caller_name else None

        # Build local import map from caller's imports
        imported_symbols: dict[str, str] = {}
        for imp in caller_imports:
            imp_clean = imp.strip()
            m_from = re.search(r"from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)", imp_clean)
            if m_from:
                pkg_module = m_from.group(1).replace(".", "/")
                symbols_part = m_from.group(2)
                for sym_item in symbols_part.split(","):
                    sym_item = sym_item.strip()
                    if " as " in sym_item:
                        orig, alias = sym_item.split(" as ")
                        imported_symbols[alias.strip()] = f"{pkg_module}::{orig.strip()}"
                    elif sym_item:
                        imported_symbols[sym_item] = f"{pkg_module}::{sym_item}"
            else:
                m_imp = re.search(r"import\s+([A-Za-z0-9_.]+)(?:\s+as\s+([A-Za-z0-9_]+))?", imp_clean)
                if m_imp:
                    mod_path = m_imp.group(1).replace(".", "/")
                    alias = m_imp.group(2) or m_imp.group(1).split(".")[-1]
                    imported_symbols[alias] = mod_path

        for callee_raw in unit.get("calls", []):
            callee_id = None
            callee_base = callee_raw.split(".")[-1]
            callee_prefix = callee_raw.split(".")[0] if "." in callee_raw else None

            # 1. Exact match on qualified name
            if callee_raw in name_to_id:
                callee_id = name_to_id[callee_raw]

            # 2. 'self.' / 'cls.' / 'this.' call bound to caller's class
            elif callee_prefix in ("self", "cls", "this") and caller_class:
                callee_id = class_and_method_to_id.get((caller_class, callee_base))

            # 3. Explicit Class.method match (e.g. User.save)
            elif "." in callee_raw:
                parts = callee_raw.split(".")
                callee_id = class_and_method_to_id.get((parts[0], parts[-1]))

                # Check if receiver variable matches an imported class
                if not callee_id and parts[0] in imported_symbols:
                    target_info = imported_symbols[parts[0]]
                    for (c_name, m_name), target_id in class_and_method_to_id.items():
                        if m_name == parts[-1] and (c_name in target_info or target_info.endswith(f"::{c_name}")):
                            callee_id = target_id
                            break

            # 4. Intra-class resolution (calling sibling method in same class)
            if not callee_id and caller_class:
                callee_id = class_and_method_to_id.get((caller_class, callee_base))

            # 5. Intra-file resolution (function/class in same file)
            if not callee_id and (caller_file, callee_base) in file_and_base_to_ids:
                candidates_in_file = file_and_base_to_ids[(caller_file, callee_base)]
                if caller_class:
                    for cid in candidates_in_file:
                        if f"::{caller_class}." in cid:
                            callee_id = cid
                            break
                if not callee_id:
                    callee_id = candidates_in_file[0]

            # 6. Imported symbol resolution
            if not callee_id and callee_base in imported_symbols:
                target_str = imported_symbols[callee_base]
                for node_id in G.nodes:
                    if target_str in node_id or node_id.endswith(f"::{callee_base}"):
                        callee_id = node_id
                        break

            # 7. Receiver name heuristic (e.g. user.save -> User.save, auth_service.validate -> AuthService.validate)
            if not callee_id and callee_prefix and callee_prefix not in ("self", "cls", "this"):
                clean_prefix = callee_prefix.replace("_", "").lower()
                for (cls_name, m_name), target_id in class_and_method_to_id.items():
                    if m_name == callee_base and (cls_name.lower().endswith(clean_prefix) or clean_prefix in cls_name.lower()):
                        callee_id = target_id
                        break

            # 8. Global unique base name match
            if not callee_id and callee_base in base_name_to_ids:
                candidates = base_name_to_ids[callee_base]
                if len(candidates) == 1:
                    callee_id = candidates[0]
                else:
                    # Disambiguate by directory proximity
                    caller_dir = str(Path(caller_file).parent)
                    best_match = None
                    for c_id in candidates:
                        if caller_dir in c_id:
                            best_match = c_id
                            break
                    callee_id = best_match or candidates[0]

            # 9. Fallback to basic name lookup
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

def expand_one_hop(G: nx.DiGraph, node_ids: list[str], max_degree: int = 10) -> set[str]:
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


def expand_two_hop(
    G: nx.DiGraph,
    node_ids: list[str],
    max_degree: int = 10,
    max_total_nodes: int = 15,
) -> set[str]:
    """
    Return all 2-hop neighbours (direct + transitive caller/callee dependencies)
    of the given seed nodes, excluding the seed nodes themselves.
    Capped at max_total_nodes to protect LLM context windows against blowout.
    """
    one_hop = expand_one_hop(G, node_ids, max_degree=max_degree)
    two_hop = expand_one_hop(G, list(one_hop), max_degree=max_degree)
    combined = (one_hop | two_hop) - set(node_ids)
    if len(combined) > max_total_nodes:
        seed_files = {G.nodes[n].get("file", "") for n in node_ids if n in G}
        def _score_node(nid: str) -> tuple[int, int, str]:
            n_file = G.nodes[nid].get("file", "") if nid in G else ""
            same_file = 1 if n_file and n_file in seed_files else 0
            deg = G.degree(nid) if nid in G else 0
            return (same_file, deg, nid)

        candidates_one = one_hop - set(node_ids)
        if len(candidates_one) >= max_total_nodes:
            ranked = sorted(candidates_one, key=_score_node, reverse=True)[:max_total_nodes]
            return set(ranked)

        ranked = sorted(candidates_one, key=_score_node, reverse=True)
        remaining_quota = max_total_nodes - len(ranked)
        candidates_two = sorted(two_hop - one_hop, key=_score_node, reverse=True)
        ranked.extend(candidates_two[:remaining_quota])
        return set(ranked)
    return combined


def get_node_metadata(G: nx.DiGraph, node_id: str) -> dict:
    """Return node attribute dict, or empty dict if node not in graph."""
    return dict(G.nodes.get(node_id, {}))

