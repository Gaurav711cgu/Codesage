# GPU Experiment Runbook

Run this on a single A100/L4-class notebook or cloud instance. Keep the same
Git revision for baseline, training, and post-training evaluation.

```bash
git clone https://github.com/Gaurav711cgu/Codesage.git
cd Codesage
pip install datasets codebleu human-eval transformers torch unsloth trl

python training/dataset_prep.py
python training/eval_codebleu.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --test_data training/data/test.jsonl --output training/results/base_codeblu.json
python training/eval_humaneval.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --output training/results/base_humaneval.json --temperature 0 --seed 42

python training/finetune.py

python training/eval_codebleu.py --model checkpoints/best_checkpoint --test_data training/data/test.jsonl --output training/results/finetuned_codeblu.json
python training/eval_humaneval.py --model checkpoints/best_checkpoint --output training/results/finetuned_humaneval.json --temperature 0 --seed 42
python training/compare_results.py
```

Review `training/results/comparison.json` and the model card before publishing
any claim. Commit manifests and measured result JSON, never model weights or
the source dataset.
