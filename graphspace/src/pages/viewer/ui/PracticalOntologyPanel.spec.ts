import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PracticalOntology } from "../model/use-practical-ontology";
import { OntologyGraphDemoLens, PracticalOntologyPanel } from "./PracticalOntologyPanel";

const practicalOntology: PracticalOntology = {
  apiVersion: "v1",
  artifactKind: "specspace_practical_ontology",
  schemaVersion: 1,
  generatedAt: "2026-06-17T12:00:00Z",
  readOnly: true,
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  source: { provider: "file", ontology_mode: "curated_core_seed" },
  sources: {
    curated_seed: {
      available: true,
      id: "specgraph.core.v0",
      title: "SpecGraph Core Ontology",
      entry_count: 3,
      relation_count: 2,
    },
    legacy_extraction: { available: false, reason: "removed_from_primary_ontology_surface" },
  },
  summary: {
    termCount: 3,
    relationCount: 2,
    semanticRelationCount: 2,
    topologyEdgeCount: 0,
    proposalReferenceCount: 0,
    domainCount: 1,
    sourceCount: 1,
    gapCount: 0,
    diffAddedClassCount: 0,
    diffBreakingChangeCount: 0,
  },
  domains: [
    {
      domainId: "domain.ontology",
      label: "SpecGraph Core",
      termCount: 3,
      termKinds: ["ontology", "entity"],
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
    },
  ],
  terms: [
    {
      termId: "ontology.specgraph",
      label: "SpecGraph",
      kind: "ontology",
      domain: "SpecGraph Core",
      canonicalRef: "SG-SPEC-0001",
      description: "Executable product ontology.",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
    {
      termId: "entity.spec",
      label: "Spec",
      kind: "entity",
      domain: "SpecGraph Core",
      canonicalRef: "SG-SPEC-0001#specification.node_kinds.spec",
      description: "Versioned specification artifact.",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
    {
      termId: "entity.requirement",
      label: "Requirement",
      kind: "entity",
      domain: "SpecGraph Core",
      canonicalRef: "SG-SPEC-0001#specification.node_kinds.requirement",
      description: "Verifiable obligation.",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
  ],
  relations: [
    {
      relationId: "specgraph--contains--spec",
      sourceTerm: "SpecGraph",
      relation: "contains",
      targetTerm: "Spec",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
    {
      relationId: "spec--defines--requirement",
      sourceTerm: "Spec",
      relation: "defines",
      targetTerm: "Requirement",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
  ],
  package: null,
  gaps: [],
  compatibilityDiff: null,
  governanceEvidence: [],
  rawArtifacts: [{ artifact: "curated_seed", path: "curated://specspace/specgraph-core-v0" }],
  topologyEdges: [],
  proposalReferences: [],
  relationTaxonomy: {
    relations: "curated semantic ontology relations",
    topology_edges: "legacy topology extraction removed",
  },
  authorityBoundary: {
    practicalOntologyIsAuthority: false,
    derivedFromSpecgraphSources: false,
    compilerArtifactBacked: false,
    mayWriteOntologyPackage: false,
    mayMutateCanonicalSpecs: false,
    mayMarkCandidateAccepted: false,
  },
};

const compilerBackedOntology: PracticalOntology = {
  ...practicalOntology,
  source: {
    provider: "http",
    ontology_mode: "compiler_artifact_projection",
    package_ref: "org.0al.specgraph.core@0.1.0",
  },
  summary: {
    ...practicalOntology.summary,
    gapCount: 1,
    diffAddedClassCount: 1,
    sourceCount: 5,
  },
  package: {
    packageId: "org.0al.specgraph.core",
    namespace: "sgcore",
    version: "0.1.0",
    packageRef: "org.0al.specgraph.core@0.1.0",
    authorityClass: "draft_imported",
    sourceRef: "codex/ont-038-specgraph-core-package",
    sourceUri: "git+https://github.com/0al-spec/Ontology.git",
    digest: "sha256:22022e3",
    materializedIr: "ontology/specgraph-core/ontology.normalized.json",
    acceptedByProposal: "SG-RFC-0130-smoke",
  },
  gaps: [
    {
      gapId: "ontology-gap-sgcore-claimcalibration",
      severity: "medium",
      targetPackage: "org.0al.specgraph.core@0.1.0",
      recommendedRoute: "ontology_package_draft",
      missingRef: "sgcore:ClaimCalibration",
      missingConcept: "ClaimCalibration",
      namespaceHint: "sgcore",
      subject: "proposal SG-RFC-0130",
      neededBy: ["0060", "SG-RFC-0130"],
      sourceRefs: ["tests/fixtures/ontology_import/specgraph-core/import-fixture.yaml"],
    },
  ],
  compatibilityDiff: {
    compatible: true,
    fromRef: "org.0al.specgraph.core@0.1.0",
    toRef: "org.0al.specgraph.core@0.2.0",
    packageRef: "org.0al.specgraph.core",
    status: "compatible",
    nextGap: "review_required_specgraph_actions",
    addedClasses: ["sgcore:ClaimCalibration"],
    addedRelations: [],
    removedClasses: [],
    removedRelations: [],
    breakingChanges: [],
    requiredSpecgraphActions: ["updateLockfile"],
    sourceRefs: ["tests/fixtures/ontology_import/specgraph-core/compatibility-report.yaml"],
  },
  governanceEvidence: [
    {
      packageRef: "org.0al.specgraph.core@0.1.0",
      lifecycleState: "draft",
      decisionRef: "https://github.com/0al-spec/Ontology/pull/57",
      validationReportRef: "Ontology:SPECS/INPROGRESS/ONT-038_Validation_Report.md",
      repeatabilityReportRef: "Ontology:Tests/OntologyCompilerTests/SpecGraphCorePackageTests.swift",
      trustedRegistryGateRef: "Ontology:SPECS/ontology/packages/specgraph-core/README.md#scope",
    },
  ],
  rawArtifacts: [
    { artifact: "ontology_package_index", path: "runs/ontology_package_index.json" },
    {
      artifact: "ontology_normalized_ir",
      path: "ontology/specgraph-core/ontology.normalized.json",
    },
  ],
  authorityBoundary: {
    ...practicalOntology.authorityBoundary,
    derivedFromSpecgraphSources: true,
    compilerArtifactBacked: true,
  },
};

describe("PracticalOntologyPanel", () => {
  it("renders readonly curated core terms and relations", () => {
    const html = renderToStaticMarkup(
      createElement(PracticalOntologyPanel, {
        state: { kind: "ok", data: practicalOntology },
      }),
    );

    expect(html).toContain("SpecGraph");
    expect(html).toContain("Requirement");
    expect(html).toContain("Spec → Requirement");
    expect(html).toContain("curated_core_seed");
    expect(html).toContain("working_draft");
    expect(html).toContain("Diff !");
    expect(html).toContain("Open ontology graph");
    expect(html).toContain("Compiler IR unavailable");
  });

  it("renders compiler package metadata with gaps, diffs, and governance evidence", () => {
    const html = renderToStaticMarkup(
      createElement(PracticalOntologyPanel, {
        state: { kind: "ok", data: compilerBackedOntology },
      }),
    );

    expect(html).toContain("Compiler IR package");
    expect(html).toContain("org.0al.specgraph.core");
    expect(html).toContain("ontology/specgraph-core/ontology.normalized.json");
    expect(html).toContain("Import Gaps");
    expect(html).toContain("ClaimCalibration");
    expect(html).toContain("Compatibility Diff");
    expect(html).toContain("sgcore:ClaimCalibration");
    expect(html).toContain("Governance Evidence");
    expect(html).toContain("https://github.com/0al-spec/Ontology/pull/57");
    expect(html).toContain("Raw Artifacts");
    expect(html).toContain("runs/ontology_package_index.json");
  });

  it("renders a curated ontology graph lens", () => {
    const html = renderToStaticMarkup(
      createElement(OntologyGraphDemoLens, {
        data: practicalOntology,
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("Ontology Graph Lens");
    expect(html).toContain("SpecGraph Core Ontology v0");
    expect(html).toContain("working_draft");
    expect(html).toContain("ontology links");
    expect(html).toContain("breaking changes");
    expect(html).toContain("curated seed links");
    expect(html).toContain("SpecGraph");
  });
});
