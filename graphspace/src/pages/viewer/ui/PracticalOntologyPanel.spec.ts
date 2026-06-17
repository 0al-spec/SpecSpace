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
    relationCount: 1,
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
  relations: [
    {
      relationId: "ontology-grounding--mentions-spec--sg-spec-0001",
      sourceTerm: "Ontology Grounding",
      relation: "mentions_spec",
      targetTerm: "SG-SPEC-0001",
      sourceRefs: ["docs/proposals/0100_ontology_grounding.md"],
      evidenceCount: 1,
    },
  ],
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
    expect(html).toContain("mentions_spec");
    expect(html).toContain("not_authority");
  });
});
