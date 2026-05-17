type ProposalTraceEntriesState<T> = {
  kind: string;
  data?: { entries: readonly T[] };
};

export function proposalTraceEntriesForPanel<T>(
  state: ProposalTraceEntriesState<T>,
  fallback: readonly T[],
): readonly T[] {
  if (state.kind === "ok" && state.data) return state.data.entries;
  return fallback;
}
