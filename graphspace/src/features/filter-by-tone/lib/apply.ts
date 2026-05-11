import { toneFor, type RecentChange, type RecentChangeTone } from "@/entities/recent-change";

/**
 * Empty selection means "no filter active" — pass every entry through.
 * Otherwise keep entries whose mapped tone is in the selection set.
 *
 * Pure function so the filter logic is trivial to test and to call from
 * either a hook or a future SSR boundary without React.
 */
export function filterByTone(
  entries: readonly RecentChange[],
  selected: ReadonlySet<RecentChangeTone>,
): readonly RecentChange[] {
  if (selected.size === 0) return entries;
  return entries.filter((e) => selected.has(toneFor(e)));
}

/**
 * Histogram of tone -> count over the input list. Used by the chip UI to
 * label each chip with `(N)` so users see what they're filtering toward
 * before clicking. Returns counts for every known tone (including zeros)
 * plus `neutral` for unknown event types.
 */
export function toneCounts(
  entries: readonly RecentChange[],
): Record<RecentChangeTone, number> {
  const counts: Record<RecentChangeTone, number> = {
    spec: 0,
    trace: 0,
    proposal: 0,
    implementation: 0,
    review: 0,
    neutral: 0,
  };
  for (const e of entries) counts[toneFor(e)] += 1;
  return counts;
}
