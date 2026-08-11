import { useMemo } from 'react';
import { Paperclip } from 'lucide-react';
import type { Conversation } from '../types';
import { estimateTokens } from '../lib/markdown';
import { fileSize, stamp } from '../lib/format';

interface Props {
  conversation: Conversation;
  onJumpTo: (messageId: string) => void;
}

/**
 * Right-hand context panel.
 *
 * On a long review the questions asked *are* the table of contents, so they
 * become jump links. This is also what earns the width on a wide screen — the
 * space to the right of the transcript was previously empty.
 */
export function ContextPanel({ conversation, onJumpTo }: Props) {
  const questions = useMemo(
    () => conversation.messages.filter((m) => m.role === 'user'),
    [conversation.messages],
  );

  const files = useMemo(
    () => conversation.messages.flatMap((m) => m.attachments ?? []),
    [conversation.messages],
  );

  const approxTokens = useMemo(
    () => conversation.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
    [conversation.messages],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface">
      <section className="border-b border-edge px-4 py-3">
        <h2 className="label text-muted">Details</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 meta">
          <dt className="text-muted">Messages</dt>
          <dd className="text-right text-ink">{conversation.messages.length}</dd>
          <dt className="text-muted">Started</dt>
          <dd className="text-right text-ink">{stamp(conversation.createdAt)}</dd>
          <dt className="text-muted">Updated</dt>
          <dd className="text-right text-ink">{stamp(conversation.updatedAt)}</dd>
          <dt className="text-muted">Context</dt>
          <dd className="text-right text-ink">~{approxTokens.toLocaleString()} tok</dd>
        </dl>
      </section>

      <section className="border-b border-edge">
        <h2 className="label sticky top-0 bg-surface px-4 py-3 text-muted">
          Questions · {questions.length}
        </h2>
        {questions.length === 0 ? (
          <p className="px-4 pb-3 meta text-muted">Nothing asked yet.</p>
        ) : (
          <ol className="pb-2">
            {questions.map((q, i) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onJumpTo(q.id)}
                  className="flex w-full gap-2 px-4 py-1.5 text-left transition-colors hover:bg-hover"
                >
                  <span className="w-5 shrink-0 pt-px meta text-edge-strong">{i + 1}</span>
                  <span className="line-clamp-2 min-w-0 text-[13px] leading-snug text-ink">
                    {q.content}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="px-4 py-3">
        <h2 className="label text-muted">Files · {files.length}</h2>
        {files.length === 0 ? (
          <p className="mt-2 meta text-muted">No attachments in this chat.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-ctl border border-edge bg-raised px-2 py-1.5"
              >
                <Paperclip
                  aria-hidden="true"
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-accent-text"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{file.name}</span>
                <span className="shrink-0 meta text-muted">{fileSize(file.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
