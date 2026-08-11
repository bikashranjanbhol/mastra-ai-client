# Walmart Assistant

An internal chat client, laid out as a three-zone workspace: chat list on the left,
transcript in the middle, and a context panel on the right that indexes every
question in the conversation as a jump link.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run typecheck
```

Talks to **mastra-ai-service** over its HTTP API, and falls back to a built-in
simulator when that service is unreachable — saying so in the header rather than
failing silently.

```bash
cp .env.example .env       # defaults point at http://localhost:4111/api
npm run dev
```

---

## Backend integration

The client is wired to [mastra-ai-service](https://github.com/bikashranjanbhol/mastra-ai-service)
(Mastra v1). Every route below was read from the running server's own OpenAPI
document (`GET /api/openapi.json`) and exercised against a live instance — none
of it is transcribed from documentation.

| What the UI does | Endpoint |
| --- | --- |
| Connect, name the agent | `GET /agents` |
| Provider key status in the picker | `GET /agents/providers` |
| Send a message, stream the reply | `POST /agents/{agentId}/stream` |
| Stop generating | `POST /agents/{agentId}/threads/abort` |
| Chat list | `GET /memory/threads` |
| New chat (on first send) | `POST /memory/threads` |
| Rename | `PATCH /memory/threads/{threadId}` |
| Delete | `DELETE /memory/threads/{threadId}` |
| Load a chat | `GET /memory/threads/{threadId}/messages` |
| Regenerate / edit-and-resend | `POST /memory/messages/delete` |

Two identifier conventions differ on the server and are easy to get wrong:
**agents are addressed by their `id`** (`docs-agent`), while **workflows are
addressed by their registry key** (`triageAndFileWorkflow`, not `triage-and-file`).

### The stream

`POST /agents/{id}/stream` returns `text/event-stream`: one JSON object per
`data:` line, terminated by `data: [DONE]`. The frames the client acts on:

```
start · step-start
text-start · text-delta · text-end                 → the answer
reasoning-start · reasoning-delta · reasoning-end   → the Reasoning disclosure
tool-call-input-streaming-start · tool-call-delta
tool-call · tool-result · tool-error                → the tool trace
step-finish · finish                                → token usage, model id
error · abort
```

`src/lib/api/sse.ts` decodes this incrementally: a network chunk can end
mid-line, mid-event or mid-UTF-8-codepoint, so nothing is assumed about where
boundaries fall, and one malformed frame is dropped rather than killing the
connection.

### Model selection

The service is provider-agnostic — an agent's model is resolved per request from
`provider` and `tier` on Mastra's request context. So the picker sets those two
rather than a model name, and marks which providers the server actually holds a
key for. `fallback: 'off'` pins a single provider when a failure needs to be
attributable.

### Threads are created lazily

A new chat is local until its first message; only then is a thread created. An
earlier version created one on every page load, which left empty "New chat"
threads in the database that then outranked real conversations by `updatedAt`.

### What the composer tools map to

- **Reasoning** requests the service's `reasoning` tier, which falls back to
  flagship where a provider has no distinct reasoning model.
- **Deep Research** is a prompt-level instruction to search exhaustively and
  cite passage ids. The service has no research mode, so this is honest about
  being prompting rather than a separate capability.

### Verified against a live model

The integration was run end to end against Google Gemini through the service:
multi-step tool calling (two `search_docs` calls followed by `create_ticket`),
citations, the reasoning tier, regenerate, stop, thread persistence across a
reload, rename and delete. Screenshots of that run are in the branch history.

> **Service-side fix needed.** The service pins retired Gemini model ids, so a
> valid Google key still fails with *"This model models/gemini-2.5-flash is no
> longer available to new users"*. In `mastra-ai-service`, at
> `src/mastra/config/models.ts`:
>
> ```diff
> -    models: { fast: 'gemini-2.5-flash', flagship: 'gemini-2.5-pro' },
> +    models: { fast: 'gemini-flash-latest', flagship: 'gemini-3.5-flash' },
> ```
>
> Both replacements were confirmed to serve `generateContent` on a free-tier
> key. `gemini-pro-latest` returns 429 on the free tier, so it is a poor
> flagship default.

### Known limits

- `GET /memory/search` exists and is called, but the service's agents are not
  configured with semantic recall, so it returns nothing. Sidebar search filters
  loaded threads instead.
- Attachments are collected and displayed but not uploaded; the stream call
  sends text only.
- `resourceId` is a fixed demo user (`VITE_RESOURCE_ID`). Every browser shares
  one history until it is wired to a real session.

## Before this ships — brand kit items not included here

Five things are deliberately left as placeholders rather than approximated. All
are marked in `src/brand.ts`.

| Item | Status | What to do |
| --- | --- | --- |
| **Bogle** | Not bundled — licensed | Named first in the font stack, so it is used wherever installed. Add the licensed web fonts to `public/fonts/` and an `@font-face` block. Fallback today is Helvetica Neue → Arial. |
| **The Spark mark** | Original stand-in | `BrandMark` draws an original glyph — three ascending bars capped by a dot — *not* the Spark, which is a registered trademark and should not be traced from memory. Swap the glyph for the official SVG and every use follows, including the speaker marks and `public/favicon.svg`. |
| **Product name** | Working title | `BRAND.productName` in `src/brand.ts`. |
| **Signed-in user** | Fixture | `demoUser` in `src/brand.ts` feeds the sidebar footer. Wire it to the real session once auth exists. |
| **Semantic + dark tokens** | Derived here | True Blue, Spark Yellow and Bentonville Blue are the published core. Success, warning, danger and the whole dark theme were derived for contrast, not taken from the internal design system. Reconcile them. |

## Design tokens

The core palette is the published Walmart set. Everything else is derived and
tuned for contrast.

| Token | Light | Dark |
| --- | --- | --- |
| accent (True Blue) | `#0071DC` | `#4DA6FF` |
| accent-text | `#0053A0` | `#7CC0FF` |
| highlight (Spark Yellow) | `#FFC220` | `#FFC220` |
| ink (Bentonville Blue) | `#041E42` | `#E9F1FA` |
| surface / desk | `#EEF2F7` | `#01152E` |
| raised / sheet | `#FFFFFF` | `#041E42` |
| border | `#D9E0E8` | `#1B3C6B` |
| muted | `#59657A` | `#A2B6CD` |
| success | `#1A7F37` | `#56C271` |
| danger | `#B3122B` | `#FF8B9A` |

