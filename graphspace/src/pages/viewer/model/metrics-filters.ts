import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";

export type MetricsViewerFilters = {
  category: string;
  status: string;
  sourceKind: string;
  referenceQuery: string;
};

export type MetricsViewerContextFilter =
  | {
      kind: "node";
      nodeId: string;
    }
  | {
      kind: "edge";
      edgeId: string;
    };

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const matchesOption = (actual: string, selected: string): boolean =>
  selected === "" || actual === selected;

const referenceTokens = (reference: string): Set<string> =>
  new Set(reference.split(/[^A-Za-z0-9_-]+/).filter(Boolean));

const entryReferencesTarget = (
  entry: MetricsIndexEntry,
  target: string,
): boolean =>
  entry.reference_texts.some((reference) => referenceTokens(reference).has(target));

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

export function filterMetricsEntriesByContext(
  entries: readonly MetricsIndexEntry[],
  contextFilter: MetricsViewerContextFilter | null,
): MetricsIndexEntry[] {
  if (!contextFilter) return [...entries];
  const target =
    contextFilter.kind === "node" ? contextFilter.nodeId : contextFilter.edgeId;
  return entries.filter((entry) => entryReferencesTarget(entry, target));
}

export function sortedFilterOptions(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => a.localeCompare(b));
}
