import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";

export type ProposalViewerFilters = {
  status: string;
  authorityState: string;
  runtimeState: string;
  specQuery: string;
};

export type ProposalViewerContextFilter = {
  kind: "spec";
  specId: string;
};

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const matchesOption = (actual: string | null, selected: string): boolean =>
  selected === "" || (actual ?? "unknown") === selected;

export function filterProposalEntries(
  entries: readonly ProposalIndexEntry[],
  filters: ProposalViewerFilters,
): ProposalIndexEntry[] {
  const specNeedle = normalize(filters.specQuery);

  return entries.filter((entry) => {
    if (!matchesOption(entry.status, filters.status)) return false;
    if (!matchesOption(entry.authority_state, filters.authorityState)) return false;
    if (!matchesOption(entry.runtime_state, filters.runtimeState)) return false;
    if (!specNeedle) return true;
    return entry.affected_spec_ids.some((specId) => normalize(specId).includes(specNeedle));
  });
}

export function filterProposalEntriesByContext(
  entries: readonly ProposalIndexEntry[],
  contextFilter: ProposalViewerContextFilter | null,
): ProposalIndexEntry[] {
  if (!contextFilter) return [...entries];
  return entries.filter((entry) =>
    entry.affected_spec_ids.includes(contextFilter.specId),
  );
}

export function sortedFilterOptions(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => a.localeCompare(b));
}
