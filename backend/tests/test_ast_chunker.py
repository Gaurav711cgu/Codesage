"""
Tests for AST-Aware Semantic Code Chunker with Parent Context Headers.
"""
import textwrap
import uuid
from pathlib import Path
import pytest

from app.services.ast_chunker import ASTChunker, ParentContext, default_ast_chunker


def test_ast_chunker_parent_context_headers_attached(tmp_path: Path):
    code = textwrap.dedent('''\
        """Module docstring for auth service."""
        from app.core import security
        import os

        class Authenticator:
            """Handles enterprise credentials verification."""

            def verify_token(self, token: str) -> bool:
                """Validate incoming bearer token."""
                return security.verify(token)
    ''')
    f = tmp_path / "auth.py"
    f.write_text(code)

    chunks = default_ast_chunker.chunk_file(f, "test_repo", "app/auth.py")
    assert len(chunks) >= 2

    # Verify class chunk
    class_chunk = next(c for c in chunks if c.name == "Authenticator")
    assert class_chunk.type == "class"
    assert "Handles enterprise credentials verification" in class_chunk.docstring

    # Verify method chunk and attached parent context
    method_chunk = next(c for c in chunks if c.name == "Authenticator.verify_token")
    assert method_chunk.type == "function"
    assert method_chunk.parent_class == "Authenticator"
    assert method_chunk.parent_docstring is not None
    assert "Handles enterprise credentials verification" in method_chunk.parent_docstring
    assert "security" in method_chunk.parent_header
    assert "app/auth.py" in method_chunk.parent_header

    # Verify to_document representation enriches isolated chunk text
    doc_text = method_chunk.to_document()
    assert "Parent Class: Authenticator" in doc_text
    assert "Parent Class Docstring:" in doc_text
    assert "def verify_token" in doc_text


def test_ast_chunker_preserves_method_boundaries(tmp_path: Path):
    code = textwrap.dedent("""\
        class Calculator:
            def add(self, a, b):
                return a + b

            def subtract(self, a, b):
                return a - b
    """)
    f = tmp_path / "calc.py"
    f.write_text(code)

    chunks = default_ast_chunker.chunk_file(f, "test_repo", "calc.py")
    names = {c.name for c in chunks}
    assert "Calculator" in names
    assert "Calculator.add" in names
    assert "Calculator.subtract" in names

    # Methods must have parent_class == Calculator
    add_chunk = next(c for c in chunks if c.name == "Calculator.add")
    assert add_chunk.parent_class == "Calculator"


def test_ast_chunker_oversized_function_statement_splitting(tmp_path: Path):
    # Construct a function with 50 statement lines
    statements = "\n    ".join([f"x_{i} = {i} * 2" for i in range(50)])
    code = f"def giant_worker():\n    '''Performs large batch job.'''\n    {statements}\n    return True\n"

    f = tmp_path / "giant.py"
    f.write_text(code)

    chunker = ASTChunker(max_chunk_lines=20, max_chunk_chars=500)
    chunks = chunker.chunk_file(f, "test_repo", "giant.py")

    assert len(chunks) > 1
    for c in chunks:
        assert c.type == "function"
        assert c.total_chunks == len(chunks)
        assert "giant_worker" in c.name
        # Sub-chunks retain file header
        assert "File: giant.py" in c.source


def test_ast_chunker_handles_javascript_typescript(tmp_path: Path):
    ts_code = textwrap.dedent("""\
        import { Request, Response } from 'express';

        export class UserController {
            async getUser(req: Request, res: Response) {
                return res.json({ id: 1 });
            }
        }
    """)
    f = tmp_path / "controller.ts"
    f.write_text(ts_code)

    chunks = default_ast_chunker.chunk_file(f, "test_repo", "controller.ts")
    names = {c.name for c in chunks}
    assert "UserController" in names
    assert "UserController.getUser" in names

    method = next(c for c in chunks if c.name == "UserController.getUser")
    assert method.parent_class == "UserController"
    assert "File: controller.ts" in method.parent_header


def test_ast_chunker_python_ast_fallback():
    chunker = ASTChunker()
    code = textwrap.dedent("""\
        import math

        class Geometry:
            '''Geometry utilities.'''
            def circle_area(self, r: float) -> float:
                return math.pi * r * r
    """).encode("utf-8")

    chunks = chunker._chunk_python_ast_fallback(code, "test_repo", "geo.py")
    assert len(chunks) == 2
    names = {c.name for c in chunks}
    assert "Geometry" in names
    assert "Geometry.circle_area" in names

    method = next(c for c in chunks if c.name == "Geometry.circle_area")
    assert method.parent_class == "Geometry"
    assert "Geometry utilities" in (method.parent_docstring or "")
