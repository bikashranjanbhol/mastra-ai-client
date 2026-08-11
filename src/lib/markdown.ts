/**
 * A small, streaming-tolerant markdown parser.
 *
 * "Streaming-tolerant" is the reason this is hand-rolled rather than pulled from
 * npm: while a response is being written, the text is almost always
 * syntactically broken — an unclosed fence, a table with one row so far, a bold
 * run with only its opening asterisks. Everything below degrades to plain text
 * instead of throwing away the partial block, and an unterminated fence is
 * reported as `open` so the renderer can keep showing the code as it arrives.
 */

export type Align = 'left' | 'center' | 'right';

export interface ListItem {
  blocks: Block[];
}

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; lang: string; code: string; open: boolean }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'quote'; blocks: Block[] }
  | { type: 'hr' }
  | { type: 'table'; header: string[]; align: Align[]; rows: string[][] };

const RE_FENCE = /^ {0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const RE_HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*$/;
const RE_QUOTE = /^ {0,3}> ?(.*)$/;
const RE_BULLET = /^([ \t]*)([-*+])[ \t]+(.*)$/;
const RE_ORDERED = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/;
const RE_TABLE_DIVIDER = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;

const indentOf = (line: string): number => {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 4;
    else break;
  }
  return n;
};

const isBlank = (line: string): boolean => line.trim() === '';

/** Splits a table row on unescaped pipes, dropping the leading/trailing ones. */
const splitRow = (line: string): string[] => {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((c) => c.trim());
};

const alignOf = (spec: string): Align => {
  const s = spec.trim();
  if (s.startsWith(':') && s.endsWith(':')) return 'center';
  if (s.endsWith(':')) return 'right';
  return 'left';
};

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    // Fenced code — the one block that swallows everything until its closer.
    const fence = RE_FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const width = fence[1].length;
      const lang = fence[2] || '';
      const body: string[] = [];
      i += 1;
      let closed = false;
      while (i < lines.length) {
        const candidate = RE_FENCE.exec(lines[i]);
        if (candidate && candidate[1][0] === marker && candidate[1].length >= width) {
          closed = true;
          i += 1;
          break;
        }
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', lang, code: body.join('\n'), open: !closed });
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = RE_HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length) {
        const m = RE_QUOTE.exec(lines[i]);
        if (m) {
          inner.push(m[1]);
          i += 1;
        } else if (!isBlank(lines[i]) && inner.length) {
          inner.push(lines[i]); // lazy continuation
          i += 1;
        } else {
          break;
        }
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(inner.join('\n')) });
      continue;
    }

    // Table: a header row followed by a divider row. During streaming the
    // divider may not have arrived yet, in which case this falls to paragraph.
    if (line.includes('|') && i + 1 < lines.length && RE_TABLE_DIVIDER.test(lines[i + 1])) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        const cells = splitRow(lines[i]);
        while (cells.length < header.length) cells.push('');
        rows.push(cells.slice(0, header.length));
        i += 1;
      }
      while (align.length < header.length) align.push('left');
      blocks.push({ type: 'table', header, align, rows: rows });
      continue;
    }

    const bullet = RE_BULLET.exec(line);
    const ordered = RE_ORDERED.exec(line);
    if (bullet || ordered) {
      const listIndent = indentOf(line);
      const isOrdered = Boolean(ordered);
      const start = ordered ? Number(ordered[2]) : 1;
      const items: ListItem[] = [];
      let buffer: string[] = [];

      const flush = () => {
        if (buffer.length) items.push({ blocks: parseBlocks(buffer.join('\n')) });
        buffer = [];
      };

      while (i < lines.length) {
        const cur = lines[i];
        if (isBlank(cur)) {
          // A blank line only ends the list if the next line is not a
          // continuation of it.
          const next = lines[i + 1];
          if (next === undefined) break;
          const nextIsItem =
            indentOf(next) === listIndent &&
            Boolean(isOrdered ? RE_ORDERED.exec(next) : RE_BULLET.exec(next));
          if (!nextIsItem && indentOf(next) <= listIndent) break;
          buffer.push('');
          i += 1;
          continue;
        }

        const curIndent = indentOf(cur);
        const curBullet = RE_BULLET.exec(cur);
        const curOrdered = RE_ORDERED.exec(cur);
        const marker = isOrdered ? curOrdered : curBullet;

        if (marker && curIndent === listIndent) {
          flush();
          buffer.push(marker[3]);
          i += 1;
          continue;
        }

        if (curIndent > listIndent) {
          // Nested content: dedent by one level and let recursion handle it.
          buffer.push(cur.slice(Math.min(curIndent, listIndent + 2)));
          i += 1;
          continue;
        }

        // A different marker style at the same indent starts a new list.
        break;
      }
      flush();
      blocks.push({ type: 'list', ordered: isOrdered, start, items });
      continue;
    }

    // Paragraph: run until a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i])) {
      const l = lines[i];
      if (
        para.length &&
        (RE_FENCE.test(l) ||
          RE_HEADING.test(l) ||
          RE_HR.test(l) ||
          RE_QUOTE.test(l) ||
          RE_BULLET.test(l) ||
          RE_ORDERED.test(l))
      ) {
        break;
      }
      para.push(l.trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }

  return blocks;
}

