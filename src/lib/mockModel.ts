/**
 * Simulated model backend.
 *
 * Streams a canned reply token-by-token with jittered timing so the transcript,
 * the stop control, the caret and the auto-scroll behaviour can all be exercised
 * without a server. Swapping this for a real endpoint means replacing
 * `streamAssistantReply` — nothing in the UI layer knows the difference.
 *
 * The sample replies use retail-operations scenarios so the demo reads like the
 * tool it is meant to become. All figures in them are invented for the mock.
 */

import type { Message, ReplyMode } from '../types';

export const THINKING_MS = 520;

export class StreamAbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'StreamAbortError';
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new StreamAbortError());
      return;
    }
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new StreamAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

interface Canned {
  match: RegExp;
  body: string;
}

const REPLIES: Canned[] = [
  {
    match: /markdown|margin|price|promo|clearance|sell-through/i,
    body: `Sell-through is the number to steer by here, not units moved — a deep cut always moves units.

### Cadence comparison, seasonal apparel

| Cadence | First cut | Weeks to clear | Sell-through | Margin retained |
| --- | ---: | ---: | ---: | ---: |
| Single deep cut | −40% | 3.1 | 91% | 54% |
| Two-step | −20/−40% | 4.4 | 93% | **63%** |
| Three-step | −15/−30/−50% | 6.8 | 95% | 61% |
| Hold to season end | −50% | 8.2 | 88% | 49% |

The two-step wins on retained margin and the three-step barely catches it while
tying up shelf space for another two and a half weeks — which is the cost that
does not show up in this table.

### What I would do

1. **Trigger on rate of sale, not on the calendar.** Cut when a week's units drop
   below 60% of the four-week trailing average.
2. **Hold the second step for regional variance.** Warm-weather regions clear at
   the first cut; the second step is really a Northeast and Midwest instrument.
3. **Protect the top decile.** The items clearing on their own should not be in
   the event at all — they are giving up margin for demand you already have.

> Watch the space, not just the ledger. Six extra weeks of clearance on an
> endcap costs more in forgone new-season sell-through than the extra points of
> markdown you saved.

Want this broken out by region or by department?`,
  },
  {
    match: /retry|backoff|api|timeout|integration|endpoint|service|latency/i,
    body: `The pattern you want is bounded exponential backoff with full jitter, plus a circuit breaker so a degraded dependency cannot pull the caller down with it.

\`\`\`typescript
interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Statuses worth retrying. 429 and 5xx yes; 4xx client errors no. */
  retryableStatuses: ReadonlySet<number>;
}

const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 200,
  maxDelayMs: 8_000,
  retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]),
};

/**
 * Full jitter: a random point in [0, capped], not capped ± noise. Equal jitter
 * still leaves a floor that keeps callers loosely in step, which is what
 * produces the retry spikes you are seeing on the hour.
 */
function backoffDelay(attempt: number, policy: RetryPolicy): number {
  const capped = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.random() * capped;
}

export async function callWithRetry<T>(
  request: (signal: AbortSignal) => Promise<Response>,
  parse: (res: Response) => Promise<T>,
  signal: AbortSignal,
  policy: RetryPolicy = DEFAULT_POLICY,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
    try {
      const res = await request(signal);

      if (res.ok) return await parse(res);

      if (!policy.retryableStatuses.has(res.status)) {
        // A 400 will fail identically every time. Fail fast and loudly.
        throw new HttpError(res.status, await res.text());
      }

      // Honour the server's own guidance when it gives any.
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
      lastError = new HttpError(res.status, 'retryable');
      await sleep(retryAfter ?? backoffDelay(attempt, policy), signal);
    } catch (err) {
      if (err instanceof HttpError && !policy.retryableStatuses.has(err.status)) throw err;
      if (signal.aborted) throw err;
      lastError = err;
      await sleep(backoffDelay(attempt, policy), signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('request failed after retries');
}

/** Retry-After is either delta-seconds or an HTTP date. Both appear in the wild. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  return Number.isNaN(when) ? undefined : Math.max(0, when - Date.now());
}
\`\`\`

Three things that matter more than the retry loop itself:

- **Idempotency keys.** Without them a retried write can double-post. Any retried
  \`POST\` needs a key the server deduplicates on.
- **A total deadline.** Four attempts at up to eight seconds is potentially half a
  minute; the caller upstream has its own timeout and will have given up.
- **Retry budgets.** Cap retries at a small percentage of total requests. Without
  a budget, a partial outage turns your own traffic into the load that keeps it down.`,
  },
  {
    match: /sql|query|slow|index|database|report|dashboard/i,
    body: `The plan is sequential-scanning \`sales_daily\` because the predicate is not sargable — wrapping the column in \`date_trunc\` defeats the index.

\`\`\`sql
-- Before: 4.2s, Seq Scan on sales_daily (rows=18,441,203)
SELECT date_trunc('week', sold_at) AS week, store_nbr, sum(net_sales)
FROM sales_daily
WHERE date_trunc('week', sold_at) >= now() - interval '13 weeks'
GROUP BY 1, 2;

-- After: 61ms, Index Scan using sales_daily_sold_at_idx
SELECT date_trunc('week', sold_at) AS week, store_nbr, sum(net_sales)
FROM sales_daily
WHERE sold_at >= date_trunc('week', now() - interval '13 weeks')
GROUP BY 1, 2
ORDER BY 1, 2;
\`\`\`

Keep the column bare on the left of the comparison and push the arithmetic to the
constant side. If you genuinely need the truncated value indexed, build the
expression index instead:

\`\`\`sql
CREATE INDEX CONCURRENTLY sales_daily_week_idx
  ON sales_daily (date_trunc('week', sold_at), store_nbr);
\`\`\`

\`CONCURRENTLY\` avoids the \`ACCESS EXCLUSIVE\` lock — it takes roughly twice as long
and cannot run inside a transaction block, which is a fair trade on a live table.

If this feeds a dashboard that several hundred people open each morning, the
better answer is a materialised view refreshed after the nightly load. The query
above is fast; the one nobody has to run at all is faster.`,
  },
  {
    match: /forecast|inventory|stock|replenish|demand|allocat|supply/i,
    body: `Before touching the model, split the error. Forecast misses and availability misses look identical in the out-of-stock report and have opposite fixes.

**Three questions, in order:**

1. **Was the demand signal right?** Compare forecast against POS units, not against
   shipped units. Shipped is censored by whatever was on hand.
2. **Did the order fire?** A correct forecast with a suppressed replenishment order
   is a parameter problem — usually a safety-stock floor or a pack-size rounding
   rule, not the model.
3. **Did it arrive and get worked?** Received-not-on-shelf is invisible to the
   system and is a substantial share of real out-of-stocks in high-volume stores.

Only the first is a forecasting problem. In the reviews I have seen described,
it is usually the smallest of the three.

**On the model itself.** For items with clean history, weekly seasonality and a
promo flag will get you most of the way. The places it will hurt:

- **New items** have no history — they need an attribute-based cold start,
  borrowing from the nearest comparable item.
- **Promoted items** break the seasonal pattern outright. Model the lift
  separately rather than letting the promo weeks poison the baseline.
- **Weather-sensitive categories** need the forecast horizon to match how far out
  the weather signal is actually reliable, which is shorter than most people assume.

What does the current error look like when you split it those three ways?`,
  },
  {
    match: /accessib|a11y|aria|screen reader|contrast|keyboard|wcag/i,
    body: `The short version: announce **state**, not tokens.

A live region set to \`aria-live="polite"\` on the streaming text itself will queue an
utterance for every mutation. On a 400-word response that is several hundred
interruptions, and screen reader users will simply leave.

What works:

1. **Mark the message busy.** \`aria-busy="true"\` on the message container while it
   streams, cleared on completion.
2. **Announce transitions in a separate region.** One \`role="status"\` node that says
   *"Response in progress"*, then *"Response complete, 312 words"*.
3. **Make the text reachable afterwards.** The finished message must be ordinary,
   navigable content — not a region that announced once and vanished.
4. **Respect \`prefers-reduced-motion\`.** The blinking caret is decoration; drop it to
   a static block.

| Element | Role | Live behaviour |
| --- | --- | --- |
| Transcript | \`log\` | \`aria-live="polite"\` |
| Streaming message | \`article\` | \`aria-busy\` while active |
| Status line | \`status\` | transitions only |
| Stop button | \`button\` | label swaps with state |

Contrast is the other half, and it is where brand palettes usually fail: Spark
Yellow is roughly 1.7:1 on white, so it can carry a fill or an indicator but never
text. True Blue clears AA on white at 4.8:1, which is enough for body copy but
leaves no headroom — on any tinted surface, step to the darker blue.`,
  },
];

