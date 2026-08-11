# Marginalia

A chat client for researchers and long-form writers. The conversation is set as a
**critical edition** — a text column with an editorial margin. Every turn is an entry
with an apparatus, not a bubble.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run typecheck
```

No backend required. Responses come from a simulated streaming model
(`src/lib/mockModel.ts`); state lives in memory only.

## Design spec

The build follows this spec exactly; it was written before any code.

**Type.** Display and body: Iowan Old Style → Palatino → Georgia. Chrome and meta:
`ui-monospace`. There is no sans-serif anywhere in the product.

**Colour.**

| Token | Light | Dark |
| --- | --- | --- |
| surface | `#F3EFE6` | `#141210` |
| raised | `#FBF8F1` | `#1D1A16` |
| border | `#DAD2C2` | `#332E26` |
| text-primary | `#1C1917` | `#EDE6D8` |
| text-muted | `#6B6355` | `#9C9384` |
| accent (rubric) | `#B4451F` | `#E2734A` |
| success | `#2F6B4F` | `#74AE8E` |
| danger | `#8E1F2B` | `#E4788A` |

Measured contrast, both themes: muted-on-paper ≥ 5.17:1, primary-on-paper ≥ 15:1,
every semantic colour ≥ 5.19:1 — all clear of WCAG AA.

**Spacing** 4px base — 4 / 8 / 12 / 16 / 24 / 32 / 48.
**Radius** 0 for structure, 2px for controls, never more.
**Elevation** No shadows. Depth is 1px rules plus a paper-tone shift. The mobile
drawer scrim is the only exception.

**The unconventional decision.** A persistent 132px left margin rail carries role,
timestamp, revision and per-message actions. No avatars, no bubbles, no hover-revealed
toolbars — every action is visible at rest. *Tradeoff:* it costs horizontal space and
forces a stacked fallback below 900px, where the rail becomes a strip above the text.

## How the anti-patterns were avoided

- **Not a centred column with a floating pill.** The sheet is left-aligned and bounded
  at 64rem; past that the surplus stays visible as desk. The composer is a full-bleed
  slab docked flush to the foot of the sheet, square, separated by a single rule, and
  repeats the transcript's margin rail so a draft reads as the next entry.
- **No gradients, no glassmorphism, no Inter-on-white.** Warm paper, ink, one rubric
  accent; flat fills and hairlines only.
- **No emoji.** Iconography is lucide-react at 12–14px plus two hand-drawn SVG sigils.
- **Avatars are not lettered circles.** A filled notched square for the reader, an open
  square with a rule through it for the responder — distinguishable by shape alone,
  in monochrome, at 12px.
- **Roles differ by more than background.** Your turns are italic serif behind a rubric
  vertical rule; responses are upright serif on the bare sheet, with different rail
  marks and different rail actions.

## Architecture

```
src/
  lib/markdown.ts     block + inline parser, tolerant of half-written input
  lib/highlight.ts    tokenizer-based highlighter (ts/js, python, sql, bash, css,
                      html, rust, go, json)
  lib/mockModel.ts    simulated streaming, jittered cadence, injectable faults
  lib/seed.ts         three sample conversations
  hooks/useChat.ts    conversation state machine; tokens buffered and flushed once
                      per animation frame rather than once per token
  hooks/useVirtualList.ts   windowed rendering with ResizeObserver-measured heights
  hooks/useTheme.ts   system / light / dark, resolved onto <html data-theme>
  components/         shell, transcript, composer, markdown renderer
```

The markdown parser is hand-rolled for one reason: streaming text is almost always
syntactically broken. An unclosed fence, a table with one row so far, a bold run with
only its opening asterisks. Every path degrades to plain text rather than dropping the
partial block, and an unterminated fence reports itself as `open` so the code listing
keeps rendering as it arrives.

## Behaviour worth knowing

- **Virtualization** engages above 100 messages. The seeded "Chapter 7" conversation has
  126 turns; roughly 9 rows are in the DOM at a time.
- **Auto-scroll** follows new text only while you are already within 96px of the foot.
  Scroll up and a *Jump to latest* control appears.
- **Screen readers** are told about state, not tokens: the streaming message carries
  `aria-busy`, and a separate `role="status"` region announces "Response in progress" and
  "Response complete, N words" — a live region on the text itself would queue hundreds of
  interruptions per reply.
- **Simulate dropped connection** (sidebar footer) arms a one-shot mid-stream failure so
  the error and retry path can be exercised.

## Keyboard

| | |
| --- | --- |
| `⌘/Ctrl + K` | search the index |
| `⌘/Ctrl + B` | collapse or expand the index |
| `⌘/Ctrl + ⇧ + O` | new entry |
| `Enter` / `⇧ + Enter` | send / newline |
| `⌘/Ctrl + Enter` | resend while editing a turn |
| `Esc` | stop generation, cancel an edit, close the drawer |
