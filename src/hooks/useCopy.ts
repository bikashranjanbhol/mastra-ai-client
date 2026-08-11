import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard';

/** Copy-with-confirmation; the flag falls back to false after `hold` ms. */
export function useCopy(hold = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      if (!ok) return false;
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), hold);
      return true;
    },
    [hold],
  );

  return { copied, copy };
}
