"""
QLoRA fine-tuning of Qwen2.5-Coder-1.5B-Instruct on CommitPack bug-fix data.
T4-optimized: seq_len=1024, batch=1, grad_acc=8, fp16, save per epoch.

Usage in Kaggle / Colab:
    python training/finetune.py           # train
    python training/finetune.py --export  # export to GGUF after training

Checkpoints are saved after every epoch.
If session dies, re-run — the script resumes from the latest epoch checkpoint.

Changes from original (reasons inline):
  - MAX_SEQ_LENGTH: 2048 → 1024  (T4 has 15GB; 2048+batch2 = OOM)
  - batch_size: 2 → 1            (T4 memory constraint)
  - grad_accumulation: 4 → 8     (keeps effective batch size = 8)
  - dtype: None → torch.float16  (T4 doesn't support bfloat16 reliably)
  - bf16: auto → False           (explicit — T4 returns False anyway)
  - fp16: auto → True            (explicit — required on T4)
  - save_strategy: "epoch" (CRITICAL: prevents losing everything on crash)
  - load_best_model_at_end: added (saves best checkpoint by eval_loss)
  - report_to: "wandb" added for ML Ops tracking (FAANG standard)
  - DATA_DIR: relative CWD → __file__-relative
  - Drive backup: added after each save
  - Resume: auto-detect latest epoch checkpoint
  - packing: disabled (avoids Unsloth padding_free/max_length conflict)
  - SFTTrainer args: only pass model, tokenizer, datasets, args (no duplicates)
"""

import argparse
import json
import logging
import os
import shutil
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ── Clear Unsloth's compiled cache BEFORE any import ─────────────────────────
# Stale cache causes FP8BackendType AttributeError and other compiled-cache bugs.
for _cache in [
    "/root/.cache/unsloth",
    os.path.expanduser("~/.cache/unsloth"),
    "unsloth_compiled_cache",
    "/kaggle/working/Codesage/unsloth_compiled_cache",
    "/kaggle/working/unsloth_compiled_cache",
]:
    if os.path.exists(_cache):
        try:
            shutil.rmtree(_cache, ignore_errors=True)
        except Exception:
            pass

# ── Monkey-patch trl BEFORE importing SFTTrainer ─────────────────────────────
# Different trl versions have different SFTConfig signatures.  We patch early so
# that Unsloth's internal call to SFTConfig(**dict_args) never blows up.
try:
    import trl as _trl
    if hasattr(_trl, "SFTConfig"):
        _orig_sftconfig_init = _trl.SFTConfig.__init__

        def _safe_sftconfig_init(self, *args, **kwargs):
            """Strip any kwargs unknown to this trl version before delegating."""
            import inspect
            try:
                valid = set(inspect.signature(_orig_sftconfig_init).parameters.keys())
                # Remove unknown kwargs silently
                for k in list(kwargs):
                    if k not in valid and k != "self":
                        kwargs.pop(k)
            except Exception:
                # If introspection fails just drop the known bad ones
                for bad in ("push_to_hub_token",):
                    kwargs.pop(bad, None)
            return _orig_sftconfig_init(self, *args, **kwargs)

        _trl.SFTConfig.__init__ = _safe_sftconfig_init
except ImportError:
    pass

# ── Now safe to import transformers ──────────────────────────────────────────
import transformers
transformers.logging.set_verbosity_error()

from experiment_utils import provenance, sha256_file, write_json  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

# ── Paths (relative to this file, not CWD) ───────────────────────────────────
_TRAINING_DIR  = Path(__file__).parent
DATA_DIR       = _TRAINING_DIR / "data"
RESULTS_DIR    = _TRAINING_DIR / "results"
if Path("/kaggle/working").exists():
    CHECKPOINT_DIR = Path("/kaggle/working/checkpoints")
else:
    CHECKPOINT_DIR = Path("/content/checkpoints")
DRIVE_CKPT_DIR = Path("/content/drive/MyDrive/codesagez/checkpoints")

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)


