import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SpecNode } from "@/entities/spec-node";
import { SpecNodeCard } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import { getSpecGraphNodeFocusPoint } from "../model/focus-point";
import {
  buildSpecNodeHoverPreview,
  SPEC_NODE_HOVER_PREVIEW_DELAY_MS,
  type HoverPreviewAnchor,
} from "../model/hover-preview";
import { buildSpecGraphSelection, type SpecGraphSelection } from "../model/selection";
import { toSpecGraphFlowElements, type SpecFlowNode } from "../model/to-flow-elements";
import { useSpecNodePreviewDetail } from "../model/use-spec-node-preview-detail";
import type { UseSpecGraphState } from "../model/use-spec-graph";
import styles from "./SpecGraphCanvas.module.css";
import { SpecNodeHoverPreview } from "./SpecNodeHoverPreview";

type Props = {
  state: UseSpecGraphState;
  className?: string;
  selectedNodeId?: string | null;
  lifecycleBadgesByNode?: ReadonlyMap<string, SpecPMLifecycleBadge>;
  onSelectedNodeIdChange?: (nodeId: string | null) => void;
  onSelectionChange?: (selection: SpecGraphSelection | null) => void;
};

type HoverPreviewState = {
  node: SpecNode;
  anchor: HoverPreviewAnchor;
};

