import type { Conversation, Message } from '../types';

/**
 * Sample conversations for the demo.
 *
 * Scenarios are retail-operations shaped so the interface can be reviewed in
 * something close to its real context. Every figure, store number and item
 * below is invented for the mock — none of it is real operating data.
 */

let counter = 0;
export const uid = (prefix = 'id'): string => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const now = Date.now();

const turn = (
  role: Message['role'],
  content: string,
  createdAt: number,
  extra: Partial<Message> = {},
): Message => ({
  id: uid('msg'),
  role,
  content,
  createdAt,
  status: 'complete',
  ...extra,
});

/* ------------------------------------------------ 1. markdown plan, with a table */

const markdownStart = now - 2 * HOUR;

const markdownPlan: Conversation = {
  id: uid('conv'),
  title: 'Q3 markdown cadence — seasonal apparel',
  createdAt: markdownStart,
  updatedAt: markdownStart + 14 * MINUTE,
  messages: [
    turn(
      'user',
      'I need to set the markdown cadence for seasonal apparel going into Q3. Single deep cut or a stepped schedule? Last season we cleared late and ate the margin.',
      markdownStart,
      {
        attachments: [
          { id: uid('att'), name: 'q2-sellthrough-by-dept.csv', size: 284_112, kind: 'data' },
        ],
      },
    ),
    turn(
      'assistant',
      `Stepped, and trigger it on rate of sale rather than on the calendar. Clearing late is usually a trigger problem, not a depth problem.

### Cadence comparison, seasonal apparel

| Cadence | First cut | Weeks to clear | Sell-through | Margin retained |
| --- | ---: | ---: | ---: | ---: |
| Single deep cut | −40% | 3.1 | 91% | 54% |
| Two-step | −20/−40% | 4.4 | 93% | **63%** |
| Three-step | −15/−30/−50% | 6.8 | 95% | 61% |
| Hold to season end | −50% | 8.2 | 88% | 49% |

Two things stand out. The two-step retains nine points more margin than the single
cut for about nine extra days on the floor. And the three-step buys two more points
of sell-through for another two and a half weeks of shelf space — which is the cost
that never shows up in a markdown table.

### What I'd do

1. **Trigger on rate of sale.** Cut when a week's units fall below 60% of the
   four-week trailing average, rather than on a fixed date.
2. **Hold the second step for regional variance.** Warm-weather regions clear on the
   first cut; the second step is really a Northeast and Midwest instrument.
3. **Exclude the top decile.** Items clearing on their own should not be in the event
   — that is margin given up for demand you already have.

> Watch the space, not just the ledger. Six extra weeks of clearance on an endcap
> costs more in forgone new-season sell-through than the markdown points you saved.`,
      markdownStart + 3 * MINUTE,
    ),
    turn(
      'user',
      'The rate-of-sale trigger is interesting. Does a 60% threshold fire too early on items with lumpy weekly demand?',
      markdownStart + 9 * MINUTE,
    ),
    turn(
      'assistant',
      `Yes, on low-velocity items it will — and that is where most of the false triggers come from.

A four-week trailing average on an item selling three units a week has enormous
relative variance; one slow week drops you under the threshold with no signal behind
it. Two adjustments handle it:

- **Require two consecutive weeks below threshold** before the cut. Costs you a week
  of latency and removes most single-week noise.
- **Set a velocity floor for the rule.** Below roughly ten units a week, the trigger
  is not measuring anything — put those items on the calendar schedule and leave the
  rate-of-sale rule to items with enough volume to have a rate.

For high-velocity items the opposite risk applies: 60% can fire *late*, because a
strong item falling to 60% is already a real collapse in demand. Consider 70% there.`,
      markdownStart + 11 * MINUTE,
    ),
  ],
};

/* -------------------------------------------- 2. integration work, long code block */

const apiStart = now - 26 * HOUR;

