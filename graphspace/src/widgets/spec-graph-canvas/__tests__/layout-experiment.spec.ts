import dagre from "@dagrejs/dagre";
import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import snapshot from "../../../../experiments/spec-graph-layout/specgraph-snapshot.json";
import { computeSpecGraphCanvasLayoutPositions } from "../model/layout-presets";
import { pathsIntersect, routeCrossings } from "./layout-routes";
import { samplePath } from "./layout-route-sampling";

type Point = { x: number; y: number };
type Graph = { nodes: SpecNode[]; edges: SpecEdge[] };
const snapshotGraph = snapshot as unknown as Graph;
const node = (node_id: string) => ({ node_id, status: "linked" }) as SpecNode;
const edge = (source_id: string, target_id: string, edge_kind: SpecEdge["edge_kind"] = "refines") =>
  ({
    source_id,
    target_id,
    edge_kind,
    status: "resolved",
    edge_id: `${source_id}-${edge_kind}-${target_id}`,
  }) as SpecEdge;
const synthetic: Record<string, Graph> = {
  multi_parent: {
    nodes: ["a", "b", "c", "d"].map(node),
    edges: [edge("b", "a"), edge("c", "a"), edge("d", "b"), edge("d", "c")],
  },
  cycle: {
    nodes: ["a", "b", "c", "d"].map(node),
    edges: [
      edge("b", "a"),
      edge("c", "b"),
      edge("a", "c"),
      edge("d", "c"),
      edge("a", "d", "depends_on"),
    ],
  },
};

function experimental(graph: Graph): Map<string, Point> {
  const layout = new dagre.graphlib.Graph({ multigraph: true });
  layout.setGraph({ rankdir: "LR", ranksep: 140, nodesep: 46, marginx: 0, marginy: 0 });
  layout.setDefaultEdgeLabel(() => ({}));
  for (const n of [...graph.nodes].sort((a, b) => a.node_id.localeCompare(b.node_id)))
    layout.setNode(n.node_id, { width: 220, height: 126 });
  const ids = new Set(graph.nodes.map((n) => n.node_id));
  for (const e of [...graph.edges].sort((a, b) => a.edge_id.localeCompare(b.edge_id))) {
    if (
      e.status === "resolved" &&
      e.edge_kind === "refines" &&
      ids.has(e.source_id) &&
      ids.has(e.target_id)
    )
      layout.setEdge(e.target_id, e.source_id, {}, e.edge_id);
  }
  dagre.layout(layout);
  return new Map(
    graph.nodes.map((n) => {
      const p = layout.node(n.node_id) as Point;
      return [n.node_id, { x: p.x - 110, y: p.y - 63 }];
    }),
  );
}

function metrics(graph: Graph, positions: Map<string, Point>) {
  const pts = [...positions.values()];
  const extentX = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) + 220;
  const extentY = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)) + 126;
  const overlaps = pts.reduce(
    (count, a, i) =>
      count +
      pts.slice(i + 1).filter((b) => Math.abs(a.x - b.x) < 220 && Math.abs(a.y - b.y) < 126).length,
    0,
  );
  const links = graph.edges.filter(
    (e) => e.status === "resolved" && positions.has(e.source_id) && positions.has(e.target_id),
  );
  const hierarchy = links.filter((e) => e.edge_kind === "refines");
  const backwards = hierarchy.filter(
    (e) => positions.get(e.target_id)!.x >= positions.get(e.source_id)!.x,
  ).length;
  // Straight-line centre-to-centre proxy; this does not measure the UI's routed paths.
  const orient = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let crossings = 0;
  for (const [i, a] of links.entries())
    for (const b of links.slice(i + 1)) {
      if (new Set([a.source_id, a.target_id, b.source_id, b.target_id]).size < 4) continue;
      const p = positions.get(a.source_id)!,
        q = positions.get(a.target_id)!,
        r = positions.get(b.source_id)!,
        s = positions.get(b.target_id)!;
      if (orient(p, q, r) * orient(p, q, s) < 0 && orient(r, s, p) * orient(r, s, q) < 0)
        crossings++;
    }
  return {
    overlaps,
    hierarchy_not_forward: backwards,
    straight_line_crossings: crossings,
    width: extentX,
    height: extentY,
    area: extentX * extentY,
  };
}

