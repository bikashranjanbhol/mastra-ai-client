import { ArrowUpRight } from 'lucide-react';
import { demoUser } from '../brand';

/** Questions the service's documentation corpus can actually answer. */
const LIVE_OPENINGS = [
  {
    title: 'Expense limits',
    prompt: 'What is the meal reimbursement cap, and when do I need receipts?',
  },
  {
    title: 'Incident severity',
    prompt: 'How do I decide between sev1 and sev2 for a partial outage?',
  },
  {
    title: 'Laptop provisioning',
    prompt: 'A new starter has no laptop on day one. What is the process, and who owns it?',
  },
  {
    title: 'Credential handling',
    prompt: 'What are the rules for handling credentials and how long is data retained?',
  },
];

const MOCK_OPENINGS = [
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

interface Props {
  onPick: (text: string) => void;
  /** Live suggestions are grounded in the service's corpus; offline ones are not. */
  live: boolean;
}

/**
 * Shown for a chat with no messages. The orb and the two-line greeting sit above
 * the composer, which the shell centres in the empty state.
 *
 * Openings differ by connection state: suggesting questions the connected agent
 * cannot answer is a worse first impression than suggesting different ones.
 */
export function WelcomeHero({ onPick, live }: Props) {
  const firstName = demoUser.name.split(' ')[0];
  const openings = live ? LIVE_OPENINGS : MOCK_OPENINGS;

  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div className="orb" aria-hidden="true" />

      <h1 className="mt-7 text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold leading-[1.2] tracking-tight text-ink">
        {greeting()}, {firstName}
        <br />
        How can I <span className="text-accent">help you today?</span>
      </h1>

      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {openings.map((opening) => (
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
