import tree_sitter_javascript as ts_js
from tree_sitter import Language, Parser
lang = Language(ts_js.language())
parser = Parser(lang)
tree = parser.parse(b"""
import { a } from 'b';
class Foo {
    bar() {
        baz();
    }
}
function qux() {}
const quux = () => {};
""")
def walk(node, indent=0):
    print(" " * indent + node.type)
    for child in node.children:
        walk(child, indent + 2)
walk(tree.root_node)
