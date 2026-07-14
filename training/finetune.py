"""
QLoRA fine-tuning of Qwen2.5-Coder-1.5B-Instruct on CommitPack bug-fix data.

Run on Colab A100 (40GB VRAM):
    pip install unsloth trl datasets
    python finetune.py

Checkpoints saved to ./checkpoints/
Best checkpoint (lowest eval_loss) loaded at end via load_best_model_at_end=True.
After training:
    python finetune.py --export   # merge weights and export to GGUF
"""

import argparse
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR     = Path("training/data")
RESULTS_DIR  = Path("training/results")
CHECKPOINT_DIR = Path("checkpoints")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

MAX_SEQ_LENGTH = 2048
RANDOM_SEED    = 42


# ─── Dataset loader ───────────────────────────────────────────────────────────

def load_jsonl(path: Path):
    import datasets as hf_datasets
    rows = []
    with path.open() as f:
        for line in f:
            rows.append(json.loads(line))
    return hf_datasets.Dataset.from_list(rows)


# ─── Training ─────────────────────────────────────────────────────────────────

def train():
    import torch
    from unsloth import FastLanguageModel
    from trl import SFTTrainer
    from transformers import TrainingArguments

    logger.info("Loading model: Qwen/Qwen2.5-Coder-1.5B-Instruct")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="Qwen/Qwen2.5-Coder-1.5B-Instruct",
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,           # auto-detect bf16/fp16
        load_in_4bit=True,    # QLoRA
    )

    logger.info("Attaching LoRA adapters")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=RANDOM_SEED,
    )

    logger.info("Loading datasets")
    train_dataset = load_jsonl(DATA_DIR / "train.jsonl")
    val_dataset   = load_jsonl(DATA_DIR / "val.jsonl")
    logger.info("Train: %d  Val: %d", len(train_dataset), len(val_dataset))

    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,   # effective batch size = 8
        warmup_ratio=0.05,
        num_train_epochs=3,
        learning_rate=2e-4,
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        logging_steps=25,
        evaluation_strategy="steps",
        eval_steps=200,
        save_strategy="steps",
        save_steps=200,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        seed=RANDOM_SEED,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        args=training_args,
        packing=False,
    )

    logger.info("Starting training (3 epochs, effective batch size 8)…")
    trainer_stats = trainer.train()

    # Save training log
    log = {
        "epochs_completed": training_args.num_train_epochs,
        "train_runtime_s": trainer_stats.metrics.get("train_runtime"),
        "train_loss": trainer_stats.metrics.get("train_loss"),
        "eval_date": None,        # filled after running evals
        "humaneval_interpretation": None,  # filled after error analysis
    }
    (RESULTS_DIR / "training_log.json").write_text(json.dumps(log, indent=2))
    logger.info("Training complete. Log saved to training/results/training_log.json")

    # Save the best adapter weights
    model.save_pretrained(str(CHECKPOINT_DIR / "best_checkpoint"))
    tokenizer.save_pretrained(str(CHECKPOINT_DIR / "best_checkpoint"))
    logger.info("Best checkpoint saved to %s/best_checkpoint", CHECKPOINT_DIR)

    return model, tokenizer


# ─── Export ───────────────────────────────────────────────────────────────────

def export_model():
    """
    Merge LoRA weights into base model and export to GGUF for Ollama.
    Run after training is complete.
    """
    from unsloth import FastLanguageModel

    logger.info("Loading best checkpoint for export…")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(CHECKPOINT_DIR / "best_checkpoint"),
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )

    logger.info("Merging LoRA weights (merged_16bit)…")
    model.save_pretrained_merged(
        "codesagez-qwen-merged",
        tokenizer,
        save_method="merged_16bit",
    )

    logger.info("Exporting to GGUF (q4_k_m quantisation)…")
    model.save_pretrained_gguf(
        "codesagez-qwen-gguf",
        tokenizer,
        quantization_method="q4_k_m",
    )

    logger.info(
        "Export complete.\n"
        "  Merged weights:  codesagez-qwen-merged/\n"
        "  GGUF model:      codesagez-qwen-gguf/model.gguf\n\n"
        "Next steps:\n"
        "  ollama create codesagez-coder -f training/Modelfile\n"
        "  ollama run codesagez-coder 'test'"
    )


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune Qwen2.5-Coder")
    parser.add_argument("--export", action="store_true",
                        help="Export trained model to GGUF (run after training)")
    args = parser.parse_args()

    if args.export:
        export_model()
    else:
        train()
