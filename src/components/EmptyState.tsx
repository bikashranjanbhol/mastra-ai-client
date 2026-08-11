import { ArrowUpRight } from 'lucide-react';

const OPENINGS = [
  {
    title: 'Compare markdown cadences',
    body: 'Seasonal apparel going into Q3 — show the margin tradeoff between a single deep cut and a stepped schedule.',
  },
  {
    title: 'Review a retry policy',
    body: 'Our availability-service client spikes on the hour when the service degrades. What should the policy be?',
  },
  {
    title: 'Diagnose a slow query',
    body: 'This weekly sales rollup takes four seconds against an indexed column. Where is the plan going wrong?',
  },
  {
    title: 'Split an availability miss',
    body: 'Out-of-stocks are up but sales held flat. How do I tell a forecast miss from an execution miss?',
  },
];

/** Shown for a chat with no messages yet. A dense card grid, not a centred hero. */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="px-4 py-6 md:px-6">
      <h2 className="text-[1.35rem] font-bold leading-tight text-ink">
        What can I help you with?
      </h2>
      <p className="mt-1 max-w-[64ch] text-[14px] text-muted">
        Every message keeps its time and version inline, and the panel on the right indexes the
        questions in a chat so you can jump back to any of them.
      </p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {OPENINGS.map((opening) => (
          <li key={opening.title}>
            <button
              type="button"
              onClick={() => onPick(`${opening.title}. ${opening.body}`)}
              className="group flex h-full w-full flex-col gap-1 rounded-card border border-edge bg-raised p-3 text-left transition-colors hover:border-accent hover:bg-hover"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                {opening.title}
                <ArrowUpRight
                  aria-hidden="true"
                  size={14}
                  strokeWidth={2.25}
                  className="text-edge-strong transition-colors group-hover:text-accent"
                />
              </span>
              <span className="meta leading-snug text-muted">{opening.body}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
