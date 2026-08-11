import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { CornerDownLeft, Paperclip, Square, X } from 'lucide-react';
import type { Attachment } from '../types';
import { estimateTokens } from '../lib/markdown';
import { fileSize } from '../lib/format';
import { uid } from '../lib/seed';
import { BRAND } from '../brand';

const TOKEN_BUDGET = 8000;
const MAX_HEIGHT = 220;

export interface ComposerHandle {
  focus: () => void;
}

interface Props {
  busy: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  handleRef?: RefObject<ComposerHandle | null>;
}

const kindOf = (name: string): Attachment['kind'] => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'json', 'xlsx', 'parquet'].includes(ext)) return 'data';
  if (['txt', 'md', 'rtf', 'tex'].includes(ext)) return 'text';
  return 'other';
};

/**
 * Docked to the foot of the transcript, full width, with the controls on one
 * line under the input. No side rail — the space it used to occupy is the
 * transcript's now.
 */
export function Composer({ busy, onSend, onStop, handleRef }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(handleRef, () => ({ focus: () => areaRef.current?.focus() }), []);

  // Autogrow: reset to auto first so the box can shrink as well as grow.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  useEffect(() => {
    if (!busy) areaRef.current?.focus();
  }, [busy]);

  const tokens = estimateTokens(text);
  const overBudget = tokens > TOKEN_BUDGET;
  const canSend = text.trim().length > 0 && !busy && !overBudget;

  const submit = () => {
    if (!canSend) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
  };

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setAttachments((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({
        id: uid('att'),
        name: file.name,
        size: file.size,
        kind: kindOf(file.name),
      })),
    ]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="shrink-0 border-t border-edge bg-surface px-4 py-3 md:px-6"
    >
      <div className="rounded-card border border-edge bg-raised focus-within:border-accent">
        <label htmlFor="composer" className="sr-only-text">
          Write a message
        </label>
        <textarea
          id="composer"
          ref={areaRef}
          value={text}
          disabled={busy}
          rows={1}
          placeholder={
            busy
              ? `${BRAND.assistantLabel} is replying…`
              : 'Ask anything. Enter sends, Shift+Enter adds a line.'
          }
          aria-describedby="composer-hint"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent px-3 pt-2.5 text-[15px] leading-[1.55] text-ink outline-none placeholder:text-muted disabled:opacity-50"
        />

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-1.5 rounded-pill border border-edge bg-surface px-2 py-0.5 meta text-muted"
              >
                <Paperclip aria-hidden="true" size={12} strokeWidth={2} />
                <span className="text-ink">{att.name}</span>
                <span>{fileSize(att.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="rounded-pill p-0.5 transition-colors hover:bg-hover hover:text-danger"
                >
                  <X aria-hidden="true" size={12} strokeWidth={2.5} />
                  <span className="sr-only-text">Remove {att.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 px-2 pb-2 pt-1.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only-text"
            id="composer-files"
            onChange={(e) => onFiles(e.target.files)}
          />
          <label
            htmlFor="composer-files"
            tabIndex={0}
            title="Attach files"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            className="icon-btn cursor-pointer"
          >
            <Paperclip aria-hidden="true" size={15} strokeWidth={2} />
            <span className="sr-only-text">Attach files</span>
          </label>

          <p id="composer-hint" className="meta text-muted">
            {overBudget ? (
              <span className="text-danger">Over the context budget — trim before sending.</span>
            ) : (
              'Enter to send · Shift+Enter for a new line'
            )}
          </p>

          <div className="flex-1" />

          <span className={`meta ${overBudget ? 'text-danger' : 'text-muted'}`}>
            {text.length ? `${text.length} ch · ` : ''}~{tokens.toLocaleString()} /{' '}
            {TOKEN_BUDGET.toLocaleString()} tok
          </span>

          {busy ? (
            <button type="button" onClick={onStop} className="btn btn-quiet btn-sm">
              <Square
                aria-hidden="true"
                size={10}
                strokeWidth={2}
                className="fill-current text-danger"
              />
              Stop
              <kbd className="meta font-normal text-muted">Esc</kbd>
            </button>
          ) : (
            <button type="submit" disabled={!canSend} className="btn btn-primary btn-sm">
              Send
              <CornerDownLeft aria-hidden="true" size={13} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
