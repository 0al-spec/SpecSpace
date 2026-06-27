import { describe, expect, it } from "vitest";
import {
  expandLocalOntologyArtifactFiles,
  loadLocalOntologyArtifact,
  selectDomainOntologyPackageFile,
  selectOntologyNormalizedIrFile,
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
