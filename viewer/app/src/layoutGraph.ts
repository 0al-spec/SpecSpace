import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 148;
const HEADER_HEIGHT = 40;
const MSG_HEIGHT = 36;
const MSG_GAP = 16;
const SUBFLOW_PAD = 14;

export function expandedNodeHeight(checkpointCount: number): number {
  return (
    HEADER_HEIGHT +
    checkpointCount * (MSG_HEIGHT + MSG_GAP) -
    MSG_GAP +
    SUBFLOW_PAD * 2
  );
}

export interface LayoutOptions {
  direction?: "LR" | "TB";
  nodeSep?: number;
  rankSep?: number;
}

export function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node[] {
  const { direction = "LR", nodeSep = 60, rankSep = 120 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  // Only layout top-level nodes (no parentId)
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  const childNodes = nodes.filter((n) => n.parentId);

  for (const node of topLevelNodes) {
    const isGroup = node.type === "group";
    const w = isGroup
      ? (node.style?.width as number) || NODE_WIDTH
      : NODE_WIDTH;
    const h = isGroup
      ? (node.style?.height as number) || NODE_HEIGHT
      : NODE_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  // Only add edges between top-level nodes
  const topLevelIds = new Set(topLevelNodes.map((n) => n.id));
  for (const edge of edges) {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positionedNodes = topLevelNodes.map((node) => {
    const pos = g.node(node.id);
    const w = pos.width;
    const h = pos.height;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });

  return [...positionedNodes, ...childNodes];
}
