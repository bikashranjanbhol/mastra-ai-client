/**
 * Simulated model backend.
 *
 * Streams a canned reply token-by-token with jittered timing so the transcript,
 * the stop control, the caret and the auto-scroll behaviour can all be exercised
 * without a server. Swapping this for a real endpoint means replacing
 * `streamAssistantReply` — nothing in the UI layer knows the difference.
 */

import type { Message } from '../types';

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
    match: /chunk|embed|retriev|rag|vector|index/i,
    body: `Chunking is the decision that quietly determines your retrieval ceiling, so it's worth doing deliberately rather than reaching for the 512-token default.

### Choosing a strategy

| Strategy | Chunk size | Recall on prose | Recall on tables | Cost / 1M tok |
| --- | ---: | ---: | ---: | ---: |
| Fixed window | 512 | 0.61 | 0.24 | $0.02 |
| Sentence-aware | ~400 | 0.74 | 0.31 | $0.02 |
| Recursive structural | 300–900 | **0.83** | 0.58 | $0.03 |
| Section + summary head | 300–900 | 0.81 | **0.79** | $0.06 |

Two observations from that grid:

1. **Structure beats size.** Every gain in the table comes from respecting document boundaries, not from tuning the window.
2. **Tables need their own path.** A table split across chunks loses its header row and becomes unretrievable noise. Extract them, serialise each to markdown, and prepend the caption.

A reasonable default:

\`\`\`python
def chunk(doc: Document, target: int = 600, overlap: int = 80) -> list[Chunk]:
    """Split on the deepest structural boundary that fits the budget."""
    for level in (Boundary.SECTION, Boundary.PARAGRAPH, Boundary.SENTENCE):
        spans = doc.split(level)
        if all(len(s) <= target * 1.5 for s in spans):
            break
    out, buf = [], []
    for span in spans:
        if sum(map(len, buf)) + len(span) > target and buf:
            out.append(Chunk(text="".join(buf), heading=doc.heading_at(span.start)))
            buf = buf[-overlap:]
        buf.append(span)
    if buf:
        out.append(Chunk(text="".join(buf), heading=doc.heading_at(spans[-1].start)))
    return out
\`\`\`

> Measure before you tune. Build a 50-question eval set from the corpus itself and you will find the answer in an afternoon — guessing at chunk sizes can burn a week.

Want me to sketch the eval harness next?`,
  },
  {
    match: /stream|parser|token|sse|incremental/i,
    body: `Here's the shape I'd reach for — a parser that stays correct when the input arrives in arbitrary fragments.

\`\`\`typescript
type Frame =
  | { kind: 'delta'; text: string }
  | { kind: 'done'; reason: 'stop' | 'length' };

/**
 * Server-sent-event decoder. The tricky part is that a network chunk can end
 * mid-line, mid-event, or even mid-UTF-8-codepoint, so nothing may be assumed
 * about where the boundaries fall.
 */
export class EventDecoder {
  private buffer = '';
  private readonly utf8 = new TextDecoder('utf-8', { fatal: false });

  push(bytes: Uint8Array): Frame[] {
    // \`stream: true\` holds partial codepoints back until they complete.
    this.buffer += this.utf8.decode(bytes, { stream: true });

    const frames: Frame[] = [];
    let boundary = this.buffer.indexOf('\\n\\n');

    while (boundary !== -1) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const frame = this.parseEvent(raw);
      if (frame) frames.push(frame);
      boundary = this.buffer.indexOf('\\n\\n');
    }

    return frames;
  }

  private parseEvent(raw: string): Frame | null {
    const data = raw
      .split('\\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\\n');

    if (!data || data === '[DONE]') return null;

    try {
      const parsed = JSON.parse(data) as {
        delta?: { text?: string };
        stop_reason?: 'stop' | 'length';
      };
      if (parsed.delta?.text) return { kind: 'delta', text: parsed.delta.text };
      if (parsed.stop_reason) return { kind: 'done', reason: parsed.stop_reason };
      return null;
    } catch {
      // A malformed event is recoverable: drop it, keep the connection.
      return null;
    }
  }

  /** Call on connection close to surface anything left in the buffer. */
  flush(): string {
    const tail = this.buffer;
    this.buffer = '';
    return tail;
  }
}
\`\`\`

Three details that matter more than they look:

- \`TextDecoder\` with \`{ stream: true }\` — without it, a codepoint split across two packets renders as \`�\`.
- Events are separated by a **blank line**, not a newline. Splitting on \`\\n\` will cut multi-line \`data:\` payloads in half.
- Never let one bad frame kill the stream. Log it, drop it, keep reading.

Tests worth writing: feed the same fixture one byte at a time and assert the output is identical to feeding it whole.`,
  },
  {
    match: /edit|prose|sentence|draft|chapter|copy|writ/i,
    body: `Read straight through, the passage works. The problems are all at the seams.

**Opening.** The first sentence carries three clauses before it commits to a subject. Cut to the noun:

> ~~Having spent the better part of a decade in the archive, and knowing what the ledgers would say, Aurel opened the box.~~
> **Aurel opened the box. He had spent a decade in the archive; he knew what the ledgers would say.**

**Tense.** Paragraphs 4–7 drift into past perfect and stay there. Past perfect is a doorway, not a room — use it for the first sentence of a flashback, then switch to simple past.

**Repetition.** *Quiet* appears five times in nine hundred words. Two of those are doing real work; the rest are reflex.

**Dialogue.** The attributions are over-specified:

- \`"I don't know," she demurred quietly.\` → \`"I don't know."\`
- \`he expostulated\` → \`he said\`

You have earned enough character voice that the reader can hear who is speaking. Trust it.

**The ending** is the strongest thing here and it arrives too fast. The reveal lands in half a sentence after eight pages of approach. Give it a paragraph of its own and let the room stay silent for a beat.

Want me to mark up the full passage line by line, or work on the ending alone?`,
  },
  {
    match: /sql|query|database|postgres|join|schema/i,
    body: `The plan is going to sequential-scan \`events\` because the predicate isn't sargable — \`date_trunc\` on the column side defeats the index.

\`\`\`sql
-- Before: 4.2s, Seq Scan on events (rows=18,441,203)
SELECT date_trunc('day', created_at) AS day, count(*)
FROM events
WHERE date_trunc('day', created_at) >= now() - interval '30 days'
GROUP BY 1;

-- After: 61ms, Index Scan using events_created_at_idx
SELECT date_trunc('day', created_at) AS day, count(*)
FROM events
WHERE created_at >= date_trunc('day', now() - interval '30 days')
GROUP BY 1
ORDER BY 1;
\`\`\`

Keep the column bare on the left of the comparison and push the arithmetic to the constant side. If you genuinely need the truncated value indexed, build the expression index instead:

\`\`\`sql
CREATE INDEX CONCURRENTLY events_day_idx ON events (date_trunc('day', created_at));
\`\`\`

\`CONCURRENTLY\` avoids the \`ACCESS EXCLUSIVE\` lock — it takes roughly twice as long and cannot run inside a transaction block, which is a fair trade on a live table.`,
  },
  {
    match: /accessib|a11y|aria|screen reader|contrast|keyboard/i,
    body: `The short version: announce **state**, not tokens.

A live region set to \`aria-live="polite"\` on the streaming text itself will queue an utterance for every mutation. On a 400-word response that is several hundred interruptions, and screen reader users will simply leave.

What works:

1. **Mark the message busy.** \`aria-busy="true"\` on the message container while it streams, cleared on completion.
2. **Announce transitions in a separate region.** One \`role="status"\` node that says *"Response in progress"*, then *"Response complete, 312 words"*.
3. **Make the text reachable afterwards.** The finished message must be ordinary, navigable content — not a region that only announced once and vanished.
4. **Respect \`prefers-reduced-motion\`.** The blinking caret is decoration; drop it to a static block.

| Element | Role | Live behaviour |
| --- | --- | --- |
| Transcript | \`log\` | \`aria-live="polite"\` |
| Streaming message | \`article\` | \`aria-busy\` while active |
| Status line | \`status\` | transitions only |
| Stop button | \`button\` | label swaps with state |

Contrast is the other half. Muted text at #6B6355 on #F3EFE6 clears 4.5:1; anything lighter fails AA at body size no matter how good it looks in the mock.`,
  },
];

