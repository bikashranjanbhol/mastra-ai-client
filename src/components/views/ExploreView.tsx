import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { searchDocs, type DocPassage } from '../../lib/api/tools';
import { ApiError } from '../../lib/api/http';

interface Props {
  /** Sends a question about a passage into a new chat. */
  onAsk: (prompt: string) => void;
  live: boolean;
}

/**
 * Explore — search the documentation the assistant answers from.
 *
 * It runs the agent's own `search_docs` tool rather than a separate index, so
 * what you find here is exactly what the assistant would retrieve.
 */
export function ExploreView({ onAsk, live }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocPassage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = async (text: string) => {
    const q = text.trim();
    if (!q || !live) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await searchDocs(q));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The search failed.');
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-6">
      <h1 className="text-[1.35rem] font-bold text-ink">Explore the documentation</h1>
      <p className="mt-1 max-w-[70ch] text-[14px] text-muted">
        Searches the same corpus the assistant answers from, using its own retrieval tool. Open a
        passage to ask about it in a new chat.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="relative mt-5"
      >
        <Search
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <label htmlFor="explore-search" className="sr-only-text">
          Search the documentation
        </label>
        <input
          id="explore-search"
          ref={inputRef}
          value={query}
          disabled={!live}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="expenses, incident severity, credential handling…"
          className="w-full rounded-pill border border-edge bg-raised py-2.5 pl-10 pr-24 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!live || busy || !query.trim()}
          className="btn btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {!live && (
        <p className="mt-4 rounded-ctl border border-edge bg-surface px-3 py-2 text-[13px] text-muted">
          The documentation lives on the service. Connect to it to search.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-ctl border border-danger px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      {results && (
        <>
          <p className="mt-6 label text-muted">
            {results.length} passage{results.length === 1 ? '' : 's'}
          </p>
          {results.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">
              Nothing matched. The corpus is small and deliberate — try a broader word.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {results.map((passage) => (
                <li key={passage.id} className="rounded-card border border-edge bg-raised p-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 className="text-[14px] font-bold text-ink">{passage.title}</h2>
                    <span className="meta text-muted">{passage.section}</span>
                    <span className="rounded-pill bg-wash px-2 py-px text-[11px] font-bold text-accent-text">
                      {passage.id}
                    </span>
                    <span className="meta text-muted">owner: {passage.owner}</span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-[1.55] text-ink">{passage.text}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onAsk(
                        `About ${passage.id} (${passage.title} — ${passage.section}): explain what this means in practice and what I should do.`,
                      )
                    }
                    className="btn btn-quiet btn-sm mt-2.5"
                  >
                    <CornerDownLeft aria-hidden="true" size={13} strokeWidth={2} />
                    Ask about this
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
