import { describe, expect, it } from "vitest";
import { describeLive } from "./live-status";

const noun = {
  items: "items",
  itemSingular: "item",
  emptyLive: "No items emitted yet",
};

describe("describeLive", () => {
  it("keeps live ok artifacts separate from fallback states", () => {
    const status = describeLive({
      kind: "ok",
      data: {},
      meta: { path: "runs/x.json", mtime: 1, mtime_iso: "2026-05-11T00:00:00+00:00" },
    }, noun);

    expect(status).toEqual({
      caption: "live",
      emptyMessage: "No items emitted yet",
    });
  });

  it("describes unsupported future schemas", () => {
    const status = describeLive({
      kind: "version-not-supported",
      artifact_kind: "implementation_work_index",
      schema_version: 99,
      max_supported: 1,
    }, noun);

    expect(status.caption).toBe("live · schema_version 99 unsupported · sample fallback");
    expect(status.emptyMessage).toBe("schema_version 99 > max 1");
  });
});
