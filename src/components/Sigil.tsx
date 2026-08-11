import type { Role } from '../types';

/**
 * Speaker mark. Not an avatar — a printer's sigil: a filled square for the
 * writer's own hand, an open square with a rule through it for the responding
 * one. Two marks, distinguishable by shape alone at 12px and in monochrome.
 */
export function Sigil({ role, className = '' }: { role: Role; className?: string }) {
  if (role === 'user') {
    return (
      <svg
        viewBox="0 0 14 14"
        width="12"
        height="12"
        aria-hidden="true"
        className={`shrink-0 ${className}`}
      >
        <path d="M1 1h12v12H1z" fill="currentColor" />
        <path d="M1 9h5v5" fill="var(--paper-surface)" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 14 14"
      width="12"
      height="12"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M1.5 1.5h11v11h-11z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 12.5 12.5 1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
