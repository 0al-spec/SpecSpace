import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";
import type { HoverPreviewAnchor } from "./hover-preview";
import type {
  SpecGraphCanvasOverlayKind,
  SpecGraphCanvasOverlaySummary,
} from "./overlays";
import {
  DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
  computeSpecGraphCanvasLayoutPositions,
  type SpecGraphCanvasLayoutPreset,
} from "./layout-presets";

export type SpecFlowNodeData = Record<string, unknown> & {
  spec: SpecNode;
  lifecycleBadge?: SpecPMLifecycleBadge | null;
  overlay?: SpecGraphCanvasOverlaySummary | null;
  onHoverPreviewIntent?: (node: SpecNode, anchor: HoverPreviewAnchor) => void;
  onHoverPreviewClear?: () => void;
  onOverlayClick?: (kind: SpecGraphCanvasOverlayKind, nodeId: string) => void;
};

export type SpecFlowEdgeData = Record<string, unknown> & {
  specEdge: SpecEdge;
  overlay?: SpecGraphCanvasOverlaySummary | null;
  onOverlayClick?: (kind: SpecGraphCanvasOverlayKind, edgeId: string) => void;
};

export type SpecFlowNode = Node<SpecFlowNodeData, "specNode">;
export type SpecFlowEdge = Edge<SpecFlowEdgeData, "specEdge">;

export const SPEC_FLOW_NODE_INITIAL_WIDTH = 220;
export const SPEC_FLOW_NODE_INITIAL_HEIGHT = 126;

const byNodeId = (a: SpecNode, b: SpecNode) =>
  a.node_id.localeCompare(b.node_id);
const byEdgeId = (a: SpecEdge, b: SpecEdge) =>
  a.edge_id.localeCompare(b.edge_id);

/**
 * Refinement Ladder Layout
 *
 * The default SpecSpace UI SpecGraph layout ranks nodes by resolved `refines`
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

export function toSpecGraphFlowElements(
  response: SpecGraphResponse,
  layoutPreset: SpecGraphCanvasLayoutPreset = DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
): {
  nodes: SpecFlowNode[];
  edges: SpecFlowEdge[];
} {
  const sortedNodes = [...response.graph.nodes].sort(byNodeId);
  const nodeIds = new Set(sortedNodes.map((node) => node.node_id));
  const positions = computeSpecGraphCanvasLayoutPositions(
    sortedNodes,
    response.graph.edges,
    layoutPreset,
  );
  const nodes: SpecFlowNode[] = sortedNodes.map((spec) => ({
    id: spec.node_id,
    type: "specNode",
    position: positions.get(spec.node_id) ?? { x: 0, y: 0 },
    initialWidth: SPEC_FLOW_NODE_INITIAL_WIDTH,
    initialHeight: SPEC_FLOW_NODE_INITIAL_HEIGHT,
    data: { spec },
  }));

  // Missing-endpoint broken edges are omitted until SpecSpace UI has a
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
        type: "specEdge",
        animated: false,
        style: edgeStyle(specEdge),
        markerEnd: edgeMarker(specEdge),
      };
    });

  return { nodes, edges };
}
