import type { Role } from '../types';
import { BRAND } from '../brand';

/**
 * PLACEHOLDER — the official Spark mark is a registered trademark and is not
 * reproduced here. Replace the <svg> body below with the SVG from the brand
 * kit; do not trace or approximate it. Sizing and colour are driven from the
 * parent, so a drop-in replacement needs no other change.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={`${BRAND.org} logo placeholder`}
      className="shrink-0"
    >
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--true-blue)" />
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="16" cy="16" r="5.5" fill="var(--spark-yellow)" />
    </svg>
  );
}

/**
 * Speaker marks. Not lettered circles: two distinct shapes in the brand's
 * corner language, legible at 12px and distinguishable in monochrome — a solid
 * notched tile for the associate, an outlined tile with a yellow quadrant for
 * the assistant.
 */
export function SpeakerMark({ role, className = '' }: { role: Role; className?: string }) {
  if (role === 'user') {
    return (
      <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" className={`shrink-0 ${className}`}>
        <rect x="1" y="1" width="12" height="12" rx="3.5" fill="currentColor" />
        <path d="M4.4 7.4 6.3 9.3 9.9 5.4" fill="none" stroke="var(--raised)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="1" y="1" width="12" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 3.4a3.6 3.6 0 0 1 3.6 3.6H7z" fill="var(--spark-yellow)" />
    </svg>
  );
}
