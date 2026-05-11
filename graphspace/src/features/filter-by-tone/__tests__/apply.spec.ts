import { describe, it, expect } from "vitest";
import { filterByTone, toneCounts } from "../lib/apply";
import type { RecentChange } from "@/entities/recent-change";

const make = (event_type: string, event_id: string): RecentChange => ({
  event_id,
  event_type,
  spec_id: "SG-SPEC-0001",
  title: "x",
  occurred_at: "2026-05-11T00:00:00+00:00",
  summary: "x",
  source_kind: "git_commit",
  source_paths: [],
  viewer: { tone: "spec", label: "x" },
});

const SAMPLE: RecentChange[] = [
  make("canonical_spec_updated", "a"),     // tone: spec
  make("trace_baseline_attached", "b"),    // tone: trace
  make("evidence_baseline_attached", "c"), // tone: trace
  make("proposal_emitted", "d"),           // tone: proposal
  make("implementation_work_emitted", "e"),// tone: implementation
  make("review_feedback_applied", "f"),    // tone: review
  make("future_unknown", "g"),             // tone: neutral
];

describe("filterByTone", () => {
  it("returns input unchanged when no tones selected", () => {
    const out = filterByTone(SAMPLE, new Set());
    expect(out).toBe(SAMPLE);
  });

  it("keeps entries whose tone is in the selection", () => {
    const out = filterByTone(SAMPLE, new Set(["spec"]));
    expect(out.map((e) => e.event_id)).toEqual(["a"]);
  });

  it("collapses synonymous event types into one tone bucket", () => {
    // Both trace_baseline_attached and evidence_baseline_attached map to "trace"
    const out = filterByTone(SAMPLE, new Set(["trace"]));
    expect(out.map((e) => e.event_id)).toEqual(["b", "c"]);
  });

  it("union semantics for multi-tone selection", () => {
    const out = filterByTone(SAMPLE, new Set(["spec", "review"]));
    expect(out.map((e) => e.event_id).sort()).toEqual(["a", "f"]);
  });

  it("unknown event types are reachable via the neutral tone", () => {
    const out = filterByTone(SAMPLE, new Set(["neutral"]));
    expect(out.map((e) => e.event_id)).toEqual(["g"]);
  });
});

describe("toneCounts", () => {
  it("returns counts for every known tone including zeros", () => {
    const counts = toneCounts([make("canonical_spec_updated", "a")]);
    expect(counts.spec).toBe(1);
    expect(counts.trace).toBe(0);
    expect(counts.proposal).toBe(0);
    expect(counts.implementation).toBe(0);
    expect(counts.review).toBe(0);
    expect(counts.neutral).toBe(0);
  });

  it("buckets the full sample correctly", () => {
    const counts = toneCounts(SAMPLE);
    expect(counts).toEqual({
      spec: 1,
      trace: 2,
      proposal: 1,
      implementation: 1,
      review: 1,
      neutral: 1,
    });
  });
});