# ── Hyperparameters ──────────────────────────────────────────────────────────
# T4-safe values. Do NOT increase MAX_SEQ_LENGTH or BATCH_SIZE without
# checking torch.cuda.memory_summary() after the first training step.
MAX_SEQ_LENGTH   = 1024   # 2048 OOMs on T4 (15GB). 1024 uses ~7GB safely.
BATCH_SIZE       = 1      # T4 constraint. Compensated by GRAD_ACCUM_STEPS.
GRAD_ACCUM_STEPS = 8      # Effective batch = BATCH_SIZE × GRAD_ACCUM_STEPS = 8
RANDOM_SEED      = 42
BASE_MODEL       = "Qwen/Qwen2.5-Coder-1.5B-Instruct"


# ── Dataset loader ───────────────────────────────────────────────────────────

def load_jsonl(path: Path):
    """Load a JSONL file into a HuggingFace Dataset."""
    import datasets as hf_datasets
    rows = []
    with path.open() as f:
        for line in f:
            rows.append(json.loads(line))
    logger.info("Loaded %d rows from %s", len(rows), path)
    return hf_datasets.Dataset.from_list(rows)


# ── Resume detection ─────────────────────────────────────────────────────────

def find_latest_checkpoint(ckpt_dir: Path) -> Path | None:
    """
    Scan checkpoint_dir for saved epoch dirs and return the most recent one.
    HuggingFace names them checkpoint-{step} — we pick the highest step number.
    Returns None if no checkpoints exist.
    """
    if not ckpt_dir.exists():
        return None
    candidates = sorted(
        [d for d in ckpt_dir.iterdir() if d.is_dir() and d.name.startswith("checkpoint-")],
        key=lambda d: int(d.name.split("-")[-1]),
    )
    return candidates[-1] if candidates else None


# ── Drive backup helper ──────────────────────────────────────────────────────

def backup_to_drive(src: Path, dst: Path) -> None:
    """Copy src directory to dst on Google Drive. Silently skip if Drive not mounted."""
    if not Path("/content/drive/MyDrive").exists():
        logger.warning("Google Drive not mounted — skipping backup of %s", src)
        return
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copytree(str(src), str(dst), dirs_exist_ok=True)
    logger.info("Backed up %s → %s", src, dst)


# ── Detect trl version capabilities ─────────────────────────────────────────

def _trl_has_sftconfig() -> bool:
    """Return True if the installed trl has SFTConfig (trl >= 0.10)."""
    try:
        from trl import SFTConfig  # noqa: F401
        return True
    except ImportError:
        return False


def _sftconfig_accepts(param: str) -> bool:
    """Return True if SFTConfig.__init__ accepts the given parameter name."""
    try:
        import inspect
        from trl import SFTConfig
        sig = inspect.signature(SFTConfig.__init__)
        return param in sig.parameters
    except Exception:
        return False


# ── Training ─────────────────────────────────────────────────────────────────

