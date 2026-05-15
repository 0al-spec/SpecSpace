import { describe, expect, it, vi } from "vitest";
import { fetchSpecPMLifecycleBadges } from "../model/load-specpm-lifecycle-badges";

const artifact = {
  available: false,
  generated_at: null,
  entry_count: 0,
};

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("fetchSpecPMLifecycleBadges", () => {
  it("loads lifecycle data and projects package status onto source nodes", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({
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
      }),
    );

    const result = await fetchSpecPMLifecycleBadges({ fetcher });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(fetcher).toHaveBeenCalledWith("/api/v1/specpm/lifecycle", { signal: undefined });
    expect(result.badgesByNode.get("SG-SPEC-0001")).toEqual({
      packageKey: "specgraph.core_repository_facade",
      status: "draft_preview_only",
      tone: "draft",
    });
  });

  it("returns http-error without throwing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(buildResponse({ error: "not configured" }, { status: 404, statusText: "Not Found" }));

    const result = await fetchSpecPMLifecycleBadges({ fetcher });

    expect(result.kind).toBe("http-error");
  });
});