const FALLBACK = `Good question — let me take it in three parts.

**What's actually being asked.** Underneath the phrasing there are two separable problems, and they have different answers. Worth splitting them before committing to an approach.

**Where I'd start.** The cheapest experiment that could falsify the plan:

1. Write down the result you expect, in one sentence, before running anything.
2. Build the smallest version that could produce that result.
3. Compare. The gap between expectation and outcome is the actual finding.

**What to watch for.** The failure mode here is optimising the part that's easy to measure while the real constraint sits somewhere unmeasured. If the numbers improve and the experience doesn't, that's the tell.

Tell me which part you want to go deeper on and I'll expand it.`;

const pickReply = (prompt: string): string => {
  for (const reply of REPLIES) {
    if (reply.match.test(prompt)) return reply.body;
  }
  return FALLBACK;
};

/** Splits into word-plus-trailing-whitespace pieces, the granularity a real API streams at. */
const toChunks = (text: string): string[] => text.match(/\s*\S+|\s+/g) ?? [];

export interface StreamHandle {
  onToken: (chunk: string) => void;
  signal: AbortSignal;
  /** When true the stream dies mid-flight, to exercise the error + retry path. */
  injectFailure?: boolean;
}

export async function streamAssistantReply(
  history: Message[],
  { onToken, signal, injectFailure }: StreamHandle,
): Promise<void> {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const body = pickReply(lastUser?.content ?? '');
  const chunks = toChunks(body);

  await sleep(THINKING_MS + Math.random() * 240, signal);

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
