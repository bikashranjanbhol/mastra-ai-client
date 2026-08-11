import type { Conversation, Message } from '../types';

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

/* ------------------------------------------------ 1. retrieval, with a table */

const retrievalStart = now - 2 * HOUR;

const retrieval: Conversation = {
  id: uid('conv'),
  title: 'Chunking a 400-page corpus',
  createdAt: retrievalStart,
  updatedAt: retrievalStart + 14 * MINUTE,
  messages: [
    turn(
      'user',
      "I have ~400 pages of scanned municipal reports, OCR'd, lots of tables. I need retrieval over them. What chunking strategy should I use?",
      retrievalStart,
      {
        attachments: [
          { id: uid('att'), name: 'city-reports-1998-2024.pdf', size: 41_582_336, kind: 'other' },
        ],
      },
    ),
    turn(
      'assistant',
      `Scanned + tabular is the hard case, so the usual advice ("512 tokens, 50 overlap") will underperform badly here. Let me separate the two problems.

### The measurements

I ran the four common strategies against a similar corpus last year. Recall@5 on a 50-question eval set:

| Strategy | Chunk size | Recall on prose | Recall on tables | Index cost |
| --- | ---: | ---: | ---: | ---: |
| Fixed window | 512 tok | 0.61 | 0.24 | 1.0× |
| Sentence-aware | ~400 tok | 0.74 | 0.31 | 1.0× |
| Recursive structural | 300–900 tok | **0.83** | 0.58 | 1.4× |
| Section + summary head | 300–900 tok | 0.81 | **0.79** | 2.8× |

The gap in the *tables* column is the whole story. A table cut in half loses its header row, and a table body without headers is close to unretrievable — the numbers no longer have names attached to them.

### What I'd actually do

1. **Extract tables before chunking.** Serialise each one to markdown, keep the caption and the preceding heading, and store it as a single atomic chunk regardless of length.
2. **Chunk the remaining prose on structure** — section, then paragraph, then sentence — taking the deepest boundary that fits your budget.
3. **Prepend the heading path** to every chunk. \`1998 Annual Report › Section 4 › Water Utility\` costs you twelve tokens and buys a great deal of disambiguation across 26 years of near-identical documents.
4. **Keep OCR confidence as metadata** so you can filter out the garbage pages instead of letting them pollute the neighbourhood.

> Do step 1 before you tune anything else. On a table-heavy corpus it is worth more than every other adjustment combined.`,
      retrievalStart + 3 * MINUTE,
    ),
    turn(
      'user',
      'The heading path idea is interesting. Does that hurt embedding quality by adding boilerplate?',
      retrievalStart + 9 * MINUTE,
    ),
    turn(
      'assistant',
      `A little, and it's worth it — but there's a way to get most of the benefit without the cost.

Prepended headings do drag chunks from the same section toward each other in embedding space, which slightly flattens *within-section* ranking. In practice that mattered for about 4% of queries in my eval, and the disambiguation gain was much larger than that.

If you want both: **embed without the heading, retrieve, then attach the heading when you assemble the context.** The heading path matters to the model reading the chunk, not to the vector index. Two lines of code, no downside.

The one exception is when queries name a section explicitly ("what did the *water utility* section say"). If that's a common pattern in your traffic, keep the heading in the embedding and accept the flattening.`,
      retrievalStart + 11 * MINUTE,
    ),
  ],
};

/* -------------------------------------------- 2. streaming parser, long code */

const parserStart = now - 26 * HOUR;

