#!/bin/bash
set -e

# Run CodeBLEU evaluation
echo "Running CodeBLEU Baseline..."
python training/eval_codebleu.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --test_data training/data/test.jsonl \
    --output training/results/base_codeblu.json

# Run HumanEval evaluation
echo "Running HumanEval Baseline..."
python training/eval_humaneval.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --output training/results/base_humaneval.json

echo "Baseline evaluations complete."
