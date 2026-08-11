/** Shown between request and first token. Three ruled marks, filling left to right. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2.5 py-1" role="presentation">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[3px] w-4 bg-edge-strong"
            style={{
              animation: 'caret-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        composing
      </span>
    </div>
  );
}
