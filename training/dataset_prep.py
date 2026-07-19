"""
Dataset preparation for QLoRA fine-tuning on CommitPack Python bug-fix commits.

Pipeline:
  1. Stream bigcode/commitpack "python" split (never downloads it in full)
  2. Apply 7 sequential filters (see PRD §4.2)
  3. Shuffle with seed=42, split 1500/250/250 (train/val/test)
  4. Format each sample as Alpaca-style prompt
  5. Save train.jsonl, val.jsonl, test.jsonl + split_indices.json
  6. Backup to Google Drive immediately

Prerequisites:
    datasets==2.19.2 (MUST be this version — 2.20+ blocks trust_remote_code)
    See COLAB_GUIDE.md Cell 1 for installation.

Usage in Colab (via COLAB_GUIDE.md Cell 3):
    python training/dataset_prep.py

The test split is sacred — never inspect it until final evaluation.
"""

import ast
import difflib
import json
import logging
import random
import re
import argparse
import shutil
from pathlib import Path

from experiment_utils import count_jsonl, provenance, sha256_file, write_json

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Constants ──────────────────────────────────────────────────────────────────

RANDOM_SEED = 42
TRAIN_SIZE  = 1_500
VAL_SIZE    = 250
TEST_SIZE   = 250
TOTAL_SIZE  = TRAIN_SIZE + VAL_SIZE + TEST_SIZE  # 2000

# T4 Colab sessions run for up to 12 hours. Scanning 750K rows at streaming
# speed takes ~25-35 minutes. If this limit is hit before TOTAL_SIZE samples
# are collected, increase it or reduce TOTAL_SIZE.
DEFAULT_SOURCE_SCAN_LIMIT = 750_000

MAX_FILE_CHARS    = 3_500
MAX_DIFF_LINES    = 100
MIN_MESSAGE_WORDS = 8

BUG_KEYWORDS = re.compile(
    r"\b(fix|bug|error|exception|null|none|crash|fail|incorrect|wrong|"
    r"issue|patch|resolve|broken|invalid|missing|handle)\b",
    re.IGNORECASE,
)

# Path relative to this file — works regardless of CWD
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DRIVE_DATA_DIR = Path("/content/drive/MyDrive/codesagez/data")


# ── Filter functions ───────────────────────────────────────────────────────────

def filter_language(example: dict) -> bool:
    """Filter 1 — keep Python only."""
    return example.get("lang", "").lower() == "python"


def filter_message_quality(example: dict) -> bool:
    """Filter 2 — commit message must have ≥8 words."""
    return len(example.get("message", "").split()) >= MIN_MESSAGE_WORDS


def filter_file_size(example: dict) -> bool:
    """Filter 3 — both old and new content must be < 3500 chars."""
    old = example.get("old_contents", "") or ""
    new = example.get("new_contents", "") or ""
    return len(old) < MAX_FILE_CHARS and len(new) < MAX_FILE_CHARS


def filter_actual_change(example: dict) -> bool:
    """Filter 4 — old and new content must differ."""
    return example.get("old_contents") != example.get("new_contents")


def filter_bugfix_signal(example: dict) -> bool:
    """Filter 5 — commit message must mention a bug-fix keyword."""
    return bool(BUG_KEYWORDS.search(example.get("message", "")))


def filter_diff_size(example: dict) -> bool:
    """Filter 6 — unified diff must change ≤100 lines (surgical fixes only)."""
    old = (example.get("old_contents", "") or "").splitlines(keepends=True)
    new = (example.get("new_contents", "") or "").splitlines(keepends=True)
    diff = list(difflib.unified_diff(old, new))
    changed = sum(
        1 for line in diff
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    )
    return changed <= MAX_DIFF_LINES


def filter_syntax_valid(example: dict) -> bool:
    """
    Filter 7 — both before and after must be syntactically valid Python.
    Disabled by default (slow); enable by passing --syntax-check flag.
    """
    try:
        ast.parse(example.get("old_contents", "") or "")
        ast.parse(example.get("new_contents", "") or "")
        return True
    except SyntaxError:
        return False


# ── Formatting ─────────────────────────────────────────────────────────────────

def format_sample(example: dict) -> dict:
    """
    Convert a CommitPack row into an Alpaca-style training sample.
    Returns {"text": "<full prompt + completion>", "prompt": ..., "completion": ..., "meta": ...}
    """
    message  = example.get("message", "").strip()
    old_code = (example.get("old_contents", "") or "").strip()
    new_code = (example.get("new_contents", "") or "").strip()

    prompt = (
        "### Task: Fix the bug described by the commit message.\n\n"
        f"### Commit message:\n{message}\n\n"
        f"### Buggy code:\n```python\n{old_code}\n```\n\n"
        "### Fixed code:\n```python\n"
    )
    completion = f"{new_code}\n```"

    return {
        "text":       prompt + completion,
        "prompt":     prompt,
        "completion": completion,
        "meta": {
            "message": message,
            "url":     example.get("url", ""),
        },
    }


# ── Drive backup ───────────────────────────────────────────────────────────────

