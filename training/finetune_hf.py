"""
Standard HuggingFace PEFT 4-bit QLoRA fine-tuning (Zero Unsloth).
100% official Hugging Face + PyTorch + BitsAndBytes stack.
Zero monkey-patching, zero dynamic code generation, zero cache corruption.

Usage in Google Colab / Kaggle:
    pip install transformers peft bitsandbytes accelerate datasets
    python training/finetune_hf.py --model-size 1.5b
    python training/finetune_hf.py --model-size 7b
"""

import argparse
import json
import logging
import os
import shutil
import sys
from pathlib import Path
import torch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

_TRAINING_DIR = Path(__file__).parent
DATA_DIR = _TRAINING_DIR / "data"
RESULTS_DIR = _TRAINING_DIR / "results"
CHECKPOINT_DIR = Path("/content/checkpoints") if Path("/content").exists() else _TRAINING_DIR / "checkpoints"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_MAP = {
    "1.5b": "Qwen/Qwen2.5-Coder-1.5B-Instruct",
    "7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
}


def load_dataset_from_jsonl(path: Path):
    from datasets import Dataset
    rows = []
    with path.open() as f:
        for line in f:
            rows.append(json.loads(line))
    logger.info("Loaded %d rows from %s", len(rows), path)
    return Dataset.from_list(rows)


def train_hf(model_size: str = "1.5b", custom_model: str | None = None) -> None:
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
        Trainer,
        DataCollatorForSeq2Seq,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

    base_model = custom_model or MODEL_MAP.get(model_size, MODEL_MAP["1.5b"])
    logger.info("Using official HuggingFace PEFT on model: %s", base_model)

    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        logger.info("Hardware: %s | VRAM: %.2f GB", gpu_name, vram_gb)
    else:
        logger.warning("No CUDA GPU detected! Running on CPU (very slow).")

    # Load Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 4-bit BitsAndBytes Quantization Config (native Float16 compute for T4)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    logger.info("Loading 4-bit quantized base model...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )

    # Prepare model for LoRA
    model = prepare_model_for_kbit_training(model)

    # Standard PEFT LoRA Config
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # Load and tokenize data
    train_data = load_dataset_from_jsonl(DATA_DIR / "train.jsonl")
    val_data = load_dataset_from_jsonl(DATA_DIR / "val.jsonl")

    def tokenize_fn(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=1024,
            padding=False,
        )

    logger.info("Tokenizing datasets...")
    tokenized_train = train_data.map(tokenize_fn, batched=True, remove_columns=train_data.column_names)
    tokenized_val = val_data.map(tokenize_fn, batched=True, remove_columns=val_data.column_names)

    # Training Arguments (100% standard Hugging Face)
    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        num_train_epochs=3,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        fp16=True,                # Official standard FP16 works seamlessly with bnb compute_dtype=float16
        bf16=False,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_val,
        data_collator=DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8, return_tensors="pt", padding=True),
    )

    logger.info("Starting Hugging Face PEFT training...")
    trainer_stats = trainer.train()

    best_ckpt = CHECKPOINT_DIR / "best_checkpoint"
    trainer.save_model(str(best_ckpt))
    tokenizer.save_pretrained(str(best_ckpt))
    logger.info("Training complete! Best model saved -> %s", best_ckpt)

    results_file = RESULTS_DIR / "training_log.json"
    with results_file.open("w") as f:
        json.dump(
            {
                "base_model": base_model,
                "framework": "huggingface_peft_standard",
                "train_runtime_s": trainer_stats.metrics.get("train_runtime"),
                "train_loss": trainer_stats.metrics.get("train_loss"),
                "epochs": 3,
            },
            f,
            indent=2,
        )
    logger.info("Log saved -> %s", results_file)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Official HuggingFace PEFT QLoRA Training (Zero Unsloth)")
    parser.add_argument("--model-size", choices=["1.5b", "7b"], default="1.5b")
    parser.add_argument("--model", type=str, default=None)
    args = parser.parse_args()

    train_hf(model_size=args.model_size, custom_model=args.model)
