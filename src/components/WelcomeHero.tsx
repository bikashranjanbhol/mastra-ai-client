import { ArrowUpRight } from 'lucide-react';
import { demoUser } from '../brand';

const OPENINGS = [
  {
    title: 'Compare markdown cadences',
    prompt:
      'Compare markdown cadences for seasonal apparel going into Q3 — show the margin tradeoff between a single deep cut and a stepped schedule.',
  },
  {
    title: 'Review a retry policy',
    prompt:
      'Review our retry policy for the availability service. We see retry spikes on the hour whenever it degrades.',
  },
  {
    title: 'Diagnose a slow query',
    prompt:
      'This weekly sales rollup takes four seconds against an indexed column. Where is the query plan going wrong?',
  },
  {
    title: 'Split an availability miss',
    prompt:
      'Out-of-stocks are up but sales held flat. How do I tell a forecast miss from an execution miss?',
  },
];

/** Time-of-day greeting. Real logic, not a fixed string. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Shown for a chat with no messages. The orb and the two-line greeting sit above
 * the composer, which the shell centres in the empty state.
 */
export function WelcomeHero({ onPick }: { onPick: (text: string) => void }) {
  const firstName = demoUser.name.split(' ')[0];

  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div className="orb" aria-hidden="true" />

      <h1 className="mt-7 text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold leading-[1.2] tracking-tight text-ink">
        {greeting()}, {firstName}
        <br />
        How can I <span className="text-accent">help you today?</span>
      </h1>

      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {OPENINGS.map((opening) => (
          <li key={opening.title}>
            <button type="button" onClick={() => onPick(opening.prompt)} className="chip">
              {opening.title}
              <ArrowUpRight aria-hidden="true" size={14} strokeWidth={2.25} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
