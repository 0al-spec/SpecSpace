import { useState, useCallback } from "react";

const PREFIX = "ctxb_";

export function useSessionString(
  key: string,
  initial: string | null = null,
): [string | null, (value: string | null) => void] {
  const fullKey = PREFIX + key;
  const [value, setValue] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(fullKey) ?? initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: string | null) => {
      setValue(next);
      try {
        if (next === null) {
          sessionStorage.removeItem(fullKey);
        } else {
          sessionStorage.setItem(fullKey, next);
        }
      } catch {
        // ignore quota errors
      }
    },
    [fullKey],
  );

  return [value, set];
}

export function useSessionSet(
  key: string,
): [Set<string>, (updater: (prev: Set<string>) => Set<string>) => void] {
  const fullKey = PREFIX + key;
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(fullKey);
      if (stored) return new Set(JSON.parse(stored));
    } catch {
      // ignore
    }
    return new Set();
  });

  const set = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setValue((prev) => {
        const next = updater(prev);
        try {
          sessionStorage.setItem(fullKey, JSON.stringify([...next]));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [fullKey],
  );

  return [value, set];
}
