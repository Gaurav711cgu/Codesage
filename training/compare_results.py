"""Create a validated baseline-vs-fine-tuned comparison from real result files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from experiment_utils import provenance, write_json


def load(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Missing required result: {path}")
    return json.loads(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-dir", type=Path, default=Path("training/results"))
    parser.add_argument("--output", type=Path, default=Path("training/results/comparison.json"))
    args = parser.parse_args()

    results = args.results_dir
    base_cb = load(results / "base_codeblu.json")
    ft_cb = load(results / "finetuned_codeblu.json")
    base_he = load(results / "base_humaneval.json")
    ft_he = load(results / "finetuned_humaneval.json")

    if base_cb.get("test_data_sha256") != ft_cb.get("test_data_sha256"):
        raise SystemExit("CodeBLEU results use different held-out test files; refusing comparison.")

    output = {
        **provenance(),
        "status": "measured",
        "codebleu": {
            "test_data_sha256": base_cb["test_data_sha256"],
            "baseline": base_cb["codebleu"],
            "finetuned": ft_cb["codebleu"],
            "delta": round(ft_cb["codebleu"] - base_cb["codebleu"], 2),
        },
        "humaneval_pass_at_1": {
            "baseline": base_he["pass_at_1"],
            "finetuned": ft_he["pass_at_1"],
            "delta": round(ft_he["pass_at_1"] - base_he["pass_at_1"], 2),
        },
    }
    write_json(args.output, output)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
