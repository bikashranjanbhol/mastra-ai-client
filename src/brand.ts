/**
 * Brand layer.
 *
 * Everything brand-specific is named here or in the token block at the top of
 * `index.css`. The product's information design lives in the components and
 * does not change when this file does.
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
 *   5. The signed-in user. `demoUser` is fixture data for the demo; wire the
 *      sidebar footer to the real session once auth exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const BRAND = {
  org: 'Walmart',
  productName: 'Walmart Assistant',
  /** Used where the full name will not fit. */
  shortName: 'Assistant',
  descriptor: 'Internal · Associate tools',
  assistantLabel: 'Assistant',
  userLabel: 'You',
} as const;

/** Fixture — replace with the authenticated session. */
export const demoUser = {
  name: 'Jordan Avery',
  email: 'jordan.avery@example.com',
  role: 'Merchandising · Region 14',
} as const;
