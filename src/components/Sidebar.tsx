import { useMemo, useState, type RefObject } from 'react';
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Clock,
  Compass,
  Home,
  Pencil,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { Conversation, View } from '../types';
import { plural } from '../lib/format';
import { BrandMark, UserAvatar } from './BrandMark';
import { BRAND, demoUser } from '../brand';

interface Props {
  view: View;
  onSelectView: (view: View) => void;
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  faultArmed: boolean;
  onToggleFault: () => void;
}

const DAY = 86_400_000;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Buckets a conversation by how long ago it was last touched. */
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
 * The chat list, as a floating card.
 *
 * Conversations are grouped by recency rather than listed flat — with a long
 * history the date bands are what make the list scannable.
 */
const NAV: Array<{ view: View; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'explore', label: 'Explore', icon: Compass },
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'history', label: 'History', icon: Clock },
];

export function Sidebar({
  view,
  onSelectView,
  conversations,
  activeId,
  onSelect,
  onRename,
  onDelete,
  searchRef,
  faultArmed,
  onToggleFault,
}: Props) {
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

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

  const commitRename = (id: string) => {
    onRename(id, draft);
    setRenaming(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <BrandMark size={28} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-ink">
            {BRAND.productName}
          </p>
          <p className="truncate meta text-muted">{BRAND.descriptor}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-4 pt-4">
        <Search
          aria-hidden="true"
          size={15}
          strokeWidth={2}
          className="pointer-events-none absolute left-7 top-1/2 mt-2 -translate-y-1/2 text-muted"
        />
        <label htmlFor="chat-search" className="sr-only-text">
          Search chats
        </label>
        <input
          id="chat-search"
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search"
          className="w-full rounded-ctl border border-edge bg-surface py-2 pl-9 pr-12 text-[14px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <kbd className="pointer-events-none absolute right-6 top-1/2 mt-2 -translate-y-1/2 rounded-md border border-edge bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-muted">
          ⌘K
        </kbd>
      </div>

      {/* Sections */}
      <nav aria-label="Sections" className="mt-4 px-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = view === item.view;
            return (
              <li key={item.view}>
                <button
                  type="button"
                  onClick={() => onSelectView(item.view)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-2 text-left text-[14px] transition-colors ${
                    active
                      ? 'bg-wash font-semibold text-accent-text'
                      : 'text-muted hover:bg-hover hover:text-ink'
                  }`}
                >
                  <item.icon
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    className={active ? 'text-accent' : ''}
                  />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-4 mt-4 border-t border-edge" />

      {/* Grouped history */}
      <nav aria-label="Chat list" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {total === 0 ? (
          <p className="px-2 py-4 meta text-muted">No chats match “{query}”.</p>
        ) : (
          groups.map(([bucket, list]) => (
            <section key={bucket} className="mb-3">
              <h2 className="px-2 pb-1 text-[12px] font-semibold text-muted">{bucket}</h2>
              <ul className="space-y-px">
                {list.map((conv) => {
                  const active = conv.id === activeId;
                  return (
                    <li key={conv.id} className="group relative">
                      {renaming === conv.id ? (
                        <div className="flex items-center gap-1 px-1 py-1">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(conv.id);
                              if (e.key === 'Escape') setRenaming(null);
                            }}
                            aria-label={`Rename ${conv.title}`}
                            className="min-w-0 flex-1 rounded-ctl border border-accent bg-raised px-2 py-1 text-[13px] text-ink outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(conv.id)}
                            className="icon-btn text-success"
                          >
                            <Check aria-hidden="true" size={14} strokeWidth={2.5} />
                            <span className="sr-only-text">Save title</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenaming(null)}
                            className="icon-btn"
                          >
                            <X aria-hidden="true" size={14} strokeWidth={2.5} />
                            <span className="sr-only-text">Cancel rename</span>
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`flex items-center rounded-ctl pr-1 transition-colors ${
                            active ? 'bg-wash' : 'hover:bg-hover'
                          }`}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-1.5 left-0 w-[3px] rounded-pill bg-accent"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => onSelect(conv.id)}
                            aria-current={active ? 'true' : undefined}
                            title={conv.title}
                            className="min-w-0 flex-1 px-2.5 py-2 text-left"
                          >
                            <span
                              className={`block truncate text-[13.5px] leading-snug ${
                                active ? 'font-semibold text-ink' : 'text-muted'
                              }`}
                            >
                              {conv.title}
                            </span>
                          </button>

                          {confirming === conv.id ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDelete(conv.id);
                                  setConfirming(null);
                                }}
                                className="rounded-pill px-2 py-1 text-[12px] font-bold text-danger transition-colors hover:bg-hover"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirming(null)}
                                className="rounded-pill px-2 py-1 text-[12px] font-bold text-muted transition-colors hover:bg-hover"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft(conv.title);
                                  setRenaming(conv.id);
                                }}
                                className="icon-btn"
                                title="Rename"
                              >
                                <Pencil aria-hidden="true" size={13} strokeWidth={2} />
                                <span className="sr-only-text">Rename {conv.title}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirming(conv.id)}
                                className="icon-btn hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 aria-hidden="true" size={13} strokeWidth={2} />
                                <span className="sr-only-text">Delete {conv.title}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      {/* Demo affordance for the error path, kept out of the way. */}
      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={onToggleFault}
          aria-pressed={faultArmed}
          className={`chip w-full justify-center ${faultArmed ? 'border-danger text-danger' : ''}`}
        >
          <Zap aria-hidden="true" size={13} strokeWidth={2} />
          {faultArmed ? 'Fault armed — next reply drops' : 'Simulate dropped connection'}
        </button>
      </div>

      {/* Signed-in user */}
      <div className="p-3 pt-1">
        <div className="flex items-center gap-2.5 rounded-ctl border border-edge bg-surface px-2.5 py-2">
          <UserAvatar size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-ink">
              {demoUser.name}
            </p>
            <p className="truncate meta text-muted">{demoUser.email}</p>
          </div>
          <span aria-hidden="true" className="icon-btn shrink-0">
            <ChevronsUpDown size={14} strokeWidth={2} />
          </span>
        </div>
        <p className="px-1 pt-1.5 meta text-muted">
          {plural(conversations.length, 'chat')} · demo account
        </p>
      </div>
    </div>
  );
}