function changeImpact(
  graph: Graph,
  original: Map<string, Point>,
  layout: (graph: Graph) => Map<string, Point>,
) {
  const anchor = [...graph.nodes].map((n) => n.node_id).sort((a, b) => a.localeCompare(b))[0];
  const deep = [...original.entries()].sort(
    (a, b) => b[1].x - a[1].x || a[0].localeCompare(b[0]),
  )[0][0];
  const variants = {
    root_leaf: {
      nodes: [...graph.nodes, node("zz-experiment-leaf")],
      edges: [...graph.edges, edge("zz-experiment-leaf", anchor)],
    },
    deep_leaf: {
      nodes: [...graph.nodes, node("zz-experiment-leaf")],
      edges: [...graph.edges, edge("zz-experiment-leaf", deep)],
    },
    isolated: { nodes: [...graph.nodes, node("zz-experiment-leaf")], edges: graph.edges },
    secondary: { nodes: graph.nodes, edges: [...graph.edges, edge(anchor, deep, "depends_on")] },
  };
  const beforeAnchor = original.get(anchor)!;
  return Object.fromEntries(
    Object.entries(variants).map(([name, variant]) => {
      const changed = layout(variant);
      const afterAnchor = changed.get(anchor)!;
      const deltaX = afterAnchor.x - beforeAnchor.x;
      const deltaY = afterAnchor.y - beforeAnchor.y;
      const moved = [...original].filter(([id, point]) => {
        const next = changed.get(id)!;
        return (
          Math.abs(next.x - point.x - deltaX) > 0.01 || Math.abs(next.y - point.y - deltaY) > 0.01
        );
      });
      return [name, moved.length];
    }),
  );
}

describe("reproducible specification layout experiment", () => {
  it("samples line, quadratic and cubic paths with their correct endpoints", () => {
    expect(samplePath("M0,0L10,0Q15,0 15,5C15,10 20,10 20,15").at(-1)).toEqual({ x: 20, y: 15 });
    expect(() => samplePath("M0,0Z")).toThrow();
  });
  it("counts a non-collinear contact at a polyline vertex but not collinear overlaps", () => {
    expect(pathsIntersect(samplePath("M0,0L5,0L10,0"), samplePath("M5,-5L5,5"))).toBe(true);
    expect(pathsIntersect(samplePath("M0,0L10,0"), samplePath("M5,0L15,0"))).toBe(false);
    expect(pathsIntersect(samplePath("M0,0L10,0"), samplePath("M11,-5L11,5"))).toBe(false);
  });
  for (const [name, graph] of Object.entries({ specgraph_snapshot: snapshotGraph, ...synthetic })) {
    it(`compares three layouts on ${name}`, () => {
      const tree = computeSpecGraphCanvasLayoutPositions(graph.nodes, graph.edges, "tree");
      const spine = computeSpecGraphCanvasLayoutPositions(graph.nodes, graph.edges, "spine");
      const candidate = experimental(graph);
      // DOM measurements from 2026-11-06 production snapshot; synthetic cases use 126px.
      const heights =
        name === "specgraph_snapshot"
          ? new Map(
              graph.nodes.map((n) => [
                n.node_id,
                ["SG-SPEC-0020", "SG-SPEC-0046"].includes(n.node_id) ? 132 : 158,
              ]),
            )
          : undefined;
      expect(candidate.size).toBe(graph.nodes.length);
      expect(experimental(graph)).toEqual(candidate);
      const withoutSecondary = experimental({
        ...graph,
        edges: graph.edges.filter((e) => e.edge_kind === "refines"),
      });
      expect(withoutSecondary).toEqual(candidate);
      console.log(
        JSON.stringify({
          fixture: name,
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          tree: {
            ...metrics(graph, tree),
            curved_route_pairs: routeCrossings(graph.edges, tree, "curved", 16, heights),
            curved_route_pairs_32: routeCrossings(graph.edges, tree, "curved", 32, heights),
            orthogonal_route_pairs: routeCrossings(graph.edges, tree, "orthogonal", 16, heights),
            ...changeImpact(graph, tree, (g) =>
              computeSpecGraphCanvasLayoutPositions(g.nodes, g.edges, "tree"),
            ),
          },
          spine: {
            ...metrics(graph, spine),
            curved_route_pairs: routeCrossings(graph.edges, spine, "curved", 16, heights),
            curved_route_pairs_32: routeCrossings(graph.edges, spine, "curved", 32, heights),
            orthogonal_route_pairs: routeCrossings(graph.edges, spine, "orthogonal", 16, heights),
            ...changeImpact(graph, spine, (g) =>
              computeSpecGraphCanvasLayoutPositions(g.nodes, g.edges, "spine"),
            ),
          },
          dagre: {
            ...metrics(graph, candidate),
            curved_route_pairs: routeCrossings(graph.edges, candidate, "curved", 16, heights),
            curved_route_pairs_32: routeCrossings(graph.edges, candidate, "curved", 32, heights),
            orthogonal_route_pairs: routeCrossings(
              graph.edges,
              candidate,
              "orthogonal",
              16,
              heights,
            ),
            ...changeImpact(graph, candidate, experimental),
          },
        }),
      );
    });
  }
});
