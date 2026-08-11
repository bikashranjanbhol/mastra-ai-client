import { memo, useMemo } from 'react';
import { Check, Copy } from 'lucide-react';
import { TOKEN_CLASS, languageLabel, tokenize, type Token } from '../lib/highlight';
import { useCopy } from '../hooks/useCopy';

interface Props {
  code: string;
  lang: string;
  /** True while the closing fence has not arrived yet. */
  open?: boolean;
}

/**
 * A code listing, set like one in a printed manual: ruled header, numbered
 * lines, no rounded corners, no shadow.
 */
export const CodeBlock = memo(function CodeBlock({ code, lang, open }: Props) {
  const { copied, copy } = useCopy();

  // Tokenized as one unit and only then split into lines: block comments and
  // triple-quoted strings span lines, and per-line tokenizing would break them.
  const highlighted = useMemo(() => {
    const body = code.replace(/\n$/, '');
    const lines: Token[][] = [[]];
    for (const token of tokenize(body, lang)) {
      const parts = token.value.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push({ type: token.type, value: part });
      });
    }
    return lines;
  }, [code, lang]);

  const gutterWidth = `${String(highlighted.length).length + 1}ch`;

  return (
    <figure className="my-6 border border-edge bg-raised">
      <figcaption className="flex items-center justify-between gap-4 border-b border-edge px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {languageLabel(lang)}
          {open && <span className="ml-2 text-accent">· writing</span>}
        </span>
        <button
          type="button"
          onClick={() => void copy(code)}
          className="flex items-center gap-1.5 rounded-ctl px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          {copied ? (
            <Check aria-hidden="true" size={13} strokeWidth={2} className="text-success" />
          ) : (
            <Copy aria-hidden="true" size={13} strokeWidth={1.75} />
          )}
          {copied ? 'copied' : 'copy'}
          <span className="sr-only-text">
            {copied ? 'Code copied to clipboard' : `Copy ${languageLabel(lang)} code block`}
          </span>
        </button>
      </figcaption>

      <div className="overflow-x-auto">
        <pre className="min-w-full py-3 font-mono text-[13px] leading-[1.65]">
          <code>
            {highlighted.map((tokens, i) => (
              <span key={i} className="flex px-3">
                <span
                  aria-hidden="true"
                  className="shrink-0 select-none pr-4 text-right text-edge-strong tabular-nums"
                  style={{ width: gutterWidth }}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  {tokens.map((t, j) => (
                    <span key={j} className={TOKEN_CLASS[t.type]}>
                      {t.value}
                    </span>
                  ))}
                  {open && i === highlighted.length - 1 && <span className="caret" />}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
});
