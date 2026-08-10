const PYTHON_KEYWORDS = [
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import',
  'from', 'as', 'try', 'except', 'finally', 'with', 'yield', 'lambda',
  'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'pass',
  'break', 'continue', 'raise', 'del', 'global', 'nonlocal', 'assert',
  'async', 'await', 'self', 'cls'
];

const JS_KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'import', 'from', 'export', 'default', 'class', 'extends', 'new', 'this',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
  'switch', 'case', 'break', 'continue', 'null', 'undefined', 'true', 'false',
  'of', 'in', 'yield', 'super'
];

const RUST_KEYWORDS = [
  'fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'trait', 'use',
  'mod', 'self', 'super', 'crate', 'match', 'if', 'else', 'for', 'while',
  'loop', 'return', 'break', 'continue', 'async', 'await', 'move', 'where',
  'type', 'const', 'static', 'ref', 'true', 'false', 'Some', 'None', 'Ok', 'Err'
];

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE',
  'DROP', 'ALTER', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND',
  'OR', 'NOT', 'NULL', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
  'INTO', 'VALUES', 'SET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'UNION', 'EXISTS', 'BETWEEN', 'LIKE', 'IN', 'IS', 'CASE', 'WHEN', 'THEN', 'END'
];

const GO_KEYWORDS = [
  'func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface',
  'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
  'break', 'continue', 'go', 'chan', 'select', 'defer', 'map', 'make',
  'nil', 'true', 'false', 'error', 'string', 'int', 'bool', 'float64'
];

const JAVA_KEYWORDS = [
  'public', 'private', 'protected', 'static', 'final', 'class', 'interface',
  'extends', 'implements', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
  'throws', 'new', 'this', 'super', 'void', 'int', 'boolean', 'String',
  'null', 'true', 'false', 'import', 'package', 'abstract', 'synchronized'
];

const C_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
  'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
  'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
  'NULL', 'printf', 'scanf', 'malloc', 'free', 'include', 'define'
];

const CPP_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'class', 'const', 'continue', 'default',
  'delete', 'do', 'double', 'else', 'enum', 'explicit', 'extern', 'false',
  'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long',
  'namespace', 'new', 'nullptr', 'operator', 'private', 'protected', 'public',
  'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch',
  'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename',
  'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while',
  'catch', 'const_cast', 'dynamic_cast', 'reinterpret_cast', 'static_cast',
  'std', 'string', 'vector', 'map', 'set', 'cout', 'cin', 'endl',
  'include', 'define', 'pragma'
];

function getKeywords(lang) {
  const map = {
    python: PYTHON_KEYWORDS,
    typescript: JS_KEYWORDS,
    javascript: JS_KEYWORDS,
    rust: RUST_KEYWORDS,
    sql: SQL_KEYWORDS,
    go: GO_KEYWORDS,
    java: JAVA_KEYWORDS,
    c: C_KEYWORDS,
    'c++': CPP_KEYWORDS,
    cpp: CPP_KEYWORDS,
  };
  return map[lang?.toLowerCase()] || PYTHON_KEYWORDS;
}

export function highlightCode(code, language = 'python') {
  if (!code) return '';
  const keywords = getKeywords(language);
  const lines = code.split('\n');
  
  return lines.map(line => {
    let result = '';
    let i = 0;
    
    while (i < line.length) {
      // Comments
      const isPythonStyle = language === 'python';
      const isCStyle = ['c', 'c++', 'cpp', 'java', 'javascript', 'typescript', 'rust', 'go'].includes(language?.toLowerCase());
      
      if (isPythonStyle && line[i] === '#') {
        result += `<span class="code-comment">${escapeHtml(line.substring(i))}</span>`;
        break;
      }
      if (isCStyle && line.substring(i, i + 2) === '//') {
        result += `<span class="code-comment">${escapeHtml(line.substring(i))}</span>`;
        break;
      }
      // C/C++ preprocessor directives
      if (['c', 'c++', 'cpp'].includes(language?.toLowerCase()) && line[i] === '#') {
        result += `<span class="code-keyword">${escapeHtml(line.substring(i))}</span>`;
        break;
      }
      
      // Strings
      if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
        const quote = line[i];
        let end = i + 1;
        while (end < line.length && line[end] !== quote) {
          if (line[end] === '\\') end++;
          end++;
        }
        end = Math.min(end + 1, line.length);
        result += `<span class="code-string">${escapeHtml(line.substring(i, end))}</span>`;
        i = end;
        continue;
      }
      
      // Numbers
      if (/\d/.test(line[i]) && (i === 0 || /[\s(,=:[{+\-*/<>!]/.test(line[i-1]))) {
        let end = i;
        while (end < line.length && /[\d.eExXa-fA-F_]/.test(line[end])) end++;
        result += `<span class="code-number">${escapeHtml(line.substring(i, end))}</span>`;
        i = end;
        continue;
      }
      
      // Words (keywords, functions)
      if (/[a-zA-Z_]/.test(line[i])) {
        let end = i;
        while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++;
        const word = line.substring(i, end);
        
        if (keywords.includes(word)) {
          result += `<span class="code-keyword">${escapeHtml(word)}</span>`;
        } else if (end < line.length && line[end] === '(') {
          result += `<span class="code-function">${escapeHtml(word)}</span>`;
        } else if (word.match(/^[A-Z][a-zA-Z]*$/)) {
          result += `<span class="code-type">${escapeHtml(word)}</span>`;
        } else {
          result += escapeHtml(word);
        }
        i = end;
        continue;
      }
      
      // Decorators
      if (line[i] === '@' && language === 'python') {
        let end = i + 1;
        while (end < line.length && /[a-zA-Z0-9_.]/.test(line[end])) end++;
        result += `<span class="code-keyword">${escapeHtml(line.substring(i, end))}</span>`;
        i = end;
        continue;
      }
      
      result += escapeHtml(line[i]);
      i++;
    }
    
    return result;
  }).join('\n');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default highlightCode;
