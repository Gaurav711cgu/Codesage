"""
Training package for CodeSage fine-tuning and evaluation pipelines.
"""
import sys
from pathlib import Path

# Ensure training directory is accessible on sys.path when imported as a package
_pkg_dir = str(Path(__file__).resolve().parent)
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)
