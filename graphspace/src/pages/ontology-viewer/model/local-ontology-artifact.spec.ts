import { describe, expect, it } from "vitest";
import {
  expandLocalOntologyArtifactFiles,
  loadLocalOntologyArtifact,
  selectDomainOntologyPackageFile,
  selectOntologyNormalizedIrFile,
  selectViewerArchiveManifest,
} from "./local-ontology-artifact";

const validIr = JSON.stringify({
  id: "example.local",
  namespace: "local",
  version: "0.1.0",
  classes: [
    {
      id: "Root",
      fqid: "local:Root",
      kind: "DomainEntity",
    },
    {
      id: "Leaf",
      fqid: "local:Leaf",
      kind: "DomainEntity",
      extends: "local:Root",
    },
  ],
  relations: [
    {
      id: "hasLeaf",
      fqid: "local:hasLeaf",
      domain: "local:Root",
      range: "local:Leaf",
    },
  ],
});

function file(path: string, text: string, name = path.split("/").at(-1) ?? path) {
  return { name, path, text };
}

const packageYaml = [
  "apiVersion: ontology.specgraph.io/v1alpha1",
  "kind: DomainOntologyPackage",
  "metadata:",
  "  id: example.local",
  "  namespace: local",
  "  version: 0.1.0",
  "  publisher: OntologyService",
  "  source: SPECS/ontology/packages/local/domain-ontology-package.yaml",
  "  approvalStatus: draft",
  "spec:",
  "  imports: []",
].join("\n");

function viewerManifest(
  artifacts: readonly Record<string, unknown>[] = [
    {
      path: "domain-ontology-package.yaml",
      role: "package_source",
      required: true,
      media_type: "application/yaml",
    },
    {
      path: "generated/ontology.normalized.json",
      role: "normalized_ir",
      required: true,
      media_type: "application/json",
    },
    {
      path: "generated/refs.ts",
      role: "generated_sdk",
      required: false,
      media_type: "text/typescript",
    },
  ],
) {
  return JSON.stringify({
    artifact_kind: "ontology_viewer_archive_manifest",
    schema_version: 1,
    package: {
      id: "example.local",
      namespace: "local",
      version: "0.1.0",
    },
    artifacts,
    authority_boundary: {
      viewer_manifest_is_authority: false,
      may_write_ontology_package: false,
      may_publish_registry_entry: false,
      may_mutate_specgraph: false,
    },
  });
}

