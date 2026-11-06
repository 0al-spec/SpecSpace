import dagre from "@dagrejs/dagre";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphCanvasLayoutPosition } from "./layout-overrides";

/** Arrange the resolved refinement hierarchy; secondary links do not affect placement. */
export function computeDagrePositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: 140, nodesep: 46, marginx: 0, marginy: 0 });
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  for (const node of [...nodes].sort((a, b) => a.node_id.localeCompare(b.node_id))) {
    graph.setNode(node.node_id, { width: 220, height: 126 });
  }
  for (const edge of [...edges].sort((a, b) => a.edge_id.localeCompare(b.edge_id))) {
    if (
      edge.status === "resolved" &&
      edge.edge_kind === "refines" &&
      nodeIds.has(edge.source_id) &&
      nodeIds.has(edge.target_id)
    ) {
      graph.setEdge(edge.target_id, edge.source_id, {}, edge.edge_id);
    }
  }
  dagre.layout(graph);
  return new Map(
    nodes.map((node) => {
      const position = graph.node(node.node_id) as { x: number; y: number };
      return [node.node_id, { x: position.x - 110, y: position.y - 63 }];
    }),
  );
}
