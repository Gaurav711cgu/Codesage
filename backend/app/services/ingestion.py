"""
Ingestion pipeline — 7 stages:
  1. Clone repo (gitpython, depth=1)
  2. Discover Python files
  3. Tree-sitter parse → CodeUnit objects
  4. Build NetworkX call graph
  5. Generate embeddings (text-embedding-004)
  6. Store in ChromaDB
  7. Finalise (update DB, cache graph, cleanup)

Every stage transition is written to the tasks table so the frontend
can reconnect after an SSE drop and recover last-known state.
"""
import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncGenerator, Callable, Awaitable

import httpx
from git import Repo as GitRepo
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from tree_sitter import Language, Parser
import tree_sitter_python as tspython

from app.core.config import settings
from app.models.repo import Repo, Task
from app.services import chromadb_client, graph as graph_svc
from app.services.gemini import embed_texts

logger = logging.getLogger(__name__)

# ─── Tree-sitter setup ────────────────────────────────────────────────────────

PY_LANGUAGE = Language(tspython.language())
_parser = Parser(PY_LANGUAGE)


# ─── Data model ───────────────────────────────────────────────────────────────

@dataclass
class CodeUnit:
    id: str                       # "{repo_id}::{file_rel}::{name}"
    repo_id: str
    name: str
    file: str                     # relative path inside repo
    type: str                     # "function" | "class"
    start_line: int
    end_line: int
    source: str                   # raw source text of the unit
    docstring: str = ""
    calls: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)

    def to_document(self) -> str:
        """Text fed to the embedder."""
        parts = [
            f"File: {self.file}",
            f"Type: {self.type}",
            f"Name: {self.name}",
        ]
        if self.docstring:
            parts.append(f"Docstring: {self.docstring}")
        if self.calls:
            parts.append(f"Calls: {', '.join(self.calls)}")
        parts.append(self.source)
        return "\n".join(parts)

    def to_metadata(self) -> dict:
        return {
            "name": self.name,
            "file": self.file,
            "type": self.type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "calls": json.dumps(self.calls),
        }

    def to_graph_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "file": self.file,
            "type": self.type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "calls": self.calls,
        }


# ─── SSE event helpers ────────────────────────────────────────────────────────

SSECallback = Callable[[dict], Awaitable[None]]


async def _noop_sse(data: dict) -> None:
    pass


# ─── DB helpers (sync-safe via run_sync or direct async) ─────────────────────

async def _update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    stage: str,
    current: int = 0,
    total: int = 0,
    status: str = "running",
) -> None:
    await db.execute(
        update(Task)
        .where(Task.id == task_id)
        .values(stage=stage, current_step=current, total_steps=total, status=status)
    )
    await db.commit()


async def _update_repo_status(
    db: AsyncSession,
    repo_id: uuid.UUID,
    status: str,
    error_code: str | None = None,
    error_message: str | None = None,
    stats: dict | None = None,
    graph_data: str | None = None,
) -> None:
    values: dict = {"status": status}
    if error_code:
        values["error_code"] = error_code
    if error_message:
        values["error_message"] = error_message
    if stats:
        values["stats"] = stats
    if graph_data is not None:
        values["graph_data"] = graph_data
    await db.execute(update(Repo).where(Repo.id == repo_id).values(**values))
    await db.commit()


# ─── Tree-sitter parsing helpers ──────────────────────────────────────────────

def _node_text(node, src_bytes: bytes) -> str:
    return src_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _extract_docstring(body_node, src_bytes: bytes) -> str:
    """Return the first string literal in a function/class body as docstring."""
    for child in body_node.children:
        if child.type == "expression_statement":
            for grandchild in child.children:
                if grandchild.type in ("string", "concatenated_string"):
                    raw = _node_text(grandchild, src_bytes)
                    return raw.strip('"""').strip("'''").strip('"').strip("'").strip()
    return ""


def _extract_calls(body_node, src_bytes: bytes) -> list[str]:
    """Walk the AST and collect all call names (simple name only, no attrs)."""
    calls: list[str] = []

    def walk(node):
        if node.type == "call":
            func_node = node.child_by_field_name("function")
            if func_node:
                if func_node.type == "identifier":
                    calls.append(_node_text(func_node, src_bytes))
                elif func_node.type == "attribute":
                    attr = func_node.child_by_field_name("attribute")
                    if attr:
                        calls.append(_node_text(attr, src_bytes))
        for child in node.children:
            walk(child)

    walk(body_node)
    return list(dict.fromkeys(calls))  # deduplicate preserving order


def _extract_imports(tree_root, src_bytes: bytes) -> list[str]:
    imports: list[str] = []
    for node in tree_root.children:
        if node.type in ("import_statement", "import_from_statement"):
            imports.append(_node_text(node, src_bytes).strip())
    return imports


