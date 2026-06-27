import { describe, expect, it } from "vitest";
import {
  loadLocalOntologyArtifact,
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

  it("loads valid normalized IR into an ontology graph projection", () => {
    const result = loadLocalOntologyArtifact([
      file("generated/ontology.normalized.json", validIr),
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
  });

  it("reports missing normalized IR", () => {
    const result = loadLocalOntologyArtifact([
      file("domain-ontology-package.yaml", "metadata"),
    ]);

    expect(result).toEqual({
      kind: "failed",
      diagnostics: [
        {
          severity: "error",
          code: "normalized_ir_missing",
          message: "No ontology.normalized.json file was found in the selected files.",
          path: null,
        },
      ],
    });
  });

  it("reports invalid JSON", () => {
    const result = loadLocalOntologyArtifact([
      file("generated/ontology.normalized.json", "{"),
    ]);

    expect(result).toEqual({
      kind: "failed",
      diagnostics: [
        {
          severity: "error",
          code: "normalized_ir_invalid_json",
          message: "ontology.normalized.json is not valid JSON.",
          path: "generated/ontology.normalized.json",
        },
      ],
    });
  });

  it("reports invalid normalized IR shape", () => {
    const result = loadLocalOntologyArtifact([
      file("generated/ontology.normalized.json", JSON.stringify({ classes: "nope" })),
    ]);

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "normalized_ir_shape_invalid",
      path: "generated/ontology.normalized.json#classes",
    });
  });
});
