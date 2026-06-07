import { describe, expect, it } from "vitest";
import { parseSpecMarkdownCompile } from "../parsers/parse-spec-markdown-compile";

const payload = {
  api_version: "v1",
  artifact_kind: "specspace_hyperprompt_compile",
  root_id: "SG-SPEC-0001",
  scope: "subtree",
  source: {
    provider: "file",
    read_only: true,
  },
  export: {
    download_filename: "SG-SPEC-0001.md",
    manifest: {
      root_id: "SG-SPEC-0001",
      scope: "subtree",
      node_count: 1,
      max_depth_reached: 0,
      nodes_included: ["SG-SPEC-0001"],
      cycles_skipped: [],
      missing_skipped: [],
      load_errors: [],
    },
  },
  compile: {
    exit_code: 0,
    compiled_markdown: "# Compiled output\n",
    compiler_manifest: {},
    export_dir: "/tmp/specspace/SG-SPEC-0001",
    root_hc: "/tmp/specspace/SG-SPEC-0001/root.hc",
    markdown_file: "/tmp/specspace/SG-SPEC-0001/export.md",
    export_manifest: "/tmp/specspace/SG-SPEC-0001/export_manifest.json",
    compiled_md: "/tmp/specspace/SG-SPEC-0001/compiled.md",
    manifest_json: "/tmp/specspace/SG-SPEC-0001/manifest.json",
    stdout: "",
    stderr: "",
  },
};

describe("parseSpecMarkdownCompile", () => {
  it("parses the /api/v1/spec-markdown/compile response shape", () => {
    const result = parseSpecMarkdownCompile(payload);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.compile.compiled_markdown).toContain("Compiled output");
  });

  it("rejects root id mismatches", () => {
    const result = parseSpecMarkdownCompile({
      ...payload,
      export: {
        ...payload.export,
        manifest: { ...payload.export.manifest, root_id: "SG-SPEC-0002" },
      },
    });

    expect(result.kind).toBe("invariant-violation");
  });

  it("rejects scope mismatches", () => {
    const result = parseSpecMarkdownCompile({
      ...payload,
      export: {
        ...payload.export,
        manifest: { ...payload.export.manifest, scope: "node" },
      },
    });

    expect(result.kind).toBe("invariant-violation");
  });

  it("rejects compile responses without export manifest scope", () => {
    const { scope: _scope, ...manifestWithoutScope } = payload.export.manifest;
    const result = parseSpecMarkdownCompile({
      ...payload,
      export: {
        ...payload.export,
        manifest: manifestWithoutScope,
      },
    });

    expect(result.kind).toBe("parse-error");
  });

  it("rejects successful responses without compiled markdown", () => {
    const result = parseSpecMarkdownCompile({
      ...payload,
      compile: { ...payload.compile, compiled_markdown: undefined },
    });

    expect(result.kind).toBe("invariant-violation");
  });
});
