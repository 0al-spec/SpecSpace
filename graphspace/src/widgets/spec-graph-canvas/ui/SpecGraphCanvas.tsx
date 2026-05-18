import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeChange,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SpecNode } from "@/entities/spec-node";
import { SpecNodeCard } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import { getSpecGraphNodeFocusPoint } from "../model/focus-point";
import {
  countSpecGraphCanvasGapFilters,
  filterSpecGraphCanvasNodes,
  SPEC_GRAPH_CANVAS_GAP_FILTER_LABELS,
  SPEC_GRAPH_CANVAS_GAP_FILTERS,
  type SpecGraphCanvasGapFilter,
} from "../model/gap-filter";
import {
  applySpecGraphCanvasLayoutOverrides,
  buildSpecGraphCanvasLayoutStorageKey,
  getSpecGraphCanvasLayoutStorage,
  readSpecGraphCanvasLayoutOverrides,
  removeSpecGraphCanvasLayoutOverrides,
  upsertSpecGraphCanvasLayoutOverride,
  writeSpecGraphCanvasLayoutOverrides,
  type SpecGraphCanvasLayoutOverrides,
  type SpecGraphCanvasLayoutPosition,
} from "../model/layout-overrides";
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
  selectedEdgeId?: string | null;
  lifecycleBadgesByNode?: ReadonlyMap<string, SpecPMLifecycleBadge>;
  onSelectedNodeIdChange?: (nodeId: string | null) => void;
  onSelectedEdgeIdChange?: (edgeId: string | null) => void;
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
  selectedEdgeId,
  lifecycleBadgesByNode,
  onSelectedNodeIdChange,
  onSelectedEdgeIdChange,
  onSelectionChange,
}: Props) {
  return (
    <ReactFlowProvider>
      <SpecGraphCanvasInner
        state={state}
        className={className}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        lifecycleBadgesByNode={lifecycleBadgesByNode}
        onSelectedNodeIdChange={onSelectedNodeIdChange}
        onSelectedEdgeIdChange={onSelectedEdgeIdChange}
        onSelectionChange={onSelectionChange}
      />
    </ReactFlowProvider>
  );
}

