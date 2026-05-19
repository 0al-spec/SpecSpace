import { describe, expect, it, vi } from "vitest";
import { fetchSpecMarkdownExport } from "../model";

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const payload = {
  api_version: "v1",
  root_id: "SG-SPEC-ROOT",
  scope: "subtree",
  markdown: "# SG-SPEC-ROOT\n",
  manifest: {
    root_id: "SG-SPEC-ROOT",
    scope: "subtree",
    node_count: 1,
    max_depth_reached: 0,
    nodes_included: ["SG-SPEC-ROOT"],
    cycles_skipped: [],
    missing_skipped: [],
    load_errors: [],
  },
  source: {
    provider: "file",
    read_only: true,
  },
  download_filename: "SG-SPEC-ROOT.md",
};

describe("fetchSpecMarkdownExport", () => {
  it("fetches the selected root from /api/v1/spec-markdown", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));

    const result = await fetchSpecMarkdownExport({
      rootId: "SG-SPEC-ROOT",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/spec-markdown?root=SG-SPEC-ROOT&scope=subtree",
      { signal: undefined },
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.markdown).toContain("# SG-SPEC-ROOT");
  });

  it("can request a selected-node-only export", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));

    await fetchSpecMarkdownExport({
      rootId: "SG-SPEC-ROOT",
      scope: "node",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/spec-markdown?root=SG-SPEC-ROOT&scope=node",
      { signal: undefined },
    );
  });

  it("preserves existing query params for URL overrides", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));

    await fetchSpecMarkdownExport({
      rootId: "SG-SPEC-ROOT",
      url: "/proxy/spec-markdown?token=abc",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/proxy/spec-markdown?token=abc&root=SG-SPEC-ROOT&scope=subtree",
      { signal: undefined },
    );
  });

  it("replaces existing root and scope query params for URL overrides", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));

    await fetchSpecMarkdownExport({
      rootId: "SG-SPEC-NEW",
      scope: "node",
      url: "/proxy/spec-markdown?token=abc&root=SG-SPEC-OLD&scope=subtree",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/proxy/spec-markdown?token=abc&root=SG-SPEC-NEW&scope=node",
      { signal: undefined },
    );
  });

  it("returns http-error for backend failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        buildResponse({ error: "not found" }, { status: 404, statusText: "Not Found" }),
      );

    const result = await fetchSpecMarkdownExport({
      rootId: "SG-SPEC-MISSING",
      fetcher,
    });

    expect(result.kind).toBe("http-error");
  });

  it("returns parse-error for malformed payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({ root_id: "SG" }));

    const result = await fetchSpecMarkdownExport({ rootId: "SG", fetcher });

    expect(result.kind).toBe("parse-error");
  });

  it("rethrows AbortError", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetcher = vi.fn().mockRejectedValue(abort);

    await expect(
      fetchSpecMarkdownExport({ rootId: "SG-SPEC-ROOT", fetcher }),
    ).rejects.toBe(abort);
  });
});
