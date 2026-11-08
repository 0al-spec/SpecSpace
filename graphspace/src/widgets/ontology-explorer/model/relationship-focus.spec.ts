import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection, type Selection } from "@/entities/ontology-diagram";
import publication from "./publication-verification.fixture.json";
import specgraph from "./specgraph-core.fixture.json";
import { typeLayerLayout } from "./type-layer-layout";
import { dimOutsideRelationship, relationshipFocus } from "./relationship-focus";

function selectNode(graph: ReturnType<typeof buildGraph>, id: string): Selection {
  const node = graph.nodes.find((item) => item.id === id)!;
  return { type: "node", id: node.id, data: node.data };
}

function selectEdge(graph: ReturnType<typeof buildGraph>, id: string): Selection {
  const edge = graph.edges.find((item) => item.id === id)!;
  return { type: "edge", id: edge.id, source: edge.source, target: edge.target, data: edge.data! };
}

describe("relationship focus", () => {
  it("follows roles, reference fields and their base types but not unrelated siblings", () => {
    const source = buildGraph(parseProjection(publication));
    const template = source.nodes.find((node) => node.id === "classes/pubverify:PublishedBundle")!;
    const baseEdge = source.edges.find((edge) => edge.id === "extends/pubverify:PublishedBundle")!;
    const unrelated = {
      ...template,
      id: "classes/pubverify:Unrelated",
      data: { ...template.data, label: "pubverify:Unrelated" },
    };
    const graph = {
      nodes: [...source.nodes, unrelated],
      edges: [
        ...source.edges,
        { ...baseEdge, id: "extends/pubverify:Unrelated", source: unrelated.id },
      ],
    };
    const selection = selectNode(graph, "relations/pubverify:verifiesPublishedBundle");
    const focus = relationshipFocus(graph, selection)!;
    expect([...focus.nodeIds].sort((a, b) => a.localeCompare(b))).toEqual([
      "classes/pubverify:PublicationVerifier",
      "classes/pubverify:PublishedBundle",
      "classes/pubverify:RetainedBundle",
      "classes/pubverify:VerifyPublishedBundle",
      "external/classes/ont:Action",
      "external/classes/ont:DomainEntity",
      "relations/pubverify:verifiesPublishedBundle",
    ]);
    for (const id of [
      "role/pubverify:verifiesPublishedBundle/subject",
      "role/pubverify:verifiesPublishedBundle/action",
      "role/pubverify:verifiesPublishedBundle/object/0",
      "field/pubverify:VerifyPublishedBundle/expectedBundle",
      "extends/pubverify:RetainedBundle",
      "extends/pubverify:VerifyPublishedBundle",
    ])
      expect(focus.edgeIds.has(id)).toBe(true);
    expect(focus.nodeIds.has(unrelated.id)).toBe(false);
    expect(focus.edgeIds.has("extends/pubverify:Unrelated")).toBe(false);

    const laidOut = typeLayerLayout(graph);
    const role = selectEdge(laidOut, "role/pubverify:verifiesPublishedBundle/action");
    expect(relationshipFocus(graph, role)).toEqual(focus);
    const decorated = dimOutsideRelationship(laidOut, focus);
    expect(decorated.nodes.find((node) => node.id === unrelated.id)?.className).toContain(
      "filter-dim",
    );
    expect(decorated.nodes.find((node) => node.id === unrelated.id)?.position).toEqual(
      laidOut.nodes.find((node) => node.id === unrelated.id)?.position,
    );
    expect(laidOut.nodes.find((node) => node.id === unrelated.id)?.className).not.toContain(
      "filter-dim",
    );
    expect(
      decorated.edges.find((edge) => edge.id === "extends/pubverify:Unrelated")?.className,
    ).toContain("filter-dim");
  });

  it("focuses both ends and all oneOf alternatives of a plain relation", () => {
    const source = buildGraph(parseProjection(specgraph));
    const relation = source.edges.find((edge) => edge.id === "relation/sgcore:refinesIntent/0")!;
    const graph = {
      ...source,
      edges: [
        ...source.edges,
        { ...relation, id: "relation/sgcore:refinesIntent/1", target: "classes/sgcore:Test" },
      ],
    };
    const focus = relationshipFocus(graph, selectEdge(graph, relation.id))!;
    for (const id of [
      "classes/sgcore:Spec",
      "classes/sgcore:Intent",
      "classes/sgcore:Test",
      "external/classes/sg:DomainEntity",
    ]) {
      expect(focus.nodeIds.has(id)).toBe(true);
    }
    expect(focus.edgeIds.has("relation/sgcore:refinesIntent/1")).toBe(true);
    expect(focus.edgeIds.has("relation/sgcore:definesRequirement/0")).toBe(false);
    expect(focus.nodeIds.has("classes/sgcore:Requirement")).toBe(false);
  });

  it("terminates on cyclic dependencies and ignores non-relationship selections", () => {
    const source = buildGraph(parseProjection(publication));
    const reference = source.edges.find(
      (edge) => edge.id === "field/pubverify:VerifyPublishedBundle/expectedBundle",
    )!;
    const graph = {
      ...source,
      edges: [
        ...source.edges,
        { ...reference, id: "field/return", source: reference.target, target: reference.source },
      ],
    };
    const focus = relationshipFocus(
      graph,
      selectNode(graph, "relations/pubverify:verifiesPublishedBundle"),
    )!;
    expect(focus.edgeIds.has("field/return")).toBe(true);
    expect(focus.nodeIds.size).toBeLessThanOrEqual(graph.nodes.length);
    expect(
      relationshipFocus(graph, selectNode(graph, "classes/pubverify:PublishedBundle")),
    ).toBeNull();
    expect(relationshipFocus(graph, null)).toBeNull();
    expect(dimOutsideRelationship(graph, null)).toBe(graph);
  });
});
