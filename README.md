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

No backend required. Responses come from a simulated streaming model
(`src/lib/mockModel.ts`); state lives in memory only. All figures, store numbers
and items in the sample conversations are invented for the demo.

---

## Before this ships — brand kit items not included here

Four things are deliberately left as placeholders rather than approximated. All
four are marked in `src/brand.ts`.

| Item | Status | What to do |
| --- | --- | --- |
| **Bogle** | Not bundled — licensed | Named first in the font stack, so it is used wherever installed. Add the licensed web fonts to `public/fonts/` and an `@font-face` block. Fallback today is Helvetica Neue → Arial. |
| **The Spark mark** | Placeholder | `BrandMark` draws a neutral shape. Drop the official SVG in and delete the placeholder — it should not be traced or redrawn. |
| **Product name** | Working title | `BRAND.productName` in `src/brand.ts`. |
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
**Corners** — controls 8px, containers 12px, buttons and chips fully round.
**Elevation** — two shadow tokens, both soft and low. Cards and code listings take
`--shadow-raised`; only the jump-to-latest control lifts to `--shadow-pop`.

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

```
┌──────────────────────────────────────────────────────────┐
│ app bar — True Blue, full width, brand + global controls │
├───────────┬──────────────────────────────┬───────────────┤
│ chat list │ chat title                   │ details       │
│ 256px     ├──────────────────────────────┤ questions ↵   │
│           │ transcript                   │ files         │
│           ├──────────────────────────────┤ 288px         │
│           │ composer                     │               │
└───────────┴──────────────────────────────┴───────────────┘
```

Three decisions worth knowing:

- **The window is used all the way across.** An earlier revision bounded the
  transcript and left the surplus empty; that space is now the context panel, which
  is where a 126-message review actually needs help.
- **The brand is carried by the chrome.** A full-width blue app bar is what makes the
  product recognisable at a glance — leaving the colour on a couple of buttons is what
  made the earlier revision read as generic.
- **Density is the point.** 15px body at 1.55, message rows at 12px vertical padding,
  two-line chat rows. This is a tool someone has open all day, not a landing page.

Message identity sits on a compact header line — a 20px speaker mark, the name, the
time, the version — with that row's actions revealed on hover **and** on focus-within,
so they stay in the tab order without adding permanent clutter to every row.

Breakpoints: the context panel is hidden below 1180px rather than squeezed, and below
900px the chat list becomes a scrim drawer.

## Architecture

```
src/
  brand.ts            product name, labels, and the brand-kit checklist above
  index.css           all colour, type, radius and elevation tokens
  lib/markdown.ts     block + inline parser, tolerant of half-written input
  lib/highlight.ts    tokenizer-based highlighter (ts/js, python, sql, bash, css,
                      html, rust, go, json)
  lib/mockModel.ts    simulated streaming, jittered cadence, injectable faults
  lib/seed.ts         three sample conversations
  hooks/useChat.ts    conversation state machine; tokens buffered and flushed once
                      per animation frame rather than once per token
  hooks/useVirtualList.ts   windowed rendering with ResizeObserver-measured heights
  hooks/useTheme.ts   system / light / dark, resolved onto <html data-theme>
  components/TopBar.tsx        the blue app bar; where the brand lives
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
