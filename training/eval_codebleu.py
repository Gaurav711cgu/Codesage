"""
CodeBLEU evaluation on the held-out CommitPack test set.

Run BEFORE training (baseline) and AFTER training (fine-tuned):

  # Baseline
  python training/eval_codebleu.py \
      --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
      --test_data training/data/test.jsonl \
      --output training/results/base_codeblu.json

  # Fine-tuned
  python training/eval_codebleu.py \
      --model "./checkpoints/best_checkpoint" \
      --test_data training/data/test.jsonl \
      --output training/results/finetuned_codeblu.json

Requires: pip install codebleu transformers torch
"""

import argparse
import json
import logging
from pathlib import Path

from experiment_utils import provenance, sha256_file, write_json

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

MAX_NEW_TOKENS = 512
TEMPERATURE    = 0.0


def load_test_samples(path: Path) -> list[dict]:
    samples = []
    with path.open() as f:
        for line in f:
            samples.append(json.loads(line))
    return samples


def generate_fix(model, tokenizer, prompt: str, device: str, temperature: float) -> str:
    """Generate a fixed code snippet for the given prompt."""
    inputs = tokenizer(prompt, return_tensors="pt",
                       truncation=True, max_length=1800).to(device)
    with __import__("torch").no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            temperature=temperature if temperature > 0 else None,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )
    # Decode only the new tokens
    new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    generated = tokenizer.decode(new_ids, skip_special_tokens=True)
    # Strip closing fence if present
    return generated.split("```")[0].strip()


def main():
    parser = argparse.ArgumentParser(description="CodeBLEU evaluation")
    parser.add_argument("--model",     required=True,
                        help="HuggingFace model ID or local checkpoint path")
    parser.add_argument("--test_data", required=True,
                        help="Path to test.jsonl")
    parser.add_argument("--output",    required=True,
                        help="Output JSON path for results")
    parser.add_argument("--temperature", type=float, default=TEMPERATURE)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max_samples", type=int, default=None,
                        help="Limit evaluation to N samples (for quick testing)")
    args = parser.parse_args()

    try:
        from codebleu import calc_codebleu
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
    except ImportError as e:
        raise SystemExit(f"Missing dependency: {e}\n"
                         "Run: pip install codebleu transformers torch")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    logger.info("Device: %s", device)

    logger.info("Loading model: %s", args.model)
    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        device_map="auto" if device == "cuda" else None,
        trust_remote_code=True,
    )
    model.eval()

    samples = load_test_samples(Path(args.test_data))
    if args.max_samples:
        samples = samples[:args.max_samples]
    logger.info("Evaluating on %d samples…", len(samples))

    predictions: list[str] = []
    references:  list[str] = []
    errors = 0

    for i, sample in enumerate(samples):
        try:
            prompt     = sample["prompt"]
            reference  = sample["completion"].replace("```", "").strip()
            prediction = generate_fix(model, tokenizer, prompt, device, args.temperature)

            predictions.append(prediction)
            references.append(reference)

            if (i + 1) % 50 == 0:
                logger.info("Progress: %d/%d", i + 1, len(samples))
        except Exception as exc:
            logger.warning("Sample %d failed: %s", i, exc)
            errors += 1

    logger.info("Generation complete. %d errors out of %d samples.",
                errors, len(samples))

    # Compute CodeBLEU
    result = calc_codebleu(
        references=[[r] for r in references],
        predictions=predictions,
        lang="python",
        weights=(0.25, 0.25, 0.25, 0.25),  # equal weights for all 4 components
    )
    codebleu_score = result["codebleu"]
    logger.info("CodeBLEU: %.4f (×100 = %.2f)", codebleu_score, codebleu_score * 100)

    output = {
        **provenance(),
        "model":         args.model,
        "metric": "CodeBLEU",
        "test_data": str(Path(args.test_data)),
        "test_data_sha256": sha256_file(Path(args.test_data)),
        "test_samples":  len(predictions),
        "errors":        errors,
        "seed": args.seed,
        "generation": {"temperature": args.temperature, "max_new_tokens": MAX_NEW_TOKENS, "do_sample": args.temperature > 0},
        "codebleu":      round(codebleu_score * 100, 2),   # reported ×100 per PRD
        "codebleu_raw":  codebleu_score,
        "components": {
            "ngram_match":       result.get("ngram_match_score"),
            "weighted_ngram":    result.get("weighted_ngram_match_score"),
            "syntax_match":      result.get("syntax_match_score"),
            "dataflow_match":    result.get("dataflow_match_score"),
        },
    }

    out_path = Path(args.output)
    write_json(out_path, output)
    logger.info("Results saved to %s", out_path)

    print(f"\nCodeBLEU: {codebleu_score * 100:.2f}  (model: {args.model})")


if __name__ == "__main__":
    main()