**Type** — Bogle → Helvetica Neue → Arial → system-ui. Monospace is used only for
code listings and inline code.
**Spacing** — 4px base: 4 / 8 / 12 / 16 / 24 / 32 / 48.
**Corners** — controls 12px, cards 18px, buttons and chips fully round.
**Elevation** — three soft tokens. `--shadow-card` lifts the floating panels,
`--shadow-raised` sits under code listings and tables, `--shadow-pop` is only for
the jump-to-latest control.

### Two contrast rules worth keeping

- **Spark Yellow is ~1.7:1 on white.** It is a fill and an indicator colour only —
  never text, never a border carrying meaning by itself. It is used here for the
  callout rule and the speaker mark.
- **White on True Blue is 4.78:1.** That passes AA with no headroom, so any blue
  text on a tinted surface uses `--accent-text` (`#0053A0`) instead of the brand
  blue. In dark mode the accent lightens, so text placed on it flips to
  Bentonville Blue via `--on-accent`.

Measured across fourteen token pairs in both themes, the lowest ratio is 4.52:1
against a WCAG AA bar of 4.5. `npm run dev` and the audit script in the repo
history reproduce the numbers.

## Layout

Built to a supplied reference: floating rounded cards on a soft page, a centred
welcome with an orb and greeting, and a large composer with a tool tray.

