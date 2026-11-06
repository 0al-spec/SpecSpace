import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection } from "@/entities/ontology-diagram";
import fixture from "./motivation-full.fixture.json";
import { directedLayout, reversesEdge } from "./directed-layout";

describe("directedLayout", () => {
  it("places bases before subtypes and declared transitions source before target", () => {
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
    expect(x("child")).toBeLessThan(x("end"));
    expect(result.edges[0]).toMatchObject({
      source: "base",
      target: "child",
      markerStart: input.edges[0].markerEnd,
      ariaLabel: "Edge from child to base",
    });
    expect(result.edges[1]).toMatchObject({
      source: "child",
      target: "end",
      markerEnd: input.edges[1].markerEnd,
    });
    expect(input.edges[0].source).toBe("child");
  });
  it("reverses only hierarchy edges in directed mode", () => {
    expect(reversesEdge("directed", "extends")).toBe(true);
    expect(reversesEdge("directed", "implements")).toBe(true);
    expect(reversesEdge("directed", "relation")).toBe(false);
    expect(reversesEdge("RL", "relation")).toBe(true);
  });
  it("handles a cyclic real graph deterministically without dropping nodes or links", () => {
    const graph = buildGraph(parseProjection(fixture));
    const one = directedLayout(graph);
    expect(one.nodes).toHaveLength(graph.nodes.length);
    expect(one.edges).toHaveLength(graph.edges.length);
    expect(directedLayout(graph)).toEqual(one);
  });
});
