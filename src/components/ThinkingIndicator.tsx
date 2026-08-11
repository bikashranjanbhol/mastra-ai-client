/** Shown between request and first token. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2.5 py-1" role="presentation">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-pill bg-accent"
            style={{
              animation: 'caret-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </span>
      <span className="label text-muted">Thinking</span>
    </div>
  );
}
