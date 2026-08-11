import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { ArrowUp, Brain, Paperclip, Sparkles, Square, Telescope, X } from 'lucide-react';
import type { Attachment, ReplyMode } from '../types';
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
  onSend: (text: string, attachments: Attachment[], mode: ReplyMode) => void;
  onStop: () => void;
  /** Roomier in the welcome state, compact once the transcript has content. */
  variant?: 'hero' | 'docked';
  handleRef?: RefObject<ComposerHandle | null>;
}

const kindOf = (name: string): Attachment['kind'] => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'json', 'xlsx', 'parquet'].includes(ext)) return 'data';
  if (['txt', 'md', 'rtf', 'tex'].includes(ext)) return 'text';
  return 'other';
};

const TOOLS: Array<{ mode: Exclude<ReplyMode, 'standard'>; label: string; icon: typeof Brain }> = [
  { mode: 'reasoning', label: 'Reasoning', icon: Brain },
  { mode: 'research', label: 'Deep Research', icon: Telescope },
];

/**
 * The composer.
 *
 * Both tools are wired to the request rather than decorative: reasoning spends
 * longer before the first token and prepends its working, research appends the
 * sources it consulted. Exactly one can be active at a time, so the tray reads
 * as a mode switch rather than a set of independent flags.
 */
export function Composer({ busy, onSend, onStop, variant = 'docked', handleRef }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mode, setMode] = useState<ReplyMode>('standard');
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
    onSend(text, attachments, mode);
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

  const hero = variant === 'hero';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="relative isolate w-full"
    >
      {/* Decorative light spill behind the card. */}
      <div className="aurora" aria-hidden="true" />

      <div className="card overflow-hidden">
        <div className="flex items-start gap-2 px-4 pt-3.5">
          <Sparkles
            aria-hidden="true"
            size={17}
            strokeWidth={2}
            className="mt-[3px] shrink-0 text-accent"
          />
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
              busy ? `${BRAND.assistantLabel} is replying…` : 'Initiate a query or send a command…'
            }
            aria-describedby="composer-hint"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className={`w-full resize-none bg-transparent text-[15px] leading-[1.55] text-ink outline-none placeholder:text-muted disabled:opacity-50 ${
              hero ? 'min-h-20' : ''
            }`}
          />
        </div>

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-4 pt-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-1.5 rounded-pill border border-edge bg-surface px-2.5 py-1 meta text-muted"
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

        {/* Tool tray */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-3">
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
            className="chip cursor-pointer px-2.5"
          >
            <Paperclip aria-hidden="true" size={15} strokeWidth={2} />
            <span className="sr-only-text">Attach files</span>
          </label>

          {TOOLS.map((tool) => (
            <button
              key={tool.mode}
              type="button"
              aria-pressed={mode === tool.mode}
              disabled={busy}
              onClick={() => setMode((m) => (m === tool.mode ? 'standard' : tool.mode))}
              className="chip"
            >
              <tool.icon aria-hidden="true" size={15} strokeWidth={2} />
              {tool.label}
            </button>
          ))}

          <div className="flex-1" />

          <span
            id="composer-hint"
            className={`meta ${overBudget ? 'text-danger' : 'text-muted'} ${
              text.length ? 'hidden sm:block' : 'sr-only-text'
            }`}
          >
            {overBudget
              ? 'Over the context budget — trim before sending.'
              : text.length
                ? `${text.length} ch · ~${tokens.toLocaleString()} / ${TOKEN_BUDGET.toLocaleString()} tok`
                : 'Enter to send, Shift+Enter for a new line.'}
          </span>

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating (Esc)"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-edge bg-raised text-danger transition-colors hover:bg-hover"
            >
              <Square aria-hidden="true" size={12} strokeWidth={2} className="fill-current" />
              <span className="sr-only-text">Stop generating</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              title="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-muted disabled:shadow-[inset_0_0_0_1px_var(--line)]"
            >
              <ArrowUp aria-hidden="true" size={17} strokeWidth={2.5} />
              <span className="sr-only-text">Send message</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
