import { useCallback, useState } from "react";
import type { RecentChangeTone } from "@/entities/recent-change";

export type ToneFilterApi = {
  selected: ReadonlySet<RecentChangeTone>;
  isActive: (tone: RecentChangeTone) => boolean;
  toggle: (tone: RecentChangeTone) => void;
  clear: () => void;
  /** True when at least one chip is active. */
  hasAny: boolean;
};

/**
 * Local UI state for the tone filter — a Set of currently-selected tones.
 *
 * Kept inside the feature slice (not lifted to the app shell) because the
 * filter is local to one render of one panel. If a second consumer needs
 * the same state, lift it up later — not before.
 */
export function useToneFilter(): ToneFilterApi {
  const [selected, setSelected] = useState<ReadonlySet<RecentChangeTone>>(
    () => new Set(),
  );

  const toggle = useCallback((tone: RecentChangeTone) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tone)) next.delete(tone);
      else next.add(tone);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isActive = useCallback((tone: RecentChangeTone) => selected.has(tone), [selected]);

  return { selected, isActive, toggle, clear, hasAny: selected.size > 0 };
}