const apiWork: Conversation = {
  id: uid('conv'),
  title: 'Retry policy for the availability service',
  createdAt: apiStart,
  updatedAt: apiStart + 21 * MINUTE,
  messages: [
    turn(
      'user',
      'Our client for the item-availability service hammers it when it degrades — we see retry spikes right on the hour and the service takes longer to recover. What should the retry policy actually look like?',
      apiStart,
    ),
    turn(
      'assistant',
      `The spikes on the hour are the tell: your retries are synchronised. Every caller backs off by the same deterministic amount, so they all come back at the same instant and re-flatten the service you are waiting on.

The fix is full jitter plus a budget. Here is the shape I would ship:

\`\`\`typescript
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Total wall-clock budget across all attempts, including the waits. */
  deadlineMs: number;
  /** Statuses worth retrying. 429 and 5xx yes; 4xx client errors no. */
  retryableStatuses: ReadonlySet<number>;
}

const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 200,
  maxDelayMs: 8_000,
  deadlineMs: 20_000,
  retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]),
};

/**
 * Full jitter: a uniform random point in [0, capped], not capped ± noise.
 * Equal jitter still leaves a floor that keeps callers loosely in step, which
 * is what produces the synchronised spikes.
 */
function backoffDelay(attempt: number, policy: RetryPolicy): number {
  const capped = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.random() * capped;
}

/** Retry-After is either delta-seconds or an HTTP date. Both appear in the wild. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const when = Date.parse(header);
  return Number.isNaN(when) ? undefined : Math.max(0, when - Date.now());
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function callWithRetry<T>(
  request: (signal: AbortSignal) => Promise<Response>,
  parse: (res: Response) => Promise<T>,
  signal: AbortSignal,
  policy: RetryPolicy = DEFAULT_POLICY,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= policy.deadlineMs) break;

    try {
      const res = await request(signal);
      if (res.ok) return await parse(res);

      if (!policy.retryableStatuses.has(res.status)) {
        // A 400 will fail identically every time. Fail fast and loudly.
        throw new HttpError(res.status, await res.text());
      }

      lastError = new HttpError(res.status, 'retryable');

      // Honour the server's own guidance whenever it gives any.
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
      const delay = retryAfter ?? backoffDelay(attempt, policy);
      const remaining = policy.deadlineMs - (Date.now() - startedAt);
      if (delay >= remaining) break;

      await sleep(delay, signal);
    } catch (err) {
      if (err instanceof HttpError && !policy.retryableStatuses.has(err.status)) throw err;
      if (signal.aborted) throw err;

      lastError = err;
      const delay = backoffDelay(attempt, policy);
      const remaining = policy.deadlineMs - (Date.now() - startedAt);
      if (delay >= remaining) break;

      await sleep(delay, signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('availability request failed after retries');
}
\`\`\`

Three things that matter as much as the loop itself:

- **Idempotency keys** on anything retried that writes. Without them a retried
  \`POST\` can double-post, and the retry becomes the incident.
- **The total deadline**, which the code above enforces. Four attempts at up to
  eight seconds each is potentially half a minute; whoever called you has already
  given up by then.
- **A retry budget** — cap retries at a small percentage of total requests. Without
  one, a partial outage turns your own traffic into the load keeping it down.`,
      apiStart + 4 * MINUTE,
    ),
    turn(
      'user',
      'Why `2 ** attempt` rather than a lookup table of delays? Style, or is there a reason?',
      apiStart + 18 * MINUTE,
    ),
    turn(
      'assistant',
      `Mostly style — but the exponent has one practical advantage.

A lookup table quietly caps your retry count at the table length, so raising
\`maxAttempts\` without extending the table gives you an \`undefined\` delay. The
exponent and the \`maxDelayMs\` clamp scale together, so the two knobs stay independent.

Where a table wins is when the delays are not a clean curve — if operations wants
"200ms, 1s, then 30s" because the dependency has a known recovery profile, encoding
that as a formula is worse than just writing the three numbers down.`,
      apiStart + 21 * MINUTE,
    ),
  ],
};

/* --------------------------- 3. long conversation, to exercise virtualization */

/**
 * Question/answer pairs for the long conversation. Each takes the store number
 * so the substitution cannot leak into a figure where a store number makes no
 * sense — an earlier version produced "the 4562-week trailing average".
 */
