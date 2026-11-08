import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection } from "@/entities/ontology-diagram";
import fixture from "./motivation-full.fixture.json";
import membership from "./membership.fixture.json";
import { mirrorGraph } from "./mirror-graph";

describe("mirrorGraph", () => {
  it("mirrors positions and keeps arrowheads at semantic targets", () => {
    const original = buildGraph(parseProjection(fixture));
    const mirrored = mirrorGraph(original);
    expect(original.nodes.length).toBeGreaterThan(1);
    const xs = original.nodes.map((node) => node.position.x);
    const axis = Math.min(...xs) + Math.max(...xs);
    for (const node of original.nodes) {
      expect(mirrored.nodes.find((candidate) => candidate.id === node.id)?.position.x).toBe(
        axis - node.position.x,
      );
    }
    for (const edge of original.edges) {
      const result = mirrored.edges.find((candidate) => candidate.id === edge.id);
      expect(result).toEqual(edge);
    }
    expect(mirrorGraph(mirrored).nodes.map((node) => node.position)).toEqual(
      original.nodes.map((node) => node.position),
    );
  });
  it("keeps action and field links on their original named target handles", () => {
    const graph = buildGraph(parseProjection(membership));
    const reversed = mirrorGraph(graph);
    const ports = graph.edges.filter((edge) => edge.targetHandle);
    expect(ports).toHaveLength(4);
    for (const edge of ports) {
      const after = reversed.edges.find((candidate) => candidate.id === edge.id);
      expect(after).toMatchObject({
        source: edge.source,
        target: edge.target,
        targetHandle: edge.targetHandle,
      });
      const target = reversed.nodes.find((node) => node.id === edge.target);
      expect(target?.data.ports?.some((port) => port.id === edge.targetHandle)).toBe(true);
    }
  });
});
