"""Build the bundled read-only sample from authored Python files using Python's AST."""
import ast,json
from pathlib import Path
files={
'api.py':'''# A small, local example used to explore source relationships.
from graph import build_graph
from retrieval import rank_context


def inspect_repository(files, question):
    """Collect structural context before a reviewer asks a question."""
    graph = build_graph(files)
    context = rank_context(question, graph["symbols"])
    return {"context": context, "graph": graph}
''',
'graph.py':'''# Source relationships are resolved from local syntax trees.
from parser import parse_symbols, resolve_calls


def build_graph(files):
    """Keep definitions and their resolved calls together."""
    symbols = []
    edges = []

    for path, source in files.items():
        symbols.extend(parse_symbols(path, source))

    for path, source in files.items():
        edges.extend(resolve_calls(path, source, symbols))

    return {"symbols": symbols, "edges": edges}


def neighbors(name, edges):
    """Return direct callees for a selected definition."""
    return [edge["to"] for edge in edges if edge["from"] == name]
''',
'parser.py':'''import ast


def parse_symbols(path, source):
    """Return function names and their original source locations."""
    tree = ast.parse(source)
    return [{"name": node.name, "file": path, "line": node.lineno}
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef)]


def resolve_calls(path, source, symbols):
    """Keep calls whose target is a known function in this sample."""
    known = {symbol["name"] for symbol in symbols}
    tree = ast.parse(source)
    edges = []
    for function in ast.walk(tree):
        if isinstance(function, ast.FunctionDef):
            for call in ast.walk(function):
                if isinstance(call, ast.Call) and isinstance(call.func, ast.Name):
                    if call.func.id in known:
                        edges.append({"from": function.name, "to": call.func.id})
    return edges
''',
'retrieval.py':'''# This sample performs local lexical ranking, without a model call.

def lexical_score(question, symbol):
    words = set(question.lower().split())
    name = symbol["name"].replace("_", " ").lower()
    return sum(word in name for word in words)


def rank_context(question, symbols):
    """Order definitions by a small, inspectable lexical score."""
    ranked = sorted(symbols,
                    key=lambda symbol: lexical_score(question, symbol),
                    reverse=True)
    return ranked[:4]
'''
}
symbols=[]
for path,source in files.items():
 for node in ast.walk(ast.parse(source)):
  if isinstance(node,ast.FunctionDef): symbols.append({'name':node.name,'file':path,'line':node.lineno})
known={s['name'] for s in symbols};edges=[]
for path,source in files.items():
 for fn in ast.walk(ast.parse(source)):
  if isinstance(fn,ast.FunctionDef):
   for call in ast.walk(fn):
    if isinstance(call,ast.Call) and isinstance(call.func,ast.Name) and call.func.id in known:
     edges.append({'from':fn.name,'to':call.func.id})
result={'label':'Authored local source-explorer sample','generatedWith':'Python ast; static function and call inspection','files':[{'path':p,'source':s} for p,s in files.items()],'symbols':symbols,'edges':edges}
output = Path(__file__).resolve().parents[1] / 'src/app/repos/sample.json'
output.write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(files)} files, {len(symbols)} definitions, {len(edges)} resolved call edges')
