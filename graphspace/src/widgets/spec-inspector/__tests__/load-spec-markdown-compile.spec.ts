import { describe, expect, it, vi } from "vitest";
import { fetchSpecMarkdownCompile } from "../model";

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const payload = {
  api_version: "v1",
  artifact_kind: "specspace_hyperprompt_compile",
  root_id: "SG-SPEC-ROOT",
  scope: "subtree",
  source: {
    provider: "file",
    read_only: true,
  },
  export: {
    download_filename: "SG-SPEC-ROOT.md",
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
  },
  compile: {
    exit_code: 0,
    compiled_markdown: "# Compiled SG-SPEC-ROOT\n",
    compiler_manifest: {},
    stdout: "",
    stderr: "",
  },
};

describe("fetchSpecMarkdownCompile", () => {
  it("posts the selected root to /api/v1/spec-markdown/compile", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));

    const result = await fetchSpecMarkdownCompile({
      rootId: "SG-SPEC-ROOT",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith("/api/v1/spec-markdown/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: "SG-SPEC-ROOT", scope: "subtree" }),
      signal: undefined,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.compile.compiled_markdown).toContain("Compiled");
  });

  it("can request a selected-node-only compile", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({
      ...payload,
      scope: "node",
      export: {
        ...payload.export,
        manifest: { ...payload.export.manifest, scope: "node" },
      },
    }));

    await fetchSpecMarkdownCompile({
      rootId: "SG-SPEC-ROOT",
      scope: "node",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/spec-markdown/compile",
      expect.objectContaining({
        body: JSON.stringify({ root: "SG-SPEC-ROOT", scope: "node" }),
      }),
    );
  });

  it("returns http-error with diagnostic body for backend failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        buildResponse(
          { error: "Hyperprompt compile unavailable", status: "provider_unsupported" },
          { status: 503, statusText: "Service Unavailable" },
        ),
      );

    const result = await fetchSpecMarkdownCompile({
      rootId: "SG-SPEC-ROOT",
      fetcher,
    });

    expect(result.kind).toBe("http-error");
    if (result.kind !== "http-error") return;
    expect(result.body).toMatchObject({ status: "provider_unsupported" });
  });

  it("returns parse-error for malformed payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({ root_id: "SG" }));

    const result = await fetchSpecMarkdownCompile({ rootId: "SG", fetcher });

    expect(result.kind).toBe("parse-error");
  });

  it("rethrows AbortError", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetcher = vi.fn().mockRejectedValue(abort);

    await expect(
      fetchSpecMarkdownCompile({ rootId: "SG-SPEC-ROOT", fetcher }),
    ).rejects.toBe(abort);
  });
});