def train() -> None:
    import torch
    from unsloth import FastLanguageModel

    # Verify GPU
    if not torch.cuda.is_available():
        raise SystemExit("No GPU available. Runtime → Change runtime type → T4 GPU")
    vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
    logger.info(
        "GPU: %s | VRAM: %.1fGB", torch.cuda.get_device_name(0), vram_gb
    )
    if vram_gb < 12:
        raise SystemExit(
            f"Only {vram_gb:.1f}GB VRAM. Need at least 12GB. "
            "Reduce MAX_SEQ_LENGTH to 512 or get a T4/V100 runtime."
        )

    # Dataset
    manifest_path = DATA_DIR / "dataset_manifest.json"
    if not manifest_path.exists():
        raise SystemExit(
            "Missing training/data/dataset_manifest.json.\n"
            "Run Cell 3 in COLAB_GUIDE.md (dataset preparation) first."
        )
    train_dataset = load_jsonl(DATA_DIR / "train.jsonl")
    val_dataset   = load_jsonl(DATA_DIR / "val.jsonl")

    # Check for existing checkpoint (resume support)
    resume_from = find_latest_checkpoint(CHECKPOINT_DIR)
    if resume_from:
        logger.info("Resuming from checkpoint: %s", resume_from)
    else:
        logger.info("No existing checkpoint — starting fresh")

    # Load model
    logger.info("Loading %s (4-bit QLoRA)", BASE_MODEL)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=torch.float16,      # Explicit. T4 uses fp16, not bfloat16.
        load_in_4bit=True,
    )

    # Attach LoRA adapters
    logger.info("Attaching LoRA adapters (r=16, alpha=32)")
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
        use_gradient_checkpointing="unsloth",  # Unsloth's optimized checkpointing
        random_state=RANDOM_SEED,
    )

    # ── Build training arguments (version-aware) ──────────────────────────────
    # Core args shared between SFTConfig and TrainingArguments
    _common_args = dict(
        output_dir=str(CHECKPOINT_DIR),
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM_STEPS,
        warmup_ratio=0.1,
        num_train_epochs=3,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",        # 8-bit optimizer saves ~2GB VRAM
        weight_decay=0.01,
        fp16=True,                 # T4 uses fp16
        bf16=False,                # T4 does NOT support bfloat16
        logging_steps=25,
        eval_strategy="epoch",     # evaluate after every epoch
        save_strategy="epoch",     # CRITICAL: save after every epoch
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        seed=RANDOM_SEED,
        report_to="wandb",
        dataloader_num_workers=2,
    )

    if _trl_has_sftconfig():
        from trl import SFTConfig, SFTTrainer
        # SFTConfig-specific fields — only add if accepted (version safe)
        sft_extras: dict = {}
        if _sftconfig_accepts("dataset_text_field"):
            sft_extras["dataset_text_field"] = "text"
        if _sftconfig_accepts("max_seq_length"):
            sft_extras["max_seq_length"] = MAX_SEQ_LENGTH
        if _sftconfig_accepts("dataset_num_proc"):
            sft_extras["dataset_num_proc"] = 2
        # packing=True causes Unsloth to enable padding_free which then
        # conflicts with max_seq_length validation — keep packing=False.
        # With packing=False we avoid the ValueError entirely.
        if _sftconfig_accepts("packing"):
            sft_extras["packing"] = False

        training_args = SFTConfig(**_common_args, **sft_extras)
        logger.info("Using SFTConfig (trl >= 0.10)")

        # SFTTrainer with SFTConfig: do NOT pass dataset_text_field /
        # max_seq_length / packing again — they live in SFTConfig already.
        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            args=training_args,
        )
    else:
        # Old trl (< 0.10): SFTTrainer takes everything directly
        from trl import SFTTrainer
        from transformers import TrainingArguments
        training_args = TrainingArguments(**_common_args)
        logger.info("Using TrainingArguments (trl < 0.10 — no SFTConfig)")

        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            dataset_text_field="text",
            max_seq_length=MAX_SEQ_LENGTH,
            dataset_num_proc=2,
            packing=False,
            args=training_args,
        )

    # ── Fix Unsloth AttributeError on transformers >= 4.46 ───────────────────
    # 'int' object has no attribute 'mean' — triggered when num_items_in_batch
    # is passed as a plain int rather than a tensor.
    _orig_training_step = trainer.training_step

    def _safe_training_step(model, inputs, num_items_in_batch=None):
        """Guard num_items_in_batch before delegating to the real training step."""
        if isinstance(num_items_in_batch, int):
            num_items_in_batch = None
        return _orig_training_step(model, inputs, num_items_in_batch)

    trainer.training_step = _safe_training_step

    # Print memory before training
    torch.cuda.reset_peak_memory_stats()
    logger.info("Starting training…")
    logger.info(
        "Config: seq_len=%d | batch=%d | grad_acc=%d | effective_batch=%d",
        MAX_SEQ_LENGTH, BATCH_SIZE, GRAD_ACCUM_STEPS, BATCH_SIZE * GRAD_ACCUM_STEPS,
    )

    trainer_stats = trainer.train(
        resume_from_checkpoint=str(resume_from) if resume_from else None
    )

    peak_vram = torch.cuda.max_memory_reserved() / 1e9
    logger.info(
        "Training complete | runtime=%.1fs | train_loss=%.4f | peak_VRAM=%.1fGB",
        trainer_stats.metrics.get("train_runtime", 0),
        trainer_stats.metrics.get("train_loss", 0),
        peak_vram,
    )

    # Save best adapter
    best_ckpt = CHECKPOINT_DIR / "best_checkpoint"
    model.save_pretrained(str(best_ckpt))
    tokenizer.save_pretrained(str(best_ckpt))
    logger.info("Best checkpoint saved → %s", best_ckpt)

    # Immediate Drive backup
    backup_to_drive(CHECKPOINT_DIR, DRIVE_CKPT_DIR)

    # Write training log
    log = {
        **provenance(),
        "base_model": BASE_MODEL,
        "dataset_manifest_sha256": sha256_file(manifest_path),
        "random_seed": RANDOM_SEED,
        "max_seq_length": MAX_SEQ_LENGTH,
        "batch_size": BATCH_SIZE,
        "grad_accumulation_steps": GRAD_ACCUM_STEPS,
        "effective_batch_size": BATCH_SIZE * GRAD_ACCUM_STEPS,
        "peak_vram_gb": round(peak_vram, 2),
        "qlora": {"r": 16, "alpha": 32, "dropout": 0.05, "load_in_4bit": True},
        "epochs_completed": training_args.num_train_epochs,
        "train_runtime_s": trainer_stats.metrics.get("train_runtime"),
        "train_loss": trainer_stats.metrics.get("train_loss"),
        "resumed_from": str(resume_from) if resume_from else None,
    }
    write_json(RESULTS_DIR / "training_log.json", log)
    logger.info("Training log → %s", RESULTS_DIR / "training_log.json")

    # Back up results to Drive
    if Path("/content/drive/MyDrive").exists():
        drive_results = Path("/content/drive/MyDrive/codesagez/results")
        drive_results.mkdir(parents=True, exist_ok=True)
        shutil.copy(
            str(RESULTS_DIR / "training_log.json"),
            str(drive_results / "training_log.json"),
        )
        logger.info("Training log backed up to Drive")


