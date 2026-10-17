"""
Unit tests for Incremental Ingestion Manifest and SHA-256 Change Detection.
"""
from pathlib import Path
import pytest

from app.services.incremental import (
    IncrementalManifest,
    compute_file_sha256,
    IngestionDiff,
)


def test_compute_file_sha256(tmp_path: Path):
    f = tmp_path / "hello.py"
    f.write_text("print('hello world')\n")
    h1 = compute_file_sha256(f)
    assert len(h1) == 64

    # Change content
    f.write_text("print('hello modified')\n")
    h2 = compute_file_sha256(f)
    assert h1 != h2


def test_incremental_manifest_diff(tmp_path: Path):
    repo_dir = tmp_path / "my_repo"
    repo_dir.mkdir()
    manifest_dir = tmp_path / "manifests"

    f1 = repo_dir / "app.py"
    f1.write_text("def run(): pass\n")
    f2 = repo_dir / "utils.py"
    f2.write_text("def helper(): pass\n")

    manifest = IncrementalManifest("test_repo", manifest_dir=manifest_dir)

    # Initial diff: both files should be added
    diff1 = manifest.diff_directory(repo_dir, [f1, f2])
    assert len(diff1.added_files) == 2
    assert len(diff1.modified_files) == 0
    assert diff1.unchanged_count == 0

    # Record both files
    manifest.record_file("app.py", compute_file_sha256(f1), ["chunk_1"])
    manifest.record_file("utils.py", compute_file_sha256(f2), ["chunk_2"])
    manifest.save()

    # Second diff with no changes: both files unchanged
    manifest2 = IncrementalManifest("test_repo", manifest_dir=manifest_dir)
    diff2 = manifest2.diff_directory(repo_dir, [f1, f2])
    assert len(diff2.added_files) == 0
    assert len(diff2.modified_files) == 0
    assert diff2.unchanged_count == 2

    # Modify f1, delete f2, add f3
    f1.write_text("def run(): return 42\n")
    f2.unlink()
    f3 = repo_dir / "extra.py"
    f3.write_text("class Extra: pass\n")

    diff3 = manifest2.diff_directory(repo_dir, [f1, f3])
    assert len(diff3.added_files) == 1
    assert diff3.added_files[0] == f3
    assert len(diff3.modified_files) == 1
    assert diff3.modified_files[0] == f1
    assert "utils.py" in diff3.deleted_paths
    assert diff3.unchanged_count == 0
