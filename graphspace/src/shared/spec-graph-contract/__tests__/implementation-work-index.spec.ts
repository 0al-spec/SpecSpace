import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseImplementationWorkIndex } from "../parsers/parse-implementation-work-index";
import {
  isKnownReadiness,
  KNOWN_READINESS,
} from "../schemas/implementation-work-index";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, "../fixtures/implementation_work_index.golden.json");
const goldenText = readFileSync(goldenPath, "utf-8");
const golden = JSON.parse(goldenText) as Record<string, unknown>;
const cloneGolden = () => JSON.parse(goldenText);

describe("parseImplementationWorkIndex", () => {
  it("parses the captured golden fixture", () => {
    const r = parseImplementationWorkIndex(golden);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data.artifact_kind).toBe("implementation_work_index");
    expect(r.data.entries.length).toBeGreaterThan(0);
    // Stable per contract §9 — planning surface, not graph truth.
    expect(r.data.canonical_mutations_allowed).toBe(false);
    expect(r.data.runtime_code_mutations_allowed).toBe(false);
  });

  it("preserves entry_count = entries.length on a healthy fixture", () => {
    const r = parseImplementationWorkIndex(golden);
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(r.data.entry_count).toBe(r.data.entries.length);
  });

  it("flags entry_count vs entries.length mismatch as invariant-violation", () => {
    const broken = cloneGolden();
    broken.entry_count = broken.entry_count + 1;
    expect(parseImplementationWorkIndex(broken).kind).toBe("invariant-violation");
  });

  it("rejects an artifact with the wrong artifact_kind", () => {
    const wrong = { ...cloneGolden(), artifact_kind: "spec_activity_feed" };
    expect(parseImplementationWorkIndex(wrong).kind).toBe("wrong-artifact-kind");
  });

  it("returns version-not-supported when schema_version exceeds max", () => {
    const future = { ...cloneGolden(), schema_version: 42 };
    const r = parseImplementationWorkIndex(future);
    expect(r.kind).toBe("version-not-supported");
    if (r.kind !== "version-not-supported") return;
    expect(r.max_supported).toBe(1);
  });

  it("accepts unknown readiness values as a neutral pass-through", () => {
    const novel = cloneGolden();
    novel.entries[0].readiness = "ready_for_some_future_state";
    const r = parseImplementationWorkIndex(novel);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(isKnownReadiness(r.data.entries[0].readiness)).toBe(false);
  });

  it("returns parse-error when a required entry field is missing", () => {
    const broken = cloneGolden();
    delete broken.entries[0].work_item_id;
    expect(parseImplementationWorkIndex(broken).kind).toBe("parse-error");
  });

  it("returns parse-error when source_delta_snapshot is missing", () => {
    const broken = cloneGolden();
    delete broken.source_delta_snapshot;
    expect(parseImplementationWorkIndex(broken).kind).toBe("parse-error");
  });

  it("known readiness vocabulary stays in sync with the contract", () => {
    // Contract §7 + special delta-only states.
    expect([...KNOWN_READINESS].sort()).toEqual([
      "blocked_by_evidence_gap",
      "blocked_by_spec_quality",
      "blocked_by_trace_gap",
      "empty_delta",
      "implemented",
      "implemented_pending_evidence",
      "in_progress",
      "invalid_target_scope",
      "ready_for_coding_agent",
      "ready_for_planning",
    ]);
  });
});
