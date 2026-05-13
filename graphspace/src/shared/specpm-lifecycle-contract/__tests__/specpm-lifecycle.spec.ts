import { describe, expect, it } from "vitest";
import { parseSpecPMLifecycle } from "../parsers/parse-specpm-lifecycle";

const artifact = {
  available: false,
  generated_at: null,
  entry_count: 0,
};

const lifecycle = {
  packages: [
    {
      package_key: "specgraph.core_repository_facade",
      root_spec_id: "SG-SPEC-0001",
      source_spec_ids: ["SG-SPEC-0001"],
      export: {
        status: "draft_preview_only",
        review_state: "draft_preview_only",
        next_gap: "review_draft_specpm_boundary",
      },
    },
  ],
  package_count: 1,
  import_source: null,
  artifacts: {
    export_preview: { ...artifact, available: true, entry_count: 1 },
    handoff_packets: artifact,
    materialization_report: artifact,
    import_preview: artifact,
    import_handoff_packets: artifact,
  },
};

describe("parseSpecPMLifecycle", () => {
  it("accepts lifecycle packages with SpecGraph source anchors", () => {
    const result = parseSpecPMLifecycle(lifecycle);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.packages[0].root_spec_id).toBe("SG-SPEC-0001");
    expect(result.data.packages[0].source_spec_ids).toEqual(["SG-SPEC-0001"]);
  });

  it("rejects package count mismatches", () => {
    const result = parseSpecPMLifecycle({ ...lifecycle, package_count: 2 });
    expect(result.kind).toBe("invariant-violation");
  });

  it("defaults missing source ids to an empty array", () => {
    const result = parseSpecPMLifecycle({
      ...lifecycle,
      packages: [{ package_key: "pkg", export: lifecycle.packages[0].export }],
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.packages[0].source_spec_ids).toEqual([]);
  });
});
