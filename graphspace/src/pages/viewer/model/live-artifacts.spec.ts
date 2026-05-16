import { describe, expect, it } from "vitest";
import { describeArtifact, describeSourceDeltaSnapshot } from "./live-artifacts";

const base = {
  id: "work",
  label: "Implementation work",
  endpoint: "/api/v1/implementation-work-index",
  sampleCount: 5,
  noun: { singular: "item", plural: "items" },
  emptyDetail: "No implementation delta.",
};

describe("describeArtifact", () => {
  it("marks non-empty ok artifacts as live", () => {
    const result = describeArtifact({
      ...base,
      state: { kind: "ok", data: {}, meta: { path: "runs/x.json", mtime: 1, mtime_iso: "2026-05-11T00:00:00+00:00" } },
      liveCount: 3,
    });
    expect(result).toMatchObject({
      tone: "live",
      status: "live",
      countLabel: "3 items",
    });
  });

  it("marks zero-count ok artifacts as live empty", () => {
    const result = describeArtifact({
      ...base,
      state: { kind: "ok", data: {}, meta: { path: "runs/x.json", mtime: 1, mtime_iso: "2026-05-11T00:00:00+00:00" } },
      liveCount: 0,
    });
    expect(result).toMatchObject({
      tone: "empty",
      status: "live empty",
      countLabel: "0 items",
      detail: "No implementation delta.",
    });
  });

  it("marks load failures as sample fallback", () => {
    const result = describeArtifact({
      ...base,
      state: { kind: "http-error", status: 404, statusText: "Not Found" },
      liveCount: 0,
    });
    expect(result).toMatchObject({
      tone: "fallback",
      status: "sample fallback",
      countLabel: "5 items",
    });
    expect(result.detail).toContain("HTTP 404");
  });

  it("surfaces structured backend error details for artifact failures", () => {
    const result = describeArtifact({
      ...base,
      state: {
        kind: "http-error",
        status: 404,
        statusText: "Not Found",
        body: {
          error: "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first.",
          reason: "missing_artifact",
          artifact: "runs/implementation_work_index.json",
        },
      },
      liveCount: 0,
    });
    expect(result.detail).toContain("implementation_work_index.json not found");
    expect(result.detail).toContain("artifact runs/implementation_work_index.json");
    expect(result.detail).toContain("reason missing_artifact");
  });

  it("surfaces nested source details for manifest failures", () => {
    const result = describeArtifact({
      ...base,
      state: {
        kind: "http-error",
        status: 503,
        statusText: "Service Unavailable",
        body: {
          error: "SpecGraph artifact manifest is not readable.",
          source: {
            path: "https://specgraph.tech/artifact_manifest.json",
            detail: "manifest returned HTTP 404",
          },
        },
      },
      liveCount: 0,
    });
    expect(result.detail).toContain("SpecGraph artifact manifest is not readable");
    expect(result.detail).toContain("manifest returned HTTP 404");
    expect(result.detail).toContain("https://specgraph.tech/artifact_manifest.json");
  });
});

describe("describeSourceDeltaSnapshot", () => {
  it("uses the explicit source delta status when present", () => {
    expect(describeSourceDeltaSnapshot({
      status: "empty_delta",
      next_gap: "no_implementation_delta",
    })).toBe("source delta is empty_delta (no_implementation_delta)");
  });

  it("does not present a missing status as empty", () => {
    expect(describeSourceDeltaSnapshot({
      next_gap: "no_implementation_delta",
    })).toBe("source delta status is missing (no_implementation_delta)");
  });
});
