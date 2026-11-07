import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection } from "@/entities/ontology-diagram";
import fixture from "./motivation-full.fixture.json";
import specgraph from "./specgraph-core.fixture.json";
import { directedLayout, reversesEdge } from "./directed-layout";

const node = (id: string) => ({
  id,
  position: { x: 0, y: 0 },
  data: { label: id, kind: "class" as const },
});
const edge = (id: string, source: string, target: string, kind: string) => ({
  id,
  source,
  target,
  markerEnd: { type: "arrowclosed" as const },
  data: { kind, semanticId: id, record: {} },
});

describe("directedLayout", () => {
  it("places bases before subtypes without letting secondary links change placement", () => {
    const input: ReturnType<typeof buildGraph> = {
      nodes: [node("base"), node("child"), node("end")],
      edges: [
        edge("inheritance", "child", "base", "extends"),
        edge("transition", "child", "end", "transition"),
      ],
    };
    const result = directedLayout(input);
    const x = (id: string) => result.nodes.find((n) => n.id === id)!.position.x;
    expect(x("base")).toBeLessThan(x("child"));
    const withoutSecondary = directedLayout({
      ...input,
      edges: [input.edges[0]],
    });
    expect(result.nodes.map((node) => node.position)).toEqual(
      withoutSecondary.nodes.map((node) => node.position),
    );
    const withBackwardLink = directedLayout({
      ...input,
      edges: [
        ...input.edges,
        edge("back", "end", "base", "relation"),
        edge("same-layer", "base", "end", "relation"),
      ],
    });
    expect(withBackwardLink.nodes.map((node) => node.position)).toEqual(
      withoutSecondary.nodes.map((node) => node.position),
    );
    expect(withBackwardLink.edges.find((item) => item.id === "back")).toMatchObject({
      source: "end",
      target: "base",
      markerEnd: { type: "arrowclosed" },
    });
    expect(result.edges[0]).toMatchObject({
      source: "base",
      target: "child",
      markerEnd: input.edges[0].markerEnd,
      label: "extended by",
      ariaLabel: "Visual flow from base to child; child extends base",
    });
    expect(result.edges[1]).toMatchObject({
      source: "child",
      target: "end",
      markerEnd: input.edges[1].markerEnd,
    });
    expect(input.edges[0].source).toBe("child");
  });
  it("reverses hierarchy edge selection back to the authored direction in both layered modes", () => {
    expect(reversesEdge("directed", "extends")).toBe(true);
    expect(reversesEdge("directed", "implements")).toBe(true);
    expect(reversesEdge("directed", "relation")).toBe(false);
    expect(reversesEdge("relations", "extends")).toBe(true);
    expect(reversesEdge("relations", "implements")).toBe(true);
    expect(reversesEdge("relations", "relation")).toBe(false);
    expect(reversesEdge("types", "extends")).toBe(true);
    expect(reversesEdge("types", "relation")).toBe(false);
    expect(reversesEdge("RL", "relation")).toBe(false);
  });
  it("handles a cyclic real graph deterministically without dropping nodes or links", () => {
    const graph = buildGraph(parseProjection(fixture));
    const one = directedLayout(graph);
    expect(one.nodes).toHaveLength(graph.nodes.length);
    expect(one.edges).toHaveLength(graph.edges.length);
    expect(directedLayout(graph)).toEqual(one);
  });
  it("spreads the SpecGraph ontology by relationships without changing edge semantics", () => {
    const graph = buildGraph(parseProjection(specgraph));
    const hierarchy = directedLayout(graph);
    const relations = directedLayout(graph, "relations");
    const columns = (value: typeof graph) =>
      new Set(value.nodes.map((node) => node.position.x)).size;
    expect(columns(relations)).toBeGreaterThan(columns(hierarchy));
    const semanticEdges = graph.edges.filter(
      (edge) => edge.data?.kind !== "extends" && edge.data?.kind !== "implements",
    );
    expect(
      relations.edges.filter(
        (edge) => edge.data?.kind !== "extends" && edge.data?.kind !== "implements",
      ),
    ).toEqual(semanticEdges);
    const inheritance = relations.edges.find((edge) => edge.id === "extends/sgcore:Intent")!;
    expect(inheritance.source).toContain("DomainEntity");
    expect(inheritance.target).toBe("classes/sgcore:Intent");
    expect(inheritance.markerEnd).toBeDefined();
    const position = (id: string) => relations.nodes.find((node) => node.id === id)!.position.x;
    expect(position(inheritance.source)).toBeLessThan(position(inheritance.target));
    expect(relations.nodes).toHaveLength(graph.nodes.length);
    expect(directedLayout(graph, "relations")).toEqual(relations);
  });
  it("keeps base-to-class-to-relationship flow when relationships contain a cycle", () => {
    const input: ReturnType<typeof buildGraph> = {
      nodes: [node("base"), node("child"), node("relationship")],
      edges: [
        edge("extends", "child", "base", "extends"),
        { ...edge("role", "child", "relationship", "relation"), targetHandle: "subject" },
        edge("back", "relationship", "base", "relation"),
      ],
    };
    const result = directedLayout(input, "relations");
    const x = (id: string) => result.nodes.find((item) => item.id === id)!.position.x;
    expect(x("base")).toBeLessThan(x("child"));
    expect(x("child")).toBeLessThan(x("relationship"));
    expect(result.edges).toHaveLength(3);
    expect(result.edges[1]).toMatchObject({
      source: "child",
      target: "relationship",
      targetHandle: "subject",
      markerEnd: { type: "arrowclosed" },
    });
    expect(result.edges[2]).toEqual(input.edges[2]);
  });
});
