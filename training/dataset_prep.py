"""
Dataset preparation for QLoRA fine-tuning on CommitPack Python bug-fix commits.

Pipeline:
  1. Load bigcode/commitpack "python" split
  2. Apply 7 sequential filters (see PRD §4.2)
  3. Shuffle with seed=42, split 8K/1K/1K (train/val/test)
  4. Format each sample as Alpaca-style prompt
  5. Save train.jsonl, val.jsonl, test.jsonl + split_indices.json

Usage (Colab A100 recommended for the full dataset):
    python dataset_prep.py

The test split is sacred — never look at it until final evaluation.
"""

import ast
import difflib
import json
import logging
import random
import re
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

RANDOM_SEED = 42
TRAIN_SIZE  = 8_000
VAL_SIZE    = 1_000
TEST_SIZE   = 1_000
TOTAL_SIZE  = TRAIN_SIZE + VAL_SIZE + TEST_SIZE

MAX_FILE_CHARS = 3_500
MAX_DIFF_LINES = 30
MIN_MESSAGE_WORDS = 8

BUG_KEYWORDS = re.compile(
    r"\b(fix|bug|error|exception|null|none|crash|fail|incorrect|wrong|"
    r"issue|patch|resolve|broken|invalid|missing|handle)\b",
    re.IGNORECASE,
)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


# ─── Filter functions ─────────────────────────────────────────────────────────

def filter_language(example: dict) -> bool:
    """Filter 1 — keep Python only (belt-and-suspenders; split already filtered)."""
    return example.get("lang", "").lower() == "python"


def filter_message_quality(example: dict) -> bool:
    """Filter 2 — commit message must have ≥8 words."""
    msg = example.get("message", "")
    return len(msg.split()) >= MIN_MESSAGE_WORDS


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
    msg = example.get("message", "")
    return bool(BUG_KEYWORDS.search(msg))


def filter_diff_size(example: dict) -> bool:
    """Filter 6 — unified diff must change ≤30 lines (surgical fixes only)."""
    old = (example.get("old_contents", "") or "").splitlines(keepends=True)
    new = (example.get("new_contents", "") or "").splitlines(keepends=True)
    diff = list(difflib.unified_diff(old, new))
    changed = sum(1 for line in diff if line.startswith(("+", "-"))
                  and not line.startswith(("+++", "---")))
    return changed <= MAX_DIFF_LINES


def filter_syntax_valid(example: dict) -> bool:
    """Filter 7 — both old and new contents must be syntactically valid Python."""
    for key in ("old_contents", "new_contents"):
        src = example.get(key, "") or ""
        try:
            ast.parse(src)
        except SyntaxError:
            return False
    return True


# ─── Formatting ───────────────────────────────────────────────────────────────

def format_sample(example: dict) -> dict:
    """
    Convert a CommitPack row into an Alpaca-style training sample.
    Returns {"text": "<full prompt + completion>", "meta": {...}}
    """
    message     = example.get("message", "").strip()
    old_code    = (example.get("old_contents", "") or "").strip()
    new_code    = (example.get("new_contents", "") or "").strip()

    prompt = (
        "### Task: Fix the bug described by the commit message.\n\n"
        f"### Commit message:\n{message}\n\n"
        f"### Buggy code:\n```python\n{old_code}\n```\n\n"
        "### Fixed code:\n```python\n"
    )
    # The model learns to complete the prompt with new_code + closing fence
    completion = f"{new_code}\n```"

    return {
        "text": prompt + completion,
        "prompt": prompt,
        "completion": completion,
        "meta": {
            "message": message,
            "url": example.get("url", ""),
        },
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        import datasets
    except ImportError:
        raise SystemExit(
            "datasets not installed. Run: pip install datasets"
        )

    logger.info("Loading bigcode/commitpack python split…")
    ds = datasets.load_dataset("bigcode/commitpack", "python", split="train",
                               trust_remote_code=True)
    logger.info("Loaded %d rows", len(ds))

    # Apply filters in sequence
    filters = [
        ("language",       filter_language),
        ("message_quality",filter_message_quality),
        ("file_size",      filter_file_size),
        ("actual_change",  filter_actual_change),
        ("bugfix_signal",  filter_bugfix_signal),
        ("diff_size",      filter_diff_size),
        ("syntax_valid",   filter_syntax_valid),
    ]

    for name, fn in filters:
        before = len(ds)
        ds = ds.filter(fn, num_proc=4)
        logger.info("After filter %-20s: %d → %d (-%d)",
                    name, before, len(ds), before - len(ds))

    total_available = len(ds)
    logger.info("Total samples after all filters: %d", total_available)

    if total_available < TOTAL_SIZE:
        raise SystemExit(
            f"Only {total_available} samples after filtering, need {TOTAL_SIZE}. "
            "Relax filters or use a larger dataset split."
        )

    # Reproducible shuffle and split
    random.seed(RANDOM_SEED)
    indices = list(range(total_available))
    random.shuffle(indices)

    train_indices = indices[:TRAIN_SIZE]
    val_indices   = indices[TRAIN_SIZE : TRAIN_SIZE + VAL_SIZE]
    test_indices  = indices[TRAIN_SIZE + VAL_SIZE : TOTAL_SIZE]

    # Save indices for reproducibility
    split_file = DATA_DIR / "split_indices.json"
    split_file.write_text(json.dumps({
        "train": train_indices,
        "val":   val_indices,
        "test":  test_indices,
        "random_seed": RANDOM_SEED,
        "total_available": total_available,
    }, indent=2))
    logger.info("Saved split indices to %s", split_file)

    # Write JSONL files
    for split_name, split_indices in [
        ("train", train_indices),
        ("val",   val_indices),
        ("test",  test_indices),
    ]:
        out_path = DATA_DIR / f"{split_name}.jsonl"
        written = 0
        with out_path.open("w") as f:
            for idx in split_indices:
                row = ds[idx]
                sample = format_sample(row)
                f.write(json.dumps(sample) + "\n")
                written += 1
        logger.info("Wrote %d samples to %s", written, out_path)

    logger.info(
        "Dataset ready: %d train / %d val / %d test (test split is held out)",
        TRAIN_SIZE, VAL_SIZE, TEST_SIZE,
    )
    logger.info(
        "Spot-check: review 20 random samples from train.jsonl before training."
    )


if __name__ == "__main__":
    main()
