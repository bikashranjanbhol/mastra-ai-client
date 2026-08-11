import { memo, useEffect, useRef, useState } from 'react';
import { Check, Copy, Paperclip, PencilLine, RefreshCw, RotateCcw } from 'lucide-react';
import type { Message } from '../types';
import { InlineMarkdown, Markdown } from './Markdown';
import { Sigil } from './Sigil';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useCopy } from '../hooks/useCopy';
import { fileSize, stamp } from '../lib/format';

interface Props {
  message: Message;
  busy: boolean;
  onRegenerate: (id: string) => void;
  onEditSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
}

/** A rail control: monospace, always visible, never a hover-only affordance. */
function RailAction({
  icon: Icon,
  label,
  onClick,
  tone = 'muted',
  disabled,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  tone?: 'muted' | 'accent' | 'success';
  disabled?: boolean;
}) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-success' : 'text-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-1.5 rounded-ctl px-1 py-0.5 font-mono text-[11px] tracking-[0.08em] ${toneClass} transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-35`}
    >
      <Icon aria-hidden="true" size={12} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

export const MessageRow = memo(function MessageRow({
  message,
  busy,
  onRegenerate,
  onEditSubmit,
  onRetry,
}: Props) {
  const isUser = message.role === 'user';
  const streaming = message.status === 'streaming';
  const { copied, copy } = useCopy();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  const beginEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const commitEdit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== message.content) onEditSubmit(message.id, next);
  };

  return (
    <article
      aria-busy={streaming || undefined}
      aria-label={isUser ? 'Your message' : 'Marginalia response'}
      className="grid grid-cols-1 gap-2 border-t border-edge px-5 py-6 min-[900px]:grid-cols-[8.25rem_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:px-8"
    >
      {/* ------------------------------------------------------- margin rail */}
      <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 min-[900px]:sticky min-[900px]:top-4 min-[900px]:h-fit min-[900px]:flex-col min-[900px]:items-start min-[900px]:gap-1.5">
        <h3 className="flex items-center gap-2">
          <Sigil role={message.role} className={isUser ? 'text-accent' : 'text-ink'} />
          <span
            className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
              isUser ? 'text-accent' : 'text-ink'
            }`}
          >
            {isUser ? 'You' : 'Marginalia'}
          </span>
        </h3>

        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="font-mono text-[11px] tabular-nums text-muted"
        >
          {stamp(message.createdAt)}
        </time>

        {(message.revision ?? 1) > 1 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted">
            rev {message.revision}
          </span>
        )}

        <div className="flex flex-row gap-2 min-[900px]:mt-2 min-[900px]:w-full min-[900px]:flex-col min-[900px]:gap-0.5">
          <RailAction
            icon={copied ? Check : Copy}
            tone={copied ? 'success' : 'muted'}
            label={copied ? 'copied' : 'copy'}
            onClick={() => void copy(message.content)}
          />
          {isUser ? (
            <RailAction
              icon={PencilLine}
              label="edit"
              onClick={beginEdit}
              disabled={busy || editing}
            />
          ) : (
            <RailAction
              icon={RefreshCw}
              label="redo"
              onClick={() => onRegenerate(message.id)}
              disabled={busy || streaming}
            />
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------- body */}
      <div className="min-w-0">
        {editing ? (
          <div className="border-l-2 border-accent pl-4">
            <label className="sr-only-text" htmlFor={`edit-${message.id}`}>
              Edit your message and resend
            </label>
            <textarea
              id={`edit-${message.id}`}
              ref={editRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(false);
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              className="w-full resize-none bg-transparent font-display text-[1.0625rem] italic leading-[1.6] text-ink outline-none"
              rows={2}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={commitEdit}
                className="rounded-ctl border border-accent bg-accent px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-raised transition-opacity hover:opacity-90"
              >
                Resend
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-ctl px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                Cancel
              </button>
              <span className="font-mono text-[11px] text-muted">
                ⌘↵ resend · esc cancel · replies below are replaced
              </span>
            </div>
          </div>
        ) : isUser ? (
          <div className="border-l-2 border-accent pl-4">
            <p className="whitespace-pre-wrap font-display text-[1.0625rem] italic leading-[1.6] text-ink">
              <InlineMarkdown text={message.content} />
            </p>
            {message.attachments?.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {message.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-2 rounded-ctl border border-edge bg-raised px-2 py-1 font-mono text-[11px] text-muted"
                  >
                    <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} />
                    <span className="text-ink">{att.name}</span>
                    <span className="tabular-nums">{fileSize(att.size)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="max-w-[68ch]">
            {streaming && !message.content ? (
              <ThinkingIndicator />
            ) : (
              <Markdown source={message.content} streaming={streaming} />
            )}

            {message.status === 'stopped' && (
              <p className="mt-4 border-l-2 border-edge-strong pl-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                stopped by you
              </p>
            )}

            {message.status === 'error' && (
              <div
                role="alert"
                className="mt-4 border border-danger bg-raised px-4 py-3 text-[0.95rem]"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
                  transport error
                </p>
                <p className="mt-1.5 text-ink">{message.error}</p>
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  disabled={busy}
                  className="mt-3 flex items-center gap-1.5 rounded-ctl border border-edge px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-hover disabled:opacity-40"
                >
                  <RotateCcw aria-hidden="true" size={12} strokeWidth={1.75} />
                  Retry this turn
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
