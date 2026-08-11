import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { ArrowDown } from 'lucide-react';
import type { Conversation } from '../types';
import { MessageRow } from './MessageRow';
import { useVirtualList } from '../hooks/useVirtualList';
import { plural } from '../lib/format';

/** Above this many messages the list switches to windowed rendering. */
const VIRTUALIZE_ABOVE = 100;
/** Distance from the bottom, in px, still counted as "following along". */
const PIN_SLACK = 96;

export interface TranscriptHandle {
  jumpTo: (messageId: string) => void;
}

interface Props {
  conversation: Conversation;
  busy: boolean;
  onRegenerate: (id: string) => void;
  onEditSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
  handleRef?: RefObject<TranscriptHandle | null>;
}

export function Transcript({
  conversation,
  busy,
  onRegenerate,
  onEditSubmit,
  onRetry,
  handleRef,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  const [flashId, setFlashId] = useState<string | null>(null);

  const messages = conversation.messages;
  const count = messages.length;
  const virtualized = count > VIRTUALIZE_ABOVE;

  const { indices, padTop, padBottom, registerRow, offsetOf } = useVirtualList({
    scrollRef,
    count,
    enabled: virtualized,
    estimate: 190,
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

  /**
   * Jump to a message by id, for the context panel's question links.
   *
   * When the list is windowed the target row usually is not mounted, so the
   * scroll goes to its computed offset first; the row mounts on the next frame
   * and is then centred exactly.
   */
  useImperativeHandle(
    handleRef,
    () => ({
      jumpTo: (messageId: string) => {
        const node = scrollRef.current;
        if (!node) return;
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;

        pinnedRef.current = false;
        setPinned(false);
        setFlashId(messageId);

        if (virtualized) node.scrollTop = Math.max(0, offsetOf(index) - 24);

        requestAnimationFrame(() => {
          document
            .getElementById(`msg-${messageId}`)
            ?.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      },
    }),
    [messages, offsetOf, virtualized],
  );

  // Clear the jump highlight after it has been seen.
  useEffect(() => {
    if (!flashId) return;
    const id = window.setTimeout(() => setFlashId(null), 1600);
    return () => window.clearTimeout(id);
  }, [flashId]);

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
      setAnnouncement(
        `Response complete, ${plural(last.content.trim().split(/\s+/).length, 'word')}.`,
      );
    else if (last.status === 'stopped') setAnnouncement('Generation stopped.');
    else if (last.status === 'error') setAnnouncement('The response failed. Retry is available.');
  }, [last, last?.status]);

  const rows = indices.map((index) => {
    const message = messages[index];
    if (!message) return null;
    return (
      <div
        key={message.id}
        ref={virtualized ? registerRow(index) : undefined}
        className={
          flashId === message.id ? 'ring-2 ring-inset ring-accent transition-shadow' : undefined
        }
      >
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
        {virtualized && padTop > 0 && <div style={{ height: padTop }} aria-hidden="true" />}
        {rows}
        {virtualized && padBottom > 0 && <div style={{ height: padBottom }} aria-hidden="true" />}

        {count > 0 && (
          <p className="px-4 py-3 meta text-muted md:px-6">
            End of conversation · {plural(count, 'message')}
            {virtualized && ' · windowed'}
          </p>
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
          className="btn btn-sm absolute bottom-3 right-4 border border-edge bg-raised text-ink shadow-pop hover:bg-hover md:right-5"
        >
          <ArrowDown aria-hidden="true" size={14} strokeWidth={2.25} className="text-accent" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
