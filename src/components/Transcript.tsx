import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Conversation } from '../types';
import { MessageRow } from './MessageRow';
import { EmptyState } from './EmptyState';
import { useVirtualList } from '../hooks/useVirtualList';
import { plural } from '../lib/format';

/** Above this many messages the list switches to windowed rendering. */
const VIRTUALIZE_ABOVE = 100;
/** Distance from the bottom, in px, still counted as "following along". */
const PIN_SLACK = 96;

interface Props {
  conversation: Conversation;
  busy: boolean;
  onSend: (text: string) => void;
  onRegenerate: (id: string) => void;
  onEditSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
}

export function Transcript({
  conversation,
  busy,
  onSend,
  onRegenerate,
  onEditSubmit,
  onRetry,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);

  const messages = conversation.messages;
  const count = messages.length;
  const virtualized = count > VIRTUALIZE_ABOVE;

  const { indices, padTop, padBottom, registerRow } = useVirtualList({
    scrollRef,
    count,
    enabled: virtualized,
    estimate: 260,
  });

  const setPin = useCallback((next: boolean) => {
    pinnedRef.current = next;
    setPinned(next);
  }, []);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setPin(distance < PIN_SLACK);
  }, [setPin]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    pinnedRef.current = true;
    setPinned(true);
  }, []);

  // Jump to the foot of the transcript when the conversation changes.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    pinnedRef.current = true;
    setPinned(true);
  }, [conversation.id]);

  const last = messages[count - 1];
  const growth = `${count}:${last?.content.length ?? 0}`;

  // Follow new text only while the reader is already at the foot of the page.
  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [growth]);

  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!last) return;
    if (last.status === 'streaming') setAnnouncement('Response in progress.');
    else if (last.status === 'complete' && last.role === 'assistant')
      setAnnouncement(`Response complete, ${plural(last.content.trim().split(/\s+/).length, 'word')}.`);
    else if (last.status === 'stopped') setAnnouncement('Generation stopped.');
    else if (last.status === 'error') setAnnouncement('The response failed. Retry is available.');
  }, [last, last?.status]);

  const rows = indices.map((index) => {
    const message = messages[index];
    if (!message) return null;
    return (
      <div key={message.id} ref={virtualized ? registerRow(index) : undefined}>
        <MessageRow
          message={message}
          busy={busy}
          onRegenerate={onRegenerate}
          onEditSubmit={onEditSubmit}
          onRetry={onRetry}
        />
      </div>
    );
  });

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`Transcript of ${conversation.title}`}
        className="h-full overflow-y-auto overflow-x-hidden focus-visible:outline-offset-[-2px]"
      >
        {count === 0 ? (
          <EmptyState onPick={onSend} />
        ) : (
          <>
            {virtualized && padTop > 0 && <div style={{ height: padTop }} aria-hidden="true" />}
            {rows}
            {virtualized && padBottom > 0 && (
              <div style={{ height: padBottom }} aria-hidden="true" />
            )}
          </>
        )}

        {count > 0 && (
          <div className="border-t border-edge px-5 py-6 min-[900px]:px-8">
            <p className="label text-muted">
              End of conversation · {plural(count, 'message')}
              {virtualized && ' · windowed'}
            </p>
          </div>
        )}
      </div>

      {/* Announcements are separated from the transcript so streaming text is not
          re-read token by token. */}
      <p role="status" aria-live="polite" className="sr-only-text">
        {announcement}
      </p>

      {!pinned && count > 0 && (
        <button
          type="button"
          onClick={() => scrollToLatest()}
          className="btn absolute bottom-4 right-5 border border-edge bg-raised text-ink shadow-pop hover:bg-hover min-[900px]:right-8"
        >
          <ArrowDown aria-hidden="true" size={14} strokeWidth={2.25} className="text-accent" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
