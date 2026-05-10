import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseSpecActivityFeed } from "../lib/parse-spec-activity-feed";
import { isKnownEventType, KNOWN_EVENT_TYPES } from "../model/spec-activity-feed";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, "../fixtures/spec_activity_feed.golden.json");
const goldenText = readFileSync(goldenPath, "utf-8");
const golden = JSON.parse(goldenText) as Record<string, unknown>;
const cloneGolden = () => JSON.parse(goldenText);

describe("parseSpecActivityFeed", () => {
  it("parses the captured golden fixture", () => {
    const r = parseSpecActivityFeed(golden);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data.artifact_kind).toBe("spec_activity_feed");
    expect(r.data.entries.length).toBeGreaterThan(0);
  });

  it("preserves the count-invariant on a healthy fixture", () => {
    const r = parseSpecActivityFeed(golden);
    if (r.kind !== "ok") throw new Error("expected ok");
    const { entry_count, summary, entries } = r.data;
    expect(entry_count).toBe(summary.entry_count);
    expect(entry_count).toBe(entries.length);
  });

  it("flags entry_count vs summary.entry_count mismatch as invariant-violation", () => {
    const broken = cloneGolden();
    broken.entry_count = broken.entry_count + 1;
    const r = parseSpecActivityFeed(broken);
    expect(r.kind).toBe("invariant-violation");
  });

  it("flags entry_count vs entries.length mismatch as invariant-violation", () => {
    const broken = cloneGolden();
    broken.entries.pop();
    const r = parseSpecActivityFeed(broken);
    expect(r.kind).toBe("invariant-violation");
  });

  it("rejects an artifact with the wrong artifact_kind", () => {
    const wrong = { ...cloneGolden(), artifact_kind: "metric_pack" };
    const r = parseSpecActivityFeed(wrong);
    expect(r.kind).toBe("wrong-artifact-kind");
  });

  it("returns version-not-supported when schema_version exceeds max", () => {
    const future = { ...cloneGolden(), schema_version: 999 };
    const r = parseSpecActivityFeed(future);
    expect(r.kind).toBe("version-not-supported");
    if (r.kind !== "version-not-supported") return;
    expect(r.schema_version).toBe(999);
    expect(r.max_supported).toBe(1);
  });

  it("accepts unknown event_type values as a neutral pass-through", () => {
    const novel = cloneGolden();
    novel.entries[0].event_type = "future_event_we_dont_know_yet";
    const r = parseSpecActivityFeed(novel);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(isKnownEventType(r.data.entries[0].event_type)).toBe(false);
  });

  it("accepts entries with empty spec_id (graph-level events)", () => {
    const r = parseSpecActivityFeed(golden);
    if (r.kind !== "ok") throw new Error("expected ok");
    // Golden fixture builder includes one empty spec_id entry when present.
    const empty = r.data.entries.filter((e) => e.spec_id === "");
    // Either 0 or >=1 depending on whether the source had any; just assert
    // they pass when present rather than fail on the type.
    for (const e of empty) expect(typeof e.spec_id).toBe("string");
  });

  it("returns parse-error for arbitrary non-object input", () => {
    expect(parseSpecActivityFeed(null).kind).toBe("parse-error");
    expect(parseSpecActivityFeed("a string").kind).toBe("parse-error");
    expect(parseSpecActivityFeed(42).kind).toBe("parse-error");
  });

  it("returns parse-error when a required entry field is missing", () => {
    const broken = cloneGolden();
    delete broken.entries[0].event_id;
    const r = parseSpecActivityFeed(broken);
    expect(r.kind).toBe("parse-error");
  });

  it("known event-type vocabulary stays in sync with the contract", () => {
    // Lock against accidental drift. Contract §5 lists exactly these types.
    expect([...KNOWN_EVENT_TYPES].sort()).toEqual([
      "canonical_spec_updated",
      "evidence_baseline_attached",
      "implementation_work_emitted",
      "proposal_emitted",
      "review_feedback_applied",
      "stack_only_merge_observed",
      "trace_baseline_attached",
    ]);
  });
});