def parse_python_file(
    file_path: Path, repo_id: str, file_rel: str
) -> list[CodeUnit]:
    """Parse a single Python file and return a list of CodeUnit objects."""
    try:
        src_bytes = file_path.read_bytes()
    except Exception as exc:
        logger.warning("Could not read %s: %s", file_path, exc)
        return []

    tree = _parser.parse(src_bytes)
    root = tree.root_node
    imports = _extract_imports(root, src_bytes)
    units: list[CodeUnit] = []

    def process_node(node, parent_class: str | None = None):
        if node.type in ("function_definition", "async_function_definition"):
            name_node = node.child_by_field_name("name")
            body_node = node.child_by_field_name("body")
            if not name_node or not body_node:
                return
            name = _node_text(name_node, src_bytes)
            qualified = f"{parent_class}.{name}" if parent_class else name
            unit_id = f"{repo_id}::{file_rel}::{qualified}::{node.start_point[0] + 1}"
            units.append(
                CodeUnit(
                    id=unit_id,
                    repo_id=repo_id,
                    name=qualified,
                    file=file_rel,
                    type="function",
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    source=_node_text(node, src_bytes),
                    docstring=_extract_docstring(body_node, src_bytes),
                    calls=_extract_calls(body_node, src_bytes),
                    imports=imports,
                )
            )
            # Recurse into nested functions
            for child in body_node.children:
                process_node(child, parent_class)

        elif node.type == "class_definition":
            name_node = node.child_by_field_name("name")
            body_node = node.child_by_field_name("body")
            if not name_node or not body_node:
                return
            class_name = _node_text(name_node, src_bytes)
            unit_id = f"{repo_id}::{file_rel}::{class_name}::{node.start_point[0] + 1}"
            units.append(
                CodeUnit(
                    id=unit_id,
                    repo_id=repo_id,
                    name=class_name,
                    file=file_rel,
                    type="class",
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    source=_node_text(node, src_bytes),
                    docstring=_extract_docstring(body_node, src_bytes),
                    calls=[],
                    imports=imports,
                )
            )
            # Recurse into class body for methods
            for child in body_node.children:
                process_node(child, class_name)

    for node in root.children:
        process_node(node)

    return units


# ─── GitHub size check ────────────────────────────────────────────────────────