const FALLBACK = `Good question — let me take it in three parts.

**What's actually being asked.** Underneath the phrasing there are two separable
problems, and they have different answers. Worth splitting them before committing
to an approach.

**Where I'd start.** The cheapest experiment that could falsify the plan:

1. Write down the result you expect, in one sentence, before running anything.
2. Build the smallest version that could produce that result.
3. Compare. The gap between expectation and outcome is the actual finding.

**What to watch for.** The failure mode here is optimising the part that is easy to
measure while the real constraint sits somewhere unmeasured. If the numbers improve
and the experience doesn't, that's the tell.

Tell me which part you want to go deeper on and I'll expand it.`;

const pickReply = (prompt: string): string => {
  for (const reply of REPLIES) {
    if (reply.match.test(prompt)) return reply.body;
  }
  return FALLBACK;
};

/**
 * Reasoning mode prepends a short trace before the answer, and research mode
 * appends a source list. Both are mock behaviours here, but they are what the
 * corresponding tools would change about a real request, so the composer
 * toggles drive something real rather than decorating the tray.
 */
const REASONING_PREFIX = `> **Working through it**
>
> 1. Establish what is actually being measured before comparing options.
> 2. Separate the effects that are genuinely independent of each other.
> 3. Check the recommendation against the cheapest case that could disprove it.

`;

