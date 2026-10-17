# CodeSage: Colab GPU Fine-Tuning Guide (v2.0-STABLE)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/Gaurav711cgu/Codesage/blob/feat/gravitas-modernization-v2/training/codesage_qlora_training.ipynb)

This guide walks you through fine-tuning **`Qwen/Qwen2.5-Coder-1.5B-Instruct`** on Python bug-fix commits using **Unsloth 4-bit QLoRA** on a free Google Colab T4 GPU or A100.

---

## 1. Quick Start in 3 Steps

1. Click the **Open In Colab** badge above (or open [Google Colab](https://colab.research.google.com/) and upload `training/codesage_qlora_training.ipynb`).
2. Set Runtime to GPU:
   - Go to **Runtime** $\rightarrow$ **Change runtime type**.
   - Select **T4 GPU** (or A100/L4 if you have Colab Pro).
   - Click **Save**.
3. Run the cells in order!

---

## 2. Notebook Workflow & Cell Breakdown

### Cell 1–3: Hardware & Environment
- **`!nvidia-smi`**: Checks available VRAM (T4 provides ~15 GB VRAM).
- **Google Drive Mount** (Optional): Mounts `/content/drive` to automatically back up checkpoints across session resets.
- **Dependency Installation**:
  ```bash
  !pip install --no-cache-dir "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  !pip install --no-cache-dir --no-deps trl peft accelerate bitsandbytes
  !pip install "datasets==3.6.0" codebleu human-eval
  ```

### Cell 4–5: Code & Environment Check
- Clones `https://github.com/Gaurav711cgu/Codesage.git` and checks out branch `feat/gravitas-modernization-v2`.
- Runs `python training/verify_colab_env.py` to ensure package compatibility.

### Cell 6: Dataset Selection (2 Modes)
- **Fast Dry-Run Mode (~10 seconds):**
  ```bash
  !python training/seed_starter_data.py
  ```
  Generates 160 structurally valid, syntax-checked Python bug-fix samples in `training/data/` (`train.jsonl`, `val.jsonl`, `test.jsonl`, `dataset_manifest.json`). Ideal for testing GPU backpropagation and export within 5 minutes.
- **Full Production Mode (~25–35 minutes):**
  ```bash
  !python training/dataset_prep.py --source-scan-limit 750000
  ```
  Streams 750,000 commits from `bigcode/commitpack` with 7 sequential AST filters (syntax validation, message quality $\ge 8$ words, character bounds, bug-fix signals).

### Cell 7: Pre-Training Baseline Evaluation
- Runs zero-shot evaluation on the un-tuned base model:
  ```bash
  !python training/eval_codebleu.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --test_data training/data/test.jsonl --output training/results/base_codeblu.json
  !python training/eval_humaneval.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --output training/results/base_humaneval.json --temperature 0 --seed 42
  ```

### Cell 8: QLoRA Fine-Tuning Execution
- Executes `python training/finetune.py`.
- **Hyperparameters:**
  - Base Model: `Qwen/Qwen2.5-Coder-1.5B-Instruct`
  - Quantization: 4-bit NormalFloat (NF4) via BitsAndBytes
  - LoRA Config: rank $r=16$, $\alpha=32$, dropout $0.05$
  - Target Modules: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`
  - Sequence Length: `1024` tokens (fits safely in 7 GB VRAM on T4)
  - Batch Size: `1` per device, `8` gradient accumulation steps (effective batch size 8)
  - Optimizer: `adamw_8bit`
  - Learning Rate: `2e-4` with cosine decay
  - Epochs: `3`
  - Saves best checkpoint by validation loss to `/content/checkpoints/best_checkpoint`.

### Cell 9–10: Post-Training Evaluation & Comparison
- Evaluates the fine-tuned adapter on the sacred held-out test split:
  ```bash
  !python training/eval_codebleu.py --model /content/checkpoints/best_checkpoint --test_data training/data/test.jsonl --output training/results/finetuned_codeblu.json
  !python training/eval_humaneval.py --model /content/checkpoints/best_checkpoint --output training/results/finetuned_humaneval.json --temperature 0 --seed 42
  ```
- Generates empirical delta comparison:
  ```bash
  !python training/compare_results.py
  ```
  Outputs `training/results/comparison.json` with verifiable deltas.

### Cell 11: Export LoRA Adapters & GGUF
- Exports weights:
  ```bash
  !python training/finetune.py --export
  ```
  Produces:
  - 16-bit LoRA adapter weights (for Hugging Face / PEFT)
  - `q4_k_m` GGUF quantized model (for direct deployment in Ollama / vLLM)

---

## 3. Post-Training: Sealing the Evidence

Once training completes:
1. Download `training/results/comparison.json`, `base_codeblu.json`, and `finetuned_codeblu.json`.
2. Place them in your local `Codesage/training/results/` directory.
3. Commit the results:
   ```bash
   git add training/results/*.json
   git commit -m "docs(ml): record empirical fine-tuning comparison receipt on CommitPack"
   git push origin feat/gravitas-modernization-v2
   ```
4. Now your resume claims are backed by 100% genuine, reproducible training receipts!
