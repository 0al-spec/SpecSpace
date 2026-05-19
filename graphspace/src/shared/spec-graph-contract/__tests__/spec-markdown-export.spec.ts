import { describe, expect, it } from "vitest";
import { parseSpecMarkdownExport } from "../parsers/parse-spec-markdown-export";

const payload = {
  api_version: "v1",
  root_id: "SG-SPEC-0001",
  markdown: "# SG-SPEC-0001\n",
  manifest: {
    root_id: "SG-SPEC-0001",
    node_count: 1,
    max_depth_reached: 0,
    nodes_included: ["SG-SPEC-0001"],
    cycles_skipped: [],
    missing_skipped: [],
    load_errors: [],
  },
  source: {
    provider: "http",
    read_only: true,
    artifact_base_url: "https://specgraph.tech",
  },
  download_filename: "SG-SPEC-0001.md",
};

describe("parseSpecMarkdownExport", () => {
  it("parses the /api/v1/spec-markdown response shape", () => {
    const result = parseSpecMarkdownExport(payload);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.markdown).toContain("# SG-SPEC-0001");
    expect(result.data.source.provider).toBe("http");
  });

  it("rejects root id mismatches", () => {
    const result = parseSpecMarkdownExport({
      ...payload,
      manifest: { ...payload.manifest, root_id: "SG-SPEC-0002" },
    });

    expect(result.kind).toBe("invariant-violation");
  });

  it("rejects non-markdown filenames", () => {
    const result = parseSpecMarkdownExport({
      ...payload,
      download_filename: "SG-SPEC-0001.txt",
    });

    expect(result.kind).toBe("invariant-violation");
  });
});
