import { describe, expect, it } from "vitest";
import { buildSpecPMLifecycleBadgesByNode } from "../lib/badge";

describe("buildSpecPMLifecycleBadgesByNode", () => {
  it("maps package status onto root and source spec nodes", () => {
    const badges = buildSpecPMLifecycleBadgesByNode([
      {
        package_key: "specgraph.core_repository_facade",
        root_spec_id: "SG-SPEC-0001",
        source_spec_ids: ["SG-SPEC-0001", "SG-SPEC-0054"],
        export: {
          status: "draft_preview_only",
          review_state: "draft_preview_only",
          next_gap: "review_draft_specpm_boundary",
        },
      },
    ]);

    expect(badges.get("SG-SPEC-0001")).toEqual({
      packageKey: "specgraph.core_repository_facade",
      status: "draft_preview_only",
      tone: "draft",
    });
    expect(badges.get("SG-SPEC-0054")?.status).toBe("draft_preview_only");
  });

  it("prefers blocked package signals when multiple packages touch a node", () => {
    const badges = buildSpecPMLifecycleBadgesByNode([
      {
        package_key: "ready.package",
        source_spec_ids: ["SG-SPEC-0001"],
        export: {
          status: "ready_for_review",
          review_state: "ready_for_review",
          next_gap: null,
        },
      },
      {
        package_key: "blocked.package",
        source_spec_ids: ["SG-SPEC-0001"],
        export: {
          status: "blocked_by_consumer_gap",
          review_state: "blocked_by_consumer_gap",
          next_gap: "repair_specpm_export_registry",
        },
      },
    ]);

    expect(badges.get("SG-SPEC-0001")).toEqual({
      packageKey: "blocked.package",
      status: "blocked_by_consumer_gap",
      tone: "blocked",
    });
  });

  it("uses the strongest stage tone inside a package", () => {
    const badges = buildSpecPMLifecycleBadgesByNode([
      {
        package_key: "pkg",
        source_spec_ids: ["SG-SPEC-0001"],
        export: {
          status: "ready_for_handoff",
          review_state: "ready_for_handoff",
          next_gap: null,
        },
        import: {
          status: "blocked_by_bundle_gap",
          review_state: "blocked_by_bundle_gap",
          next_gap: "repair_specpm_bundle",
        },
      },
    ]);

    expect(badges.get("SG-SPEC-0001")?.status).toBe("blocked_by_bundle_gap");
    expect(badges.get("SG-SPEC-0001")?.tone).toBe("blocked");
  });
});