/* ------------------------------------------------------------------ inline */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'break' }
  | { type: 'link'; href: string; title?: string; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'del'; children: Inline[] };

interface Rule {
  re: RegExp;
  build: (m: RegExpExecArray) => Inline;
}

const RULES: Rule[] = [
  {
    re: /(`+)([^`]|[\s\S]*?[^`])\1(?!`)/,
    build: (m) => ({ type: 'code', value: m[2].replace(/^ (.*) $/, '$1') }),
  },
  {
    re: /!?\[([^\]]*)\]\(\s*<?([^\s)<>]*)>?(?:\s+"([^"]*)")?\s*\)/,
    build: (m) => ({
      type: 'link',
      href: m[2],
      title: m[3],
      children: parseInline(m[1] || m[2]),
    }),
  },
  {
    re: /<((?:https?|mailto):[^\s>]+)>/,
    build: (m) => ({ type: 'link', href: m[1], children: [{ type: 'text', value: m[1] }] }),
  },
  {
    re: /(\*\*|__)(?=\S)([\s\S]*?\S)\1/,
    build: (m) => ({ type: 'strong', children: parseInline(m[2]) }),
  },
  {
    re: /~~(?=\S)([\s\S]*?\S)~~/,
    build: (m) => ({ type: 'del', children: parseInline(m[1]) }),
  },
  {
    re: /(?<![\w*])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?![\w*])/,
    build: (m) => ({ type: 'em', children: parseInline(m[1]) }),
  },
  {
    re: /(?<![\w_])_(?=[^\s_])([\s\S]*?[^\s_])_(?![\w_])/,
    build: (m) => ({ type: 'em', children: parseInline(m[1]) }),
  },
  {
    re: /(?<=\S)\n/,
    build: () => ({ type: 'break' }),
  },
];

/** Unescapes backslash-escaped punctuation once no rule can claim the text. */
const unescape = (s: string): string => s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;

  while (rest.length) {
    let best: { index: number; match: RegExpExecArray; rule: Rule } | null = null;

    for (const rule of RULES) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, match: m, rule };
      }
    }

    if (!best) {
      out.push({ type: 'text', value: unescape(rest) });
      break;
    }

    if (best.index > 0) {
      out.push({ type: 'text', value: unescape(rest.slice(0, best.index)) });
    }
    out.push(best.rule.build(best.match));
    rest = rest.slice(best.index + best.match[0].length);
  }

  return out;
}

/** Rough token estimate — good enough for a counter, honest about being an estimate. */
export const estimateTokens = (text: string): number =>
  text.trim() ? Math.ceil(text.trim().length / 3.8) : 0;
