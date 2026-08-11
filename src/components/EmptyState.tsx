import { CornerDownLeft } from 'lucide-react';

const OPENINGS = [
  'Compare markdown cadences for seasonal apparel and show the margin tradeoff.',
  'Review our retry policy for the availability service — we see spikes on the hour.',
  'This weekly sales query takes four seconds. Where is the plan going wrong?',
  'Out-of-stocks are up but sales held flat. How do I tell what actually happened?',
];

/**
 * The rail keeps its position and the sheet carries a heading plus four
 * openings. No centred hero, no illustration.
 */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-10 min-[900px]:grid-cols-[8.25rem_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:px-8">
      <div className="label text-muted">New chat</div>

      <div className="max-w-[62ch]">
        <h2 className="text-[1.6rem] font-bold leading-tight text-ink">
          What can I help you with?
        </h2>
        <p className="mt-2 max-w-[52ch] text-[1.0625rem] leading-[1.6] text-muted">
          Every message keeps its time and version in the left margin. Ask anything — or start
          with one of these.
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
                <span className="text-[1rem] font-medium leading-snug text-ink">
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
