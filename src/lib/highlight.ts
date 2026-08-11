/**
 * A compact tokenizer-based highlighter.
 *
 * Six token classes, five colour roles — deliberately fewer than a full
 * TextMate grammar. Comments, literals and keywords are what a reader actually
 * scans for; painting every identifier a different colour adds noise, and the
 * three code colours here are checked for contrast in both themes.
 */

export type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'func'
  | 'punct';

export interface Token {
  type: TokenType;
  value: string;
}

interface Rule {
  type: TokenType;
  re: RegExp;
}

const words = (list: string) => new RegExp(`(?:${list.trim().split(/\s+/).join('|')})\\b`, 'y');

const COMMON = {
  lineComment: (prefix: string): Rule => ({
    type: 'comment',
    re: new RegExp(`${prefix}[^\\n]*`, 'y'),
  }),
  blockComment: { type: 'comment', re: /\/\*[\s\S]*?(?:\*\/|$)/y } as Rule,
  dquote: { type: 'string', re: /"(?:\\.|[^"\\\n])*"?/y } as Rule,
  squote: { type: 'string', re: /'(?:\\.|[^'\\\n])*'?/y } as Rule,
  backtick: { type: 'string', re: /`(?:\\.|[^`\\])*`?/y } as Rule,
  number: { type: 'number', re: /0[xXbBoO][0-9a-fA-F_]+n?|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?n?/y } as Rule,
  call: { type: 'func', re: /[A-Za-z_$][\w$]*(?=\s*\()/y } as Rule,
  capitalized: { type: 'type', re: /[A-Z][A-Za-z0-9_]*/y } as Rule,
  punct: { type: 'punct', re: /[{}[\]()<>;,.:?!&|+\-*/%=^~@#]+/y } as Rule,
};

const JS_KEYWORDS =
  'abstract async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in instanceof interface let new of private protected public readonly return satisfies set static super switch this throw try type typeof var void while with yield as keyof infer namespace';
const JS_LITERALS = 'true false null undefined NaN Infinity';

const PY_KEYWORDS =
  'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case';
const PY_LITERALS = 'True False None self cls';

const SQL_KEYWORDS =
  'SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET JOIN LEFT RIGHT INNER OUTER FULL CROSS ON AS WITH UNION ALL INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE VIEW INDEX DROP ALTER ADD PRIMARY KEY FOREIGN REFERENCES NOT NULL DISTINCT CASE WHEN THEN ELSE END AND OR IN EXISTS BETWEEN LIKE ILIKE IS ASC DESC OVER PARTITION RANGE ROWS PRECEDING FOLLOWING CURRENT ROW COALESCE CAST INTERVAL RETURNING ON CONFLICT DO NOTHING';

const SH_KEYWORDS =
  'if then else elif fi for while until do done case esac function in return break continue local export source alias set unset trap read echo printf cd exit';

const RS_KEYWORDS =
  'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while';

const GO_KEYWORDS =
  'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var';

const LANGS: Record<string, Rule[]> = {
  js: [
    COMMON.blockComment,
    COMMON.lineComment('//'),
    COMMON.dquote,
    COMMON.squote,
    COMMON.backtick,
    { type: 'number', re: words(JS_LITERALS) },
    { type: 'keyword', re: words(JS_KEYWORDS) },
    COMMON.number,
    COMMON.call,
    COMMON.capitalized,
    COMMON.punct,
  ],
  python: [
    { type: 'string', re: /(?:[rRbBfFuU]{0,2})("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))/y },
    COMMON.lineComment('#'),
    { type: 'string', re: /[rRbBfFuU]{0,2}"(?:\\.|[^"\\\n])*"?/y },
    { type: 'string', re: /[rRbBfFuU]{0,2}'(?:\\.|[^'\\\n])*'?/y },
    { type: 'number', re: words(PY_LITERALS) },
    { type: 'keyword', re: words(PY_KEYWORDS) },
    { type: 'func', re: /@[A-Za-z_][\w.]*/y },
    COMMON.number,
    COMMON.call,
    COMMON.capitalized,
    COMMON.punct,
  ],
  json: [
    { type: 'keyword', re: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
    COMMON.dquote,
    { type: 'number', re: /(?:true|false|null)\b/y },
    COMMON.number,
    COMMON.punct,
  ],
  sql: [
    COMMON.lineComment('--'),
    COMMON.blockComment,
    COMMON.squote,
    { type: 'type', re: /"(?:[^"\n])*"/y },
    { type: 'keyword', re: new RegExp(`(?:${SQL_KEYWORDS.split(/\s+/).join('|')})\\b`, 'iy') },
    COMMON.number,
    COMMON.call,
    COMMON.punct,
  ],
  bash: [
    COMMON.lineComment('#'),
    COMMON.dquote,
    COMMON.squote,
    { type: 'type', re: /\$\{?[A-Za-z_][\w]*\}?|\$[@?#*!$]/y },
    { type: 'keyword', re: words(SH_KEYWORDS) },
    { type: 'func', re: /(?:^|(?<=[|;&]\s))\s*[a-z][\w.-]*/y },
    COMMON.number,
    COMMON.punct,
  ],
  css: [
    COMMON.blockComment,
    { type: 'keyword', re: /@[a-z-]+/y },
    COMMON.dquote,
    COMMON.squote,
    { type: 'type', re: /[.#][A-Za-z_-][\w-]*|:{1,2}[a-z-]+/y },
    { type: 'func', re: /--[A-Za-z][\w-]*/y },
    { type: 'number', re: /-?\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg|fr|ch)?|#[0-9a-fA-F]{3,8}/y },
    COMMON.call,
    COMMON.punct,
  ],
  html: [
    { type: 'comment', re: /<!--[\s\S]*?(?:-->|$)/y },
    { type: 'keyword', re: /<\/?[A-Za-z][\w-]*|\/?>/y },
    COMMON.dquote,
    COMMON.squote,
    { type: 'type', re: /[A-Za-z-]+(?==)/y },
    COMMON.punct,
  ],
  rust: [
    COMMON.blockComment,
    COMMON.lineComment('//'),
    COMMON.dquote,
    { type: 'string', re: /'(?:\\.|[^'\\])'/y },
    { type: 'keyword', re: words(RS_KEYWORDS) },
    { type: 'number', re: words('true false None Some Ok Err') },
    { type: 'func', re: /[a-z_][\w]*!/y },
    COMMON.number,
    COMMON.call,
    COMMON.capitalized,
    COMMON.punct,
  ],
  go: [
    COMMON.blockComment,
    COMMON.lineComment('//'),
    COMMON.dquote,
    COMMON.backtick,
    { type: 'keyword', re: words(GO_KEYWORDS) },
    { type: 'number', re: words('true false nil iota err') },
    COMMON.number,
    COMMON.call,
    COMMON.capitalized,
    COMMON.punct,
  ],
  plain: [],
};

const ALIASES: Record<string, string> = {
  javascript: 'js',
  jsx: 'js',
  ts: 'js',
  tsx: 'js',
  typescript: 'js',
  mjs: 'js',
  cjs: 'js',
  py: 'python',
  python3: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  postgres: 'sql',
  psql: 'sql',
  postgresql: 'sql',
  scss: 'css',
  less: 'css',
  xml: 'html',
  svg: 'html',
  vue: 'html',
  rs: 'rust',
  golang: 'go',
  json5: 'json',
  jsonc: 'json',
};

/** Human label shown on the code block's header rule. */
export const languageLabel = (lang: string): string => {
  const known: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript · TSX',
    js: 'JavaScript',
    jsx: 'JavaScript · JSX',
    py: 'Python',
    python: 'Python',
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    sql: 'SQL',
    json: 'JSON',
    css: 'CSS',
    html: 'HTML',
    rust: 'Rust',
    rs: 'Rust',
    go: 'Go',
    yaml: 'YAML',
    yml: 'YAML',
    md: 'Markdown',
    diff: 'Diff',
  };
  if (!lang) return 'plain text';
  return known[lang.toLowerCase()] ?? lang;
};

export function tokenize(code: string, lang: string): Token[] {
  const key = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
  const rules = LANGS[key];
  if (!rules || !rules.length) return [{ type: 'plain', value: code }];

  const tokens: Token[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      tokens.push({ type: 'plain', value: plain });
      plain = '';
    }
  };

  while (i < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        flush();
        tokens.push({ type: rule.type, value: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += code[i];
      i += 1;
    }
  }
  flush();
  return tokens;
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: 'text-ink',
  comment: 'text-muted italic',
  string: 'text-code-string',
  number: 'text-code-number',
  keyword: 'text-code-keyword font-bold',
  type: 'text-ink font-bold',
  func: 'text-ink underline decoration-edge-strong decoration-1 underline-offset-2',
  punct: 'text-muted',
};
