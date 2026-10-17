"""
CodeSage Dynamic Repository Seeder.

Provisions sample and core codebases into CodeSage SQLite, ChromaDB, and
BM25 inverted indices for immediate local experimentation, frontend UI,
and offline evaluation benchmarks.
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add backend directory to sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.repo import Repo, RepoStatus, Task
from app.services.ingestion import run_ingestion

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("codesage.seeder")

engine.echo = False
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

TARGET_PRESETS = {
    "sample": {
        "name": "codesage-sample-repo",
        "path": ROOT_DIR / "benchmarks" / "data" / "sample_repo",
        "description": "Multi-language Python + TypeScript microservice fixture",
    },
    "core": {
        "name": "codesage-core",
        "path": ROOT_DIR / "backend" / "app",
        "description": "CodeSage backend engine architecture (Graph-RAG, Ingestion, MCP)",
    },
}


async def _init_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_target(target_key: str, force: bool = False) -> Repo:
    """Seed a specific target repository preset."""
    if target_key not in TARGET_PRESETS:
        raise ValueError(f"Unknown preset '{target_key}'. Available: {list(TARGET_PRESETS.keys())}")

    preset = TARGET_PRESETS[target_key]
    target_path = Path(preset["path"]).resolve()
    repo_name = preset["name"]

    if not target_path.exists():
        raise FileNotFoundError(f"Target path does not exist: {target_path}")

    await _init_tables()

    target_url = str(target_path)
    async with AsyncSessionLocal() as session:
        stmt = select(Repo).where(Repo.github_url == target_url)
        res = await session.execute(stmt)
        repo = res.scalar_one_or_none()

        if repo and repo.status == RepoStatus.complete and not force:
            logger.info("Repository '%s' already indexed (%s). Skipping (use --force to re-index).", repo_name, repo.id)
            return repo

        if repo:
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

    logger.info("Starting ingestion for %s (Path: %s)", repo_name, target_url)

    last_stage = ""

    async def _progress(evt: dict) -> None:
        nonlocal last_stage
        stage = evt.get("stage", "")
        if stage != last_stage:
            logger.info("  [Stage: %s] %s", stage.upper(), evt.get("message", ""))
            last_stage = stage

    async with AsyncSessionLocal() as session:
        await run_ingestion(repo_id, task_id, target_url, session, sse_callback=_progress)

    async with AsyncSessionLocal() as session:
        stmt = select(Repo).where(Repo.id == repo_id)
        res = await session.execute(stmt)
        final_repo = res.scalar_one()

    logger.info("Successfully seeded '%s' (%s): %s", repo_name, final_repo.id, final_repo.stats)
    return final_repo


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Seed CodeSage with sample and benchmark repositories.")
    parser.add_argument(
        "--target",
        choices=["sample", "core", "all"],
        default="sample",
        help="Repository target to seed (default: sample)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-indexing even if repository already exists in complete status",
    )
    args = parser.parse_args()

    targets_to_seed = ["sample", "core"] if args.target == "all" else [args.target]

    print("=" * 60)
    print("  CodeSage Dynamic Repository Seeder")
    print("=" * 60)

    for tgt in targets_to_seed:
        try:
            repo = await seed_target(tgt, force=args.force)
            print(f"[✓] Successfully seeded '{tgt}': {repo.name} ({repo.id})")
        except Exception as e:
            logger.exception("Failed to seed '%s': %s", tgt, e)
            print(f"[✗] Failed to seed '{tgt}': {e}", file=sys.stderr)
            return 1

    print("=" * 60)
    print("Seeding complete. Run './bin/codesage repos' to inspect indexed codebases.")
    return 0


def main() -> None:
    sys.exit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()
