"""
Run this as a Colab cell AFTER installing packages and restarting runtime.
It checks every version constraint and tells you exactly what to fix.

Paste into a Colab cell and run:
    %run training/verify_colab_env.py
"""

import sys

errors   = []
warnings_ = []

print("=" * 60)
print("CodeSageZ Colab Environment Verification")
print("=" * 60)

# ── GPU ─────────────────────────────────────────────────────────
print("\n[GPU]")
try:
    import torch
    if torch.cuda.is_available():
        name    = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        bf16    = torch.cuda.is_bf16_supported()
        print(f"  GPU    : {name}")
        print(f"  VRAM   : {vram_gb:.1f} GB")
        print(f"  bf16   : {bf16}")
        if vram_gb < 12:
            errors.append(f"GPU has only {vram_gb:.1f}GB VRAM. Need ≥12GB. "
                          "Reduce MAX_SEQ_LENGTH to 512 in finetune.py.")
        if bf16:
            warnings_.append("GPU supports bf16 — you could optionally set bf16=True, "
                             "fp16=False in finetune.py for better numerics.")
    else:
        errors.append("No CUDA GPU detected. "
                      "Runtime → Change runtime type → T4 GPU")
except ImportError:
    errors.append("torch not installed.")

# ── Core packages ───────────────────────────────────────────────
print("\n[Packages]")
checks = {
    "datasets":     ("2.19.2",  "==",  "pin to 2.19.2 — 2.20+ blocks trust_remote_code"),
    "protobuf":     ("3.20.3",  "==",  "pin to 3.20.3 — fixes TF/protobuf binary conflict"),
    "tree_sitter":  ("0.21.",   "sw",  "pin to 0.21.3 — 0.22+ breaks codebleu"),
    "transformers": ("4.",      "sw",  "any 4.x is fine"),
    "trl":          ("0.",      "sw",  "any 0.x is fine"),
    "accelerate":   ("0.",      "sw",  "any 0.x is fine"),
    "peft":         ("0.",      "sw",  "any 0.x is fine"),
}

for pkg, (required, mode, hint) in checks.items():
    try:
        mod = __import__(pkg.replace("_", "-") if pkg == "tree_sitter" else pkg)
    except ImportError:
        try:
            import importlib
            mod = importlib.import_module(pkg)
        except ImportError:
            errors.append(f"{pkg} not installed.")
            print(f"  ❌ {pkg:<20} NOT INSTALLED")
            continue

    ver = getattr(mod, "__version__", "unknown")
    ok  = (ver == required if mode == "==" else ver.startswith(required))
    status = "✅" if ok else "❌"
    print(f"  {status} {pkg:<20} {ver}")
    if not ok:
        errors.append(f"{pkg}=={ver} is wrong. Expected {required}. Hint: {hint}")

# ── codebleu import test ─────────────────────────────────────────
print("\n[codebleu]")
try:
    from codebleu import calc_codebleu
    # Quick smoke test
    result = calc_codebleu(
        references=[["def f(x): return x + 1"]],
        predictions=["def f(x): return x + 1"],
        lang="python",
    )
    print(f"  ✅ codebleu import OK | smoke test codebleu={result['codebleu']:.4f}")
except Exception as e:
    errors.append(f"codebleu import failed: {e}. "
                  "Check tree-sitter==0.21.3 is installed.")
    print(f"  ❌ codebleu: {e}")

# ── Unsloth import test ──────────────────────────────────────────
print("\n[Unsloth]")
try:
    import unsloth
    print(f"  ✅ unsloth {unsloth.__version__}")
except Exception as e:
    errors.append(f"Unsloth import failed: {e}. "
                  "Clear ~/.cache/unsloth, reinstall from git, restart runtime.")
    print(f"  ❌ unsloth: {e}")

# ── datasets trust_remote_code test ─────────────────────────────
print("\n[datasets trust_remote_code]")
try:
    import datasets as ds_mod
    if ds_mod.__version__ >= "2.20.0":
        errors.append(
            f"datasets=={ds_mod.__version__} blocks trust_remote_code. "
            "Run: pip install datasets==2.19.2 --force-reinstall, then restart."
        )
        print(f"  ❌ datasets {ds_mod.__version__} — too new")
    else:
        print(f"  ✅ datasets {ds_mod.__version__} — trust_remote_code allowed")
except ImportError:
    errors.append("datasets not installed.")

# ── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
if warnings_:
    print("WARNINGS:")
    for w in warnings_:
        print(f"  ⚠️  {w}")

if errors:
    print(f"\n❌ {len(errors)} ERROR(S) — fix these before running training:\n")
    for i, e in enumerate(errors, 1):
        print(f"  {i}. {e}")
    print()
    sys.exit(1)
else:
    print("\n✅ All checks passed. Safe to proceed with dataset prep + training.")
    print("   Follow COLAB_GUIDE.md from Cell 3 onward.")
print("=" * 60)