def backup_to_drive() -> None:
    """Copy DATA_DIR to Google Drive. Silently skips if Drive is not mounted."""
    if not Path("/content/drive/MyDrive").exists():
        logger.warning("Drive not mounted — skipping backup. Data only in /content/.")
        return
    DRIVE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copytree(str(DATA_DIR), str(DRIVE_DATA_DIR), dirs_exist_ok=True)
    logger.info("Dataset backed up to Drive: %s", DRIVE_DATA_DIR)


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stream and filter CommitPack Python bug-fix commits."
    )
    parser.add_argument(
        "--source-scan-limit",
        type=int,
        default=DEFAULT_SOURCE_SCAN_LIMIT,
        help="Max streamed rows to inspect before failing (default: %(default)s).",
    )
    parser.add_argument(
        "--syntax-check",
        action="store_true",
        help="Enable Filter 7 (syntax validation). Slower but cleaner data.",
    )
    args = parser.parse_args()

    # Verify the datasets version — 2.20+ will fail on trust_remote_code
    try:
        import datasets
        if datasets.__version__ >= "2.20.0":
            raise SystemExit(
                f"datasets {datasets.__version__} is installed but >= 2.20.0 "
                "blocks trust_remote_code.\n"
                "Fix: pip install datasets==2.19.2 --force-reinstall\n"
                "Then restart the Python runtime."
            )
        logger.info("datasets version: %s ✅", datasets.__version__)
    except ImportError:
        raise SystemExit("datasets not installed. See COLAB_GUIDE.md Cell 1.")

    logger.info(
        "Streaming bigcode/commitpack python split "
        "(scan limit: %d rows)…",
        args.source_scan_limit,
    )

    ds = datasets.load_dataset(
        "bigcode/commitpack",
        "python",
        split="train",
        streaming=True,
        trust_remote_code=True,     # Requires datasets <= 2.19.2
    ).shuffle(seed=RANDOM_SEED, buffer_size=10_000)

    filters = [
        ("language",        filter_language),
        ("message_quality", filter_message_quality),
        ("file_size",       filter_file_size),
        ("actual_change",   filter_actual_change),
        ("bugfix_signal",   filter_bugfix_signal),
        ("diff_size",       filter_diff_size),
        *([("syntax_valid", filter_syntax_valid)] if args.syntax_check else []),
    ]

    accepted = []
    rejected = {name: 0 for name, _ in filters}
    scanned  = 0

    for row in ds:
        scanned += 1
        for name, fn in filters:
            if not fn(row):
                rejected[name] += 1
                break
        else:
            accepted.append(row)
            if len(accepted) == TOTAL_SIZE:
                break

        if scanned % 10_000 == 0:
            logger.info(
                "Scanned %d rows | accepted %d / %d",
                scanned, len(accepted), TOTAL_SIZE,
            )

        if scanned >= args.source_scan_limit:
            break

    if len(accepted) < TOTAL_SIZE:
        raise SystemExit(
            f"Only {len(accepted)} samples passed filtering after {scanned} rows. "
            f"Need {TOTAL_SIZE}. Re-run with --source-scan-limit {args.source_scan_limit * 2}."
        )

    logger.info(
        "Collected %d samples after scanning %d rows.", len(accepted), scanned
    )
    logger.info("Rejection counts by filter: %s", rejected)

    # Reproducible shuffle and split
    random.seed(RANDOM_SEED)
    indices = list(range(len(accepted)))
    random.shuffle(indices)

    train_indices = indices[:TRAIN_SIZE]
    val_indices   = indices[TRAIN_SIZE:TRAIN_SIZE + VAL_SIZE]
    test_indices  = indices[TRAIN_SIZE + VAL_SIZE:TOTAL_SIZE]

    # Save split indices for reproducibility
    split_file = DATA_DIR / "split_indices.json"
    write_json(split_file, {
        "train":                train_indices,
        "val":                  val_indices,
        "test":                 test_indices,
        "random_seed":          RANDOM_SEED,
        "accepted_samples":     len(accepted),
        "source_rows_scanned":  scanned,
        "source_scan_limit":    args.source_scan_limit,
    })
    logger.info("Split indices → %s", split_file)

    # Write JSONL files
    for split_name, split_indices in [
        ("train", train_indices),
        ("val",   val_indices),
        ("test",  test_indices),
    ]:
        out_path = DATA_DIR / f"{split_name}.jsonl"
        with out_path.open("w") as f:
            for idx in split_indices:
                f.write(json.dumps(format_sample(accepted[idx])) + "\n")
        logger.info("Wrote %d samples → %s", len(split_indices), out_path)

    # Write dataset manifest
    manifest = {
        **provenance(),
        "dataset":        "bigcode/commitpack",
        "configuration":  "python",
        "random_seed":    RANDOM_SEED,
        "filters": {
            "max_file_chars":       MAX_FILE_CHARS,
            "max_diff_lines":       MAX_DIFF_LINES,
            "min_message_words":    MIN_MESSAGE_WORDS,
            "bugfix_keyword_filter": True,
            "syntax_valid_python":  args.syntax_check,
        },
        "source_access": {
            "mode":                  "streaming",
            "source_rows_scanned":   scanned,
            "source_scan_limit":     args.source_scan_limit,
            "accepted_samples":      len(accepted),
            "shuffle_seed":          RANDOM_SEED,
            "shuffle_buffer_size":   10_000,
        },
        "splits": {
            split: {
                "path":    f"training/data/{split}.jsonl",
                "samples": count_jsonl(DATA_DIR / f"{split}.jsonl"),
                "sha256":  sha256_file(DATA_DIR / f"{split}.jsonl"),
            }
            for split in ("train", "val", "test")
        },
        "split_indices_sha256": sha256_file(split_file),
    }
    manifest_path = DATA_DIR / "dataset_manifest.json"
    write_json(manifest_path, manifest)
    logger.info("Dataset manifest → %s", manifest_path)

    # Backup immediately — do NOT wait until after training
    backup_to_drive()

    logger.info(
        "\n✅ Dataset ready: %d train / %d val / %d test\n"
        "   Test split is held out — do not inspect until final eval.\n"
        "   Next: run baseline eval, then training (see COLAB_GUIDE.md).",
        TRAIN_SIZE, VAL_SIZE, TEST_SIZE,
    )


if __name__ == "__main__":
    main()
