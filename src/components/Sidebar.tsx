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

/**
 * The index: a card catalogue down the left edge. Titles are set in the reading
 * serif, everything else is monospace apparatus.
 */
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
      <div className="flex items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <h1 className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink">Marginalia</h1>
        <button
          type="button"
          onClick={onNew}
          title="New entry (⌘⇧O)"
          className="flex items-center gap-1.5 rounded-ctl border border-edge px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:bg-hover hover:text-ink"
        >
          <Plus aria-hidden="true" size={12} strokeWidth={2} />
          New
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
          Search entries
        </label>
        <input
          id="index-search"
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search titles and text  ⌘K"
          className="w-full bg-transparent py-2.5 pl-10 pr-4 font-mono text-[12px] text-ink outline-none placeholder:text-muted focus-visible:bg-hover"
        />
      </div>

      <nav aria-label="Conversation index" className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <p className="px-4 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            no entries match “{query}”
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
                        className="rounded-ctl p-1 text-success transition-colors hover:bg-hover"
                      >
                        <Check aria-hidden="true" size={14} strokeWidth={2} />
                        <span className="sr-only-text">Save title</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming(null)}
                        className="rounded-ctl p-1 text-muted transition-colors hover:bg-hover"
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
                        <span className="mt-1 block font-mono text-[11px] tracking-[0.06em] text-muted">
                          {relativeDay(conv.updatedAt)} · {plural(conv.messages.length, 'turn')}
                        </span>
                      </button>

                      {confirming === conv.id ? (
                        <div className="flex items-center gap-1 py-3">
                          <span className="font-mono text-[11px] text-danger">delete?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(conv.id);
                              setConfirming(null);
                            }}
                            className="rounded-ctl px-1.5 py-0.5 font-mono text-[11px] uppercase text-danger transition-colors hover:bg-hover"
                          >
                            yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="rounded-ctl px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted transition-colors hover:bg-hover"
                          >
                            no
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
                            className="rounded-ctl p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
                          >
                            <Pencil aria-hidden="true" size={13} strokeWidth={1.75} />
                            <span className="sr-only-text">Rename {conv.title}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(conv.id)}
                            className="rounded-ctl p-1 text-muted transition-colors hover:bg-hover hover:text-danger"
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
          className={`flex w-full items-center gap-2 rounded-ctl border px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
            faultArmed
              ? 'border-danger text-danger'
              : 'border-edge text-muted hover:bg-hover hover:text-ink'
          }`}
        >
          <Zap aria-hidden="true" size={12} strokeWidth={1.75} />
          {faultArmed ? 'fault armed — next reply drops' : 'simulate dropped connection'}
        </button>
      </div>
    </div>
  );
}