const parser: Conversation = {
  id: uid('conv'),
  title: 'SSE decoder that survives split packets',
  createdAt: parserStart,
  updatedAt: parserStart + 21 * MINUTE,
  messages: [
    turn(
      'user',
      "My SSE client drops characters under load and occasionally renders a replacement glyph. It works fine locally. What's wrong?",
      parserStart,
    ),
    turn(
      'assistant',
      `Both symptoms point at the same root cause: you're treating network chunks as if they respected message boundaries. They don't. Under load the packets get smaller and the assumption breaks.

Specifically, a single \`ReadableStream\` chunk can end:

- mid-line,
- mid-event (between \`data:\` lines of the same event),
- and mid-UTF-8-codepoint — which is exactly where your \`�\` comes from.

Here's a decoder that handles all three. The buffer is the entire trick:

\`\`\`typescript
type Frame =
  | { kind: 'delta'; text: string }
  | { kind: 'done'; reason: 'stop' | 'length' }
  | { kind: 'error'; message: string };

interface RawEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Incremental server-sent-event decoder.
 *
 * Feed it bytes as they arrive; it emits whole events only. Nothing is assumed
 * about where chunk boundaries fall, which is the property that makes it
 * correct under packet fragmentation.
 */
export class EventDecoder {
  private buffer = '';
  private lastEventId: string | undefined;
  private readonly decoder = new TextDecoder('utf-8', { fatal: false });

  push(bytes: Uint8Array): Frame[] {
    // { stream: true } holds an incomplete codepoint back until the rest of it
    // arrives, instead of emitting U+FFFD. This is the replacement-glyph fix.
    this.buffer += this.decoder.decode(bytes, { stream: true });

    const frames: Frame[] = [];

    for (;;) {
      const boundary = this.findBoundary();
      if (boundary === -1) break;

      const block = this.buffer.slice(0, boundary.start);
      this.buffer = this.buffer.slice(boundary.end);

      const raw = this.parseBlock(block);
      if (raw) {
        const frame = this.toFrame(raw);
        if (frame) frames.push(frame);
      }
    }

    return frames;
  }

  /** Events are separated by a blank line, in any newline convention. */
  private findBoundary(): { start: number; end: number } | -1 {
    const match = /\\r\\n\\r\\n|\\n\\n|\\r\\r/.exec(this.buffer);
    if (!match) return -1;
    return { start: match.index, end: match.index + match[0].length };
  }

  private parseBlock(block: string): RawEvent | null {
    const raw: RawEvent = { event: 'message', data: '' };
    const dataLines: string[] = [];

    for (const line of block.split(/\\r\\n|\\n|\\r/)) {
      if (!line || line.startsWith(':')) continue; // comment / keep-alive

      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      switch (field) {
        case 'event':
          raw.event = value;
          break;
        case 'data':
          dataLines.push(value);
          break;
        case 'id':
          if (!value.includes('\\0')) raw.id = value;
          break;
        case 'retry': {
          const ms = Number(value);
          if (Number.isInteger(ms)) raw.retry = ms;
          break;
        }
        default:
          break; // unknown fields are ignored by spec
      }
    }

    if (!dataLines.length) return null;
    raw.data = dataLines.join('\\n');
    if (raw.id) this.lastEventId = raw.id;
    return raw;
  }

  private toFrame(raw: RawEvent): Frame | null {
    if (raw.data === '[DONE]') return { kind: 'done', reason: 'stop' };

    try {
      const parsed = JSON.parse(raw.data) as {
        delta?: { text?: string };
        stop_reason?: 'stop' | 'length';
        error?: { message: string };
      };

      if (parsed.error) return { kind: 'error', message: parsed.error.message };
      if (parsed.delta?.text) return { kind: 'delta', text: parsed.delta.text };
      if (parsed.stop_reason) return { kind: 'done', reason: parsed.stop_reason };
      return null;
    } catch {
      // One malformed event must not take down the connection.
      return null;
    }
  }

  /** Header value for resuming after a drop. */
  get resumeToken(): string | undefined {
    return this.lastEventId;
  }

  /** Call when the socket closes; surfaces a trailing event with no blank line after it. */
  flush(): Frame[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const raw = this.parseBlock(this.buffer);
    this.buffer = '';
    if (!raw) return [];
    const frame = this.toFrame(raw);
    return frame ? [frame] : [];
  }
}
\`\`\`

And the read loop, which is where people usually reintroduce the bug:

\`\`\`typescript
export async function* readEvents(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<Frame> {
  const body = response.body;
  if (!body) throw new Error('response has no body');

  const reader = body.getReader();
  const decoder = new EventDecoder();

  signal.addEventListener('abort', () => void reader.cancel(), { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of decoder.push(value)) yield frame;
    }
    for (const frame of decoder.flush()) yield frame;
  } finally {
    reader.releaseLock();
  }
}
\`\`\`

### The test that would have caught this

Take a recorded response and feed it to the decoder **one byte at a time**, then feed it whole, and assert the two outputs are identical. That single property test covers every fragmentation case you'll see in production, including the multi-byte codepoint split.`,
      parserStart + 4 * MINUTE,
    ),
    turn(
      'user',
      'Why `for (;;)` instead of `while (true)`? Style, or is there a reason?',
      parserStart + 18 * MINUTE,
    ),
    turn(
      'assistant',
      `Style, mostly — but with one practical edge.

\`while (true)\` trips \`no-constant-condition\` in default ESLint configs, so codebases either disable the rule or write \`for (;;)\`, which is explicitly exempted. TypeScript treats them identically for narrowing and reachability analysis.

Use whichever your codebase already uses. Consistency is the only real argument here.`,
      parserStart + 21 * MINUTE,
    ),
  ],
};

/* --------------------------- 3. long conversation, to exercise virtualization */

