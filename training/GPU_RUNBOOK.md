# GPU Experiment Runbook

Run this on a single T4/L4/A100-class notebook or cloud instance. Keep the same
Git revision for baseline, training, and post-training evaluation.

```bash
git clone https://github.com/Gaurav711cgu/Codesage.git
cd Codesage
pip install "datasets==3.6.0" codebleu human-eval transformers torch unsloth trl

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

`dataset_prep.py` streams CommitPack and stops after collecting exactly 10,000
filtered examples. It must never be changed to a non-streaming load: the Python
source configuration is too large for a notebook disk. If the scan ceiling is
reached before 10,000 valid examples are collected, increase
`--source-scan-limit` and record that value in the generated manifest.