const SOURCES_SUFFIX = `

---

**Sources consulted**

1. Internal category performance extract, trailing 13 weeks
2. Regional planogram compliance audit, current quarter
3. Replenishment parameter reference, revision 8

*Mock citations for the demo — a real deployment would link to the systems of record.*`;

/** Splits into word-plus-trailing-whitespace pieces, the granularity a real API streams at. */
const toChunks = (text: string): string[] => text.match(/\s*\S+|\s+/g) ?? [];

export interface StreamHandle {
  onToken: (chunk: string) => void;
  signal: AbortSignal;
  /** When true the stream dies mid-flight, to exercise the error + retry path. */
  injectFailure?: boolean;
  mode?: ReplyMode;
}

export async function streamAssistantReply(
  history: Message[],
  { onToken, signal, injectFailure, mode = 'standard' }: StreamHandle,
): Promise<void> {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const answer = pickReply(lastUser?.content ?? '');
  const body =
    (mode === 'reasoning' ? REASONING_PREFIX : '') +
    answer +
    (mode === 'research' ? SOURCES_SUFFIX : '');
  const chunks = toChunks(body);

  // Reasoning spends longer before the first token, which is the whole point
  // of the mode from the reader's side.
  const think = mode === 'reasoning' ? THINKING_MS * 3 : THINKING_MS;
  await sleep(think + Math.random() * 240, signal);

  const failAt = injectFailure ? Math.floor(chunks.length * (0.12 + Math.random() * 0.14)) : -1;

  for (let i = 0; i < chunks.length; i += 1) {
    if (i === failAt) {
      throw new Error('Connection to the model was interrupted (ERR_STREAM_RESET).');
    }
    onToken(chunks[i]);

    // Jittered cadence, with an occasional longer pause at sentence ends —
    // constant-rate streaming reads as fake.
    const base = 9 + Math.random() * 16;
    const pause = /[.!?:]\s*$/.test(chunks[i]) ? 90 + Math.random() * 130 : 0;
    await sleep(base + pause, signal);
  }
}
