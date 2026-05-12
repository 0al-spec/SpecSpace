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

const byNodeId = (a: SpecNode, b: SpecNode) => a.node_id.localeCompare(b.node_id);
const byEdgeId = (a: SpecEdge, b: SpecEdge) => a.edge_id.localeCompare(b.edge_id);

export function toSpecGraphFlowElements(response: SpecGraphResponse): {
  nodes: SpecFlowNode[];
  edges: SpecFlowEdge[];
} {
  const sortedNodes = [...response.graph.nodes].sort(byNodeId);
  const nodeIds = new Set(sortedNodes.map((node) => node.node_id));
  const nodes: SpecFlowNode[] = sortedNodes.map((spec, index) => ({
    id: spec.node_id,
    type: "specNode",
    position: positionForIndex(index),
    data: { spec },
  }));

  const edges: SpecFlowEdge[] = response.graph.edges
    .filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id))
    .sort(byEdgeId)
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