async def _check_repo_size(github_url: str) -> None:
    """Raise if repo > MAX_REPO_SIZE_KB using GitHub API."""
    parts = github_url.rstrip("/").split("/")
    owner, repo = parts[-2], parts[-1]
    
    headers = {"Accept": "application/vnd.github.v3+json"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
        
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                size_kb = resp.json().get("size", 0)
                if size_kb > settings.max_repo_size_kb:
                    raise ValueError(f"Repo is {size_kb}KB, limit is {settings.max_repo_size_kb}KB")
            elif resp.status_code == 404:
                raise ValueError("Repository not found or is private")
        except ValueError:
            raise
        except Exception as exc:
            logger.warning("GitHub API size check failed: %s — proceeding anyway", exc)


# ─── Main pipeline ────────────────────────────────────────────────────────────

async def run_ingestion(
    repo_id: uuid.UUID,
    task_id: uuid.UUID,
    github_url: str,
    db: AsyncSession,
    sse_callback: SSECallback = _noop_sse,
) -> None:
    """
    Full 7-stage ingestion pipeline. Writes progress to DB and emits SSE events.
    Any unrecoverable error sets repo status=failed and re-raises.
    """
    repo_id_str = str(repo_id)
    clone_dir = Path(settings.tmp_clone_dir) / str(task_id)

    async def emit(data: dict) -> None:
        await sse_callback(data)

    try:
        # ── Stage 1: Clone ────────────────────────────────────────────────────
        await _update_repo_status(db, repo_id, "cloning")
        await _update_task(db, task_id, "cloning")
        await emit({"stage": "cloning", "message": "Checking repository size…"})

        await _check_repo_size(github_url)

        clone_dir.mkdir(parents=True, exist_ok=True)
        await emit({"stage": "cloning", "message": "Cloning repository (depth=1)…"})

        await asyncio.to_thread(
            GitRepo.clone_from,
            github_url,
            str(clone_dir),
            depth=1,
            single_branch=True,
        )
        logger.info("Cloned %s to %s", github_url, clone_dir)

        # ── Stage 2: Discover files ───────────────────────────────────────────
        await _update_repo_status(db, repo_id, "parsing")
        await _update_task(db, task_id, "discovering")

        python_files: list[Path] = []
        excluded = set(settings.excluded_dirs)
        for root, dirs, files in os.walk(clone_dir):
            # Prune excluded dirs in-place so os.walk doesn't descend into them
            dirs[:] = [d for d in dirs if d not in excluded and not d.startswith(".")]
            for fname in files:
                if fname.endswith(".py"):
                    python_files.append(Path(root) / fname)

        total_files = len(python_files)
        await emit({"stage": "discovering", "total_files": total_files})
        await _update_task(db, task_id, "discovering", 0, total_files)
        logger.info("Found %d Python files in %s", total_files, clone_dir)

        # ── Stage 3: Parse ────────────────────────────────────────────────────
        all_units: list[CodeUnit] = []
        for i, fpath in enumerate(python_files):
            file_rel = str(fpath.relative_to(clone_dir))
            units = await asyncio.to_thread(
                parse_python_file, fpath, repo_id_str, file_rel
            )
            all_units.extend(units)
            if i % 10 == 0 or i == total_files - 1:
                await emit({"stage": "parsing", "current": i + 1, "total": total_files})
                await _update_task(db, task_id, "parsing", i + 1, total_files)

        functions = [u for u in all_units if u.type == "function"]
        classes   = [u for u in all_units if u.type == "class"]
        logger.info(
            "Parsed %d units (%d functions, %d classes)",
            len(all_units), len(functions), len(classes),
        )

        # ── Stage 4: Build call graph ─────────────────────────────────────────
        await _update_repo_status(db, repo_id, "graphing")
        await _update_task(db, task_id, "graph")

        G = await asyncio.to_thread(
            graph_svc.build_graph, [u.to_graph_dict() for u in all_units]
        )
        graph_json = graph_svc.serialise_graph(G)

        await emit({
            "stage": "graph",
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
        })
        await _update_task(db, task_id, "graph", G.number_of_nodes(), G.number_of_edges())

        # ── Stage 5+6: Embed and store ────────────────────────────────────────
        await _update_repo_status(db, repo_id, "embedding")

        # Group units by collection suffix
        unit_groups = {
            "_functions": functions,
            "_classes": classes,
            "_files": [],  # file-level summaries added below
        }

        # Build one file-level document per file (aggregated imports + unit names)
        file_map: dict[str, list[CodeUnit]] = {}
        for u in all_units:
            file_map.setdefault(u.file, []).append(u)

        file_units: list[CodeUnit] = []
        for file_rel, units_in_file in file_map.items():
            unit_names = [u.name for u in units_in_file]
            unit_id = f"{repo_id_str}::FILE::{file_rel}"
            file_units.append(
                CodeUnit(
                    id=unit_id,
                    repo_id=repo_id_str,
                    name=file_rel,
                    file=file_rel,
                    type="file",
                    start_line=1,
                    end_line=0,
                    source="\n".join(
                        units_in_file[0].imports if units_in_file else []
                    ),
                    docstring="",
                    calls=[],
                    imports=units_in_file[0].imports if units_in_file else [],
                )
            )
            # Overwrite source with a useful summary
            file_units[-1].source = (
                f"File: {file_rel}\n"
                f"Contains: {', '.join(unit_names[:30])}"
            )
        unit_groups["_files"] = file_units

        try:
            total_batches = sum(
                (len(v) + 99) // 100 for v in unit_groups.values() if v
            )
            batch_done = 0

            for suffix, units in unit_groups.items():
                if not units:
                    continue

                ids       = [u.id for u in units]
                documents = [u.to_document() for u in units]
                metadatas = [u.to_metadata() for u in units]

                # Store in ChromaDB directly in batches
                await _update_repo_status(db, repo_id, "storing")
                for b_start in range(0, len(documents), 100):
                    batch_ids = ids[b_start : b_start + 100]
                    batch_docs = documents[b_start : b_start + 100]
                    batch_metas = metadatas[b_start : b_start + 100]
                    
                    await asyncio.to_thread(
                        chromadb_client.upsert_documents,
                        repo_id_str, suffix, batch_ids, batch_docs, None, batch_metas,
                    )
                    batch_done += 1
                    pct = int(batch_done / total_batches * 100)
                    await emit({"stage": "storing", "current": batch_done,
                                "total": total_batches, "progress": pct})
                    await _update_task(db, task_id, "storing", batch_done, total_batches)

        except Exception as exc:
            # Clean up any partial ChromaDB state
            logger.error("Embed/store failed, cleaning up partial collections: %s", exc)
            for suffix in chromadb_client.SUFFIXES:
                try:
                    chromadb_client.delete_repo_collections(repo_id_str)
                except Exception:
                    pass
            raise

        # ── Stage 7: Finalise ─────────────────────────────────────────────────
        stats = {
            "files": total_files,
            "functions": len(functions),
            "classes": len(classes),
            "edges": G.number_of_edges(),
        }
        await _update_repo_status(
            db, repo_id, "complete",
            stats=stats,
            graph_data=graph_json,
        )
        await _update_task(db, task_id, "complete", status="complete")

        # Cache the graph in memory for fast retrieval
        graph_svc.cache_graph(repo_id_str, G)

        # Clean up clone dir
        shutil.rmtree(clone_dir, ignore_errors=True)

        await emit({"stage": "complete", "stats": stats})
        logger.info("Ingestion complete for repo %s: %s", repo_id_str, stats)

    except Exception as exc:
        error_msg = str(exc)
        logger.exception("Ingestion failed for repo %s: %s", repo_id_str, error_msg)
        await _update_repo_status(
            db, repo_id, "failed",
            error_code="INGESTION_FAILED",
            error_message=error_msg,
        )
        await _update_task(db, task_id, "failed", status="failed")
        shutil.rmtree(clone_dir, ignore_errors=True)
        await emit({"stage": "error", "code": "INGESTION_FAILED", "message": error_msg})
        raise
