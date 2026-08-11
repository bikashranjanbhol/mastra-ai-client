import { CornerDownLeft } from 'lucide-react';

const OPENINGS = [
  'Design a chunking strategy for a table-heavy scanned corpus.',
  'Review this SSE decoder for correctness under packet fragmentation.',
  'Line-edit the opening of chapter seven and flag anything that is a pattern.',
  'How should a streaming transcript announce itself to a screen reader?',
];

/**
 * Empty state as a blank recto: the rail keeps its position, the sheet carries a
 * heading and four openings. No centred hero, no illustration.
 */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-10 min-[900px]:grid-cols-[8.25rem_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:px-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        new entry
      </div>

      <div className="max-w-[62ch]">
        <h2 className="font-display text-[1.6rem] leading-tight text-ink">
          A blank page, ruled and waiting.
        </h2>
        <p className="mt-2 max-w-[52ch] text-[1.0625rem] leading-[1.6] text-muted">
          Everything you write is kept in the left margin with its time and revision. Start
          anywhere — or take one of these.
        </p>

        <ul className="mt-7 border-t border-edge">
          {OPENINGS.map((text) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => onPick(text)}
                className="group flex w-full items-baseline gap-3 border-b border-edge px-1 py-3 text-left transition-colors hover:bg-hover"
              >
                <CornerDownLeft
                  aria-hidden="true"
                  size={13}
                  strokeWidth={1.75}
                  className="translate-y-0.5 shrink-0 text-edge-strong transition-colors group-hover:text-accent"
                />
                <span className="font-display text-[1.0625rem] italic leading-snug text-ink">
                  {text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