function zipStore(entries: readonly (readonly [string, string])[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [path, text] of entries) {
    const nameBytes = encoder.encode(path);
    const dataBytes = encoder.encode(text);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(18, dataBytes.length, true);
    view.setUint32(22, dataBytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    chunks.push(header, dataBytes);
  }

  const centralDirectory = new Uint8Array(4);
  new DataView(centralDirectory.buffer).setUint32(0, 0x02014b50, true);
  chunks.push(centralDirectory);

  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

describe("local ontology artifact loading", () => {
  it("selects ontology.normalized.json from generated package paths", () => {
    const selected = selectOntologyNormalizedIrFile([
      file("domain-ontology-package.yaml", "metadata"),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(selected?.path).toBe("generated/ontology.normalized.json");
  });

  it("prefers the shortest normalized IR candidate", () => {
    const selected = selectOntologyNormalizedIrFile([
      file("archives/package/generated/ontology.normalized.json", validIr),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(selected?.path).toBe("generated/ontology.normalized.json");
  });

  it("selects domain ontology package metadata from package paths", () => {
    const selected = selectDomainOntologyPackageFile([
      file("nested/domain-ontology-package.yaml", packageYaml),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(selected?.path).toBe("nested/domain-ontology-package.yaml");
  });

  it("selects a viewer archive manifest by artifact kind", () => {
    const selected = selectViewerArchiveManifest([
      file("ontology-viewer-archive-manifest.json", viewerManifest()),
    ]);

    expect(selected?.kind).toBe("selected");
    if (selected?.kind !== "selected") return;
    expect(selected.manifest.package.id).toBe("example.local");
    expect(selected.manifest.artifacts.map((artifact) => artifact.role)).toEqual([
      "package_source",
      "normalized_ir",
      "generated_sdk",
    ]);
  });

  it("loads valid normalized IR into an ontology graph projection", () => {
    const result = loadLocalOntologyArtifact([
      file("domain-ontology-package.yaml", packageYaml),
      file("generated/ontology.normalized.json", validIr),
      file("generated/sdk/typescript/index.ts", "export {};"),
      file("compatibility/local-0.2.0.yaml", "status: compatible"),
      file("governance/decision.yaml", "status: accepted"),
    ]);

    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.projection.package).toEqual({
      id: "example.local",
      namespace: "local",
      version: "0.1.0",
    });
    expect(result.projection.nodes.map((node) => node.id)).toEqual([
      "local:Leaf",
      "local:Root",
    ]);
    expect(result.projection.edges.map((edge) => edge.id)).toEqual([
      "extends:local:Leaf->local:Root",
      "relation:local:hasLeaf",
    ]);
    expect(result.projection.sourceFiles).toEqual([
      {
        path: "generated/ontology.normalized.json",
        role: "normalized_ir",
      },
    ]);
    expect(result.packageMetadata).toEqual({
      path: "domain-ontology-package.yaml",
      id: "example.local",
      namespace: "local",
      version: "0.1.0",
      publisher: "OntologyService",
      source: "SPECS/ontology/packages/local/domain-ontology-package.yaml",
      approvalStatus: "draft",
    });
    expect(result.packageShape).toMatchObject({
      normalizedIrPath: "generated/ontology.normalized.json",
      packageMetadataPath: "domain-ontology-package.yaml",
      manifestPath: null,
      generatedFileCount: 2,
      sdkFileCount: 1,
      compatibilityArtifactCount: 1,
      governanceArtifactCount: 1,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("reports missing normalized IR", () => {
    const result = loadLocalOntologyArtifact([
      file("domain-ontology-package.yaml", packageYaml),
    ]);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.packageMetadata?.id).toBe("example.local");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "normalized_ir_missing",
    );
  });

  it("reports invalid JSON", () => {
    const result = loadLocalOntologyArtifact([
      file("domain-ontology-package.yaml", packageYaml),
      file("generated/ontology.normalized.json", "{"),
    ]);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.diagnostics).toEqual([
      {
        severity: "error",
        code: "normalized_ir_invalid_json",
        message: "ontology.normalized.json is not valid JSON.",
        path: "generated/ontology.normalized.json",
      },
    ]);
  });

  it("reports invalid normalized IR shape", () => {
    const result = loadLocalOntologyArtifact([
      file("generated/ontology.normalized.json", JSON.stringify({ classes: "nope" })),
    ]);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.diagnostics[0]).toMatchObject({
      severity: "warning",
      code: "package_metadata_missing",
    });
    expect(result.diagnostics[1]).toMatchObject({
      severity: "error",
      code: "normalized_ir_shape_invalid",
      path: "generated/ontology.normalized.json#classes",
    });
  });

  it("expands stored ZIP archives and loads package metadata from archive members", async () => {
    const bytes = zipStore([
      ["package/domain-ontology-package.yaml", packageYaml],
      ["package/generated/ontology.normalized.json", validIr],
    ]);
    const expanded = await expandLocalOntologyArtifactFiles([
      { name: "package.zip", path: "package.zip", text: "", bytes },
    ]);
    const result = loadLocalOntologyArtifact(expanded.files);

    expect(expanded.diagnostics).toEqual([]);
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.packageShape.archiveFileCount).toBe(2);
    expect(result.packageMetadata?.path).toBe(
      "package.zip!/package/domain-ontology-package.yaml",
    );
    expect(result.packageShape.normalizedIrPath).toBe(
      "package.zip!/package/generated/ontology.normalized.json",
    );
  });

  it("uses viewer archive manifest paths when present", () => {
    const result = loadLocalOntologyArtifact([
      file("bundle/ontology-viewer-archive-manifest.json", viewerManifest()),
      file("bundle/domain-ontology-package.yaml", packageYaml),
      file("bundle/generated/ontology.normalized.json", validIr),
      file("bundle/generated/refs.ts", "export {};"),
    ]);

    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.packageShape.manifestPath).toBe(
      "bundle/ontology-viewer-archive-manifest.json",
    );
    expect(result.packageShape.packageMetadataPath).toBe(
      "bundle/domain-ontology-package.yaml",
    );
    expect(result.packageShape.normalizedIrPath).toBe(
      "bundle/generated/ontology.normalized.json",
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("resolves viewer manifest paths inside ZIP archive members", async () => {
    const bytes = zipStore([
      ["package/ontology-viewer-archive-manifest.json", viewerManifest()],
      ["package/domain-ontology-package.yaml", packageYaml],
      ["package/generated/ontology.normalized.json", validIr],
    ]);
    const expanded = await expandLocalOntologyArtifactFiles([
      { name: "package.zip", path: "package.zip", text: "", bytes },
    ]);
    const result = loadLocalOntologyArtifact(expanded.files);

    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.packageShape.manifestPath).toBe(
      "package.zip!/package/ontology-viewer-archive-manifest.json",
    );
    expect(result.packageShape.normalizedIrPath).toBe(
      "package.zip!/package/generated/ontology.normalized.json",
    );
  });

  it("reports missing required viewer manifest artifacts", () => {
    const result = loadLocalOntologyArtifact([
      file("ontology-viewer-archive-manifest.json", viewerManifest()),
      file("domain-ontology-package.yaml", packageYaml),
    ]);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewer_manifest_required_artifact_missing",
    ]);
  });

  it("rejects malformed named viewer manifests instead of guessing legacy IR", () => {
    const result = loadLocalOntologyArtifact([
      file("ontology-viewer-archive-manifest.json", "{"),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(result.kind).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewer_manifest_invalid_json",
    ]);
  });

  it("does not fallback to legacy normalized IR when manifest declares a missing IR path", () => {
    const result = loadLocalOntologyArtifact([
      file(
        "ontology-viewer-archive-manifest.json",
        viewerManifest([
          {
            path: "generated/current.normalized.json",
            role: "normalized_ir",
            required: true,
          },
        ]),
      ),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(result.kind).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewer_manifest_required_artifact_missing",
    ]);
  });

  it("does not fallback to legacy package metadata when manifest declares package source", () => {
    const result = loadLocalOntologyArtifact([
      file(
        "ontology-viewer-archive-manifest.json",
        viewerManifest([
          {
            path: "package/domain-ontology-package.yaml",
            role: "package_source",
            required: false,
          },
          {
            path: "generated/ontology.normalized.json",
            role: "normalized_ir",
            required: true,
          },
        ]),
      ),
      file("domain-ontology-package.yaml", packageYaml),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.packageMetadata?.path).toBe("ontology-viewer-archive-manifest.json");
    expect(result.packageShape.packageMetadataPath).toBeNull();
  });

  it("fails manifest imports when required package source is missing even if IR exists", () => {
    const result = loadLocalOntologyArtifact([
      file("ontology-viewer-archive-manifest.json", viewerManifest()),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(result.kind).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewer_manifest_required_artifact_missing",
    ]);
  });

  it("rejects viewer manifest paths that escape the manifest directory", () => {
    const result = loadLocalOntologyArtifact([
      file(
        "bundle/ontology-viewer-archive-manifest.json",
        viewerManifest([
          {
            path: "../generated/ontology.normalized.json",
            role: "normalized_ir",
            required: true,
          },
        ]),
      ),
      file("generated/ontology.normalized.json", validIr),
    ]);

    expect(result.kind).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewer_manifest_required_artifact_missing",
    ]);
  });

  it("reports unsupported archive layouts with actionable diagnostics", async () => {
    const bytes = zipStore([["README.md", "not an ontology package"]]);
    const expanded = await expandLocalOntologyArtifactFiles([
      { name: "notes.zip", path: "notes.zip", text: "", bytes },
    ]);
    const result = loadLocalOntologyArtifact(expanded.files);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "package_metadata_missing",
      "generated_folder_missing",
      "normalized_ir_missing",
    ]);
  });
});
