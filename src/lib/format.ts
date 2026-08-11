const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const DAY = 86_400_000;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** `14:32` for today, `4 Mar · 14:32` beyond it. */
export function stamp(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return timeFmt.format(ts);
  return `${dateFmt.format(ts)} · ${timeFmt.format(ts)}`;
}

/** Coarse relative label for the sidebar index. */
export function relativeDay(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diff = Math.round((today - day) / DAY);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} wk ago`;
  return dateFmt.format(ts);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