```
┌ page ────────────────────────────────────────────────────────┐
│ ┌ chat list ─┐ ┌ main card ───────────────┐ ┌ context card ┐ │
│ │ wordmark   │ │ [model ▾]   [☾][▤][+New] │ │ details      │ │
│ │ search ⌘K  │ │                          │ │ questions ↵  │ │
│ │ Today      │ │   orb + greeting         │ │ files        │ │
│ │ Yesterday  │ │   ┌ composer ─────────┐  │ │              │ │
│ │ Prev 7 days│ │   │ ✦ prompt          │  │ │              │ │
│ │            │ │   │ 📎 Reasoning  … ↑ │  │ │              │ │
│ │ [user]     │ │   └───────────────────┘  │ │              │ │
│ └────────────┘ └──────────────────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- **Welcome state** shows the orb, a time-of-day greeting, four openings and the
  composer, with the context card hidden so nothing competes with it. Once a chat
  has messages the transcript takes over and the composer docks to the foot.
- **The chat list groups by recency** — Today / Yesterday / Previous 7 days — which
  is what makes a long history scannable.
- **The orb and the glow under the composer are decorative only.** Both are
  `aria-hidden`, carry no state, and are built from layered radial washes rather
  than a linear gradient, so they read as light rather than as a painted band.

### The tool chips do something

`Reasoning` and `Deep Research` are wired to the request, not decoration:
reasoning spends three times as long before the first token and prepends its
working; research appends the sources consulted. Exactly one can be active, so the
tray is a mode switch rather than a set of independent flags. The mode is stored on
the reply, so regenerating a turn reuses whichever tool produced it.

### On the reference's accent

The reference is indigo. This is built in True Blue because the brand requirement
came first — swapping it back is one token (`--accent` in `index.css`) plus its
dark-theme counterpart.

## Architecture

```
src/
  brand.ts            product name, labels, and the brand-kit checklist above
  index.css           all colour, type, radius and elevation tokens
  lib/markdown.ts     block + inline parser, tolerant of half-written input
  lib/highlight.ts    tokenizer-based highlighter (ts/js, python, sql, bash, css,
                      html, rust, go, json)
  lib/api/config.ts   base URL, agent id, resource id, request-context keys
  lib/api/http.ts     fetch wrapper, ApiError, timeouts
  lib/api/sse.ts      incremental server-sent-event decoder
  lib/api/agents.ts   agent list, providers, stream, abort
  lib/api/memory.ts   threads, messages, and the stored-format mapping
  lib/mockModel.ts    offline simulator, jittered cadence, injectable faults
  lib/seed.ts         sample conversations for the offline path
  hooks/useChat.ts    conversation state machine; tokens buffered and flushed once
                      per animation frame rather than once per token
  hooks/useVirtualList.ts   windowed rendering with ResizeObserver-measured heights
  hooks/useTheme.ts   system / light / dark, resolved onto <html data-theme>
  components/BrandMark.tsx     product mark, speaker marks, user avatar
  components/ChatHeader.tsx    provider/tier picker, connection badge, New Chat
  components/ToolTrace.tsx     the agent's tool calls, expandable
  components/WelcomeHero.tsx   orb, greeting, opening prompts
  components/ContextPanel.tsx  details, question jump-links, files
  components/         shell, transcript, composer, markdown renderer
```

A rebrand touches `src/brand.ts` and the token block at the top of `index.css`.
The information design — the three zones, the docked composer, the transcript
behaviour — lives in the components and does not move when those change.

The markdown parser is hand-rolled for one reason: streaming text is almost always
syntactically broken. An unclosed fence, a table with one row so far, a bold run with
only its opening asterisks. Every path degrades to plain text rather than dropping the
partial block, and an unterminated fence reports itself as `open` so the code listing
keeps rendering as it arrives.

## Behaviour worth knowing

- **Virtualization** engages above 100 messages. The seeded Region 14 conversation has
  126 messages; roughly 10 rows are in the DOM at a time.
- **Question jump-links** work across the virtualized window: the scroll goes to the
  target row's computed offset first, then centres exactly once the row mounts.
- **Auto-scroll** follows new text only while you are already within 96px of the foot.
  Scroll up and a *Jump to latest* control appears.
- **Screen readers** are told about state, not tokens: the streaming message carries
  `aria-busy`, and a separate `role="status"` region announces "Response in progress"
  and "Response complete, N words" — a live region on the text itself would queue
  hundreds of interruptions per reply.
- **Simulate dropped connection** (sidebar footer) arms a one-shot mid-stream failure
  so the error and retry path can be demonstrated.
- **Stopping** aborts the fetch *and* calls the service's abort endpoint. Aborting
  only locally leaves the model call running and billing.
- **Tool calls are shown**, not hidden: the docs agent must search before it
  answers, so the retrieval step is part of the answer's provenance and can be
  expanded to see exactly which passages came back.

## Keyboard

| | |
| --- | --- |
| `⌘/Ctrl + K` | search chats |
| `⌘/Ctrl + B` | collapse or expand the chat list |
| `⌘/Ctrl + J` | collapse or expand the context panel |
| `⌘/Ctrl + ⇧ + O` | new chat |
| `Enter` / `⇧ + Enter` | send / newline |
| `⌘/Ctrl + Enter` | resend while editing a message |
| `Esc` | stop generation, cancel an edit, close the drawer |
