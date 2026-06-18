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
