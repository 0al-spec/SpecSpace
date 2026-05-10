import { describe, it, expect } from "vitest";
import { toneFor } from "../lib/readiness";
import type { WorkItem } from "../model/types";

const make = (overrides: Partial<WorkItem>): WorkItem => ({
  work_item_id: "implementation_work::SG-SPEC-0001::changed_acceptance",
  affected_spec_ids: ["SG-SPEC-0001"],
  implementation_reason: "changed_acceptance",
  delta_refs: [],
  required_tests: [],
  expected_evidence: [],
  likely_code_refs: [],
  readiness: "ready_for_planning",
  blockers: [],
  next_gap: "review_implementation_delta",
  ...overrides,
});

describe("toneFor (readiness)", () => {
  it.each([
    ["ready_for_coding_agent", "ready"],
    ["ready_for_planning", "planning"],
    ["in_progress", "active"],
    ["blocked_by_trace_gap", "warn"],
    ["blocked_by_evidence_gap", "warn"],
    ["implemented_pending_evidence", "warn"],
    ["blocked_by_spec_quality", "danger"],
    ["invalid_target_scope", "danger"],
    ["implemented", "done"],
    ["empty_delta", "neutral"],
  ] as const)("maps %s -> %s (per contract §7)", (readiness, expected) => {
    expect(toneFor(make({ readiness }))).toBe(expected);
  });

  it("falls back to neutral for unknown readiness (forward-compat)", () => {
    expect(toneFor(make({ readiness: "future_readiness_state" }))).toBe("neutral");
  });
});
