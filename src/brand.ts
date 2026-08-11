/**
 * Brand layer.
 *
 * Everything brand-specific is named here or in the token block at the top of
 * `index.css`. The product's information design — the margin rail, the docked
 * composer, the transcript behaviour — lives in the components and does not
 * change when this file does.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BEFORE SHIPPING, replace with values from the official brand kit:
 *
 *   1. Typeface. Bogle is licensed, not redistributable, and is not bundled
 *      here. The stack in index.css names it first, so it is picked up on any
 *      machine that has it installed; add the licensed web fonts to
 *      `public/fonts/` and an @font-face block to use it in the browser.
 *   2. The Spark mark. `BrandMark` renders a neutral placeholder. Drop the
 *      official SVG in and delete the placeholder — do not trace or redraw it.
 *   3. Product name. `productName` below is a working title.
 *   4. Semantic colours. True Blue, Spark Yellow and Bentonville Blue are the
 *      published core palette. The success/warning/danger values and the whole
 *      dark theme are derived here for contrast, not taken from the internal
 *      design system — reconcile them with it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const BRAND = {
  org: 'Walmart',
  productName: 'Walmart Assistant',
  /** Used where the full name will not fit — the collapsed rail, the tab title. */
  shortName: 'Assistant',
  /** Shown under the wordmark in the sidebar. */
  descriptor: 'Internal · Associate tools',
  /** What the model calls itself in the transcript rail. */
  assistantLabel: 'Assistant',
  userLabel: 'You',
} as const;
