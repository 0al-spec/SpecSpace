import { describe, expect, it } from "vitest";
import specgraphCoreFixture from "../fixtures/ontology_normalized_ir.specgraph-core.min.json";
import missingTargetFixture from "../fixtures/ontology_normalized_ir.invalid-missing-target.json";
import { projectOntologyNormalizedIr } from "../parsers/project-ontology-normalized-ir";

describe("ontology graph projection", () => {
  it("projects normalized ontology IR classes and relations into graph nodes and edges", () => {
    const result = projectOntologyNormalizedIr(specgraphCoreFixture, {
      sourceFiles: [
        {
          path: "generated/ontology.normalized.json",
          role: "normalized_ir",
        },
      ],
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.data.artifactKind).toBe("ontology_graph_projection/v1");
    expect(result.data.package).toEqual({
      id: "org.0al.specgraph.core",
      namespace: "sgcore",
      version: "0.1.0",
    });
    expect(result.data.nodes.map((node) => node.id)).toEqual([
      "sgcore:Requirement",
      "sgcore:Spec",
      "sgcore:SpecGraph",
    ]);
    expect(result.data.edges.map((edge) => edge.id)).toEqual([
      "extends:sgcore:Requirement->sgcore:Spec",
      "relation:sgcore:containsSpec",
      "relation:sgcore:definesRequirement",
    ]);
    expect(result.data.diagnostics).toEqual([]);
    expect(result.data.sourceFiles).toEqual([
      {
        path: "generated/ontology.normalized.json",
        role: "normalized_ir",
      },
    ]);
    expect(result.data.authorityBoundary).toEqual({
      ontologyViewerIsAuthority: false,
      mayWriteOntologyPackage: false,
      mayMutateCanonicalSpecs: false,
      mayPublishRegistryEntry: false,
    });
  });

  it("reports relation endpoint diagnostics without inventing missing nodes", () => {
    const result = projectOntologyNormalizedIr(missingTargetFixture);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.data.nodes.map((node) => node.id)).toEqual(["invalid:KnownClass"]);
    expect(result.data.edges).toEqual([]);
    expect(result.data.diagnostics).toEqual([
      {
        severity: "error",
        code: "relation_endpoint_missing",
        message:
          "invalid:pointsToMissing references a missing domain or range class.",
        ref: "invalid:pointsToMissing",
      },
    ]);
  });

  it("returns parse errors for malformed normalized IR shape", () => {
    const result = projectOntologyNormalizedIr({
      id: "example.invalid",
      namespace: "invalid",
      classes: "not-a-list",
    });

    expect(result.kind).toBe("parse-error");
    if (result.kind !== "parse-error") return;
    expect(result.issues.map((issue) => issue.path.join("."))).toContain("classes");
  });

  it("reports duplicate class and relation ids as diagnostics", () => {
    const result = projectOntologyNormalizedIr({
      id: "example.duplicates",
      namespace: "dup",
      classes: [
        { id: "Thing", fqid: "dup:Thing" },
        { id: "ThingAgain", fqid: "dup:Thing" },
      ],
      relations: [
        {
          id: "same",
          fqid: "dup:same",
          domain: "dup:Thing",
          range: "dup:Thing",
        },
        {
          id: "sameAgain",
          fqid: "dup:same",
          domain: "dup:Thing",
          range: "dup:Thing",
        },
      ],
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.diagnostics).toEqual([
      {
        severity: "error",
        code: "duplicate_class_id",
        message: "dup:Thing appears more than once in the normalized ontology IR.",
        ref: "dup:Thing",
      },
      {
        severity: "error",
        code: "duplicate_relation_id",
        message: "dup:same appears more than once in the normalized ontology IR.",
        ref: "dup:same",
      },
    ]);
  });
});
