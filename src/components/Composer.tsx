import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { CornerDownLeft, Paperclip, Square, X } from 'lucide-react';
import type { Attachment } from '../types';
import { Sigil } from './Sigil';
import { estimateTokens } from '../lib/markdown';
import { fileSize } from '../lib/format';
import { uid } from '../lib/seed';

const TOKEN_BUDGET = 8000;
const MAX_HEIGHT = 320;

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
 * The composer is docked flush to the foot of the sheet — full bleed, square,
 * separated by a single rule. It repeats the transcript's rail so a draft reads
 * as the next entry rather than as a control panel.
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
      className="grid shrink-0 grid-cols-1 gap-2 border-t border-edge-strong bg-surface px-5 py-4 min-[900px]:grid-cols-[8.25rem_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:px-8"
    >
      <div className="flex flex-row items-center gap-3 min-[900px]:flex-col min-[900px]:items-start min-[900px]:gap-1.5 min-[900px]:pt-1">
        <h2 className="flex items-center gap-2">
          <Sigil role="user" className="text-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            Draft
          </span>
        </h2>
        <span
          className={`font-mono text-[11px] tabular-nums ${overBudget ? 'text-danger' : 'text-muted'}`}
        >
          {text.length} ch
        </span>
        <span
          className={`font-mono text-[11px] tabular-nums ${overBudget ? 'text-danger' : 'text-muted'}`}
        >
          ~{tokens} / {TOKEN_BUDGET.toLocaleString()} tok
        </span>
      </div>

      <div className="min-w-0 border-l-2 border-accent pl-4">
        <label htmlFor="composer" className="sr-only-text">
          Write a message
        </label>
        <textarea
          id="composer"
          ref={areaRef}
          value={text}
          disabled={busy}
          rows={1}
          placeholder={busy ? 'Marginalia is writing…' : 'Write your entry. Enter sends, Shift+Enter breaks the line.'}
          aria-describedby="composer-hint"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent font-display text-[1.0625rem] italic leading-[1.6] text-ink outline-none placeholder:not-italic placeholder:text-muted disabled:opacity-50"
        />

        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 rounded-ctl border border-edge bg-surface px-2 py-1 font-mono text-[11px] text-muted"
              >
                <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} />
                <span className="text-ink">{att.name}</span>
                <span className="tabular-nums">{fileSize(att.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="rounded-ctl p-0.5 transition-colors hover:bg-hover hover:text-danger"
                >
                  <X aria-hidden="true" size={12} strokeWidth={2} />
                  <span className="sr-only-text">Remove {att.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-ctl border border-edge px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} />
              Attach
            </label>
            <p id="composer-hint" className="font-mono text-[11px] text-muted">
              {overBudget ? (
                <span className="text-danger">Over budget — trim before sending.</span>
              ) : (
                'Enter to send · Shift+Enter for a new line'
              )}
            </p>
          </div>

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-2 rounded-ctl border border-edge-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-hover"
            >
              <Square aria-hidden="true" size={11} strokeWidth={2} className="fill-current text-danger" />
              Stop
              <kbd className="ml-1 font-mono text-[10px] text-muted">esc</kbd>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="flex items-center gap-2 rounded-ctl border border-accent bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-raised transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-muted disabled:opacity-60"
            >
              Send
              <CornerDownLeft aria-hidden="true" size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
