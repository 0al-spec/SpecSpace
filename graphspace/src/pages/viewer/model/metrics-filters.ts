import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";

export type MetricsViewerFilters = {
  category: string;
  status: string;
  sourceKind: string;
  referenceQuery: string;
};

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const matchesOption = (actual: string, selected: string): boolean =>
  selected === "" || actual === selected;

export function filterMetricsEntries(
  entries: readonly MetricsIndexEntry[],
  filters: MetricsViewerFilters,
): MetricsIndexEntry[] {
  const referenceNeedle = normalize(filters.referenceQuery);

  return entries.filter((entry) => {
    if (!matchesOption(entry.category, filters.category)) return false;
    if (!matchesOption(entry.status, filters.status)) return false;
    if (!matchesOption(entry.source_kind, filters.sourceKind)) return false;
    if (!referenceNeedle) return true;
    return entry.reference_texts.some((reference) =>
      normalize(reference).includes(referenceNeedle),
    );
  });
}

export function sortedFilterOptions(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => a.localeCompare(b));
}
