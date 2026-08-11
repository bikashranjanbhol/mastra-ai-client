import { useMemo, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import type { Conversation } from '../../types';
import { plural, relativeDay, stamp } from '../../lib/format';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onOpen: (id: string) => void;
}

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function bucketOf(updatedAt: number): string {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(updatedAt)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 days';
  if (days <= 30) return 'Previous 30 days';
  return 'Older';
}

const ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'];

/**
 * History — every chat with its dates, in one place.
 *
 * The sidebar is a switcher and stays terse; this is the view for finding
 * something you half remember from three weeks ago.
 */
export function HistoryView({ conversations, activeId, onOpen }: Props) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.messages.some((m) => m.content.toLowerCase().includes(q)),
        )
      : conversations;

    const byBucket = new Map<string, Conversation[]>();
    for (const conv of matched) {
      const bucket = bucketOf(conv.updatedAt);
      const list = byBucket.get(bucket);
      if (list) list.push(conv);
      else byBucket.set(bucket, [conv]);
    }
    return ORDER.filter((b) => byBucket.has(b)).map((b) => [b, byBucket.get(b)!] as const);
  }, [conversations, query]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-6">
      <h1 className="text-[1.35rem] font-bold text-ink">History</h1>
      <p className="mt-1 text-[14px] text-muted">
        {plural(conversations.length, 'chat')} on this account.
      </p>

      <div className="relative mt-5">
        <Search
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <label htmlFor="history-search" className="sr-only-text">
          Filter chats
        </label>
        <input
          id="history-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title or message text"
          className="w-full rounded-pill border border-edge bg-raised py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      {total === 0 ? (
        <p className="mt-6 text-[14px] text-muted">
          {query ? `Nothing matches “${query}”.` : 'No chats yet.'}
        </p>
      ) : (
        groups.map(([bucket, list]) => (
          <section key={bucket} className="mt-6">
            <h2 className="label text-muted">{bucket}</h2>
            <ul className="mt-2 space-y-1">
              {list.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(conv.id)}
                    aria-current={conv.id === activeId ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-ctl border px-3 py-2.5 text-left transition-colors ${
                      conv.id === activeId
                        ? 'border-accent bg-wash'
                        : 'border-edge bg-raised hover:bg-hover'
                    }`}
                  >
                    <MessageSquare
                      aria-hidden="true"
                      size={15}
                      strokeWidth={2}
                      className="shrink-0 text-muted"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {conv.title}
                      </span>
                      <span className="block meta text-muted">
                        {conv.messages.length
                          ? `${plural(conv.messages.length, 'message')} · `
                          : ''}
                        updated {relativeDay(conv.updatedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 meta text-muted">{stamp(conv.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
