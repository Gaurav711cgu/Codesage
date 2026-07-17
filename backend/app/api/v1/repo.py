"""
Repo endpoints:
  POST   /api/v1/repo/ingest                      — start ingestion
  GET    /api/v1/repo/ingest/{task_id}/progress   — SSE progress stream
  GET    /api/v1/repo/ingest/{task_id}/status      — polling fallback
  GET    /api/v1/repos                             — list all repos
  DELETE /api/v1/repo/{repo_id}                   — delete repo + collections
  POST   /api/v1/repo/query                        — SSE query stream
"""
import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.repo import Repo, Task
from app.models.schemas import (
    ApiResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    RepoSummary,
    RepoStats,
    TaskStatusResponse,
)
from app.services import chromadb_client, graph as graph_svc, retrieval as retrieval_svc
from app.services.ingestion import run_ingestion
from app.services.gemini import stream_llm
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["repos"])

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _sse_event(event: str, data: dict | str) -> str:
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"event: {event}\ndata: {payload}\n\n"


def _err(code: str, message: str, status: int = 400) -> HTTPException:
    raise HTTPException(
        status_code=status,
        detail={"data": None, "error": {"code": code, "message": message}},
    )


# ─── POST /api/v1/repo/ingest ─────────────────────────────────────────────────