# ── Export ────────────────────────────────────────────────────────────────────

def export_model() -> None:
    """
    Merge LoRA weights into the base model and export to GGUF for Ollama.
    Run after training is complete: python finetune.py --export
    """
    import torch
    from unsloth import FastLanguageModel

    best_ckpt = CHECKPOINT_DIR / "best_checkpoint"
    if not best_ckpt.exists():
        # Try Drive
        drive_best = DRIVE_CKPT_DIR / "best_checkpoint"
        if drive_best.exists():
            logger.info("Restoring best_checkpoint from Drive…")
            shutil.copytree(str(drive_best), str(best_ckpt))
        else:
            raise SystemExit(
                "No best_checkpoint found locally or in Drive.\n"
                "Run training first: python finetune.py"
            )

    logger.info("Loading checkpoint for export: %s", best_ckpt)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(best_ckpt),
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=torch.float16,
        load_in_4bit=True,
    )

    merged_path = "/content/codesagez-qwen-merged"
    logger.info("Merging LoRA weights → %s", merged_path)
    model.save_pretrained_merged(
        merged_path,
        tokenizer,
        save_method="merged_16bit",
    )

    gguf_path = "/content/codesagez-qwen-gguf"
    logger.info("Exporting GGUF (q4_k_m) → %s", gguf_path)
    model.save_pretrained_gguf(
        gguf_path,
        tokenizer,
        quantization_method="q4_k_m",
    )

    # Back up GGUF to Drive
    backup_to_drive(Path(gguf_path), Path("/content/drive/MyDrive/codesagez/gguf"))

    logger.info(
        "\nExport complete.\n"
        "  Merged (fp16): %s\n"
        "  GGUF:          %s/model.gguf\n\n"
        "To serve with Ollama:\n"
        "  1. Download %s/model.gguf from Drive\n"
        "  2. ollama create codesagez-coder -f training/Modelfile\n"
        "  3. ollama run codesagez-coder 'test'",
        merged_path,
        gguf_path,
        gguf_path,
    )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune Qwen2.5-Coder-1.5B on CommitPack")
    parser.add_argument(
        "--export",
        action="store_true",
        help="Export trained model to GGUF for Ollama (run after training)",
    )
    args = parser.parse_args()

    if args.export:
        export_model()
    else:
        train()
