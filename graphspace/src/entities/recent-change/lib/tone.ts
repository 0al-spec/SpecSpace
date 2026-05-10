import type { RecentChange } from "../model/types";

/**
 * Tone keys correspond to CSS classes in RecentChangeRow.module.css.
 * The mapping comes straight from spec_activity_feed_viewer_contract.md §5.
 *
 * Why we don't trust `entry.viewer.tone` directly: the contract makes it a
 * free-form string, and unknown event types must render as "neutral" rather
 * than crash. Mapping at this layer guarantees the row CSS only ever sees a
 * known token.
 */
export type RecentChangeTone =
  | "spec"
  | "trace"
  | "proposal"
  | "implementation"
  | "review"
  | "neutral";

const EVENT_TYPE_TO_TONE: Record<string, RecentChangeTone> = {
  canonical_spec_updated: "spec",
  trace_baseline_attached: "trace",
  evidence_baseline_attached: "trace",
  proposal_emitted: "proposal",
  implementation_work_emitted: "implementation",
  review_feedback_applied: "review",
  stack_only_merge_observed: "review",
};

export function toneFor(entry: RecentChange): RecentChangeTone {
  return EVENT_TYPE_TO_TONE[entry.event_type] ?? "neutral";
}
