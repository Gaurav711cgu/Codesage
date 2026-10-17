"""
AST-Aware Semantic Code Chunker.

Implements syntax-tree aware chunking for Python, JavaScript, TypeScript,
and other languages using Tree-sitter with standard-library AST fallback.
Preserves semantic boundaries (functions, classes, methods) and attaches
parent context headers (class name, module docstrings, imports) to each chunk
so isolated retrieval candidates retain complete semantic context.
"""
from __future__ import annotations

import ast
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from tree_sitter import Language, Parser
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript

logger = logging.getLogger(__name__)

# Tree-sitter parsers
PY_LANGUAGE = Language(tspython.language())
_py_parser = Parser(PY_LANGUAGE)

JS_LANGUAGE = Language(tsjavascript.language())
_js_parser = Parser(JS_LANGUAGE)

TS_LANGUAGE = Language(tstypescript.language_typescript())
_ts_parser = Parser(TS_LANGUAGE)

TSX_LANGUAGE = Language(tstypescript.language_tsx())
_tsx_parser = Parser(TSX_LANGUAGE)


@dataclass
class ParentContext:
    """Carries hierarchical parent metadata for code chunks."""
    file: str
    parent_class: Optional[str] = None
    parent_docstring: Optional[str] = None
    imports: list[str] = field(default_factory=list)
    module_docstring: Optional[str] = None

    def format_header(self, comment_prefix: str = "#") -> str:
        """Render a contextual header prepended to isolated chunk text."""
        header_lines: list[str] = [f"{comment_prefix} File: {self.file}"]
        if self.parent_class:
            header_lines.append(f"{comment_prefix} Class: {self.parent_class}")
        if self.parent_docstring:
            clean_doc = " ".join(self.parent_docstring.strip().split())
            header_lines.append(f"{comment_prefix} Class Docstring: {clean_doc}")
        if self.module_docstring:
            clean_mod = " ".join(self.module_docstring.strip().split())
            header_lines.append(f"{comment_prefix} Module Docstring: {clean_mod}")
        if self.imports:
            # Include top 5 most relevant imports for context compactness
            top_imports = self.imports[:5]
            header_lines.append(f"{comment_prefix} Imports: {'; '.join(top_imports)}")
        return "\n".join(header_lines)


@dataclass
class ASTChunk:
    """
    Syntax-tree aware code chunk.
    Maintains 100% backward compatibility with CodeUnit fields and schemas.
    """
    id: str
    repo_id: str
    name: str
    file: str
    type: str  # "function" | "class" | "method" | "file"
    start_line: int
    end_line: int
    source: str
    docstring: str = ""
    calls: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    parent_class: Optional[str] = None
    parent_docstring: Optional[str] = None
    parent_header: str = ""
    chunk_index: int = 0
    total_chunks: int = 1

    def to_document(self) -> str:
        """
        Text representation fed to dense vector embedder and BM25 index.
        Enriches raw source with parent context header so isolated chunks retain full semantic context.
        """
        parts: list[str] = [
            f"File: {self.file}",
            f"Type: {self.type}",
            f"Name: {self.name}",
        ]
        if self.parent_class:
            parts.append(f"Parent Class: {self.parent_class}")
        if self.parent_docstring:
            parts.append(f"Parent Class Docstring: {self.parent_docstring}")
        if self.docstring:
            parts.append(f"Docstring: {self.docstring}")
        if self.calls:
            parts.append(f"Calls: {', '.join(self.calls)}")
        if self.parent_header:
            parts.append(self.parent_header)
        parts.append(self.source)
        return "\n".join(parts)

    def to_metadata(self) -> dict:
        return {
            "name": self.name,
            "file": self.file,
            "type": self.type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "calls": json.dumps(self.calls),
            "parent_class": self.parent_class or "",
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
        }

    def to_graph_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "file": self.file,
            "type": self.type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "calls": self.calls,
        }


