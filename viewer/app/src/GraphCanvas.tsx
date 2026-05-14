import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type Viewport,
} from "@xyflow/react";
import type { MouseEvent } from "react";
import ErrorBoundary from "./ErrorBoundary";
import ConversationNode from "./ConversationNode";
import ExpandedConversationNode from "./ExpandedConversationNode";
import MessageNode from "./MessageNode";
import SpecNode from "./SpecNode";
import ExpandedSpecNode from "./ExpandedSpecNode";
import SpecSubItemNode from "./SpecSubItemNode";
import CollapsedBranchNode from "./CollapsedBranchNode";
import { LODBezierEdgeMemo, LODSmoothStepEdgeMemo } from "./LODSmoothStepEdge";
import GraphDashboard from "./GraphDashboard";
import SpecForceGraph from "./SpecForceGraph";
import FitViewShortcut from "./FitViewShortcut";
import type { ApiSpecGraph, GraphMode, SpecViewOptions } from "./types";

const edgeTypes = {
  default: LODBezierEdgeMemo,
  smoothstep: LODSmoothStepEdgeMemo,
};

const nodeTypes = {
  conversation: ConversationNode,
  group: ExpandedConversationNode,
  message: MessageNode,
  spec: SpecNode,
  expandedSpec: ExpandedSpecNode,
  specSubItem: SpecSubItemNode,
  collapsedBranch: CollapsedBranchNode,
};

const kindColorMap: Record<string, string> = {
  root: "#5d8b58",
  branch: "#4e689b",
  merge: "#b06924",
};

const specStatusColorMap: Record<string, string> = {
  idea: "#b0b0b0",
  stub: "#c8a72a",
  outlined: "#4e82b8",
  specified: "#6e5ab8",
  linked: "#3e9a58",
  reviewed: "#2a7c7c",
  frozen: "#4a5568",
};

const MINIMAP_HIDE_WHEN_ZOOMED_OUT = false;

function minimapNodeColor(node: Node): string {
  const d = node.data as {
    kind?: string; status?: string; role?: string;
    searchDimmed?: boolean; timelineDimmed?: boolean; filterDimmed?: boolean; recentDimmed?: boolean;
  };
  if (d.searchDimmed || d.timelineDimmed || d.filterDimmed || d.recentDimmed) return "rgba(180,180,180,0.18)";
  if (node.type === "group" || node.type === "conversation") {
    return kindColorMap[d.kind ?? ""] ?? "#b89f7f";
  }
  if (node.type === "message") {
    return d.role === "user" ? "#8eaed4" : "#c4a67a";
  }
  if (node.type === "spec" || node.type === "expandedSpec") {
    return specStatusColorMap[d.status ?? ""] ?? "#9b8ec4";
  }
  if (node.type === "specSubItem") return "#9b8ec4";
  if (node.type === "collapsedBranch") return "#4e689b";
  return "#b89f7f";
}

interface GraphCanvasProps {
  graphMode: GraphMode;
  specViewOptions: SpecViewOptions;
  specGraph: ApiSpecGraph | null;
  selectedNodeId: string | null;
  onSpecNodeSelect: (nodeId: string) => void;
  viewerSurfacesBuildAvailable: boolean;
  nodes: Node[];
  edges: Edge[];
  loading: boolean;
  isZoomedOut: boolean;
  defaultViewport: Viewport | undefined;
  fitView: boolean;
  onNodesChange: (changes: NodeChange[]) => void;
  onNodeClick: NodeMouseHandler;
  onNodeMouseEnter: NodeMouseHandler;
  onNodeMouseLeave: NodeMouseHandler;
  onNodeDragStart: NodeMouseHandler;
  onEdgeClick: EdgeMouseHandler;
  onEdgeMouseEnter: EdgeMouseHandler;
  onEdgeMouseLeave: EdgeMouseHandler;
  onPaneClick: () => void;
  onMoveEnd: (event: unknown, viewport: Viewport) => void;
  onMiniMapClick: (event: MouseEvent, position: { x: number; y: number }) => void;
}

export default function GraphCanvas({
  graphMode,
  specViewOptions,
  specGraph,
  selectedNodeId,
  onSpecNodeSelect,
  viewerSurfacesBuildAvailable,
  nodes,
  edges,
  loading,
  isZoomedOut,
  defaultViewport,
  fitView,
  onNodesChange,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDragStart,
  onEdgeClick,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onPaneClick,
  onMoveEnd,
  onMiniMapClick,
}: GraphCanvasProps) {
  return (
    <>
      {graphMode === "dashboard" && <GraphDashboard buildAvailable={viewerSurfacesBuildAvailable} />}

      {graphMode === "specifications" && specViewOptions.viewMode === "force" && specGraph && (
        <ErrorBoundary label="SpecForceGraph">
          <SpecForceGraph
            apiGraph={specGraph}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSpecNodeSelect}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="Canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeDragStart={onNodeDragStart}
          onEdgeClick={onEdgeClick}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onPaneClick={onPaneClick}
          onMoveEnd={onMoveEnd}
          defaultViewport={defaultViewport}
          fitView={fitView}
          minZoom={0.1}
          maxZoom={2}
          onlyRenderVisibleElements={true}
          className={isZoomedOut ? "zoomed-out" : undefined}
          style={{
            opacity: loading && nodes.length > 0 ? 0.6 : 1,
            transition: "opacity 150ms",
            display: graphMode === "dashboard" || (graphMode === "specifications" && specViewOptions.viewMode === "force") ? "none" : undefined,
          }}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          selectionMode={SelectionMode.Partial}
          edgesFocusable={false}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={MINIMAP_HIDE_WHEN_ZOOMED_OUT && isZoomedOut ? "transparent" : minimapNodeColor}
            nodeStrokeColor={MINIMAP_HIDE_WHEN_ZOOMED_OUT && isZoomedOut ? "transparent" : undefined}
            maskColor={MINIMAP_HIDE_WHEN_ZOOMED_OUT && isZoomedOut ? "transparent" : "rgba(236, 227, 212, 0.7)"}
            pannable
            zoomable
            onClick={onMiniMapClick}
          />
          <FitViewShortcut />
        </ReactFlow>
      </ErrorBoundary>
    </>
  );
}