function hoverPreviewAnchorFromElement(element: HTMLElement): HoverPreviewAnchor {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function SpecFlowNodeView({ data, selected }: NodeProps<SpecFlowNode>) {
  return (
    <div
      className={styles.nodeShell}
      onMouseEnter={(event) =>
        data.onHoverPreviewIntent?.(
          data.spec,
          hoverPreviewAnchorFromElement(event.currentTarget),
        )
      }
      onMouseLeave={data.onHoverPreviewClear}
      onMouseDown={data.onHoverPreviewClear}
      onClick={data.onHoverPreviewClear}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <SpecNodeCard
        node={data.spec}
        selected={selected}
        lifecycleBadge={data.lifecycleBadge}
      />
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

const nodeTypes = {
  specNode: SpecFlowNodeView,
};

export function SpecGraphCanvas({
  state,
  className,
  selectedNodeId,
  lifecycleBadgesByNode,
  onSelectedNodeIdChange,
  onSelectionChange,
}: Props) {
  return (
    <ReactFlowProvider>
      <SpecGraphCanvasInner
        state={state}
        className={className}
        selectedNodeId={selectedNodeId}
        lifecycleBadgesByNode={lifecycleBadgesByNode}
        onSelectedNodeIdChange={onSelectedNodeIdChange}
        onSelectionChange={onSelectionChange}
      />
    </ReactFlowProvider>
  );
}

function SpecGraphCanvasInner({
  state,
  className,
  selectedNodeId,
  lifecycleBadgesByNode,
  onSelectedNodeIdChange,
  onSelectionChange,
}: Props) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [hoverCandidate, setHoverCandidate] = useState<HoverPreviewState | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    getNode,
    setCenter,
    viewportInitialized,
  } = useReactFlow<SpecFlowNode>();
  const activeSelectedNodeId = selectedNodeId === undefined ? internalSelectedNodeId : selectedNodeId;
  const focusedNodeIdRef = useRef<string | null>(null);
  const previewDetailState = useSpecNodePreviewDetail({
    nodeId: hoverCandidate?.node.node_id ?? null,
  });
  const { nodes: baseNodes, edges } = useMemo(
    () => toSpecGraphFlowElements(state.data),
    [state.data],
  );
  const clearHoverPreviewTimer = useCallback(() => {
    if (!hoverPreviewTimerRef.current) return;
    clearTimeout(hoverPreviewTimerRef.current);
    hoverPreviewTimerRef.current = null;
  }, []);
  const clearHoverPreview = useCallback(() => {
    clearHoverPreviewTimer();
    setHoverCandidate(null);
    setHoverPreview(null);
  }, [clearHoverPreviewTimer]);
  const showHoverPreviewAfterDelay = useCallback(
    (node: SpecNode, anchor: HoverPreviewAnchor) => {
      clearHoverPreviewTimer();
      const nextPreview = { node, anchor };
      setHoverCandidate(nextPreview);
      hoverPreviewTimerRef.current = setTimeout(() => {
        setHoverPreview(nextPreview);
        hoverPreviewTimerRef.current = null;
      }, SPEC_NODE_HOVER_PREVIEW_DELAY_MS);
    },
    [clearHoverPreviewTimer],
  );
  const nodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        selected: node.id === activeSelectedNodeId,
        data: {
          ...node.data,
          lifecycleBadge: lifecycleBadgesByNode?.get(node.id) ?? null,
          onHoverPreviewIntent: showHoverPreviewAfterDelay,
          onHoverPreviewClear: clearHoverPreview,
        },
      })),
    [
      activeSelectedNodeId,
      baseNodes,
      clearHoverPreview,
      lifecycleBadgesByNode,
      showHoverPreviewAfterDelay,
    ],
  );
  const selection = useMemo(
    () => buildSpecGraphSelection(state.data, activeSelectedNodeId ?? null),
    [state.data, activeSelectedNodeId],
  );
  const classNames = className ? `${styles.root} ${className}` : styles.root;
  const updateSelectedNodeId = useCallback(
    (nodeId: string | null) => {
      if (selectedNodeId === undefined) setInternalSelectedNodeId(nodeId);
      onSelectedNodeIdChange?.(nodeId);
    },
    [onSelectedNodeIdChange, selectedNodeId],
  );
  const hoverPreviewDetail =
    previewDetailState.kind === "ok" &&
    hoverPreview &&
    previewDetailState.nodeId === hoverPreview.node.node_id
      ? previewDetailState.data
      : null;
  const hoverPreviewModel = hoverPreview
    ? buildSpecNodeHoverPreview(hoverPreview.node, hoverPreviewDetail)
    : null;

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  useEffect(() => {
    if (activeSelectedNodeId && !selection) updateSelectedNodeId(null);
  }, [activeSelectedNodeId, selection, updateSelectedNodeId]);

  useEffect(() => {
    if (!activeSelectedNodeId) {
      focusedNodeIdRef.current = null;
      return;
    }
    if (!viewportInitialized || focusedNodeIdRef.current === activeSelectedNodeId) return;

    const selectedNode =
      getNode(activeSelectedNodeId) ??
      baseNodes.find((node) => node.id === activeSelectedNodeId);
    if (!selectedNode) return;

    const focusPoint = getSpecGraphNodeFocusPoint(selectedNode);
    focusedNodeIdRef.current = activeSelectedNodeId;
    void setCenter(focusPoint.x, focusPoint.y, {
      duration: 360,
    });
  }, [activeSelectedNodeId, baseNodes, getNode, setCenter, viewportInitialized]);

  useEffect(() => clearHoverPreview, [clearHoverPreview]);

  return (
    <section
      className={classNames}
      aria-label="SpecGraph canvas"
      data-testid="spec-graph-canvas"
      data-source={state.source}
    >
      <ReactFlow<SpecFlowNode>
        className={styles.flow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.08}
        maxZoom={1.6}
        nodesDraggable={false}
        onNodeClick={(_, node) => {
          clearHoverPreview();
          updateSelectedNodeId(node.id);
        }}
        onPaneClick={() => {
          clearHoverPreview();
          updateSelectedNodeId(null);
        }}
        onMoveStart={clearHoverPreview}
      >
        <Background gap={28} size={1} />
        <MiniMap
          ariaLabel="SpecGraph minimap"
          className={styles.miniMap}
          position="bottom-left"
          pannable
          zoomable
          nodeBorderRadius={0}
          nodeColor="var(--gs-paper-3)"
          nodeStrokeColor="var(--gs-muted-2)"
          nodeStrokeWidth={1}
          maskColor="rgba(244, 242, 237, 0.68)"
          maskStrokeColor="var(--gs-accent)"
          maskStrokeWidth={1}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {hoverPreview && hoverPreviewModel ? (
        <SpecNodeHoverPreview
          preview={hoverPreviewModel}
          anchor={hoverPreview.anchor}
        />
      ) : null}
    </section>
  );
}