class ASTChunker:
    """
    Syntax-tree aware semantic chunking engine.
    Respects function, class, and method boundaries.
    """

    def __init__(
        self,
        max_chunk_lines: int = 120,
        max_chunk_chars: int = 3500,
    ) -> None:
        self.max_chunk_lines = max_chunk_lines
        self.max_chunk_chars = max_chunk_chars

    @staticmethod
    def _node_text(node, src_bytes: bytes) -> str:
        return src_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    @staticmethod
    def _extract_docstring(body_node, src_bytes: bytes) -> str:
        """Extract leading docstring from block node."""
        if not body_node:
            return ""
        for child in body_node.children:
            if child.type == "expression_statement":
                for grandchild in child.children:
                    if grandchild.type in ("string", "concatenated_string"):
                        raw = src_bytes[grandchild.start_byte:grandchild.end_byte].decode(
                            "utf-8", errors="replace"
                        )
                        return raw.strip('"""').strip("'''").strip('"').strip("'").strip()
        return ""

    @staticmethod
    def _extract_calls(body_node, src_bytes: bytes) -> list[str]:
        """Extract unique invoked symbol identifiers from AST body."""
        if not body_node:
            return []
        calls: list[str] = []

        def walk(node):
            if node.type in ("call", "call_expression"):
                func_node = node.child_by_field_name("function")
                if func_node:
                    if func_node.type == "identifier":
                        calls.append(
                            src_bytes[func_node.start_byte:func_node.end_byte].decode(
                                "utf-8", errors="replace"
                            )
                        )
                    elif func_node.type in ("attribute", "member_expression"):
                        attr = (
                            func_node.child_by_field_name("attribute")
                            or func_node.child_by_field_name("property")
                        )
                        if attr:
                            calls.append(
                                src_bytes[attr.start_byte:attr.end_byte].decode(
                                    "utf-8", errors="replace"
                                )
                            )
            for child in node.children:
                walk(child)

        walk(body_node)
        return list(dict.fromkeys(calls))

    @staticmethod
    def _extract_imports(root_node, src_bytes: bytes) -> list[str]:
        imports: list[str] = []
        for node in root_node.children:
            if node.type in (
                "import_statement",
                "import_from_statement",
                "lexical_declaration",
            ):
                text = src_bytes[node.start_byte:node.end_byte].decode(
                    "utf-8", errors="replace"
                ).strip()
                if text:
                    imports.append(text)
        return imports

    def _split_oversized_unit(
        self,
        base_unit: ASTChunk,
        parent_context: ParentContext,
        comment_prefix: str,
    ) -> list[ASTChunk]:
        """
        Split an oversized function or class on statement or logical block boundaries
        rather than blind character truncation. Each sub-chunk inherits the parent header
        and signature context.
        """
        lines = base_unit.source.splitlines()
        if len(lines) <= self.max_chunk_lines and len(base_unit.source) <= self.max_chunk_chars:
            return [base_unit]

        sub_chunks: list[ASTChunk] = []
        signature_line = lines[0] if lines else f"{base_unit.type} {base_unit.name}:"
        
        current_block: list[str] = []
        block_start_line = base_unit.start_line
        current_len = 0

        for idx, line in enumerate(lines):
            line_len = len(line) + 1
            if current_len + line_len > self.max_chunk_chars or len(current_block) >= self.max_chunk_lines:
                if current_block:
                    sub_idx = len(sub_chunks) + 1
                    block_text = "\n".join(current_block)
                    augmented_source = (
                        f"{parent_context.format_header(comment_prefix)}\n"
                        f"{comment_prefix} [Part {sub_idx} of {base_unit.name}]\n"
                        f"{signature_line} ...\n"
                        f"{block_text}"
                    )
                    sub_chunks.append(
                        ASTChunk(
                            id=f"{base_unit.id}::part_{sub_idx}",
                            repo_id=base_unit.repo_id,
                            name=f"{base_unit.name}::part_{sub_idx}",
                            file=base_unit.file,
                            type=base_unit.type,
                            start_line=block_start_line,
                            end_line=block_start_line + len(current_block) - 1,
                            source=augmented_source,
                            docstring=base_unit.docstring if sub_idx == 1 else "",
                            calls=base_unit.calls,
                            imports=base_unit.imports,
                            parent_class=base_unit.parent_class,
                            parent_docstring=base_unit.parent_docstring,
                            parent_header=base_unit.parent_header,
                            chunk_index=sub_idx - 1,
                        )
                    )
                    block_start_line = base_unit.start_line + idx
                    current_block = []
                    current_len = 0

            current_block.append(line)
            current_len += line_len

        if current_block:
            sub_idx = len(sub_chunks) + 1
            block_text = "\n".join(current_block)
            augmented_source = (
                f"{parent_context.format_header(comment_prefix)}\n"
                f"{comment_prefix} [Part {sub_idx} of {base_unit.name}]\n"
                f"{signature_line} ...\n"
                f"{block_text}"
            )
            sub_chunks.append(
                ASTChunk(
                    id=f"{base_unit.id}::part_{sub_idx}",
                    repo_id=base_unit.repo_id,
                    name=f"{base_unit.name}::part_{sub_idx}",
                    file=base_unit.file,
                    type=base_unit.type,
                    start_line=block_start_line,
                    end_line=base_unit.end_line,
                    source=augmented_source,
                    docstring="",
                    calls=base_unit.calls,
                    imports=base_unit.imports,
                    parent_class=base_unit.parent_class,
                    parent_docstring=base_unit.parent_docstring,
                    parent_header=base_unit.parent_header,
                    chunk_index=sub_idx - 1,
                )
            )

        total = len(sub_chunks)
        for c in sub_chunks:
            c.total_chunks = total
        return sub_chunks

    def chunk_source(
        self,
        src_bytes: bytes,
        repo_id: str,
        file_rel: str,
        ext: str,
    ) -> list[ASTChunk]:
        """Parse source bytes using Tree-sitter AST, returning boundary-aware ASTChunk objects."""
        if ext == ".py":
            parser = _py_parser
            comment_prefix = "#"
        elif ext == ".js":
            parser = _js_parser
            comment_prefix = "//"
        elif ext == ".ts":
            parser = _ts_parser
            comment_prefix = "//"
        elif ext in (".tsx", ".jsx"):
            parser = _tsx_parser
            comment_prefix = "//"
        else:
            return self._chunk_fallback_languages(src_bytes, repo_id, file_rel, ext)

        try:
            tree = parser.parse(src_bytes)
            root = tree.root_node
        except Exception as exc:
            logger.warning("Tree-sitter parse failed for %s (%s). Falling back to Python ast.", file_rel, exc)
            if ext == ".py":
                return self._chunk_python_ast_fallback(src_bytes, repo_id, file_rel)
            return []

        imports = self._extract_imports(root, src_bytes)
        module_docstring = self._extract_docstring(root, src_bytes)
        chunks: list[ASTChunk] = []

        def process_node(
            node,
            parent_class: Optional[str] = None,
            parent_class_docstring: Optional[str] = None,
        ):
            if node.type in (
                "function_definition",
                "async_function_definition",
                "function_declaration",
                "method_definition",
                "arrow_function",
                "function",
                "function_expression",
                "generator_function_declaration",
                "generator_function",
            ):
                name_node = node.child_by_field_name("name")
                if not name_node and node.parent:
                    p = node.parent
                    if p.type in ("variable_declarator", "public_field_definition", "field_definition", "property_definition", "pair"):
                        name_node = p.child_by_field_name("name") or p.child_by_field_name("key")
                    elif p.type == "assignment_expression":
                        name_node = p.child_by_field_name("left")

                body_node = node.child_by_field_name("body") or node.child_by_field_name("statement_block")
                if name_node and body_node:
                    raw_name = self._node_text(name_node, src_bytes)
                    qualified_name = f"{parent_class}.{raw_name}" if parent_class else raw_name

                    # Use parent declarator boundary for self-contained arrow function / field chunks
                    enclosing_node = node
                    if node.parent and node.parent.type in ("variable_declarator", "public_field_definition", "field_definition", "property_definition"):
                        enclosing_node = node.parent

                    start_l = enclosing_node.start_point[0] + 1
                    end_l = enclosing_node.end_point[0] + 1
                    unit_id = f"{repo_id}::{file_rel}::{qualified_name}::{start_l}"
                    
                    docstring = self._extract_docstring(body_node, src_bytes)
                    calls = self._extract_calls(body_node, src_bytes)
                    source_text = self._node_text(enclosing_node, src_bytes)

                    parent_ctx = ParentContext(
                        file=file_rel,
                        parent_class=parent_class,
                        parent_docstring=parent_class_docstring,
                        imports=imports,
                        module_docstring=module_docstring,
                    )
                    header_str = parent_ctx.format_header(comment_prefix)

                    base_chunk = ASTChunk(
                        id=unit_id,
                        repo_id=repo_id,
                        name=qualified_name,
                        file=file_rel,
                        type="function",
                        start_line=start_l,
                        end_line=end_l,
                        source=source_text,
                        docstring=docstring,
                        calls=calls,
                        imports=imports,
                        parent_class=parent_class,
                        parent_docstring=parent_class_docstring,
                        parent_header=header_str,
                    )

                    split_units = self._split_oversized_unit(base_chunk, parent_ctx, comment_prefix)
                    chunks.extend(split_units)

                # Recurse into nested function bodies
                if body_node:
                    for child in body_node.children:
                        process_node(child, parent_class, parent_class_docstring)

            elif node.type in ("class_definition", "class_declaration"):
                name_node = node.child_by_field_name("name")
                body_node = node.child_by_field_name("body")
                if not name_node or not body_node:
                    return

                class_name = self._node_text(name_node, src_bytes)
                unit_id = f"{repo_id}::{file_rel}::{class_name}::{node.start_point[0] + 1}"
                class_doc = self._extract_docstring(body_node, src_bytes)
                source_text = self._node_text(node, src_bytes)

                parent_ctx = ParentContext(
                    file=file_rel,
                    parent_class=None,
                    parent_docstring=None,
                    imports=imports,
                    module_docstring=module_docstring,
                )
                header_str = parent_ctx.format_header(comment_prefix)

                base_chunk = ASTChunk(
                    id=unit_id,
                    repo_id=repo_id,
                    name=class_name,
                    file=file_rel,
                    type="class",
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    source=source_text,
                    docstring=class_doc,
                    calls=[],
                    imports=imports,
                    parent_class=None,
                    parent_docstring=None,
                    parent_header=header_str,
                )
                chunks.append(base_chunk)

                # Recurse into class body for methods
                for child in body_node.children:
                    process_node(child, class_name, class_doc)

            elif node.type in ("interface_declaration", "type_alias_declaration", "enum_declaration"):
                name_node = node.child_by_field_name("name")
                if name_node:
                    decl_name = self._node_text(name_node, src_bytes)
                    decl_type = "interface" if "interface" in node.type else ("type" if "type" in node.type else "enum")
                    unit_id = f"{repo_id}::{file_rel}::{decl_name}::{node.start_point[0] + 1}"
                    source_text = self._node_text(node, src_bytes)

                    parent_ctx = ParentContext(
                        file=file_rel,
                        parent_class=None,
                        parent_docstring=None,
                        imports=imports,
                        module_docstring=module_docstring,
                    )
                    header_str = parent_ctx.format_header(comment_prefix)
                    chunks.append(
                        ASTChunk(
                            id=unit_id,
                            repo_id=repo_id,
                            name=decl_name,
                            file=file_rel,
                            type=decl_type,
                            start_line=node.start_point[0] + 1,
                            end_line=node.end_point[0] + 1,
                            source=source_text,
                            docstring="",
                            calls=[],
                            imports=imports,
                            parent_class=None,
                            parent_docstring=None,
                            parent_header=header_str,
                        )
                    )

            elif node.type in (
                "lexical_declaration",
                "variable_declaration",
                "variable_declarator",
                "export_statement",
                "expression_statement",
                "field_definition",
                "public_field_definition",
                "property_definition",
                "class_body",
                "statement_block",
                "program",
            ):
                for child in node.children:
                    process_node(child, parent_class, parent_class_docstring)

        for top_node in root.children:
            process_node(top_node)

        return chunks

    def _chunk_python_ast_fallback(
        self,
        src_bytes: bytes,
        repo_id: str,
        file_rel: str,
    ) -> list[ASTChunk]:
        """Standard-library Python `ast` fallback chunker."""
        src_text = src_bytes.decode("utf-8", errors="replace")
        try:
            tree = ast.parse(src_text)
        except SyntaxError:
            return []

        chunks: list[ASTChunk] = []
        lines = src_text.splitlines()

        # Collect module imports and docstring
        imports: list[str] = []
        module_docstring = ast.get_docstring(tree) or ""
        for node in tree.body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                imports.append(ast.unparse(node))

        def process_ast_node(node, parent_class: Optional[str] = None, parent_docstring: Optional[str] = None):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                raw_name = node.name
                qualified_name = f"{parent_class}.{raw_name}" if parent_class else raw_name
                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line + len(node.body))
                source_lines = lines[start_line - 1 : end_line]
                source_text = "\n".join(source_lines)
                doc = ast.get_docstring(node) or ""

                # Extract calls
                calls: list[str] = []
                for sub in ast.walk(node):
                    if isinstance(sub, ast.Call):
                        if isinstance(sub.func, ast.Name):
                            calls.append(sub.func.id)
                        elif isinstance(sub.func, ast.Attribute):
                            calls.append(sub.func.attr)

                parent_ctx = ParentContext(
                    file=file_rel,
                    parent_class=parent_class,
                    parent_docstring=parent_docstring,
                    imports=imports,
                    module_docstring=module_docstring,
                )
                header_str = parent_ctx.format_header("#")
                unit_id = f"{repo_id}::{file_rel}::{qualified_name}::{start_line}"

                base_chunk = ASTChunk(
                    id=unit_id,
                    repo_id=repo_id,
                    name=qualified_name,
                    file=file_rel,
                    type="function",
                    start_line=start_line,
                    end_line=end_line,
                    source=source_text,
                    docstring=doc,
                    calls=list(dict.fromkeys(calls)),
                    imports=imports,
                    parent_class=parent_class,
                    parent_docstring=parent_docstring,
                    parent_header=header_str,
                )
                chunks.extend(self._split_oversized_unit(base_chunk, parent_ctx, "#"))

            elif isinstance(node, ast.ClassDef):
                class_name = node.name
                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line + len(node.body))
                source_lines = lines[start_line - 1 : end_line]
                source_text = "\n".join(source_lines)
                class_doc = ast.get_docstring(node) or ""

                parent_ctx = ParentContext(
                    file=file_rel,
                    parent_class=None,
                    parent_docstring=None,
                    imports=imports,
                    module_docstring=module_docstring,
                )
                header_str = parent_ctx.format_header("#")
                unit_id = f"{repo_id}::{file_rel}::{class_name}::{start_line}"

                chunks.append(
                    ASTChunk(
                        id=unit_id,
                        repo_id=repo_id,
                        name=class_name,
                        file=file_rel,
                        type="class",
                        start_line=start_line,
                        end_line=end_line,
                        source=source_text,
                        docstring=class_doc,
                        calls=[],
                        imports=imports,
                        parent_class=None,
                        parent_docstring=None,
                        parent_header=header_str,
                    )
                )

                for item in node.body:
                    process_ast_node(item, class_name, class_doc)

        for item in tree.body:
            process_ast_node(item)

        return chunks

    def _chunk_fallback_languages(
        self,
        src_bytes: bytes,
        repo_id: str,
        file_rel: str,
        ext: str,
    ) -> list[ASTChunk]:
        """Regex-based boundary extraction for compiled languages."""
        src_text = src_bytes.decode("utf-8", errors="replace")
        lines = src_text.splitlines()

        if ext == ".go":
            pattern = re.compile(r"func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(")
        elif ext in (".java", ".c", ".cpp"):
            pattern = re.compile(r"(?:public|private|protected|static|\s)+\s+[\w<>]+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{")
        elif ext == ".rs":
            pattern = re.compile(r"fn\s+([A-Za-z0-9_]+)\s*\(")
        else:
            return []

        chunks: list[ASTChunk] = []
        for i, line in enumerate(lines, 1):
            match = pattern.search(line)
            if match:
                fn_name = match.group(1)
                unit_id = f"{repo_id}::{file_rel}::{fn_name}::{i}"
                end_idx = min(i + 25, len(lines))
                body_snippet = "\n".join(lines[i - 1 : end_idx])
                chunks.append(
                    ASTChunk(
                        id=unit_id,
                        repo_id=repo_id,
                        name=fn_name,
                        file=file_rel,
                        type="function",
                        start_line=i,
                        end_line=end_idx,
                        source=body_snippet,
                        docstring="",
                        calls=[],
                        imports=[],
                        parent_class=None,
                        parent_docstring=None,
                        parent_header=f"// File: {file_rel}",
                    )
                )
        return chunks

    def chunk_file(
        self,
        file_path: Path,
        repo_id: str,
        file_rel: str,
    ) -> list[ASTChunk]:
        """Convenience method to chunk an on-disk source file."""
        try:
            src_bytes = file_path.read_bytes()
        except Exception as exc:
            logger.warning("Could not read file %s: %s", file_path, exc)
            return []
        ext = file_path.suffix.lower()
        return self.chunk_source(src_bytes, repo_id, file_rel, ext)


# Global default instance
default_ast_chunker = ASTChunker()
