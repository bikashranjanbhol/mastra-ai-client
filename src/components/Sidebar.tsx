import { useMemo, useState, type RefObject } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X, Zap } from 'lucide-react';
import type { Conversation } from '../types';
import { plural, relativeDay } from '../lib/format';

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

/** The chat list: dense two-line rows with search, rename and delete. */
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
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onNew}
          title="New chat (⌘⇧O)"
          className="btn btn-primary w-full justify-center"
        >
          <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
          New chat
        </button>
      </div>

      <div className="relative px-3 pb-2">
        <Search
          aria-hidden="true"
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute left-5.5 top-1/2 -translate-y-1/2 text-muted"
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
          placeholder="Search chats  ⌘K"
          className="w-full rounded-pill border border-edge bg-raised py-1.5 pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <nav aria-label="Chat list" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {results.length === 0 ? (
          <p className="px-2 py-4 meta text-muted">No chats match “{query}”.</p>
        ) : (
          <ul className="space-y-px">
            {results.map((conv) => {
              const active = conv.id === activeId;
              return (
                <li key={conv.id} className="group relative">
                  {renaming === conv.id ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
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
                      className={`flex items-center gap-1 rounded-ctl pr-1 transition-colors ${
                        active ? 'bg-raised shadow-raised' : 'hover:bg-hover'
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-1 rounded-pill bg-highlight"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onSelect(conv.id)}
                        aria-current={active ? 'true' : undefined}
                        className="min-w-0 flex-1 px-2.5 py-2 text-left"
                      >
                        <span
                          className={`block truncate text-[13px] leading-snug ${
                            active ? 'font-bold text-ink' : 'font-medium text-ink'
                          }`}
                        >
                          {conv.title}
                        </span>
                        <span className="mt-0.5 block meta text-muted">
                          {relativeDay(conv.updatedAt)} · {plural(conv.messages.length, 'message')}
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
        )}
      </nav>

      <div className="border-t border-edge px-3 py-2">
        <button
          type="button"
          onClick={onToggleFault}
          aria-pressed={faultArmed}
          className={`btn btn-sm w-full justify-center ${faultArmed ? 'btn-danger' : 'btn-quiet'}`}
        >
          <Zap aria-hidden="true" size={12} strokeWidth={2} />
          {faultArmed ? 'Fault armed — next reply drops' : 'Simulate dropped connection'}
        </button>
      </div>
    </div>
  );
}
