// useFirstVisit — returns true the first time a given key is seen, then false forever.
// Persisted in localStorage. Safe to call during SSR (try/catch).

import { useState } from "react";

export function useFirstVisit(key: string): { isFirst: boolean; dismiss: () => void } {
  const storageKey = `uscout:first-visit:${key}`;
  const [isFirst, setIsFirst] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  });

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setIsFirst(false);
  }

  return { isFirst, dismiss };
}
