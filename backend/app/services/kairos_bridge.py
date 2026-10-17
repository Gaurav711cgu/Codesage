"""
Kairos SWE Context Bridge Service.

Bridges CodeSage Graph-RAG retrieval with Kairos autonomous code repair agents.
Generates structured context bundles containing 2-hop topological call chains,
symbol definitions, and AST boundaries formatted specifically for Kairos patch proposer.
"""
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.services.retrieval import retrieve
from app.services.graph import get_graph, get_node_metadata
from app.models.schemas import RetrievedChunk


class KairosContextBundle(BaseModel):
    repo_id: str
    query: str
    target_symbols: list[str] = Field(default_factory=list)
    callers: list[dict[str, Any]] = Field(default_factory=list)
    callees: list[dict[str, Any]] = Field(default_factory=list)
    ranked_chunks: list[dict[str, Any]] = Field(default_factory=list)
    prompt_payload: str = Field(..., description="Markdown slice formatted for Kairos repair harness")


def generate_kairos_context(
    repo_id: str,
    query: str,
    symbol_name: Optional[str] = None,
    max_chunks: int = 6,
) -> KairosContextBundle:
    """
    Produce a complete Kairos-compatible context slice for an issue or symbol.
    """
    # 1. Retrieve 2-hop graph-augmented chunks
    chunks, _ = retrieve(repo_id, query, mode="graph")
    selected_chunks = chunks[:max_chunks]
    chunk_dicts = [c.model_dump() for c in selected_chunks]

    # 2. Extract call graph relationships if graph exists
    callers_list: list[dict[str, Any]] = []
    callees_list: list[dict[str, Any]] = []
    target_symbols: list[str] = []

    try:
        G = get_graph(repo_id)
        seed_nodes = []
        for c in selected_chunks:
            chunk_name = getattr(c, "name", "")
            if chunk_name:
                target_symbols.append(chunk_name)
                for node, data in G.nodes(data=True):
                    if data.get("name") == chunk_name:
                        seed_nodes.append(node)

        if symbol_name:
            target_symbols.append(symbol_name)
            for node, data in G.nodes(data=True):
                if data.get("name") == symbol_name:
                    seed_nodes.append(node)

        seen_callers = set()
        seen_callees = set()
        for node in set(seed_nodes):
            for pred in G.predecessors(node):
                if pred not in seen_callers:
                    seen_callers.add(pred)
                    callers_list.append(get_node_metadata(G, pred))
            for succ in G.successors(node):
                if succ not in seen_callees:
                    seen_callees.add(succ)
                    callees_list.append(get_node_metadata(G, succ))
    except Exception:
        pass

    # 3. Construct Kairos Markdown Prompt Payload
    payload_lines = [
        f"### CodeSage AST & Graph-RAG Context Slice for `{repo_id}`",
        f"**Issue / Query:** {query}",
        "",
        "#### Structural Call Dependencies (1-hop / 2-hop)",
    ]

    if callers_list:
        payload_lines.append(f"- **Callers ({len(callers_list)}):** " + ", ".join(f"`{c.get('name', 'unknown')}` ({c.get('file', '')}:{c.get('start_line', 0)})" for c in callers_list[:5]))
    else:
        payload_lines.append("- **Callers:** None detected or root entry point")

    if callees_list:
        payload_lines.append(f"- **Callees ({len(callees_list)}):** " + ", ".join(f"`{c.get('name', 'unknown')}` ({c.get('file', '')}:{c.get('start_line', 0)})" for c in callees_list[:5]))
    else:
        payload_lines.append("- **Callees:** None detected or leaf node")

    payload_lines.append("")
    payload_lines.append("#### Ranked Code Chunks")
    for i, c in enumerate(selected_chunks, 1):
        c_path = c.file
        lines_str = f"L{c.lines[0]}-L{c.lines[-1]}" if c.lines else "L1"
        c_code = c.content or ""
        payload_lines.append(f"**[{i}] {c_path} ({lines_str}):**")
        payload_lines.append("```python")
        payload_lines.append(c_code.strip())
        payload_lines.append("```")
        payload_lines.append("")

    return KairosContextBundle(
        repo_id=repo_id,
        query=query,
        target_symbols=list(set(target_symbols)),
        callers=callers_list,
        callees=callees_list,
        ranked_chunks=chunk_dicts,
        prompt_payload="\n".join(payload_lines),
    )