@router.post("/repo/ingest", status_code=202)
@limiter.limit("100/hour")
async def ingest_repo(
    request: Request,
    body: IngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate
    existing = await db.execute(
        select(Repo).where(Repo.github_url == body.github_url)
    )
    existing_repo = existing.scalar_one_or_none()
    if existing_repo:
        if existing_repo.status == "complete":
            _err("ALREADY_INDEXED", f"{body.github_url} is already indexed", 409)
        else:
            logger.info("Found incomplete repo %s with status %s. Deleting to allow retry.", body.github_url, existing_repo.status)
            await db.delete(existing_repo)
            await db.commit()

    repo_name = body.name or body.github_url.rstrip("/").split("/")[-1]
    repo = Repo(github_url=body.github_url, name=repo_name, status="queued")
    db.add(repo)
    await db.flush()  # get repo.id without committing

    task = Task(repo_id=repo.id, stage="queued", current_step=0, total_steps=0)
    db.add(task)
    await db.commit()
    await db.refresh(repo)
    await db.refresh(task)

    # Fire-and-forget ingestion in the background.
    # We need a fresh DB session for the background task — get_db() yields
    # a context-managed session so we create one directly.
    from app.core.database import AsyncSessionLocal

    async def _run():
        try:
            async with AsyncSessionLocal() as bg_db:
                await run_ingestion(repo.id, task.id, body.github_url, bg_db)
        except Exception as exc:
            logger.error(f"Background task failed: {exc}")

    background_tasks.add_task(_run)

    return JSONResponse(
        status_code=202,
        content={
            "data": {
                "task_id": str(task.id),
                "repo_id": str(repo.id),
                "status": "queued",
            },
            "error": None,
        },
    )


# ─── GET /api/v1/repo/ingest/{task_id}/progress  (SSE) ───────────────────────


@router.get("/repo/ingest/{task_id}/progress")
async def ingest_progress(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events stream for ingestion progress.
    Polls the tasks table every second and forwards stage changes.
    Closes when status == complete | failed.
    """
    async def _event_stream() -> AsyncGenerator[str, None]:
        last_stage = None
        last_current = -1
        timeout_ticks = 0
        max_idle_ticks = 600  # 10 minutes at 1s polling

        while timeout_ticks < max_idle_ticks:
            await asyncio.sleep(1)
            result = await db.execute(
                select(Task).where(Task.id == task_id)
            )
            task = result.scalar_one_or_none()
            if task is None:
                yield _sse_event("error", {"code": "TASK_NOT_FOUND",
                                           "message": f"Task {task_id} not found"})
                return

            if task.stage != last_stage or task.current_step != last_current:
                last_stage = task.stage
                last_current = task.current_step
                timeout_ticks = 0

                if task.status in ("complete", "failed"):
                    # Fetch repo stats for the complete event
                    repo_result = await db.execute(
                        select(Repo).where(Repo.id == task.repo_id)
                    )
                    repo = repo_result.scalar_one_or_none()
                    if task.status == "complete" and repo:
                        yield _sse_event("complete", {
                            "repo_id": str(repo.id),
                            "stats": repo.stats or {},
                        })
                    else:
                        yield _sse_event("error", {
                            "code": repo.error_code if repo else "UNKNOWN",
                            "message": repo.error_message if repo else "Ingestion failed",
                        })
                    return
                else:
                    yield _sse_event("progress", {
                        "stage": task.stage,
                        "current": task.current_step,
                        "total": task.total_steps,
                        "message": f"Stage: {task.stage}",
                    })
            else:
                timeout_ticks += 1

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── GET /api/v1/repo/ingest/{task_id}/status  (polling fallback) ─────────────


@router.get("/repo/ingest/{task_id}/status", response_model=ApiResponse)
async def ingest_status(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        _err("TASK_NOT_FOUND", f"Task {task_id} not found", 404)

    return {
        "data": TaskStatusResponse(
            stage=task.stage,
            current=task.current_step,
            total=task.total_steps,
            status=task.status,  # type: ignore[arg-type]
        ).model_dump(),
        "error": None,
    }


# ─── GET /api/v1/repos ────────────────────────────────────────────────────────


@router.get("/repos", response_model=ApiResponse)
async def list_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Repo).order_by(Repo.created_at.desc())
    )
    repos = result.scalars().all()
    data = []
    for r in repos:
        stats = None
        if r.stats:
            stats = RepoStats(**r.stats)
        data.append(
            RepoSummary(
                id=r.id,
                name=r.name,
                github_url=r.github_url,
                status=r.status,
                stats=stats,
                created_at=r.created_at,
            ).model_dump(mode="json")
        )
    return {"data": data, "error": None}


# ─── DELETE /api/v1/repo/{repo_id} ────────────────────────────────────────────


@router.delete("/repo/{repo_id}", status_code=204)
async def delete_repo(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        _err("REPO_NOT_FOUND", f"Repo {repo_id} not found", 404)

    if repo.status in ("cloning", "parsing", "graphing", "embedding", "storing"):
        _err("INGESTION_IN_PROGRESS",
             "Cannot delete repo while ingestion is running", 409)

    # Delete ChromaDB collections
    chromadb_client.delete_repo_collections(str(repo_id))

    # Evict graph from cache
    graph_svc.invalidate_graph(str(repo_id))

    # Cascade-delete via FK (tasks + messages set null handled by DB)
    await db.delete(repo)
    await db.commit()


# ─── POST /api/v1/repo/query  (SSE) ──────────────────────────────────────────


@router.post("/repo/query")
@limiter.limit("30/minute")
async def query_repo(
    request: Request,
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Repo).where(Repo.id == body.repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        _err("REPO_NOT_FOUND", f"Repo {body.repo_id} not found", 404)
    if repo.status != "complete":
        _err("REPO_NOT_READY",
             f"Repo is not ready (status: {repo.status}). Wait for ingestion to complete.",
             400)

    graph_data_json: str | None = repo.graph_data  # may be None pre-cache

    async def _stream() -> AsyncGenerator[str, None]:
        import time

        try:
            # Retrieval (blocking I/O, run in thread pool)
            chunks, retrieval_latency = await asyncio.to_thread(
                retrieval_svc.retrieve,
                str(body.repo_id),
                body.query,
                body.retrieval_mode,
                graph_data_json,
            )

            yield _sse_event("retrieval_done", {
                "chunks": [c.model_dump() for c in chunks],
                "latency_ms": retrieval_latency,
            })

            # Build prompt from retrieved context
            context_lines: list[str] = []
            for c in chunks:
                tag = "[SEED]" if c.type == "seed" else "[NEIGHBOR]"
                context_lines.append(
                    f"{tag} {c.name}  ({c.file}  L{c.lines[0]}–{c.lines[1]})"
                )
            context_str = "\n".join(context_lines)

            prompt = (
                "You are a code analysis assistant. Use the retrieved context below "
                "to answer the question. Reference function names and file paths "
                "where relevant.\n\n"
                f"=== Retrieved context ===\n{context_str}\n\n"
                f"=== Question ===\n{body.query}"
            )

            # Stream Gemini response
            t_start = time.perf_counter()
            total_tokens = 0
            
            gen = stream_llm(prompt)
            while True:
                token_text = await asyncio.to_thread(next, gen, None)
                if token_text is None:
                    break
                total_tokens += 1
                yield _sse_event("token", {"text": token_text})

            total_latency = int((time.perf_counter() - t_start) * 1000) + retrieval_latency
            yield _sse_event("done", {
                "total_tokens": total_tokens,
                "total_latency_ms": total_latency,
            })
        except Exception as exc:
            logger.error("Error in query stream: %s", exc, exc_info=True)
            yield _sse_event("error", {"code": "STREAM_ERROR", "message": str(exc)})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
