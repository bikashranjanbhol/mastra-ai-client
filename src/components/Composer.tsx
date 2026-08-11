import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { CornerDownLeft, Paperclip, Square, X } from 'lucide-react';
import type { Attachment } from '../types';
import { SpeakerMark } from './BrandMark';
import { estimateTokens } from '../lib/markdown';
import { fileSize } from '../lib/format';
import { uid } from '../lib/seed';
import { BRAND } from '../brand';

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
 * The composer is docked flush to the foot of the sheet — full bleed, separated
 * by a single rule. It repeats the transcript's rail so a draft reads as the
 * next message rather than as a control panel.
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
          <SpeakerMark role="user" className="text-accent" />
          <span className="label text-accent-text">Draft</span>
        </h2>
        <span
          className={`meta ${overBudget ? 'text-danger' : 'text-muted'}`}
        >
          {text.length} ch
        </span>
        <span
          className={`meta ${overBudget ? 'text-danger' : 'text-muted'}`}
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
          placeholder={
            busy ? `${BRAND.assistantLabel} is replying…` : 'Ask anything. Enter sends, Shift+Enter adds a line.'
          }
          aria-describedby="composer-hint"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent text-[1rem] leading-[1.6] text-ink outline-none placeholder:text-muted disabled:opacity-50"
        />

        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 rounded-pill border border-edge bg-raised px-2.5 py-1 meta text-muted"
              >
                <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} />
                <span className="text-ink">{att.name}</span>
                <span className="tabular-nums">{fileSize(att.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="rounded-pill p-0.5 transition-colors hover:bg-hover hover:text-danger"
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
              className="btn btn-quiet cursor-pointer"
            >
              <Paperclip aria-hidden="true" size={13} strokeWidth={2} />
              Attach
            </label>
            <p id="composer-hint" className="meta text-muted">
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
              className="btn btn-quiet"
            >
              <Square aria-hidden="true" size={11} strokeWidth={2} className="fill-current text-danger" />
              Stop
              <kbd className="ml-0.5 meta font-normal text-muted">Esc</kbd>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="btn btn-primary"
            >
              Send
              <CornerDownLeft aria-hidden="true" size={13} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
