import { useCallback, useEffect, useState } from 'react';
import type { ThemeChoice } from '../types';

const QUERY = '(prefers-color-scheme: dark)';

/**
 * Theme resolution. The choice is tri-state (system / light / dark) but the DOM
 * only ever sees a resolved value on `<html data-theme>`, so styling has a
 * single code path and the system default stays live while it is selected.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' =
    choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  /**
   * First press flips away from whatever is on screen; subsequent presses walk
   * light → dark → system, so "follow the OS" stays reachable without a menu.
   */
  const cycle = useCallback(() => {
    setChoice((c) => (c === 'system' ? (systemDark ? 'light' : 'dark') : c === 'light' ? 'dark' : 'system'));
  }, [systemDark]);

  return { choice, resolved, cycle, setChoice };
}