const NOTES: Array<[(store: number) => string, string]> = [
  [
    (store) => `Store ${store}: modular reset is showing 40% compliance. Real or a data problem?`,
    `Data problem first, on this evidence.

40% is low enough to be a measurement artefact rather than execution. Check the audit
timestamp against the reset completion date — if the audit ran before the reset
window closed, you are scoring a store for work it had not been asked to finish yet.

If the timestamps do line up, the usual cause at this scale is a fixture mismatch:
the planogram assumes a four-foot section and the store has a three-foot run.`,
  ],
  [
    (store) => `Item ${store} keeps reading out-of-stock but the shelf is full. Where do I look?`,
    `Phantom inventory, and it is nearly always one of three things:

1. **A receiving error** — the case was scanned into the wrong item number, so
   on-hand for the real item never moved.
2. **A shrink event** absorbed silently, leaving the system count high and the shelf
   count low. Here it's the reverse, so less likely.
3. **A UPC collision** — two items sharing a scan code, one selling down the other's
   on-hand.

Start with the receiving log for the last two deliveries. That is where the answer
usually is.`,
  ],
  [
    () => `Is the 12-week trailing average the right window for this category?`,
    `For this one, probably too long.

A trailing window has to be short enough to track real demand shifts and long enough
to smooth noise. In a category with promotional swings this size, twelve weeks carries
promo weeks into the baseline for over a month after the event ends.

Try halving it and adding a promo flag so the lift is modelled rather than averaged in.`,
  ],
  [
    (store) => `Should store ${store} keep its endcap for this category through the transition?`,
    `Keep it, but shorten the tail.

The endcap is still earning its space on units, and giving it up early means the
incoming season's item lands on a shelf position with no traffic behind it. Two weeks
of overlap is the usual compromise: incoming item on the endcap, outgoing item back to
its in-line position rather than out of the store entirely.`,
  ],
  [
    (store) => `Cut or keep the secondary display for item ${store}?`,
    `Cut it.

Two placements for one item split the demand signal without adding much lift — the
data shows the secondary taking sales from the in-line position rather than creating
new ones. The space is worth more given to an item that has no placement at all.`,
  ],
  [
    (store) => `Availability at store ${store} dipped last week but sales held. How is that possible?`,
    `Substitution, most likely — and it means the dip cost less than the report implies.

When an item goes out and the shopper takes the next size or the private-label
equivalent from the same shelf, category sales hold while item-level availability
falls. That is a real out-of-stock, but its true cost is the margin difference between
the two items, not the full basket.

Worth checking whether the substitute is the higher or lower margin item before you
prioritise the fix.`,
  ],
];

const complianceStart = now - 6 * DAY;

const buildCompliance = (): Message[] => {
  const messages: Message[] = [];
  let t = complianceStart;

  messages.push(
    turn(
      'user',
      `Working through the Q2 planogram compliance review for the Region 14 stores. I'll go store by store — flag anything that looks like a pattern across stores rather than a one-off. Audit export attached.`,
      t,
      {
        attachments: [
          { id: uid('att'), name: 'region14-compliance-q2.csv', size: 1_184_218, kind: 'data' },
          { id: uid('att'), name: 'modular-reset-calendar.xlsx', size: 92_902, kind: 'data' },
        ],
      },
    ),
  );
  t += 2 * MINUTE;

  messages.push(
    turn(
      'assistant',
      `Read straight through the export first. Three patterns stand out across the region before we get to individual stores:

1. **Audits running early.** Roughly a third of the low scores have an audit timestamp
   inside the reset window. Those stores are being marked down for work that was not
   due yet — fix the schedule before you act on the scores.
2. **Fixture mismatches clustering by store age.** The pre-2012 remodels show the same
   three sections failing, which points at fixture depth rather than execution.
3. **Compliance falling on Mondays.** Weekend truck volume is arriving faster than it
   is being worked, so Monday audits catch shelves mid-recovery.

Send the stores as you get to them and I'll work case by case.`,
      t,
    ),
  );
  t += 4 * MINUTE;

  // ~62 exchanges → ~126 messages total, comfortably past the virtualization threshold.
  for (let n = 1; n <= 62; n += 1) {
    const [question, answer] = NOTES[n % NOTES.length];
    messages.push(turn('user', question(4500 + n), t));
    t += 90_000 + (n % 5) * 45_000;
    messages.push(turn('assistant', answer, t, n % 9 === 0 ? { revision: 2 } : {}));
    t += 3 * MINUTE + (n % 7) * MINUTE;
  }

  return messages;
};

const complianceMessages = buildCompliance();

const compliance: Conversation = {
  id: uid('conv'),
  title: 'Region 14 — Q2 planogram compliance',
  createdAt: complianceStart,
  updatedAt: complianceMessages[complianceMessages.length - 1].createdAt,
  messages: complianceMessages,
};

export const seedConversations: Conversation[] = [markdownPlan, apiWork, compliance];