const NOTES: Array<[string, string]> = [
  [
    'Paragraph {n} still opens on a subordinate clause. Can it lead with the subject?',
    `Yes — and it should. The clause is doing scene-setting work that the previous paragraph already did.

> ~~Having waited through the long afternoon, she finally spoke.~~
> **She finally spoke.**

The waiting is established. Repeating it costs you the sentence's momentum for information the reader already holds.`,
  ],
  [
    'Is "{word}" overused in section {n}?',
    `Six occurrences in about eleven hundred words. Two are load-bearing; the rest are reflex.

Keep the one in the opening image and the one in the final line — they bracket the section deliberately. Replace the middle four with something concrete: what the character actually hears, rather than the absence of sound.`,
  ],
  [
    'The dialogue in scene {n} reads stilted to me. Diagnosis?',
    `Two causes, both fixable.

1. **Every line is a complete sentence.** Real speech fragments, interrupts, and trails off. Break three or four of these mid-thought.
2. **The attributions are over-specified.** \`she demurred\`, \`he expostulated\`, \`they countered\` — swap them all for \`said\` and delete half. The reader can hear who is speaking.`,
  ],
  [
    'Does the tense shift in paragraph {n} work, or is it a mistake?',
    `It works, but only because it's brief. Past perfect is a doorway, not a room: one sentence to enter the earlier moment, then simple past for the duration of it.

Right now you stay in past perfect for four sentences, which starts to feel like a grammatical hum under the prose. Convert sentences two through four to simple past and leave the first as the hinge.`,
  ],
  [
    'Cut or keep the flashback at {n}?',
    `Keep it, move it earlier.

The information it delivers is needed two pages before it currently arrives, and the reader spends that gap mildly confused about a relationship the flashback would have clarified. Moving it costs nothing structurally — the scene it interrupts has a natural seam right after the door closes.`,
  ],
  [
    'Rhythm check on the closing lines of chapter section {n}?',
    `The last three sentences are all the same length, which flattens the landing.

Try shortening the final one hard. A four-word sentence after two long ones reads as a full stop in a way that punctuation alone can't achieve. You did this well at the end of section two — same move works here.`,
  ],
];

const WORDS = ['quiet', 'suddenly', 'somehow', 'almost', 'seemed', 'gently'];

const copyeditStart = now - 6 * DAY;

const buildCopyedit = (): Message[] => {
  const messages: Message[] = [];
  let t = copyeditStart;

  messages.push(
    turn(
      'user',
      `Copyediting pass on chapter 7 of the novel. I'll go section by section — call out anything that's a pattern rather than a one-off. Draft attached.`,
      t,
      {
        attachments: [
          { id: uid('att'), name: 'ch07-draft-v4.md', size: 74_218, kind: 'text' },
          { id: uid('att'), name: 'style-sheet.md', size: 4_902, kind: 'text' },
        ],
      },
    ),
  );
  t += 2 * MINUTE;

  messages.push(
    turn(
      'assistant',
      `Read straight through once before marking anything. Three patterns stand out across the whole chapter:

1. **Subordinate-clause openings.** Roughly one paragraph in three starts with a participial or temporal clause. Individually fine; at that density it becomes a tic that softens every entry point.
2. **Adverbial hedging in dialogue attribution.** *quietly, almost, somehow* — these appear where the line itself is already doing the work.
3. **Uniform sentence length at section ends.** Every section closes on three medium sentences. The endings blur together as a result.

Send sections as you get to them and I'll work at the line level.`,
      t,
    ),
  );
  t += 4 * MINUTE;

  // ~62 exchanges → ~126 messages total, comfortably past the virtualization threshold.
  for (let n = 1; n <= 62; n += 1) {
    const [q, a] = NOTES[n % NOTES.length];
    const prompt = q.replace('{n}', String(n)).replace('{word}', WORDS[n % WORDS.length]);
    messages.push(turn('user', prompt, t));
    t += 90_000 + (n % 5) * 45_000;
    messages.push(
      turn('assistant', a.replace(/\{n\}/g, String(n)), t, n % 9 === 0 ? { revision: 2 } : {}),
    );
    t += 3 * MINUTE + (n % 7) * MINUTE;
  }

  return messages;
};

const copyeditMessages = buildCopyedit();

const copyedit: Conversation = {
  id: uid('conv'),
  title: 'Chapter 7 — line edit',
  createdAt: copyeditStart,
  updatedAt: copyeditMessages[copyeditMessages.length - 1].createdAt,
  messages: copyeditMessages,
};

export const seedConversations: Conversation[] = [retrieval, parser, copyedit];
