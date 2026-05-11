// A "work item" is one row from implementation_work_index.entries[]. We
// re-export the contract type rather than wrap it — the entity's job is
// rendering + readiness tone selection, not remodelling the contract shape.

export type { WorkItem } from "@/shared/spec-graph-contract";
