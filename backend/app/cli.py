"""
CodeSage Developer CLI (`codesage`).

Headless terminal interface for repository indexing, Graph-RAG querying,
call-graph inspection, diagnostics, and Model Context Protocol runner.
"""
import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.repo import GraphEdge, Repo, RepoStatus, Task
from app.services import chromadb_client, graph as graph_svc
from app.services.embedder import _get_provider, local_dense_embed
from app.services.hybrid_search import bm25_manager
from app.services.ingestion import run_ingestion
from app.services.retrieval import retrieve

logger = logging.getLogger("codesage.cli")
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
engine.echo = False


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _init_db_schema() -> None:
    """Ensure database tables exist before CLI actions."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _resolve_repo(session, repo_identifier: Optional[str] = None) -> Repo:
    """Find target repo by UUID prefix or name. If omitted and 1 repo exists, returns it."""
    if repo_identifier:
        # Check UUID exact/prefix match first
        try:
            val_uuid = uuid.UUID(repo_identifier)
            stmt = select(Repo).where(Repo.id == val_uuid)
            res = await session.execute(stmt)
            r = res.scalar_one_or_none()
            if r:
                return r
        except ValueError:
            pass

        # Check by name or URL substring
        stmt = select(Repo).where(
            (Repo.name == repo_identifier) | (Repo.github_url.contains(repo_identifier))
        ).order_by(Repo.updated_at.desc())
        res = await session.execute(stmt)
        candidates = res.scalars().all()
        if candidates:
            complete = [c for c in candidates if c.status == RepoStatus.complete]
            if complete:
                return complete[0]
            return candidates[0]
        raise ValueError(f"Repository '{repo_identifier}' not found in database.")

    # Omitted: pick default
    stmt = select(Repo).order_by(Repo.updated_at.desc())
    res = await session.execute(stmt)
    all_repos = res.scalars().all()
    if not all_repos:
        raise ValueError("No repositories found in database. Run 'codesage index <path>' first.")
    if len(all_repos) == 1:
        return all_repos[0]

    # Pick the latest complete repo
    complete_repos = [r for r in all_repos if r.status == RepoStatus.complete]
    if complete_repos:
        return complete_repos[0]
    return all_repos[0]


async def _load_repo_graph(session, repo_id_str: str) -> None:
    """Ensure repo graph is loaded in memory from cache or DB GraphEdge table."""
    try:
        graph_svc.get_graph(repo_id_str)
        return
    except ValueError:
        pass

    repo_uuid = uuid.UUID(repo_id_str)
    stmt = select(GraphEdge.source, GraphEdge.target).where(GraphEdge.repo_id == repo_uuid)
    res = await session.execute(stmt)
    edges = [(s, t) for s, t in res.all()]
    if edges:
        G = graph_svc.get_graph(repo_id_str, edges=edges)
        for node in G.nodes():
            parts = str(node).split("::")
            if len(parts) >= 4:
                G.nodes[node].setdefault("name", parts[2])
                G.nodes[node].setdefault("file", parts[1])
                try:
                    G.nodes[node].setdefault("start_line", int(parts[3]))
                except ValueError:
                    pass
            elif len(parts) == 3:
                G.nodes[node].setdefault("name", parts[2])
                G.nodes[node].setdefault("file", parts[1])
            else:
                G.nodes[node].setdefault("name", str(node))
    else:
        # Initialize empty DiGraph
        import networkx as nx
        graph_svc.cache_graph(repo_id_str, nx.DiGraph())


# ─── Commands ─────────────────────────────────────────────────────────────────

async def cmd_doctor(args: argparse.Namespace) -> int:
    """Run diagnostics on database, vector store, embedding models, and parsers."""
    print("=" * 60)
    print("  CodeSage System Diagnostics (Doctor)")
    print("=" * 60)

    # 1. Environment & Config
    print(f"[+] Environment:      {settings.environment}")
    print(f"[+] App Version:      {settings.version}")
    print(f"[+] Database URL:     {settings.database_url}")
    print(f"[+] Chroma Store:     {settings.chroma_persist_directory}")

    # 2. Database Connection
    db_ok = False
    repo_count = 0
    try:
        await _init_db_schema()
        async with AsyncSessionLocal() as session:
            stmt = select(Repo)
            res = await session.execute(stmt)
            repos = res.scalars().all()
            repo_count = len(repos)
            db_ok = True
        print(f"[✓] Database:         Connected (SQLite/PostgreSQL OK, {repo_count} repos registered)")
    except Exception as e:
        print(f"[✗] Database:         FAILED ({e})")

    # 3. ChromaDB
    chroma_ok = False
    try:
        colls = chromadb_client.get_client().list_collections()
        chroma_ok = True
        print(f"[✓] ChromaDB:         Connected ({len(colls)} collections active)")
    except Exception as e:
        print(f"[✗] ChromaDB:         FAILED ({e})")

    # 4. Tree-sitter Parsers
    ts_ok = False
    try:
        import tree_sitter_javascript as tsjs
        import tree_sitter_python as tspy
        import tree_sitter_typescript as tsts
        from tree_sitter import Language, Parser

        Parser(Language(tspy.language()))
        Parser(Language(tsjs.language()))
        Parser(Language(tsts.language_typescript()))
        ts_ok = True
        print("[✓] Tree-sitter:      Grammars loaded (Python, JavaScript, TypeScript)")
    except Exception as e:
        print(f"[✗] Tree-sitter:      FAILED ({e})")

    # 5. Embeddings Provider
    provider = _get_provider()
    dense_vec = local_dense_embed("def test(): pass")
    print(f"[✓] Embedder:         Active provider: '{provider}' (sample vector dim: {len(dense_vec)})")

    # 6. BM25 Cache
    manifests = list((Path(settings.chroma_persist_directory) / "bm25").glob("*.pkl")) if (Path(settings.chroma_persist_directory) / "bm25").exists() else []
    print(f"[✓] BM25 Index:       {len(manifests)} persisted index files found")

    print("-" * 60)
    all_healthy = db_ok and chroma_ok and ts_ok
    if all_healthy:
        print(">> Status: All core systems operational.")
        return 0
    else:
        print(">> Warning: One or more components degraded.")
        return 1


async def cmd_repos(args: argparse.Namespace) -> int:
    """List all indexed repositories."""
    await _init_db_schema()
    async with AsyncSessionLocal() as session:
        stmt = select(Repo).order_by(Repo.created_at.desc())
        res = await session.execute(stmt)
        repos = res.scalars().all()

        if not repos:
            print("No repositories registered in database. Use 'codesage index <path>' to index one.")
            return 0

        print(f"{'ID':<38} {'NAME':<20} {'STATUS':<12} {'FILES':<8} {'FUNCS':<8} {'EDGES':<8}")
        print("-" * 96)
        for r in repos:
            stats = r.stats or {}
            files = stats.get("files", "-")
            funcs = stats.get("functions", "-")
            edges = stats.get("edges", "-")
            print(f"{str(r.id):<38} {r.name[:18]:<20} {r.status.value:<12} {str(files):<8} {str(funcs):<8} {str(edges):<8}")
    return 0


async def cmd_index(args: argparse.Namespace) -> int:
    """Index a local directory or remote repository."""
    await _init_db_schema()
    target = args.target
    path_obj = Path(target).expanduser().resolve() if not (target.startswith("http://") or target.startswith("https://") or target.startswith("git@")) else None

    if path_obj and not path_obj.exists():
        print(f"Error: Target path does not exist: {path_obj}", file=sys.stderr)
        return 1

    repo_name = args.name or (path_obj.name if path_obj else target.rstrip("/").split("/")[-1])
    target_url = str(path_obj) if path_obj else target

    async with AsyncSessionLocal() as session:
        # Check if existing repo
        stmt = select(Repo).where(Repo.github_url == target_url)
        res = await session.execute(stmt)
        repo = res.scalar_one_or_none()

        if repo:
            if repo.status == RepoStatus.complete and not args.force:
                print(f"Repository already indexed: {repo.name} ({repo.id}). Use --force to re-index.")
                return 0
            repo.status = RepoStatus.queued
            repo.error_code = None
            repo.error_message = None
        else:
            repo = Repo(github_url=target_url, name=repo_name, status=RepoStatus.queued)
            session.add(repo)
            await session.flush()

        task = Task(repo_id=repo.id, stage="queued", current_step=0, total_steps=0)
        session.add(task)
        await session.commit()
        repo_id = repo.id
        task_id = task.id

    print(f"Indexing repository: {repo_name}")
    print(f"  ID:     {repo_id}")
    print(f"  Source: {target_url}")
    print("-" * 60)

    last_stage = ""

    async def progress_reporter(event: dict) -> None:
        nonlocal last_stage
        stage = event.get("stage", "")
        if stage != last_stage:
            print(f"-> Stage: [{stage.upper()}] {event.get('message', '')}")
            last_stage = stage
        elif "current" in event and "total" in event:
            pct = event.get("progress", int(event["current"] / event["total"] * 100))
            print(f"   Progress: {event['current']}/{event['total']} ({pct}%)", end="\r")

    try:
        async with AsyncSessionLocal() as session:
            await run_ingestion(repo_id, task_id, target_url, session, sse_callback=progress_reporter)
        print("\n" + "=" * 60)
        print(f"Indexing complete for {repo_name} (ID: {repo_id})")
        return 0
    except Exception as e:
        print(f"\nIndexing failed: {e}", file=sys.stderr)
        return 1


async def cmd_search(args: argparse.Namespace) -> int:
    """Execute hybrid Graph-RAG retrieval for a query."""
    await _init_db_schema()
    async with AsyncSessionLocal() as session:
        try:
            repo = await _resolve_repo(session, args.repo)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1

        repo_id_str = str(repo.id)
        await _load_repo_graph(session, repo_id_str)

        print(f"Searching in '{repo.name}' ({repo_id_str[:8]}...) for: \"{args.query}\" [mode: {args.mode}]")
        print("-" * 70)

        chunks, latency_ms = retrieve(repo_id_str, args.query, mode=args.mode)

        if not chunks:
            print("No relevant code chunks retrieved.")
            return 0

        chunks_to_show = chunks[: args.limit]
        for i, c in enumerate(chunks_to_show, start=1):
            score_str = f"{c.score:.4f}" if c.score is not None else "N/A"
            chunk_type = getattr(c, "chunk_type", "chunk")
            lines_str = f"L{c.lines[0]}-{c.lines[1]}" if len(c.lines) >= 2 else "L1"
            print(f"[{i}] {c.name} ({chunk_type}) | {c.file}:{lines_str} | Score: {score_str}")
            
            # Print code preview
            content_lines = (c.content or "").strip().splitlines()
            preview = "\n".join("    " + line for line in content_lines[:4])
            if preview:
                print(preview)
            if len(content_lines) > 4:
                print("    ...")
            print()

        print(f"Retrieved {len(chunks_to_show)} chunks in {latency_ms}ms")
    return 0


async def cmd_callers(args: argparse.Namespace) -> int:
    """Find caller functions that call the given symbol."""
    await _init_db_schema()
    async with AsyncSessionLocal() as session:
        try:
            repo = await _resolve_repo(session, args.repo)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1

        repo_id_str = str(repo.id)
        await _load_repo_graph(session, repo_id_str)
        G = graph_svc.get_graph(repo_id_str)

        symbol = args.symbol

        def _matches_symbol(n: str, d: dict) -> bool:
            if d.get("name") == symbol:
                return True
            parts = str(n).split("::")
            if len(parts) >= 3 and parts[2] == symbol:
                return True
            return str(n) == symbol or str(n).endswith(f"::{symbol}")

        target_nodes = [n for n, d in G.nodes(data=True) if _matches_symbol(n, d)]

        if not target_nodes:
            print(f"Symbol '{symbol}' not found in call graph for repo '{repo.name}'.")
            return 1

        print(f"Callers of '{symbol}' in '{repo.name}':")
        found_any = False
        for node in target_nodes:
            predecessors = list(G.predecessors(node))
            if predecessors:
                found_any = True
                for pred in predecessors:
                    pdata = G.nodes[pred]
                    print(f"  <- {pdata.get('name', pred)} ({pdata.get('file', '')}:{pdata.get('start_line', 0)})")

        if not found_any:
            print("  (No direct callers found in graph)")
    return 0


async def cmd_callees(args: argparse.Namespace) -> int:
    """Find functions called by the given symbol."""
    await _init_db_schema()
    async with AsyncSessionLocal() as session:
        try:
            repo = await _resolve_repo(session, args.repo)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1

        repo_id_str = str(repo.id)
        await _load_repo_graph(session, repo_id_str)
        G = graph_svc.get_graph(repo_id_str)

        symbol = args.symbol

        def _matches_symbol(n: str, d: dict) -> bool:
            if d.get("name") == symbol:
                return True
            parts = str(n).split("::")
            if len(parts) >= 3 and parts[2] == symbol:
                return True
            return str(n) == symbol or str(n).endswith(f"::{symbol}")

        target_nodes = [n for n, d in G.nodes(data=True) if _matches_symbol(n, d)]

        if not target_nodes:
            print(f"Symbol '{symbol}' not found in call graph for repo '{repo.name}'.")
            return 1

        print(f"Functions called by '{symbol}' in '{repo.name}':")
        found_any = False
        for node in target_nodes:
            successors = list(G.successors(node))
            if successors:
                found_any = True
                for succ in successors:
                    sdata = G.nodes[succ]
                    print(f"  -> {sdata.get('name', succ)} ({sdata.get('file', '')}:{sdata.get('start_line', 0)})")

        if not found_any:
            print("  (No direct calls found in graph)")
    return 0


def cmd_mcp(args: argparse.Namespace) -> int:
    """Launch Model Context Protocol (MCP) stdio JSON-RPC server."""
    from app.mcp_server import handle_stdio_rpc
    handle_stdio_rpc()
    return 0


# ─── Main CLI Parser ──────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codesage",
        description="CodeSage Developer CLI — Graph-Augmented RAG Engine for Codebases",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # doctor
    subparsers.add_parser("doctor", help="Run system diagnostics and verify dependencies")
    subparsers.add_parser("status", help="Alias for doctor")

    # repos
    subparsers.add_parser("repos", help="List all indexed repositories")

    # index
    index_parser = subparsers.add_parser("index", help="Index a local directory or remote Git repo")
    index_parser.add_argument("target", help="Local directory path or git URL to index")
    index_parser.add_argument("--name", help="Custom name for the repository")
    index_parser.add_argument("--force", action="store_true", help="Re-index if already complete")

    # search
    search_parser = subparsers.add_parser("search", help="Execute Graph-RAG retrieval for a code query")
    search_parser.add_argument("query", help="Query string or symbol name")
    search_parser.add_argument("--repo", help="Repository UUID or name (optional if only 1 repo exists)")
    search_parser.add_argument("--mode", default="graph", choices=["graph", "hybrid", "naive", "2hop"], help="Retrieval mode")
    search_parser.add_argument("--limit", type=int, default=5, help="Number of results to display")

    # callers
    callers_parser = subparsers.add_parser("callers", help="Inspect caller functions of a symbol")
    callers_parser.add_argument("symbol", help="Target function or class name")
    callers_parser.add_argument("--repo", help="Repository UUID or name")

    # callees
    callees_parser = subparsers.add_parser("callees", help="Inspect callees called by a symbol")
    callees_parser.add_argument("symbol", help="Target function or class name")
    callees_parser.add_argument("--repo", help="Repository UUID or name")

    # mcp
    subparsers.add_parser("mcp", help="Start CodeSage MCP stdio JSON-RPC server")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    if args.command in ("doctor", "status"):
        return asyncio.run(cmd_doctor(args))
    elif args.command == "repos":
        return asyncio.run(cmd_repos(args))
    elif args.command == "index":
        return asyncio.run(cmd_index(args))
    elif args.command == "search":
        return asyncio.run(cmd_search(args))
    elif args.command == "callers":
        return asyncio.run(cmd_callers(args))
    elif args.command == "callees":
        return asyncio.run(cmd_callees(args))
    elif args.command == "mcp":
        return cmd_mcp(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
