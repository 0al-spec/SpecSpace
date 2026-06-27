import { describe, expect, it } from "vitest";
import type { OntologyGraphProjection } from "./ontology-graph-contract";
import { toOntologyFlowElements } from "./ontology-flow-elements";

const projection: OntologyGraphProjection = {
  artifactKind: "ontology_graph_projection/v1",
  schemaVersion: 1,
  package: {
    id: "example.graph",
    namespace: "graph",
    version: "0.1.0",
  },
  metadata: {
    imports: [],
    policies: [],
    protocols: [],
    stateMachines: [],
    compatibility: [],
  },
  nodes: [
    {
      id: "graph:Root",
      label: "Root",
      fqid: "graph:Root",
      kind: "DomainEntity",
      description: "Root node.",
      uri: null,
      central: true,
      extends: null,
      implements: [],
    },
    {
      id: "graph:Leaf",
      label: "Leaf",
      fqid: "graph:Leaf",
      kind: "DomainEntity",
      description: "Leaf node.",
      uri: null,
      central: false,
      extends: "graph:Root",
      implements: [],
    },
  ],
  edges: [
    {
      id: "relation:graph:hasLeaf",
      kind: "relation",
      label: "hasLeaf",
      source: "graph:Root",
      target: "graph:Leaf",
      relationFqid: "graph:hasLeaf",
      description: "Root points to leaf.",
      uri: null,
      cardinality: null,
    },
    {
      id: "extends:graph:Leaf->graph:Root",
      kind: "extends",
      label: "extends",
      source: "graph:Leaf",
      target: "graph:Root",
      relationFqid: "extends",
      description: null,
      uri: null,
      cardinality: null,
    },
  ],
  diagnostics: [],
  sourceFiles: [],
  authorityBoundary: {
    ontologyViewerIsAuthority: false,
    mayWriteOntologyPackage: false,
    mayMutateCanonicalSpecs: false,
    mayPublishRegistryEntry: false,
  },
};

describe("ontology flow elements", () => {
  it("builds deterministic React Flow nodes and edges", () => {
    const flow = toOntologyFlowElements(projection);

    expect(flow.nodes.map((node) => [node.id, node.position])).toEqual([
      ["graph:Root", { x: 0, y: 0 }],
      ["graph:Leaf", { x: 320, y: 0 }],
    ]);
    expect(flow.edges.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ["relation:graph:hasLeaf", "graph:Root", "graph:Leaf"],
      ["extends:graph:Leaf->graph:Root", "graph:Leaf", "graph:Root"],
    ]);
  });

  it("marks query matches on nodes and edges", () => {
    const flow = toOntologyFlowElements(projection, "leaf");

    expect(flow.nodes.find((node) => node.id === "graph:Leaf")?.data.matched).toBe(
      true,
    );
    expect(flow.edges.find((edge) => edge.id === "relation:graph:hasLeaf")?.data?.matched).toBe(
      true,
    );
    expect(flow.edges.find((edge) => edge.id === "relation:graph:hasLeaf")?.animated).toBe(
      true,
    );
  });
});
