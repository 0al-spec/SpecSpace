import type { WorkItem } from "../model/types";

/**
 * Bounded tone vocabulary the row CSS understands. Mapping at this layer
 * means the contract can grow new `readiness` values without forcing CSS
 * changes — unknown values fall to "neutral" automatically.
 *
 * Tone definitions derive from contract §7 "Recommended tones".
 */
export type WorkItemTone =
  | "ready"        // ready_for_coding_agent — go-state
  | "planning"     // ready_for_planning — accent (next decision)
  | "active"       // in_progress
  | "warn"         // blocked_by_trace_gap | blocked_by_evidence_gap |
                   //   implemented_pending_evidence
  | "danger"       // blocked_by_spec_quality | invalid_target_scope
  | "done"         // implemented — muted green
  | "neutral";     // empty_delta + unknown states (forward-compat)

const READINESS_TO_TONE: Record<string, WorkItemTone> = {
  ready_for_coding_agent: "ready",
  ready_for_planning: "planning",
  in_progress: "active",
  blocked_by_trace_gap: "warn",
  blocked_by_evidence_gap: "warn",
  implemented_pending_evidence: "warn",
  blocked_by_spec_quality: "danger",
  invalid_target_scope: "danger",
  implemented: "done",
  empty_delta: "neutral",
};

export function toneFor(item: WorkItem): WorkItemTone {
  return READINESS_TO_TONE[item.readiness] ?? "neutral";
}
