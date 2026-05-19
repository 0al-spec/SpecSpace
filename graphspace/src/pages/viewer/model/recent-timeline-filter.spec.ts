import { describe, expect, it } from "vitest";
import type { RecentChange } from "@/entities/recent-change";
import type { SpecGraphNode } from "@/shared/spec-graph-contract";
import {
  DEFAULT_RECENT_TIMELINE_FILTER,
  filterRecentChangesByTimeline,
  hasRecentTimelineFilter,
} from "./recent-timeline-filter";

const NOW = new Date("2026-05-19T12:00:00+00:00");

const baseEntry = (event_id: string, spec_id: string, occurred_at: string): RecentChange => ({
  event_id,
  event_type: "canonical_spec_updated",
  spec_id,
  title: event_id,
  occurred_at,
  summary: event_id,
  source_kind: "git_commit",
  source_paths: [],
  viewer: { tone: "spec", label: "Spec" },
});

const baseNode = (
  node_id: string,
  timestamps: Pick<SpecGraphNode, "created_at" | "updated_at">,
): SpecGraphNode => ({
  node_id,
  file_name: `${node_id}.yaml`,
  title: node_id,
  kind: "spec",
  status: "linked",
  maturity: 1,
  acceptance_count: 0,
  decisions_count: 0,
  evidence_gap: 0,
  input_gap: 0,
  execution_gap: 0,
  gap_count: 0,
  depends_on: [],
  refines: [],
  relates_to: [],
  diagnostics: [],
  ...timestamps,
});

const entries: RecentChange[] = [
  baseEntry("fresh", "SG-SPEC-0001", "2026-05-19T10:00:00+00:00"),
  baseEntry("week-old", "SG-SPEC-0002", "2026-05-12T09:00:00+00:00"),
  baseEntry("graph-level", "", "2026-05-19T11:00:00+00:00"),
];

const nodes: SpecGraphNode[] = [
  baseNode("SG-SPEC-0001", {
    created_at: "2026-05-01T00:00:00+00:00",
    updated_at: "2026-05-19T09:00:00+00:00",
  }),
  baseNode("SG-SPEC-0002", {
    created_at: "2026-05-18T00:00:00+00:00",
    updated_at: "2026-04-01T00:00:00+00:00",
  }),
];

describe("filterRecentChangesByTimeline", () => {
  it("filters by event occurrence timestamp", () => {
    const result = filterRecentChangesByTimeline(
      entries,
      nodes,
      { field: "event", range: "24h", includeUnknown: true },
      NOW,
    );

    expect(result.entries.map((entry) => entry.event_id)).toEqual([
      "fresh",
      "graph-level",
    ]);
    expect(result.knownCount).toBe(3);
    expect(result.unknownCount).toBe(0);
  });

  it("filters by related spec updated timestamp while keeping unknown values visible", () => {
    const result = filterRecentChangesByTimeline(
      entries,
      nodes,
      { field: "spec-updated", range: "7d", includeUnknown: true },
      NOW,
    );

    expect(result.entries.map((entry) => entry.event_id)).toEqual([
      "fresh",
      "graph-level",
    ]);
    expect(result.knownCount).toBe(2);
    expect(result.unknownCount).toBe(1);
  });

  it("can hide entries whose selected timestamp is unknown", () => {
    const result = filterRecentChangesByTimeline(
      entries,
      nodes,
      { field: "spec-created", range: "30d", includeUnknown: false },
      NOW,
    );

    expect(result.entries.map((entry) => entry.event_id)).toEqual([
      "fresh",
      "week-old",
    ]);
    expect(result.knownCount).toBe(2);
    expect(result.unknownCount).toBe(1);
  });

  it("treats invalid node timestamps as explicit unknowns", () => {
    const result = filterRecentChangesByTimeline(
      [baseEntry("bad-time", "SG-SPEC-0003", "2026-05-19T10:00:00+00:00")],
      [baseNode("SG-SPEC-0003", { created_at: "not-a-date", updated_at: null })],
      { field: "spec-created", range: "all", includeUnknown: true },
      NOW,
    );

    expect(result.entries.map((entry) => entry.event_id)).toEqual(["bad-time"]);
    expect(result.knownCount).toBe(0);
    expect(result.unknownCount).toBe(1);
  });
});

describe("hasRecentTimelineFilter", () => {
  it("reports the default state as inactive", () => {
    expect(hasRecentTimelineFilter(DEFAULT_RECENT_TIMELINE_FILTER)).toBe(false);
  });

  it("reports range, field, and unknown visibility changes as active", () => {
    expect(
      hasRecentTimelineFilter({ field: "event", range: "7d", includeUnknown: true }),
    ).toBe(true);
    expect(
      hasRecentTimelineFilter({
        field: "spec-updated",
        range: "all",
        includeUnknown: true,
      }),
    ).toBe(true);
    expect(
      hasRecentTimelineFilter({ field: "event", range: "all", includeUnknown: false }),
    ).toBe(true);
  });
});
