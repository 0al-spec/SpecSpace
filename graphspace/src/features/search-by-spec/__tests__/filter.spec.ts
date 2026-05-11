import { describe, expect, it } from "vitest";
import type { RecentChange } from "@/entities/recent-change";
import { filterBySpecQuery } from "../lib/filter";

const make = (overrides: Partial<RecentChange>): RecentChange => ({
  event_id: "event",
  event_type: "canonical_spec_updated",
  spec_id: "SG-SPEC-0001",
  title: "x",
  occurred_at: "2026-05-11T00:00:00+00:00",
  summary: "x",
  source_kind: "git_commit",
  source_paths: [],
  viewer: { tone: "spec", label: "x" },
  ...overrides,
});

const SAMPLE: RecentChange[] = [
  make({
    event_id: "a",
    spec_id: "SG-SPEC-0028",
    source_paths: ["specs/nodes/SG-SPEC-0028.yaml"],
  }),
  make({
    event_id: "b",
    spec_id: "SG-SPEC-0030",
    source_paths: ["specs/nodes/SG-SPEC-0030.yaml"],
  }),
  make({
    event_id: "c",
    spec_id: "",
    source_paths: ["viewer/server.py"],
  }),
];

describe("filterBySpecQuery", () => {
  it("returns input unchanged when query is empty", () => {
    expect(filterBySpecQuery(SAMPLE, "   ")).toBe(SAMPLE);
  });

  it("matches spec ids case-insensitively", () => {
    const out = filterBySpecQuery(SAMPLE, "sg-spec-0028");
    expect(out.map((entry) => entry.event_id)).toEqual(["a"]);
  });

  it("matches compact spec id queries without punctuation", () => {
    const out = filterBySpecQuery(SAMPLE, "sgspec0030");
    expect(out.map((entry) => entry.event_id)).toEqual(["b"]);
  });

  it("matches source paths for entries without a spec id", () => {
    const out = filterBySpecQuery(SAMPLE, "viewer/server");
    expect(out.map((entry) => entry.event_id)).toEqual(["c"]);
  });

  it("returns no entries when neither spec id nor path matches", () => {
    expect(filterBySpecQuery(SAMPLE, "SG-SPEC-9999")).toEqual([]);
  });
});
