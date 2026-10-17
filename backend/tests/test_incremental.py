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


def test_incremental_manifest_chunk_caching(tmp_path: Path):
    manifest_dir = tmp_path / "manifests"
    manifest = IncrementalManifest("repo_123", manifest_dir=manifest_dir)

    dummy_chunk = {
        "id": "repo_123::file1.py::greet",
        "repo_id": "repo_123",
        "name": "greet",
        "file": "file1.py",
        "type": "function",
        "start_line": 1,
        "end_line": 5,
        "source": "def greet(): return 'hi'",
        "docstring": "greeting",
        "calls": [],
        "imports": [],
        "parent_class": None,
        "parent_docstring": None,
        "parent_header": "",
        "chunk_index": 0,
        "total_chunks": 1,
    }

    manifest.record_file("file1.py", "hash_abc", ["repo_123::file1.py::greet"], [dummy_chunk])
    manifest.save()

    # Reload from disk
    reloaded = IncrementalManifest("repo_123", manifest_dir=manifest_dir)
    chunks = reloaded.get_file_chunks("file1.py")
    assert len(chunks) == 1
    assert chunks[0].name == "greet"
    assert chunks[0].file == "file1.py"
    assert chunks[0].to_document().startswith("File: file1.py")

    all_cached = reloaded.get_all_cached_units()
    assert len(all_cached) == 1

    # Remove file
    deleted_ids = reloaded.remove_file("file1.py")
    assert deleted_ids == ["repo_123::file1.py::greet"]
    assert len(reloaded.get_file_chunks("file1.py")) == 0


def test_incremental_dirty_file_filtering(tmp_path: Path):
    """Verify dirty vs unchanged files are correctly partitioned for selective parsing."""
    repo_dir = tmp_path / "code"
    repo_dir.mkdir()
    manifest_dir = tmp_path / "manifests"

    f1 = repo_dir / "mod_a.py"
    f1.write_text("def a(): pass\n")
    f2 = repo_dir / "mod_b.py"
    f2.write_text("def b(): pass\n")

    manifest = IncrementalManifest("filter_repo", manifest_dir=manifest_dir)

    # Initial run: all dirty
    diff1 = manifest.diff_directory(repo_dir, [f1, f2])
    dirty_files = set(diff1.added_files + diff1.modified_files)
    assert len(dirty_files) == 2

    # Record both files
    manifest.record_file("mod_a.py", compute_file_sha256(f1), ["chunk_a"])
    manifest.record_file("mod_b.py", compute_file_sha256(f2), ["chunk_b"])
    manifest.save()

    # Modify ONLY mod_b
    f2.write_text("def b(): return 99\n")

    diff2 = manifest.diff_directory(repo_dir, [f1, f2])
    dirty_files2 = set(diff2.added_files + diff2.modified_files)
    assert len(dirty_files2) == 1
    assert f2 in dirty_files2
    assert f1 not in dirty_files2
    assert diff2.unchanged_count == 1

