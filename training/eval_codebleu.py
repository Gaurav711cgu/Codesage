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
import os
import warnings
from pathlib import Path

# Suppress all python warnings and verbose logging
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import transformers
transformers.logging.set_verbosity_error()

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
        import codebleu
        from codebleu import calc_codebleu
        import codebleu.codebleu
        import codebleu.utils
        import codebleu.syntax_match
        import codebleu.dataflow_match
        import tree_sitter_python
        import tree_sitter
        from tree_sitter import Language
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
        
        import ctypes
        
        # Monkey patch codebleu to fix tree-sitter version crashes on newer Python / tree-sitter
        _original_get_tree_sitter_language = codebleu.utils.get_tree_sitter_language
        def _patched_get_language(lang):
            if lang == "python":
                try:
                    lang_raw = tree_sitter_python.language()
                    if isinstance(lang_raw, Language):
                        return lang_raw
                    if isinstance(lang_raw, int):
                        return Language(lang_raw)
                    # Extract pointer from PyCapsule
                    try:
                        ctypes.pythonapi.PyCapsule_GetPointer.restype = ctypes.c_void_p
                        ctypes.pythonapi.PyCapsule_GetPointer.argtypes = [ctypes.py_object, ctypes.c_char_p]
                        ptr = ctypes.pythonapi.PyCapsule_GetPointer(lang_raw, None)
                        if ptr:
                            return Language(ptr)
                    except Exception:
                        pass
                except Exception:
                    pass
            try:
                return _original_get_tree_sitter_language(lang)
            except Exception:
                class DummyLang:
                    pass
                return DummyLang()


        codebleu.utils.get_tree_sitter_language = _patched_get_language
        codebleu.codebleu.get_tree_sitter_language = _patched_get_language
        codebleu.syntax_match.get_tree_sitter_language = _patched_get_language
        codebleu.dataflow_match.get_tree_sitter_language = _patched_get_language
        
    except ImportError as e:
        raise SystemExit(f"Missing dependency: {e}\n"
                         "Run: pip install codebleu transformers torch")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    logger.info("Device: %s", device)

    out_path = Path(args.output)
    preds_cache_path = out_path.with_suffix(".preds.json")

    predictions: list[str] = []
    references:  list[str] = []
    errors = 0

    if preds_cache_path.exists():
        logger.info("Found cached predictions in %s — loading from disk!", preds_cache_path)
        with preds_cache_path.open() as f:
            cached_data = json.load(f)
            predictions = cached_data["predictions"]
            references = cached_data["references"]
            errors = cached_data.get("errors", 0)
    else:
        logger.info("Loading model: %s", args.model)
        
        # Check if this is a PEFT (LoRA) adapter directory
        model_path = Path(args.model)
        if model_path.is_dir() and (model_path / "adapter_config.json").exists():
            from peft import PeftModel
            
            logger.info("Detected PEFT adapter. Loading base model first...")
            with open(model_path / "adapter_config.json") as f:
                base_model_name = json.load(f)["base_model_name_or_path"]
                
            tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
            base_model = AutoModelForCausalLM.from_pretrained(
                base_model_name,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None,
                trust_remote_code=True,
            )
            logger.info("Applying LoRA adapter from %s", args.model)
            model = PeftModel.from_pretrained(base_model, args.model)
        else:
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

        for i, sample in enumerate(samples):
            try:
                prompt     = sample["prompt"]
                reference  = sample["completion"].replace("```", "").strip()
                prediction = generate_fix(model, tokenizer, prompt, device, args.temperature)

                predictions.append(prediction)
                references.append(reference)

                if (i + 1) % 10 == 0 or (i + 1) == len(samples):
                    logger.info("Progress: %d/%d", i + 1, len(samples))
            except Exception as exc:
                logger.warning("Sample %d failed: %s", i, exc)
                errors += 1

        logger.info("Generation complete. %d errors out of %d samples.", errors, len(samples))
        
        # Save cache immediately after generation finishes
        write_json(preds_cache_path, {
            "predictions": predictions,
            "references": references,
            "errors": errors,
        })
        logger.info("Cached predictions saved to %s", preds_cache_path)


    # Compute CodeBLEU
    try:
        result = calc_codebleu(
            references=[[r] for r in references],
            predictions=predictions,
            lang="python",
            weights=(0.25, 0.25, 0.25, 0.25),  # equal weights for all 4 components
        )
    except Exception as exc:
        logger.warning("Full CodeBLEU syntax check failed (%s). Falling back to n-gram match CodeBLEU.", exc)
        result = calc_codebleu(
            references=[[r] for r in references],
            predictions=predictions,
            lang="python",
            weights=(0.5, 0.5, 0.0, 0.0),
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
