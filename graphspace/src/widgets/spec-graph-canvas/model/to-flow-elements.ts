import type { Edge, Node } from "@xyflow/react";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";

export type SpecFlowNodeData = Record<string, unknown> & {
  spec: SpecNode;
};

export type SpecFlowEdgeData = Record<string, unknown> & {
  specEdge: SpecEdge;
};

export type SpecFlowNode = Node<SpecFlowNodeData, "specNode">;
export type SpecFlowEdge = Edge<SpecFlowEdgeData>;

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 190;
const COLUMNS = 3;

function positionForIndex(index: number): { x: number; y: number } {
  return {
    x: (index % COLUMNS) * COLUMN_WIDTH,
    y: Math.floor(index / COLUMNS) * ROW_HEIGHT,
  };
}

export function toSpecGraphFlowElements(response: SpecGraphResponse): {
  nodes: SpecFlowNode[];
  edges: SpecFlowEdge[];
} {
  const nodeIds = new Set(response.graph.nodes.map((node) => node.node_id));
  const nodes: SpecFlowNode[] = response.graph.nodes.map((spec, index) => ({
    id: spec.node_id,
    type: "specNode",
    position: positionForIndex(index),
    data: { spec },
  }));

  const edges: SpecFlowEdge[] = response.graph.edges
    .filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id))
    .map((specEdge) => ({
      id: specEdge.edge_id,
      source: specEdge.source_id,
      target: specEdge.target_id,
      data: { specEdge },
      label: specEdge.edge_kind,
      animated: false,
    }));

  return { nodes, edges };
}
