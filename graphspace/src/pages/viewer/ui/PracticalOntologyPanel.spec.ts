import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PracticalOntology } from "../model/use-practical-ontology";
import { PracticalOntologyPanel } from "./PracticalOntologyPanel";

const practicalOntology: PracticalOntology = {
  apiVersion: "v1",
  artifactKind: "specspace_practical_ontology",
  schemaVersion: 1,
  generatedAt: "2026-06-17T12:00:00Z",
  readOnly: true,
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  source: { provider: "file" },
  sources: {
    spec_nodes: { available: true, entry_count: 1 },
    proposal_markdown: { available: true, entry_count: 1 },
  },
  summary: {
    termCount: 2,
    relationCount: 0,
    semanticRelationCount: 0,
    topologyEdgeCount: 1,
    proposalReferenceCount: 1,
    domainCount: 1,
    sourceCount: 2,
  },
  domains: [
    {
      domainId: "domain.ontology",
      label: "Ontology",
      termCount: 2,
      termKinds: ["spec_node", "proposal"],
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
    },
  ],
  terms: [
    {
      termId: "spec_node.specgraph-ontology-boundary",
      label: "SpecGraph Ontology Boundary",
      kind: "spec_node",
      domain: "Ontology",
      canonicalRef: "SG-SPEC-0001",
      description: "Define vocabulary.",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
    },
    {
      termId: "proposal.ontology-grounding",
      label: "Ontology Grounding",
      kind: "proposal",
      domain: "Ontology",
      canonicalRef: "0100",
      description: null,
      sourceRefs: ["docs/proposals/0100_ontology_grounding.md"],
      evidenceCount: 1,
    },
  ],
  relations: [],
  topologyEdges: [
    {
      edgeId: "sg-spec-0001--depends-on--sg-spec-0002",
      sourceId: "SG-SPEC-0001",
      sourceTitle: "SpecGraph Ontology Boundary",
      relation: "depends_on",
      targetId: "SG-SPEC-0002",
      targetTitle: "SpecSpace Review Surface",
      displayLabel: "SG-SPEC-0001 depends_on SG-SPEC-0002",
      sourceRefs: ["specs/nodes/SG-SPEC-0001.yaml"],
      evidenceCount: 1,
      authorityClass: "specgraph_topology",
    },
  ],
  proposalReferences: [
    {
      referenceId: "0100--mentions-spec--sg-spec-0001",
      proposalId: "0100",
      proposalTitle: "Ontology Grounding",
      relation: "mentions_spec",
      targetSpecId: "SG-SPEC-0001",
      displayLabel: "0100 mentions SG-SPEC-0001",
      sourceRefs: ["docs/proposals/0100_ontology_grounding.md"],
      evidenceCount: 1,
      authorityClass: "proposal_reference",
    },
  ],
  relationTaxonomy: {
    relations: "semantic ontology relation observations only",
    topology_edges: "SpecGraph graph topology facts",
  },
  authorityBoundary: {
    practicalOntologyIsAuthority: false,
    derivedFromSpecgraphSources: true,
    mayWriteOntologyPackage: false,
    mayMutateCanonicalSpecs: false,
    mayMarkCandidateAccepted: false,
  },
};

describe("PracticalOntologyPanel", () => {
  it("renders readonly derived terms and relations", () => {
    const html = renderToStaticMarkup(
      createElement(PracticalOntologyPanel, {
        state: { kind: "ok", data: practicalOntology },
      }),
    );

    expect(html).toContain("SpecGraph Ontology Boundary");
    expect(html).toContain("Ontology Grounding");
    expect(html).toContain("SG-SPEC-0001 depends_on SG-SPEC-0002");
    expect(html).toContain("0100 mentions SG-SPEC-0001");
    expect(html).toContain("mentions_spec");
    expect(html).toContain("not_authority");
  });
});
