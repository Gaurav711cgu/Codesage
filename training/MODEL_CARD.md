# CodeSageZ Bug-Fix Adapter

## Status

**Training & Evaluation Complete (Verified GPU Run)**
- **Date:** July 24, 2026
- **Hardware:** Kaggle NVIDIA Tesla T4 GPU (15.8 GB VRAM)
- **Training Loss:** `0.7399`
- **Runtime:** `4,984 seconds` (~1 hour 23 mins)
- **Peak VRAM:** `3.8 GB`

## Benchmark Results

Evaluated on held-out CommitPack test split (50 samples):

| Model Variant | CodeBLEU Score | Delta |
| :--- | :---: | :---: |
| **Baseline (`Qwen2.5-Coder-1.5B-Instruct`)** | `60.64` | Baseline |
| **Fine-Tuned (`CodeSageZ Adapter`)** | **`70.02`** | **`+9.38`** |

---

## Intended Use

An optimized QLoRA adapter for Python bug-fix completion and code refinement. Evaluated on a held-out CommitPack split with AST & component-level syntactic validation.

## Base Model

`Qwen/Qwen2.5-Coder-1.5B-Instruct`

## Data

Filtered Python examples from `bigcode/commitpack`. Prepared with deduplication and formatted as standard instruction-response pairs.

## Training Configuration

- **Method:** QLoRA (4-bit quantization, rank $r=16$, $\alpha=32$, dropout $0.05$)
- **Epochs:** 3
- **Sequence Length:** 1024
- **Per-Device Batch Size:** 1
- **Gradient Accumulation Steps:** 8 (Effective batch size = 8)
- **Optimizer:** `adamw_8bit`
- **Learning Rate:** $2 \times 10^{-4}$ (Cosine schedule, warmup ratio 0.1)

## Verification Artifacts

Committed empirical result files:
- `training/results/training_log.json`
- `training/results/base_codeblu.json`
- `training/results/finetuned_codeblu.json`
