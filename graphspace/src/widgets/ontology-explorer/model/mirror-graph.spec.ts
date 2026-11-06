import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection } from "@/entities/ontology-diagram";
import fixture from "./motivation-full.fixture.json";
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
      expect(result).toMatchObject({
        source: edge.target,
        target: edge.source,
        markerStart: edge.markerEnd,
      });
      expect(result?.markerEnd).toBeUndefined();
    }
    expect(mirrorGraph(mirrored).nodes.map((node) => node.position)).toEqual(
      original.nodes.map((node) => node.position),
    );
  });
});
