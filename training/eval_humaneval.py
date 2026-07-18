"""
HumanEval Pass@1 evaluation — used as a catastrophic forgetting check.

The published Qwen2.5-Coder-1.5B-Instruct baseline is ~43.9%.
If your baseline deviates by more than 3pp, investigate before training:
  - Check chat template is applied correctly
  - Verify temperature=0.2
  - Confirm you are using the instruction-tuned model, not the base model

Run BEFORE training (baseline) and AFTER (fine-tuned):

  python training/eval_humaneval.py \
      --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
      --output training/results/base_humaneval.json \
      --temperature 0.2 \
      --num_samples 1

Requires: pip install human-eval transformers torch
"""

import argparse
import json
import logging
import os
import warnings
import tempfile
from pathlib import Path

# Suppress all python warnings and verbose logging
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import transformers
transformers.logging.set_verbosity_error()

import torch
from experiment_utils import provenance, write_json

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

# Published Qwen2.5-Coder-1.5B-Instruct Pass@1
EXPECTED_BASELINE = 43.9
TOLERANCE_PP      = 3.0


def format_humaneval_prompt(problem: dict, tokenizer) -> str:
    """
    Apply the model's chat template to a HumanEval problem.
    Using the instruction format prevents the model from completing the
    function signature instead of the body.
    """
    prompt_text = problem["prompt"]
    messages = [
        {"role": "system", "content": "Complete the following Python function."},
        {"role": "user",   "content": prompt_text},
    ]
    try:
        return tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
    except Exception:
        return prompt_text  # fallback to raw prompt if template fails


def generate_completion(model, tokenizer, prompt: str, temperature: float,
                        device: str) -> str:
    import torch
    inputs = tokenizer(prompt, return_tensors="pt",
                       truncation=True, max_length=1500).to(device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )
    new_ids = outputs[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_ids, skip_special_tokens=True)


def main():
    parser = argparse.ArgumentParser(description="HumanEval Pass@1 evaluation")
    parser.add_argument("--model",       required=True)
    parser.add_argument("--output",      required=True)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--num_samples", type=int, default=1,
                        help="Samples per problem for Pass@k (we use k=1)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from human_eval.data import read_problems
        from human_eval.evaluation import evaluate_functional_correctness
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
    except ImportError as e:
        raise SystemExit(f"Missing dependency: {e}\n"
                         "Run: pip install human-eval transformers torch")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    logger.info("Device: %s", device)

    logger.info("Loading model: %s", args.model)
    
    # Check if this is a PEFT (LoRA) adapter directory
    model_path = Path(args.model)
    if model_path.is_dir() and (model_path / "adapter_config.json").exists():
        import json
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

    problems = read_problems()
    logger.info("Generating solutions for %d HumanEval problems…", len(problems))

    samples = []
    for i, (task_id, problem) in enumerate(problems.items()):
        for _ in range(args.num_samples):
            try:
                prompt = format_humaneval_prompt(problem, tokenizer)
                completion = generate_completion(
                    model, tokenizer, prompt, args.temperature, device
                )
                samples.append({"task_id": task_id, "completion": completion})
            except Exception as exc:
                logger.warning("Problem %s failed: %s", task_id, exc)
                samples.append({"task_id": task_id, "completion": ""})

        if (i + 1) % 20 == 0:
            logger.info("Progress: %d/%d", i + 1, len(problems))

    # Write samples to a temp file for human-eval runner
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl",
                                     delete=False) as tmp:
        for s in samples:
            tmp.write(json.dumps(s) + "\n")
        tmp_path = tmp.name

    logger.info("Running functional correctness evaluation…")
    results = evaluate_functional_correctness(
        sample_file=tmp_path,
        k=[1],
        n_workers=4,
        timeout=10.0,
    )
    os.unlink(tmp_path)

    pass_at_1 = round(results["pass@1"] * 100, 2)
    logger.info("Pass@1: %.2f%%", pass_at_1)

    # Sanity check vs published baseline
    if "Qwen2.5-Coder-1.5B-Instruct" in args.model and \
            abs(pass_at_1 - EXPECTED_BASELINE) > TOLERANCE_PP:
        logger.warning(
            "Baseline Pass@1 (%.2f%%) differs by >%.1fpp from published (%.1f%%). "
            "Check your chat template, temperature, and model variant before training.",
            pass_at_1, TOLERANCE_PP, EXPECTED_BASELINE,
        )

    output = {
        **provenance(),
        "model":       args.model,
        "metric": "HumanEval Pass@1",
        "pass_at_1":   pass_at_1,
        "num_problems": len(problems),
        "num_samples": args.num_samples,
        "temperature": args.temperature,
        "seed": args.seed,
        "raw_results": {k: round(v * 100, 2) for k, v in results.items()},
    }

    out_path = Path(args.output)
    write_json(out_path, output)
    logger.info("Results saved to %s", out_path)

    print(f"\nHumanEval Pass@1: {pass_at_1:.2f}%  (model: {args.model})")


if __name__ == "__main__":
    main()
