import type { Role } from '../types';
import { BRAND, demoUser } from '../brand';

/**
 * Product mark.
 *
 * An original glyph — three ascending bars capped by a dot — chosen because the
 * product is a retail-analytics assistant and it stays legible down to 16px.
 * It is deliberately NOT the Walmart Spark: that is a registered trademark, and
 * an approximation drawn from memory would be worse than an honest stand-in.
 * When the brand kit is available, swap the glyph here for the official SVG and
 * the whole app follows.
 *
 * `tone="tile"` draws the glyph on a brand-blue tile, for the wordmark and the
 * favicon-sized contexts. `tone="glyph"` draws it in `currentColor` alone, for
 * placement inside a control that already has its own background.
 */
export function BrandMark({
  size = 28,
  tone = 'tile',
  className = '',
}: {
  size?: number;
  tone?: 'tile' | 'glyph';
  className?: string;
}) {
  const bars = tone === 'tile' ? '#ffffff' : 'currentColor';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={`${BRAND.org} ${BRAND.shortName} mark`}
      className={`shrink-0 ${className}`}
    >
      {tone === 'tile' && <rect width="32" height="32" rx="8.5" fill="var(--true-blue)" />}
      <g fill={bars}>
        <rect x="7" y="17.5" width="4.6" height="7.5" rx="1.6" />
        <rect x="13.7" y="13.5" width="4.6" height="11.5" rx="1.6" />
        <rect x="20.4" y="9.5" width="4.6" height="15.5" rx="1.6" />
      </g>
      <circle cx="22.7" cy="5.6" r="2.7" fill="var(--spark-yellow)" />
    </svg>
  );
}

/**
 * Speaker marks. Not lettered circles: a filled tile with a person glyph for
 * the associate, an outlined tile carrying the product's bars for the
 * assistant. They differ by fill *and* by inner shape, so they stay apart in
 * monochrome and at 15px.
 */
export function SpeakerMark({ role, className = '' }: { role: Role; className?: string }) {
  if (role === 'user') {
    return (
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
        aria-hidden="true"
        className={`shrink-0 ${className}`}
      >
        <rect width="16" height="16" rx="4.5" fill="currentColor" />
        <circle cx="8" cy="6.2" r="2.2" fill="var(--raised)" />
        <path d="M3.9 13.2a4.1 4.1 0 0 1 8.2 0z" fill="var(--raised)" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect x="0.9" y="0.9" width="14.2" height="14.2" rx="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g fill="currentColor">
        <rect x="4" y="8.8" width="2.1" height="3.3" rx="0.85" />
        <rect x="7" y="7.1" width="2.1" height="5" rx="0.85" />
        <rect x="10" y="5.3" width="2.1" height="6.8" rx="0.85" />
      </g>
    </svg>
  );
}

/**
 * The signed-in person. A neutral silhouette on a tinted tile rather than an
 * initial in a circle — initials collide constantly in a large org, and a photo
 * is not something this demo has.
 */
export function UserAvatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={`${demoUser.name}, signed in`}
      className={`shrink-0 ${className}`}
    >
      <rect width="32" height="32" rx="9" fill="var(--wash-accent)" />
      <circle cx="16" cy="12.6" r="4.4" fill="var(--accent-text)" />
      <path d="M7.4 27.2a8.6 8.6 0 0 1 17.2 0z" fill="var(--accent-text)" />
    </svg>
  );
}
