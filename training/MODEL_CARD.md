# CodeSageZ Bug-Fix Adapter

## Status

Training is not yet complete. This card must be updated only after a real GPU
run produces committed result files. Do not publish placeholder metrics.

## Intended Use

An optional QLoRA adapter for Python bug-fix completion. It is evaluated on a
held-out CommitPack test split and HumanEval is used only as a regression check.

## Base Model

`Qwen/Qwen2.5-Coder-1.5B-Instruct`

## Data

Filtered Python examples from `bigcode/commitpack`. The preparation script
creates a manifest with split hashes before training. The test split is never
used for checkpoint selection.

## Training Configuration

QLoRA, 4-bit loading, rank 16, alpha 32, dropout 0.05, three epochs, seed 42,
maximum sequence length 2048.

## Required Reporting

- GPU type and wall-clock runtime
- Dataset manifest hash and Git revision
- Baseline and fine-tuned CodeBLEU on the same held-out split
- Baseline and fine-tuned HumanEval Pass@1
- Failure cases and known limitations

## Limitations

The adapter may overfit to short Python fixes, produce syntactically plausible
but semantically wrong patches, and should not be used without tests or human
review.
