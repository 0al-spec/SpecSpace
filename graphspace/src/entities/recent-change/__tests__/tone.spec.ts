import { describe, it, expect } from "vitest";
import { toneFor } from "../lib/tone";
import type { RecentChange } from "../model/types";

const make = (overrides: Partial<RecentChange>): RecentChange => ({
  event_id: "x",
  event_type: "canonical_spec_updated",
  spec_id: "SG-SPEC-0001",
  title: "x",
  occurred_at: "2026-05-10T00:00:00+00:00",
  summary: "x",
  source_kind: "git_commit",
  source_paths: [],
  viewer: { tone: "spec", label: "x" },
  ...overrides,
});

describe("toneFor", () => {
  it.each([
    ["canonical_spec_updated", "spec"],
    ["trace_baseline_attached", "trace"],
    ["evidence_baseline_attached", "trace"],
    ["proposal_emitted", "proposal"],
    ["implementation_work_emitted", "implementation"],
    ["review_feedback_applied", "review"],
    ["stack_only_merge_observed", "review"],
  ] as const)("maps %s -> %s (per contract §5)", (event_type, expected) => {
    expect(toneFor(make({ event_type }))).toBe(expected);
  });

  it("falls back to neutral for unknown event_type (forward-compat)", () => {
    expect(toneFor(make({ event_type: "future_unknown_kind" }))).toBe("neutral");
  });
});
