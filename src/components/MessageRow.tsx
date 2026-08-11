import { memo, useEffect, useRef, useState } from 'react';
import { Check, Copy, Paperclip, PencilLine, RefreshCw, RotateCcw } from 'lucide-react';
import type { Message } from '../types';
import { InlineMarkdown, Markdown } from './Markdown';
import { SpeakerMark } from './BrandMark';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useCopy } from '../hooks/useCopy';
import { fileSize, stamp } from '../lib/format';
import { BRAND } from '../brand';

interface Props {
  message: Message;
  busy: boolean;
  onRegenerate: (id: string) => void;
  onEditSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
}

/**
 * An action on the message header.
 *
 * Revealed on hover *and* on focus-within, so the row stays quiet at rest
 * without putting the controls out of reach — they remain in the tab order at
 * all times and become visible the moment focus lands on them.
 */
function RowAction({
  icon: Icon,
  label,
  onClick,
  tone = 'muted',
  disabled,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  tone?: 'muted' | 'success';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`icon-btn ${tone === 'success' ? 'text-success' : ''}`}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      <span className="sr-only-text">{label}</span>
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
      id={`msg-${message.id}`}
      aria-busy={streaming || undefined}
      aria-label={isUser ? 'Your message' : `${BRAND.assistantLabel} response`}
      className={`group grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-b border-edge px-4 py-3 md:px-6 ${
        isUser ? 'bg-wash' : ''
      }`}
    >
      {/* Speaker mark — 20px, not a 132px rail and not a lettered circle. */}
      <div className="pt-1">
        <SpeakerMark role={message.role} className={isUser ? 'text-accent' : 'text-ink'} />
      </div>

      <div className="min-w-0">
        {/* Header line: who, when, which version, and this row's actions. */}
        <div className="flex min-h-7 items-center gap-2">
          <h3 className={`label ${isUser ? 'text-accent-text' : 'text-ink'}`}>
            {isUser ? BRAND.userLabel : BRAND.assistantLabel}
          </h3>
          <time dateTime={new Date(message.createdAt).toISOString()} className="meta text-muted">
            {stamp(message.createdAt)}
          </time>
          {(message.revision ?? 1) > 1 && (
            <span className="rounded-pill bg-raised px-1.5 py-px text-[11px] font-bold text-accent-text">
              v{message.revision}
            </span>
          )}
          {message.status === 'stopped' && (
            <span className="rounded-pill bg-hover px-2 py-px text-[11px] font-semibold text-muted">
              Stopped
            </span>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <RowAction
              icon={copied ? Check : Copy}
              tone={copied ? 'success' : 'muted'}
              label={copied ? 'Copied' : 'Copy message'}
              onClick={() => void copy(message.content)}
            />
            {isUser ? (
              <RowAction
                icon={PencilLine}
                label="Edit and resend"
                onClick={beginEdit}
                disabled={busy || editing}
              />
            ) : (
              <RowAction
                icon={RefreshCw}
                label="Regenerate response"
                onClick={() => onRegenerate(message.id)}
                disabled={busy || streaming}
              />
            )}
          </div>
        </div>

        {/* Body */}
        {editing ? (
          <div className="pb-1">
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
              className="w-full resize-none rounded-ctl border border-accent bg-raised px-3 py-2 text-[15px] leading-[1.55] text-ink outline-none"
              rows={2}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={commitEdit} className="btn btn-primary btn-sm">
                Resend
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn btn-quiet btn-sm"
              >
                Cancel
              </button>
              <span className="meta text-muted">
                ⌘↵ to resend · Esc to cancel · replies below are replaced
              </span>
            </div>
          </div>
        ) : isUser ? (
          <>
            <p className="whitespace-pre-wrap pb-0.5 text-[15px] font-medium leading-[1.55] text-ink">
              <InlineMarkdown text={message.content} />
            </p>
            {message.attachments?.length ? (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {message.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-1.5 rounded-pill border border-edge bg-raised px-2 py-0.5 meta text-muted"
                  >
                    <Paperclip aria-hidden="true" size={12} strokeWidth={2} />
                    <span className="text-ink">{att.name}</span>
                    <span>{fileSize(att.size)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="max-w-[82ch]">
            {streaming && !message.content ? (
              <ThinkingIndicator />
            ) : (
              <Markdown source={message.content} streaming={streaming} />
            )}

            {message.status === 'error' && (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-ctl border border-danger bg-raised px-3 py-2"
              >
                <span className="label text-danger">Connection error</span>
                <span className="min-w-0 flex-1 text-[13px] text-ink">{message.error}</span>
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  disabled={busy}
                  className="btn btn-quiet btn-sm"
                >
                  <RotateCcw aria-hidden="true" size={13} strokeWidth={2} />
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
