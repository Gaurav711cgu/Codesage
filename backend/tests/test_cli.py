"""
Automated unit & integration tests for CodeSage Developer CLI (backend/app/cli.py).
"""
import argparse
import asyncio
import io
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.cli import (
    build_parser,
    cmd_callees,
    cmd_callers,
    cmd_doctor,
    cmd_index,
    cmd_repos,
    cmd_search,
)
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.repo import Repo, RepoStatus


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.mark.asyncio
async def test_cli_parser():
    parser = build_parser()
    args = parser.parse_args(["doctor"])
    assert args.command == "doctor"

    args = parser.parse_args(["search", "calculate_metrics", "--limit", "3", "--mode", "hybrid"])
    assert args.command == "search"
    assert args.query == "calculate_metrics"
    assert args.limit == 3
    assert args.mode == "hybrid"


@pytest.mark.asyncio
async def test_cli_doctor(capsys):
    args = argparse.Namespace(command="doctor")
    ret = await cmd_doctor(args)
    captured = capsys.readouterr().out
    assert ret == 0
    assert "CodeSage System Diagnostics" in captured
    assert "Database:         Connected" in captured
    assert "Tree-sitter:      Grammars loaded" in captured


@pytest.mark.asyncio
async def test_cli_repos_empty(capsys):
    args = argparse.Namespace(command="repos")
    ret = await cmd_repos(args)
    assert ret == 0


@pytest.mark.asyncio
async def test_cli_index_search_and_graph(capsys, monkeypatch):
    # 1. Setup temporary code repository fixture
    temp_dir = tempfile.mkdtemp(prefix="codesage_cli_test_")
    try:
        sample_file = Path(temp_dir) / "math_service.py"
        sample_file.write_text(
            '''def add_numbers(x: int, y: int) -> int:
    """Add two numbers together."""
    return x + y

def calculate_stats(data: list[int]) -> int:
    """Calculate aggregate stats by calling add_numbers."""
    total = 0
    for val in data:
        total = add_numbers(total, val)
    return total
'''
        )

        # 2. Run index via CLI
        index_args = argparse.Namespace(
            command="index",
            target=str(temp_dir),
            name="test_cli_math_repo",
            force=True,
        )
        ret = await cmd_index(index_args)
        captured = capsys.readouterr().out
        assert ret == 0
        assert "Indexing complete for test_cli_math_repo" in captured

        # 3. Verify in repos command
        repos_args = argparse.Namespace(command="repos")
        ret = await cmd_repos(repos_args)
        captured = capsys.readouterr().out
        assert ret == 0
        assert "test_cli_math_repo" in captured

        # 4. Search in indexed repo
        search_args = argparse.Namespace(
            command="search",
            query="add_numbers",
            repo="test_cli_math_repo",
            mode="graph",
            limit=5,
        )
        ret = await cmd_search(search_args)
        captured = capsys.readouterr().out
        assert ret == 0
        assert "add_numbers" in captured
        assert "math_service.py" in captured

        # 5. Callers check (who calls add_numbers -> calculate_stats)
        callers_args = argparse.Namespace(
            command="callers",
            symbol="add_numbers",
            repo="test_cli_math_repo",
        )
        ret = await cmd_callers(callers_args)
        captured = capsys.readouterr().out
        assert ret == 0
        assert "calculate_stats" in captured

        # 6. Callees check (who does calculate_stats call -> add_numbers)
        callees_args = argparse.Namespace(
            command="callees",
            symbol="calculate_stats",
            repo="test_cli_math_repo",
        )
        ret = await cmd_callees(callees_args)
        captured = capsys.readouterr().out
        assert ret == 0
        assert "add_numbers" in captured

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
