import { useMemo, useState, type RefObject } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X, Zap } from 'lucide-react';
import type { Conversation } from '../types';
import { plural, relativeDay } from '../lib/format';
import { BrandMark } from './BrandMark';
import { BRAND } from '../brand';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  faultArmed: boolean;
  onToggleFault: () => void;
}

/** The chat list down the left edge, with search, rename and delete. */
export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

  const commitRename = (id: string) => {
    onRename(id, draft);
    setRenaming(null);
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight text-ink">
              {BRAND.productName}
            </h1>
            <p className="truncate meta text-muted">{BRAND.descriptor}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNew}
          title="New chat (⌘⇧O)"
          className="btn btn-primary mt-3 w-full justify-center"
        >
          <Plus aria-hidden="true" size={15} strokeWidth={2.25} />
          New chat
        </button>
      </div>

      <div className="relative border-b border-edge">
        <Search
          aria-hidden="true"
          size={13}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <label htmlFor="index-search" className="sr-only-text">
          Search chats
        </label>
        <input
          id="index-search"
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search chats  ⌘K"
          className="w-full bg-transparent py-2.5 pl-10 pr-4 meta text-ink outline-none placeholder:text-muted focus-visible:bg-hover"
        />
      </div>

      <nav aria-label="Chat list" className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <p className="px-4 py-6 label text-muted">
            No chats match “{query}”
          </p>
        ) : (
          <ul>
            {results.map((conv) => {
              const active = conv.id === activeId;
              return (
                <li key={conv.id} className="group relative border-b border-edge">
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                    />
                  )}

                  {renaming === conv.id ? (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(conv.id);
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        aria-label={`Rename ${conv.title}`}
                        className="min-w-0 flex-1 border-b border-accent bg-transparent font-display text-[0.95rem] text-ink outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(conv.id)}
                        className="rounded-pill p-1 text-success transition-colors hover:bg-hover"
                      >
                        <Check aria-hidden="true" size={14} strokeWidth={2} />
                        <span className="sr-only-text">Save title</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming(null)}
                        className="rounded-pill p-1 text-muted transition-colors hover:bg-hover"
                      >
                        <X aria-hidden="true" size={14} strokeWidth={2} />
                        <span className="sr-only-text">Cancel rename</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`flex items-start gap-1 pr-2 transition-colors ${
                        active ? 'bg-raised' : 'hover:bg-hover'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(conv.id)}
                        aria-current={active ? 'true' : undefined}
                        className="min-w-0 flex-1 px-4 py-3 text-left"
                      >
                        <span
                          className={`block truncate font-display text-[0.98rem] leading-snug ${
                            active ? 'text-ink' : 'text-ink/85'
                          }`}
                        >
                          {conv.title}
                        </span>
                        <span className="mt-1 block meta text-muted">
                          {relativeDay(conv.updatedAt)} · {plural(conv.messages.length, 'message')}
                        </span>
                      </button>

                      {confirming === conv.id ? (
                        <div className="flex items-center gap-1 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(conv.id);
                              setConfirming(null);
                            }}
                            className="rounded-pill px-2.5 py-1 text-[12px] font-bold text-danger transition-colors hover:bg-hover"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="rounded-pill px-2.5 py-1 text-[12px] font-bold text-muted transition-colors hover:bg-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 py-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(conv.title);
                              setRenaming(conv.id);
                            }}
                            className="rounded-pill p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
                          >
                            <Pencil aria-hidden="true" size={13} strokeWidth={1.75} />
                            <span className="sr-only-text">Rename {conv.title}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(conv.id)}
                            className="rounded-pill p-1 text-muted transition-colors hover:bg-hover hover:text-danger"
                          >
                            <Trash2 aria-hidden="true" size={13} strokeWidth={1.75} />
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
        )}
      </nav>

      <div className="border-t border-edge px-4 py-3">
        <button
          type="button"
          onClick={onToggleFault}
          aria-pressed={faultArmed}
          className={`btn w-full justify-center ${faultArmed ? 'btn-danger' : 'btn-quiet'}`}
        >
          <Zap aria-hidden="true" size={13} strokeWidth={2} />
          {faultArmed ? 'Fault armed — next reply drops' : 'Simulate dropped connection'}
        </button>
      </div>
    </div>
  );
}
