// A "recent change" is one normalised SpecGraph activity event. We re-export
// the contract type rather than wrap it — the entity's job is to organise
// rendering and selection, not to remodel the source-of-truth shape.

export type { SpecActivityEntry as RecentChange } from "@/shared/api/spec-graph-contract";
