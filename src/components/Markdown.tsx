import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { parseBlocks, parseInline, type Block, type Inline } from '../lib/markdown';
import { CodeBlock } from './CodeBlock';

const HEADING_SIZE: Record<number, string> = {
  1: 'text-[1.5rem] leading-tight',
  2: 'text-[1.28rem] leading-snug',
  3: 'text-[1.1rem] leading-snug',
  4: 'text-[1rem]',
  5: 'text-[0.95rem]',
  6: 'text-[0.9rem]',
};

function renderInline(nodes: Inline[], keyPrefix = ''): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>;
      case 'break':
        return <br key={key} />;
      case 'code':
        return (
          <code
            key={key}
            className="rounded-ctl border border-edge bg-raised px-[0.35em] py-[0.08em] font-mono text-[0.84em] text-ink"
          >
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderInline(node.children, `${key}.`)}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic">
            {renderInline(node.children, `${key}.`)}
          </em>
        );
      case 'del':
        return (
          <del key={key} className="text-muted decoration-accent/70">
            {renderInline(node.children, `${key}.`)}
          </del>
        );
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            title={node.title}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink underline decoration-accent decoration-1 underline-offset-[3px] transition-colors hover:bg-wash hover:text-accent"
          >
            {renderInline(node.children, `${key}.`)}
          </a>
        );
      default:
        return null;
    }
  });
}

const Inlines = ({ text }: { text: string }) => <>{renderInline(parseInline(text))}</>;

/**
 * Inline-only rendering, used for what the reader wrote themselves. Their own
 * words keep their line breaks and stay in one voice — code spans and emphasis
 * are honoured, headings and tables are not.
 */
export const InlineMarkdown = memo(function InlineMarkdown({ text }: { text: string }) {
  return <Inlines text={text} />;
});

function renderBlock(block: Block, key: string, trailingCaret: boolean): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${Math.min(block.level + 1, 6)}` as unknown) as 'h2';
      return (
        <Tag
          key={key}
          className={`mt-7 mb-2 font-display font-semibold text-ink first:mt-0 ${
            HEADING_SIZE[block.level] ?? HEADING_SIZE[3]
          }`}
        >
          <Inlines text={block.text} />
          {trailingCaret && <span className="caret" />}
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p key={key} className="my-3 first:mt-0 last:mb-0">
          <Inlines text={block.text} />
          {trailingCaret && <span className="caret" />}
        </p>
      );

    case 'code':
      return <CodeBlock key={key} code={block.code} lang={block.lang} open={block.open} />;

    case 'hr':
      return <hr key={key} className="my-7 border-0 border-t border-edge" />;

    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-5 border-l-2 border-accent bg-wash py-2 pl-4 pr-3 text-muted italic"
        >
          {block.blocks.map((b, i) => renderBlock(b, `${key}.${i}`, false))}
        </blockquote>
      );

    case 'list': {
      const items = block.items.map((item, i) => (
        <li key={`${key}.${i}`} className="pl-2 marker:font-mono marker:text-accent">
          {item.blocks.map((b, j) => renderBlock(b, `${key}.${i}.${j}`, false))}
        </li>
      ));
      return block.ordered ? (
        <ol
          key={key}
          start={block.start}
          className="my-3 ml-5 list-outside list-decimal space-y-1.5 marker:text-[0.85em] marker:tabular-nums"
        >
          {items}
        </ol>
      ) : (
        <ul
          key={key}
          className="my-3 ml-5 list-outside list-[square] space-y-1.5 marker:text-[0.8em]"
        >
          {items}
        </ul>
      );
    }

    case 'table':
      return (
        <div key={key} className="my-6 overflow-x-auto border border-edge">
          <table className="w-full border-collapse text-[0.92em]">
            <thead>
              <tr className="border-b-2 border-edge-strong bg-raised">
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted"
                    style={{ textAlign: block.align[i] ?? 'left' }}
                  >
                    <Inlines text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-edge last:border-b-0">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2 align-top ${
                        block.align[j] === 'right' ? 'font-mono text-[0.92em] tabular-nums' : ''
                      }`}
                      style={{ textAlign: block.align[j] ?? 'left' }}
                    >
                      <Inlines text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

interface Props {
  source: string;
  /** Draws the rubric caret at the end of the last block while streaming. */
  streaming?: boolean;
}

export const Markdown = memo(function Markdown({ source, streaming }: Props) {
  const blocks = useMemo(() => parseBlocks(source), [source]);

  if (!blocks.length) {
    return streaming ? <span className="caret" /> : null;
  }

  const last = blocks.length - 1;
  const lastBlock = blocks[last];
  const caretInline = Boolean(
    streaming && (lastBlock.type === 'paragraph' || lastBlock.type === 'heading'),
  );
  const caretStandalone = streaming && !caretInline && lastBlock.type !== 'code';

  return (
    <div className="text-[1.0625rem] leading-[1.62] text-ink">
      {blocks.map((block, i) => renderBlock(block, `b${i}`, caretInline && i === last))}
      {caretStandalone && <span className="caret" />}
    </div>
  );
});
