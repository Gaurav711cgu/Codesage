"""
Tests for the Tree-sitter parsing and graph-building logic.
These run without any external services (no DB, no ChromaDB, no Gemini).
"""
import textwrap
import uuid
from pathlib import Path

import pytest

from app.services.ingestion import parse_python_file, CodeUnit
from app.services.graph import build_graph, expand_one_hop, serialise_graph, get_graph


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def simple_py_file(tmp_path: Path) -> Path:
    code = textwrap.dedent("""\
        def greet(name: str) -> str:
            '''Return a greeting string.'''
            return f"Hello, {name}"

        def main():
            result = greet("world")
            print(result)
    """)
    f = tmp_path / "simple.py"
    f.write_text(code)
    return f


@pytest.fixture
def class_py_file(tmp_path: Path) -> Path:
    code = textwrap.dedent("""\
        class Calculator:
            '''A simple calculator.'''

            def add(self, a, b):
                return a + b

            def subtract(self, a, b):
                return a - b

        def run():
            calc = Calculator()
            return calc.add(1, 2)
    """)
    f = tmp_path / "calculator.py"
    f.write_text(code)
    return f


# ─── parse_python_file ────────────────────────────────────────────────────────


def test_parse_simple_functions(simple_py_file, tmp_path):
    repo_id = str(uuid.uuid4())
    units = parse_python_file(simple_py_file, repo_id, "simple.py")

    names = {u.name for u in units}
    assert "greet" in names
    assert "main" in names


def test_parse_docstring(simple_py_file, tmp_path):
    repo_id = str(uuid.uuid4())
    units = parse_python_file(simple_py_file, repo_id, "simple.py")
    greet = next(u for u in units if u.name == "greet")
    assert "greeting" in greet.docstring.lower()


def test_parse_calls(simple_py_file, tmp_path):
    repo_id = str(uuid.uuid4())
    units = parse_python_file(simple_py_file, repo_id, "simple.py")
    main_unit = next(u for u in units if u.name == "main")
    assert "greet" in main_unit.calls
    assert "print" in main_unit.calls


def test_parse_class_and_methods(class_py_file, tmp_path):
    repo_id = str(uuid.uuid4())
    units = parse_python_file(class_py_file, repo_id, "calculator.py")

    types = {u.type for u in units}
    assert "class" in types
    assert "function" in types

    names = {u.name for u in units}
    assert "Calculator" in names
    assert "Calculator.add" in names
    assert "Calculator.subtract" in names
    assert "run" in names


def test_unit_id_format(simple_py_file, tmp_path):
    repo_id = "test-repo-id"
    units = parse_python_file(simple_py_file, repo_id, "simple.py")
    for u in units:
        assert u.id.startswith(f"{repo_id}::simple.py::")


def test_parse_empty_file(tmp_path):
    f = tmp_path / "empty.py"
    f.write_text("")
    units = parse_python_file(f, "repo", "empty.py")
    assert units == []


def test_parse_syntax_invalid(tmp_path):
    f = tmp_path / "bad.py"
    f.write_text("def foo(\n  # unclosed\n")
    # Should return empty rather than raise
    units = parse_python_file(f, "repo", "bad.py")
    # Tree-sitter is error-tolerant; may return partial results or empty
    assert isinstance(units, list)


# ─── build_graph ─────────────────────────────────────────────────────────────


def _make_units(specs: list[tuple[str, str, list[str]]]) -> list[dict]:
    """Helper: [(id, name, calls), ...] → list of graph dicts."""
    return [
        {"id": uid, "name": name, "file": "f.py", "type": "function",
         "start_line": 1, "end_line": 10, "calls": calls}
        for uid, name, calls in specs
    ]


def test_build_graph_nodes():
    units = _make_units([
        ("r::f::a", "a", ["b"]),
        ("r::f::b", "b", []),
    ])
    G = build_graph(units)
    assert "r::f::a" in G.nodes
    assert "r::f::b" in G.nodes


def test_build_graph_edges():
    units = _make_units([
        ("r::f::a", "a", ["b"]),
        ("r::f::b", "b", []),
    ])
    G = build_graph(units)
    assert G.has_edge("r::f::a", "r::f::b")
    assert not G.has_edge("r::f::b", "r::f::a")


def test_build_graph_no_self_loops():
    units = _make_units([("r::f::a", "a", ["a"])])
    G = build_graph(units)
    assert not G.has_edge("r::f::a", "r::f::a")


def test_expand_one_hop_successors():
    units = _make_units([
        ("r::f::a", "a", ["b"]),
        ("r::f::b", "b", ["c"]),
        ("r::f::c", "c", []),
    ])
    G = build_graph(units)
    neighbours = expand_one_hop(G, ["r::f::a"])
    assert "r::f::b" in neighbours  # a calls b → successor
    assert "r::f::c" not in neighbours  # 2-hop, not 1-hop


def test_expand_one_hop_predecessors():
    units = _make_units([
        ("r::f::caller", "caller", ["target"]),
        ("r::f::target", "target", []),
    ])
    G = build_graph(units)
    neighbours = expand_one_hop(G, ["r::f::target"])
    assert "r::f::caller" in neighbours  # caller calls target → predecessor


def test_expand_excludes_seeds():
    units = _make_units([
        ("r::f::a", "a", ["b"]),
        ("r::f::b", "b", []),
    ])
    G = build_graph(units)
    neighbours = expand_one_hop(G, ["r::f::a"])
    assert "r::f::a" not in neighbours


# ─── Graph serialisation ──────────────────────────────────────────────────────


def test_serialise_and_deserialise():
    units = _make_units([
        ("r::f::x", "x", ["y"]),
        ("r::f::y", "y", []),
    ])
    G = build_graph(units)
    json_str = serialise_graph(G)
    G2 = get_graph("test-roundtrip", json_str)
    assert set(G2.nodes) == set(G.nodes)
    assert set(G2.edges) == set(G.edges)
