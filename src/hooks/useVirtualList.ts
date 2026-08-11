import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Options {
  scrollRef: React.RefObject<HTMLElement | null>;
  count: number;
  /** Height assumed for rows that have not been measured yet. */
  estimate?: number;
  overscan?: number;
  enabled: boolean;
}

export interface VirtualWindow {
  indices: number[];
  padTop: number;
  padBottom: number;
  registerRow: (index: number) => (el: HTMLElement | null) => void;
  /** Scroll offset of a row, for jumping to a message that is not mounted. */
  offsetOf: (index: number) => number;
}

/**
 * Windowed rendering with measured row heights.
 *
 * Rows are variable height (a two-line question and a nine-hundred-line code
 * listing sit in the same list), so every mounted row is measured with a shared
 * ResizeObserver and the measurement cached. Unmeasured rows fall back to
 * `estimate`. Below the enable threshold the hook is a pass-through, which keeps
 * short conversations entirely free of virtualization artefacts.
 */
export function useVirtualList({
  scrollRef,
  count,
  estimate = 240,
  overscan = 5,
  enabled,
}: Options): VirtualWindow {
  const heights = useRef<number[]>([]);
  const elements = useRef(new Map<HTMLElement, number>());
  const [version, setVersion] = useState(0);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewport: 0 });
  const frame = useRef<number | null>(null);

  if (heights.current.length !== count) {
    const next = heights.current.slice(0, count);
    while (next.length < count) next.push(0);
    heights.current = next;
  }

  const observer = useRef<ResizeObserver | null>(null);
  if (observer.current === null && typeof ResizeObserver !== 'undefined') {
    observer.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const index = elements.current.get(entry.target as HTMLElement);
        if (index === undefined) continue;
        const height = (entry.target as HTMLElement).offsetHeight;
        if (height > 0 && Math.abs((heights.current[index] ?? 0) - height) > 0.5) {
          heights.current[index] = height;
          changed = true;
        }
      }
      if (changed) setVersion((n) => n + 1);
    });
  }

  useEffect(() => () => observer.current?.disconnect(), []);

  const registerRow = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      const ro = observer.current;
      if (!ro) return;
      // Detach any element previously registered under this index.
      for (const [node, idx] of elements.current) {
        if (idx === index && node !== el) {
          ro.unobserve(node);
          elements.current.delete(node);
        }
      }
      if (el) {
        elements.current.set(el, index);
        ro.observe(el);
        const height = el.offsetHeight;
        if (height > 0 && Math.abs((heights.current[index] ?? 0) - height) > 0.5) {
          heights.current[index] = height;
        }
      }
    },
    [],
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !enabled) return;

    const read = () => {
      frame.current = null;
      setMetrics({ scrollTop: node.scrollTop, viewport: node.clientHeight });
    };
    const onScroll = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(read);
    };

    read();
    node.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      node.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [scrollRef, enabled]);

  return useMemo<VirtualWindow>(() => {
    const heightAt = (i: number) => heights.current[i] || estimate;

    /** Sum of measured heights before `index`; used by both branches below. */
    const offsetOf = (index: number) => {
      let total = 0;
      for (let i = 0; i < Math.min(index, count); i += 1) total += heightAt(i);
      return total;
    };

    if (!enabled) {
      return {
        indices: Array.from({ length: count }, (_, i) => i),
        padTop: 0,
        padBottom: 0,
        registerRow,
        offsetOf,
      };
    }

    const offsets: number[] = new Array(count + 1);
    offsets[0] = 0;
    for (let i = 0; i < count; i += 1) offsets[i + 1] = offsets[i] + heightAt(i);

    const total = offsets[count];
    const viewport = metrics.viewport || 800;
    const top = Math.max(0, metrics.scrollTop);
    const bottom = top + viewport;

    // Binary search for the first row whose end is past the viewport top.
    let lo = 0;
    let hi = count - 1;
    let first = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] <= top) lo = mid + 1;
      else {
        first = mid;
        hi = mid - 1;
      }
    }

    let last = first;
    while (last < count - 1 && offsets[last] < bottom) last += 1;

    const start = Math.max(0, first - overscan);
    const end = Math.min(count - 1, last + overscan);

    return {
      indices: Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i),
      padTop: offsets[start],
      padBottom: Math.max(0, total - offsets[end + 1]),
      registerRow,
      offsetOf,
    };
    // Height mutations live in a ref; `version` is the signal that re-runs this
    // memo when the observer records a new measurement.
  }, [enabled, count, estimate, overscan, metrics, registerRow, version]);
}
