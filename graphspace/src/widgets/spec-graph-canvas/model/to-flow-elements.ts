import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";
import type { HoverPreviewAnchor } from "./hover-preview";

export type SpecFlowNodeData = Record<string, unknown> & {
  spec: SpecNode;
  lifecycleBadge?: SpecPMLifecycleBadge | null;
  onHoverPreviewIntent?: (node: SpecNode, anchor: HoverPreviewAnchor) => void;
  onHoverPreviewClear?: () => void;
};

export type SpecFlowEdgeData = Record<string, unknown> & {
  specEdge: SpecEdge;
};

export type SpecFlowNode = Node<SpecFlowNodeData, "specNode">;
export type SpecFlowEdge = Edge<SpecFlowEdgeData>;

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 172;

const byNodeId = (a: SpecNode, b: SpecNode) =>
  a.node_id.localeCompare(b.node_id);
const byEdgeId = (a: SpecEdge, b: SpecEdge) =>
  a.edge_id.localeCompare(b.edge_id);

/**
 * Refinement Ladder Layout
 *
 * The default GraphSpace SpecGraph layout ranks nodes by resolved `refines`
 * depth. Parents stay on the left, refining specs move right, and rows inside
 * each rank are sorted by stable node id. Non-hierarchy links remain visual
 * overlays and do not affect placement.
 */
const EDGE_STYLE: Record<SpecEdge["edge_kind"] | "broken", CSSProperties> = {
  depends_on: {
    stroke: "#b06924",
    strokeWidth: 1.45,
  },
  refines: {
    stroke: "#4e689b",
    strokeWidth: 1.7,
    strokeDasharray: "6 4",
  },
  relates_to: {
    stroke: "#7c3aed",
    strokeWidth: 1.15,
    strokeDasharray: "2 6",
    opacity: 0.45,
  },
  broken: {
    stroke: "#b54131",
    strokeWidth: 1.4,
    strokeDasharray: "4 4",
  },
};

function wouldCreateCycle(
  adjacency: Map<string, string[]>,
  parentId: string,
  childId: string,
): boolean {
  if (parentId === childId) return true;

  const seen = new Set<string>();
  const stack = [childId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === parentId) return true;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }

  return false;
}

function acyclicRefines(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): SpecEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const adjacency = new Map<string, string[]>();
  const accepted: SpecEdge[] = [];

  for (const edge of edges
    .filter((candidate) =>
      candidate.status === "resolved" && candidate.edge_kind === "refines"
    )
    .sort(byEdgeId)) {
    const parentId = edge.target_id;
    const childId = edge.source_id;
    if (!nodeIds.has(parentId) || !nodeIds.has(childId)) continue;
    if (wouldCreateCycle(adjacency, parentId, childId)) continue;

    accepted.push(edge);
    adjacency.set(parentId, [...(adjacency.get(parentId) ?? []), childId]);
  }

  return accepted;
}

function computeHierarchyRanks(nodes: readonly SpecNode[], edges: readonly SpecEdge[]): Map<string, number> {
  const ranks = new Map(nodes.map((node) => [node.node_id, 0]));
  const refines = acyclicRefines(nodes, edges);

  // SpecGraph stores `child refines parent` as source -> target. For layout,
  // rank children to the right of their parent while keeping raw edge data.
  for (let i = 0; i < nodes.length; i += 1) {
    let changed = false;
    for (const edge of refines) {
      const parentRank = ranks.get(edge.target_id);
      const childRank = ranks.get(edge.source_id);
      if (parentRank === undefined || childRank === undefined) continue;
      const nextRank = parentRank + 1;
      if (childRank < nextRank) {
        ranks.set(edge.source_id, nextRank);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return ranks;
}

function computePositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, { x: number; y: number }> {
  const ranks = computeHierarchyRanks(nodes, edges);
  const ordered = [...nodes].sort((a, b) => {
    const rankDelta = (ranks.get(a.node_id) ?? 0) - (ranks.get(b.node_id) ?? 0);
    if (rankDelta !== 0) return rankDelta;
    return a.node_id.localeCompare(b.node_id);
  });
  const perRankCount = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of ordered) {
    const rank = ranks.get(node.node_id) ?? 0;
    const row = perRankCount.get(rank) ?? 0;
    perRankCount.set(rank, row + 1);
    positions.set(node.node_id, {
      x: rank * COLUMN_WIDTH,
      y: row * ROW_HEIGHT,
    });
  }

  return positions;
}

function edgeEndpoints(edge: SpecEdge): { source: string; target: string } {
  if (edge.edge_kind === "refines") {
    return { source: edge.target_id, target: edge.source_id };
  }
  return { source: edge.source_id, target: edge.target_id };
}

function edgeStyle(edge: SpecEdge): CSSProperties {
  if (edge.status === "broken") return EDGE_STYLE.broken;
  return EDGE_STYLE[edge.edge_kind];
}

function edgeMarker(edge: SpecEdge) {
  if (edge.edge_kind === "relates_to") return undefined;
  return {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color:
      edge.status === "broken" ? "#b54131" : EDGE_STYLE[edge.edge_kind].stroke,
  };
}

export function toSpecGraphFlowElements(response: SpecGraphResponse): {
  nodes: SpecFlowNode[];
  edges: SpecFlowEdge[];
} {
  const sortedNodes = [...response.graph.nodes].sort(byNodeId);
  const nodeIds = new Set(sortedNodes.map((node) => node.node_id));
  const positions = computePositions(sortedNodes, response.graph.edges);
  const nodes: SpecFlowNode[] = sortedNodes.map((spec) => ({
    id: spec.node_id,
    type: "specNode",
    position: positions.get(spec.node_id) ?? { x: 0, y: 0 },
    data: { spec },
  }));

  // Missing-endpoint broken edges are omitted until GraphSpace has a
  // placeholder-node affordance; broken edges with present endpoints are styled.
  const edges: SpecFlowEdge[] = response.graph.edges
    .filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id))
    .sort(byEdgeId)
    .map((specEdge) => {
      const endpoints = edgeEndpoints(specEdge);
      return {
        id: specEdge.edge_id,
        source: endpoints.source,
        target: endpoints.target,
        data: { specEdge },
        type: "smoothstep",
        animated: false,
        style: edgeStyle(specEdge),
        markerEnd: edgeMarker(specEdge),
      };
    });

  return { nodes, edges };
}