function SpecGraphCanvasInner({
  state,
  className,
  selectedNodeId,
  selectedEdgeId,
  lifecycleBadgesByNode,
  onSelectedNodeIdChange,
  onSelectedEdgeIdChange,
  onSelectionChange,
}: Props) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(null);
  const [gapFilter, setGapFilter] = useState<SpecGraphCanvasGapFilter>("all");
  const [layoutOverrides, setLayoutOverrides] =
    useState<SpecGraphCanvasLayoutOverrides>({});
  const [hoverCandidate, setHoverCandidate] = useState<HoverPreviewState | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    getNode,
    setCenter,
    viewportInitialized,
  } = useReactFlow<SpecFlowNode>();
  const activeSelectedNodeId = selectedNodeId === undefined ? internalSelectedNodeId : selectedNodeId;
  const activeSelectedEdgeId = selectedEdgeId === undefined ? internalSelectedEdgeId : selectedEdgeId;
  const focusedNodeIdRef = useRef<string | null>(null);
  const previewDetailState = useSpecNodePreviewDetail({
    nodeId: hoverCandidate?.node.node_id ?? null,
  });
  const { nodes: baseNodes, edges } = useMemo(
    () => toSpecGraphFlowElements(state.data),
    [state.data],
  );
  const layoutStorageKey = useMemo(
    () => buildSpecGraphCanvasLayoutStorageKey(state.data),
    [state.data],
  );
  const layoutNodeIds = useMemo(
    () => baseNodes.map((node) => node.id),
    [baseNodes],
  );
  const positionedBaseNodes = useMemo(
    () => applySpecGraphCanvasLayoutOverrides(baseNodes, layoutOverrides),
    [baseNodes, layoutOverrides],
  );
  const baseSpecNodes = useMemo(
    () => baseNodes.map((node) => node.data.spec),
    [baseNodes],
  );
  const gapFilterCounts = useMemo(
    () => countSpecGraphCanvasGapFilters(baseSpecNodes),
    [baseSpecNodes],
  );
  const visibleNodeIds = useMemo(
    () =>
      new Set(
        filterSpecGraphCanvasNodes(baseSpecNodes, gapFilter).map(
          (node) => node.node_id,
        ),
      ),
    [baseSpecNodes, gapFilter],
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
      positionedBaseNodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => ({
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
      clearHoverPreview,
      lifecycleBadgesByNode,
      positionedBaseNodes,
      showHoverPreviewAfterDelay,
      visibleNodeIds,
    ],
  );
  const flowEdges = useMemo(
    () =>
      edges
        .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          selected: edge.id === activeSelectedEdgeId,
        })),
    [activeSelectedEdgeId, edges, visibleNodeIds],
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
  const updateSelectedEdgeId = useCallback(
    (edgeId: string | null) => {
      if (selectedEdgeId === undefined) setInternalSelectedEdgeId(edgeId);
      onSelectedEdgeIdChange?.(edgeId);
    },
    [onSelectedEdgeIdChange, selectedEdgeId],
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
  const hoverPreviewLifecycleBadge = hoverPreview
    ? lifecycleBadgesByNode?.get(hoverPreview.node.node_id) ?? null
    : null;
  const layoutOverrideCount = Object.keys(layoutOverrides).length;

  const persistLayoutOverride = useCallback(
    (nodeId: string, position: SpecGraphCanvasLayoutPosition) => {
      setLayoutOverrides((current) => {
        const next = upsertSpecGraphCanvasLayoutOverride(current, nodeId, position);
        writeSpecGraphCanvasLayoutOverrides(
          getSpecGraphCanvasLayoutStorage(),
          layoutStorageKey,
          next,
        );
        return next;
      });
    },
    [layoutStorageKey],
  );

  const updateLiveLayoutOverrides = useCallback(
    (changes: NodeChange<SpecFlowNode>[]) => {
      const positionChanges = changes.filter(
        (
          change,
        ): change is NodeChange<SpecFlowNode> & {
          id: string;
          position: SpecGraphCanvasLayoutPosition;
          type: "position";
        } => change.type === "position" && Boolean(change.position),
      );
      if (positionChanges.length === 0) return;

      setLayoutOverrides((current) => {
        let next = current;
        for (const change of positionChanges) {
          next = upsertSpecGraphCanvasLayoutOverride(next, change.id, change.position);
        }
        return next;
      });
    },
    [],
  );

  const resetLayoutOverrides = useCallback(() => {
    clearHoverPreview();
    removeSpecGraphCanvasLayoutOverrides(
      getSpecGraphCanvasLayoutStorage(),
      layoutStorageKey,
    );
    setLayoutOverrides({});
  }, [clearHoverPreview, layoutStorageKey]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  useEffect(() => {
    setLayoutOverrides(
      readSpecGraphCanvasLayoutOverrides(
        getSpecGraphCanvasLayoutStorage(),
        layoutStorageKey,
        layoutNodeIds,
      ),
    );
  }, [layoutNodeIds, layoutStorageKey]);

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
      positionedBaseNodes.find((node) => node.id === activeSelectedNodeId);
    if (!selectedNode) return;

    const focusPoint = getSpecGraphNodeFocusPoint(selectedNode);
    focusedNodeIdRef.current = activeSelectedNodeId;
    void setCenter(focusPoint.x, focusPoint.y, {
      duration: 360,
    });
  }, [activeSelectedNodeId, getNode, positionedBaseNodes, setCenter, viewportInitialized]);

  useEffect(() => clearHoverPreview, [clearHoverPreview]);

  return (
    <section
      className={classNames}
      aria-label="SpecGraph canvas"
      data-testid="spec-graph-canvas"
      data-gap-filter={gapFilter}
      data-source={state.source}
    >
      <div className={styles.gapFilterDock} aria-label="Canvas gap filters">
        {SPEC_GRAPH_CANVAS_GAP_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={[
              styles.gapFilterButton,
              gapFilter === filter ? styles.gapFilterButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={gapFilter === filter}
            onClick={() => setGapFilter(filter)}
          >
            <span>{SPEC_GRAPH_CANVAS_GAP_FILTER_LABELS[filter]}</span>
            <span>{gapFilterCounts[filter]}</span>
          </button>
        ))}
        {layoutOverrideCount > 0 ? (
          <button
            type="button"
            className={[styles.gapFilterButton, styles.layoutResetButton].join(" ")}
            onClick={resetLayoutOverrides}
          >
            <span>Reset layout</span>
            <span>{layoutOverrideCount}</span>
          </button>
        ) : null}
      </div>
      <ReactFlow<SpecFlowNode>
        className={styles.flow}
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.08}
        maxZoom={1.6}
        nodesDraggable
        onNodesChange={updateLiveLayoutOverrides}
        onNodeClick={(_, node) => {
          clearHoverPreview();
          updateSelectedEdgeId(null);
          updateSelectedNodeId(node.id);
        }}
        onNodeDragStart={clearHoverPreview}
        onNodeDragStop={(_, node) => {
          clearHoverPreview();
          persistLayoutOverride(node.id, node.position);
        }}
        onEdgeClick={(_, edge) => {
          clearHoverPreview();
          updateSelectedNodeId(null);
          updateSelectedEdgeId(edge.id);
        }}
        onPaneClick={() => {
          clearHoverPreview();
          updateSelectedNodeId(null);
          updateSelectedEdgeId(null);
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
      {nodes.length === 0 ? (
        <div className={styles.emptyFilterState}>
          No nodes match the active canvas gap filter.
        </div>
      ) : null}
      {hoverPreview && hoverPreviewModel ? (
        <SpecNodeHoverPreview
          preview={hoverPreviewModel}
          anchor={hoverPreview.anchor}
          lifecycleBadge={hoverPreviewLifecycleBadge}
        />
      ) : null}
    </section>
  );
}
