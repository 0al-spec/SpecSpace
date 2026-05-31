import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  type NodeChange,
  type NodeProps,
  useReactFlow,
  useOnViewportChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import { SpecNodeCard } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import {
  getSpecGraphEdgeEndpointBounds,
  getSpecGraphNodeFocusPoint,
} from "../model/focus-point";
import {
  countSpecGraphCanvasGapFilters,
  filterSpecGraphCanvasNodes,
  SPEC_GRAPH_CANVAS_GAP_FILTER_LABELS,
  SPEC_GRAPH_CANVAS_GAP_FILTERS,
  type SpecGraphCanvasGapFilter,
} from "../model/gap-filter";
import {
  SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS,
  SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES,
  SPEC_GRAPH_CANVAS_EDGE_ROUTE_LABELS,
  SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODES,
  SPEC_GRAPH_CANVAS_EFFECTIVE_EDGE_DETAIL_LABELS,
  getSpecGraphCanvasEdgeDetailStorage,
  isSpecGraphCanvasEdgeVisible,
  readSpecGraphCanvasEdgeDetailMode,
  readSpecGraphCanvasEdgeRouteMode,
  resolveSpecGraphCanvasEdgeDetailMode,
  writeSpecGraphCanvasEdgeDetailMode,
  writeSpecGraphCanvasEdgeRouteMode,
  type SpecGraphCanvasEdgeDetailMode,
  type SpecGraphCanvasEdgeRouteMode,
} from "../model/edge-detail";
import {
  buildSpecGraphCanvasEdgeDirectionLegend,
  type SpecGraphCanvasEdgeDirectionLegendItem,
} from "../model/edge-direction-legend";
import {
  advanceSpecGraphForceLayoutPositions,
  buildSpecGraphForceLayoutTickInput,
  buildSpecGraphForceLayoutRuntimeModel,
  computeSpecGraphForceLayoutPositions,
  forceLayoutGuardDiagnosticState,
} from "../model/force-layout-runtime";
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
  SPEC_GRAPH_CANVAS_LAYOUT_PRESETS,
  SPEC_GRAPH_CANVAS_LAYOUT_PRESET_LABELS,
  getSpecGraphCanvasLayoutPresetStorage,
  readSpecGraphCanvasLayoutPreset,
  writeSpecGraphCanvasLayoutPreset,
  type SpecGraphCanvasLayoutPreset,
} from "../model/layout-presets";
import {
  buildSpecNodeHoverPreview,
  SPEC_NODE_HOVER_PREVIEW_DELAY_MS,
  type HoverPreviewAnchor,
} from "../model/hover-preview";
import type {
  SpecGraphCanvasOverlayKind,
  SpecGraphCanvasOverlays,
  SpecGraphCanvasOverlaySummary,
} from "../model/overlays";
import { buildSpecGraphSelection, type SpecGraphSelection } from "../model/selection";
import { buildSpecGraphCanvasSubtreeCollapseModel } from "../model/subtree-collapse";
import {
  toSpecGraphFlowElements,
  type SpecFlowEdge,
  type SpecFlowNode,
} from "../model/to-flow-elements";
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
  overlays?: SpecGraphCanvasOverlays;
  onSelectedNodeIdChange?: (nodeId: string | null) => void;
  onSelectedEdgeIdChange?: (edgeId: string | null) => void;
  onNodeOverlayClick?: (kind: SpecGraphCanvasOverlayKind, nodeId: string) => void;
  onEdgeOverlayClick?: (kind: SpecGraphCanvasOverlayKind, edgeId: string) => void;
  onSelectionChange?: (selection: SpecGraphSelection | null) => void;
  onVisibleNodeIdsChange?: (nodeIds: ReadonlySet<string>) => void;
};

type HoverPreviewState = {
  node: SpecNode;
  anchor: HoverPreviewAnchor;
};

const FORCE_LIVE_INITIAL_ALPHA = 0.92;
const FORCE_LIVE_ALPHA_DECAY = 0.965;
const FORCE_LIVE_SETTLED_ALPHA = 0.025;
const FORCE_LIVE_SETTLED_MOVEMENT = 0.18;
const FORCE_GLYPH_DIAMETER = 82;
const FORCE_GLYPH_RADIUS = FORCE_GLYPH_DIAMETER / 2;
const FORCE_GLYPH_STYLE = {
  "--spec-graph-force-glyph-size": `${FORCE_GLYPH_DIAMETER}px`,
} as CSSProperties;

type ForceLiveState = "off" | "running" | "paused" | "settled";
type CanvasViewport = { x: number; y: number; zoom: number };
type ForceLiveOverlayEdge = {
  id: string;
  path: string;
  opacity: number;
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
};

function forceLiveControlLabel(state: ForceLiveState): string {
  switch (state) {
    case "running":
      return "Pause";
    case "paused":
      return "Resume";
    case "settled":
      return "Run again";
    case "off":
      return "Run";
  }
}

function forceLiveControlStateLabel(state: ForceLiveState): string {
  switch (state) {
    case "running":
      return "settling";
    case "paused":
      return "paused";
    case "settled":
      return "settled";
    case "off":
      return "";
  }
}

function forceLiveControlTitle(state: ForceLiveState): string {
  switch (state) {
    case "running":
      return "Pause Force relaxation";
    case "paused":
      return "Resume Force relaxation";
    case "settled":
      return "Run Force relaxation again";
    case "off":
      return "Run Force relaxation";
  }
}

function forceLiveStatusLabel(state: ForceLiveState): string {
  switch (state) {
    case "running":
      return "Force settling";
    case "paused":
      return "Force paused";
    case "settled":
      return "Force settled";
    case "off":
      return "";
  }
}

function cssNumericValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

const MINIMAP_NODE_COLOR = "#f4f2ed";
const MINIMAP_NODE_STROKE_COLOR = "#151719";
const MINIMAP_MASK_STROKE_COLOR = "#2c74ad";

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
  const overlay = data.overlay;
  const subtreeChildCount = data.subtreeChildCount ?? 0;
  const subtreeDescendantCount = data.subtreeDescendantCount ?? subtreeChildCount;
  const subtreeHiddenDescendantCount = data.subtreeHiddenDescendantCount ?? 0;
  const hasOverlay = Boolean(
    overlay && (overlay.proposalCount > 0 || overlay.metricCount > 0),
  );
  const showSubtreeCollapse = subtreeChildCount > 0;
  const subtreeToggleLabel = data.subtreeCollapsed
    ? `Expand ${subtreeHiddenDescendantCount} hidden descendants`
    : `Collapse ${subtreeDescendantCount} descendants`;
  const stopFlowEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };
  const shellClassName = data.forceGlyph
    ? `${styles.nodeShell} ${styles.forceNodeShell}`
    : styles.nodeShell;

  if (data.forceGlyph) {
    return (
      <div
        className={shellClassName}
        style={FORCE_GLYPH_STYLE}
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
        <Handle
          type="target"
          position={Position.Left}
          className={[styles.handle, styles.forceHandle].join(" ")}
        />
        <div
          className={[
            styles.forceNodeGlyph,
            selected ? styles.forceNodeGlyphSelected : "",
            data.edgeEndpointHighlighted === true
              ? styles.forceNodeGlyphHighlighted
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={`${data.spec.node_id}: ${data.spec.title}`}
        >
          <span>{data.spec.node_id}</span>
        </div>
        {hasOverlay && overlay ? (
          <OverlayBadges
            overlay={overlay}
            targetId={data.spec.node_id}
            onClick={data.onOverlayClick}
            className={styles.nodeOverlayDock}
          />
        ) : null}
        <Handle
          type="source"
          position={Position.Right}
          className={[styles.handle, styles.forceHandle].join(" ")}
        />
      </div>
    );
  }

  return (
    <div
      className={shellClassName}
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
        highlighted={data.edgeEndpointHighlighted === true}
        lifecycleBadge={data.lifecycleBadge}
      />
      {showSubtreeCollapse ? (
        <button
          type="button"
          className={[
            styles.subtreeToggleButton,
            data.subtreeCollapsed ? styles.subtreeToggleButtonCollapsed : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={subtreeToggleLabel}
          aria-expanded={data.subtreeCollapsed ? "false" : "true"}
          title={subtreeToggleLabel}
          onPointerDown={stopFlowEvent}
          onMouseDown={stopFlowEvent}
          onClick={(event) => {
            stopFlowEvent(event);
            data.onSubtreeCollapseToggle?.(data.spec.node_id);
          }}
        >
          <span aria-hidden="true">{data.subtreeCollapsed ? "+" : "-"}</span>
          <span>
            {data.subtreeCollapsed
              ? subtreeHiddenDescendantCount
              : subtreeDescendantCount}
          </span>
        </button>
      ) : null}
      {hasOverlay && overlay ? (
        <OverlayBadges
          overlay={overlay}
          targetId={data.spec.node_id}
          onClick={data.onOverlayClick}
          className={styles.nodeOverlayDock}
        />
      ) : null}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

function edgeCurve(edgeKind?: SpecEdge["edge_kind"]) {
  if (edgeKind === "relates_to") return 0.58;
  if (edgeKind === "depends_on") return 0.38;
  return 0.2;
}

function SpecFlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  style,
  data,
}: EdgeProps<SpecFlowEdge>) {
  const edgePathOptions = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const [edgePath, labelX, labelY] =
    data?.forceStraight === true
      ? getStraightPath(edgePathOptions)
      : data?.route === "orthogonal"
      ? getSmoothStepPath(edgePathOptions)
      : getBezierPath({
          ...edgePathOptions,
          curvature: edgeCurve(data?.specEdge.edge_kind),
        });
  const overlay = data?.overlay;
  const hasOverlay = Boolean(
    overlay && (overlay.proposalCount > 0 || overlay.metricCount > 0),
  );
  const baseStyle =
    data?.forceStraight === true
      ? {
          ...style,
          opacity: selected ? 1 : 0.88,
          strokeWidth: selected ? 2.2 : 1.65,
        }
      : style;
  const selectedStyle = selected
    ? {
        ...baseStyle,
        stroke: "var(--gs-accent)",
        strokeWidth: 2.8,
        opacity: 1,
      }
    : baseStyle;

  return (
    <>
      {selected ? (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{
            stroke: "var(--gs-accent)",
            strokeWidth: 9,
            opacity: 0.16,
          }}
        />
      ) : null}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={selectedStyle} />
      {hasOverlay && overlay ? (
        <EdgeLabelRenderer>
          <div
            className={styles.edgeOverlayLabel}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <OverlayBadges
              overlay={overlay}
              targetId={id}
              onClick={data?.onOverlayClick}
              className={styles.edgeOverlayDock}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function OverlayBadges({
  overlay,
  targetId,
  onClick,
  className,
}: {
  overlay: SpecGraphCanvasOverlaySummary;
  targetId: string;
  onClick?: (kind: SpecGraphCanvasOverlayKind, targetId: string) => void;
  className?: string;
}) {
  const stopFlowEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className={className}>
      {overlay.proposalCount > 0 ? (
        <button
          type="button"
          className={`${styles.overlayBadge} ${styles.overlayBadgeProposal}`}
          title={`${overlay.proposalCount} related proposals`}
          onPointerDown={stopFlowEvent}
          onMouseDown={stopFlowEvent}
          onClick={(event) => {
            stopFlowEvent(event);
            onClick?.("proposal", targetId);
          }}
        >
          <span>P</span>
          <span>{overlay.proposalCount}</span>
        </button>
      ) : null}
      {overlay.metricCount > 0 ? (
        <button
          type="button"
          className={`${styles.overlayBadge} ${styles.overlayBadgeMetric}`}
          title={`${overlay.metricCount} related metrics`}
          onPointerDown={stopFlowEvent}
          onMouseDown={stopFlowEvent}
          onClick={(event) => {
            stopFlowEvent(event);
            onClick?.("metric", targetId);
          }}
        >
          <span>M</span>
          <span>{overlay.metricCount}</span>
        </button>
      ) : null}
    </div>
  );
}

const nodeTypes = {
  specNode: SpecFlowNodeView,
};

const edgeTypes = {
  specEdge: SpecFlowEdgeView,
};

function edgeDirectionToneClassName(
  tone: SpecGraphCanvasEdgeDirectionLegendItem["tone"],
) {
  if (tone === "depends") return styles.edgeDirectionSwatchDepends;
  if (tone === "refines") return styles.edgeDirectionSwatchRefines;
  return styles.edgeDirectionSwatchRelates;
}

export function SpecGraphCanvas({
  state,
  className,
  selectedNodeId,
  selectedEdgeId,
  lifecycleBadgesByNode,
  overlays,
  onSelectedNodeIdChange,
  onSelectedEdgeIdChange,
  onNodeOverlayClick,
  onEdgeOverlayClick,
  onSelectionChange,
  onVisibleNodeIdsChange,
}: Props) {
  return (
    <ReactFlowProvider>
      <SpecGraphCanvasInner
        state={state}
        className={className}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        lifecycleBadgesByNode={lifecycleBadgesByNode}
        overlays={overlays}
        onSelectedNodeIdChange={onSelectedNodeIdChange}
        onSelectedEdgeIdChange={onSelectedEdgeIdChange}
        onNodeOverlayClick={onNodeOverlayClick}
        onEdgeOverlayClick={onEdgeOverlayClick}
        onSelectionChange={onSelectionChange}
        onVisibleNodeIdsChange={onVisibleNodeIdsChange}
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
  overlays,
  onSelectedNodeIdChange,
  onSelectedEdgeIdChange,
  onNodeOverlayClick,
  onEdgeOverlayClick,
  onSelectionChange,
  onVisibleNodeIdsChange,
}: Props) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(null);
  const [gapFilter, setGapFilter] = useState<SpecGraphCanvasGapFilter>("all");
  const [layoutPreset, setLayoutPreset] = useState<SpecGraphCanvasLayoutPreset>(() =>
    readSpecGraphCanvasLayoutPreset(getSpecGraphCanvasLayoutPresetStorage()),
  );
  const [forceLayoutEnabled, setForceLayoutEnabled] = useState(false);
  const [forceLiveState, setForceLiveState] = useState<ForceLiveState>("off");
  const [forceLivePositions, setForceLivePositions] =
    useState<Map<string, SpecGraphCanvasLayoutPosition> | null>(null);
  const [edgeDetailMode, setEdgeDetailMode] = useState<SpecGraphCanvasEdgeDetailMode>(() =>
    readSpecGraphCanvasEdgeDetailMode(getSpecGraphCanvasEdgeDetailStorage()),
  );
  const [edgeRouteMode, setEdgeRouteMode] = useState<SpecGraphCanvasEdgeRouteMode>(() =>
    readSpecGraphCanvasEdgeRouteMode(getSpecGraphCanvasEdgeDetailStorage()),
  );
  const [collapsedSubtreeNodeIds, setCollapsedSubtreeNodeIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [layoutOverrides, setLayoutOverrides] =
    useState<SpecGraphCanvasLayoutOverrides>({});
  const [hoverCandidate, setHoverCandidate] = useState<HoverPreviewState | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceLiveFrameRef = useRef<number | null>(null);
  const forceLiveAlphaRef = useRef(FORCE_LIVE_INITIAL_ALPHA);
  const canvasViewportRef = useRef<CanvasViewport>({ x: 0, y: 0, zoom: 1 });
  const {
    fitBounds,
    getNode,
    setCenter,
    viewportInitialized,
  } = useReactFlow<SpecFlowNode>();
  const activeSelectedNodeId = selectedNodeId === undefined ? internalSelectedNodeId : selectedNodeId;
  const activeSelectedEdgeId = selectedEdgeId === undefined ? internalSelectedEdgeId : selectedEdgeId;
  const focusedNodeIdRef = useRef<string | null>(null);
  const focusedEdgeIdRef = useRef<string | null>(null);
  const previewDetailState = useSpecNodePreviewDetail({
    nodeId: hoverCandidate?.node.node_id ?? null,
  });
  const subtreeCollapseModel = useMemo(
    () =>
      buildSpecGraphCanvasSubtreeCollapseModel(
        state.data,
        collapsedSubtreeNodeIds,
      ),
    [collapsedSubtreeNodeIds, state.data],
  );
  const subtreeVisibleNodeIds = useMemo(
    () =>
      new Set(
        subtreeCollapseModel.response.graph.nodes.map((node) => node.node_id),
      ),
    [subtreeCollapseModel.response.graph.nodes],
  );
  const { nodes: baseNodes, edges } = useMemo(
    () => toSpecGraphFlowElements(subtreeCollapseModel.response, layoutPreset),
    [layoutPreset, subtreeCollapseModel.response],
  );
  const effectiveEdgeDetailMode = useMemo(
    () =>
      resolveSpecGraphCanvasEdgeDetailMode(
        edgeDetailMode,
        canvasZoom,
        layoutPreset,
      ),
    [canvasZoom, edgeDetailMode, layoutPreset],
  );
  const edgeDirectionLegend = useMemo(
    () => buildSpecGraphCanvasEdgeDirectionLegend(layoutPreset),
    [layoutPreset],
  );
  const layoutStorageKey = useMemo(
    () => buildSpecGraphCanvasLayoutStorageKey(state.data),
    [state.data],
  );
  const layoutNodeIds = useMemo(
    () => state.data.graph.nodes.map((node) => node.node_id),
    [state.data.graph.nodes],
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
  const forceLayoutVisibleNodes = useMemo(
    () => baseSpecNodes.filter((node) => visibleNodeIds.has(node.node_id)),
    [baseSpecNodes, visibleNodeIds],
  );
  const forceLayoutVisibleEdgeSpecs = useMemo(
    () =>
      edges
        .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .filter((edge) =>
          isSpecGraphCanvasEdgeVisible(edge.data!.specEdge, effectiveEdgeDetailMode, {
            selectedEdgeId: activeSelectedEdgeId,
            selectedNodeId: activeSelectedNodeId,
          }),
        )
        .map((edge) => edge.data!.specEdge),
    [
      activeSelectedEdgeId,
      activeSelectedNodeId,
      edges,
      effectiveEdgeDetailMode,
      visibleNodeIds,
    ],
  );
  const forceLayoutTickInput = useMemo(
    () =>
      buildSpecGraphForceLayoutTickInput(
        forceLayoutVisibleNodes,
        forceLayoutVisibleEdgeSpecs,
      ),
    [forceLayoutVisibleEdgeSpecs, forceLayoutVisibleNodes],
  );
  const forceLayoutBudgetModel = useMemo(
    () =>
      buildSpecGraphForceLayoutRuntimeModel({
        nodeCount: forceLayoutVisibleNodes.length,
        edgeCount: forceLayoutVisibleEdgeSpecs.length,
        explicitEnabled: true,
      }),
    [forceLayoutVisibleEdgeSpecs.length, forceLayoutVisibleNodes.length],
  );
  const forceLayoutRuntimeModel = useMemo(
    () =>
      buildSpecGraphForceLayoutRuntimeModel({
        nodeCount: forceLayoutVisibleNodes.length,
        edgeCount: forceLayoutVisibleEdgeSpecs.length,
        explicitEnabled: forceLayoutEnabled,
      }),
    [
      forceLayoutEnabled,
      forceLayoutVisibleEdgeSpecs.length,
      forceLayoutVisibleNodes.length,
    ],
  );
  const forceLayoutPositions = useMemo(
    () =>
      forceLayoutRuntimeModel.active
        ? computeSpecGraphForceLayoutPositions(
            forceLayoutVisibleNodes,
            forceLayoutVisibleEdgeSpecs,
          )
        : null,
    [
      forceLayoutRuntimeModel.active,
      forceLayoutVisibleEdgeSpecs,
      forceLayoutVisibleNodes,
    ],
  );
  const effectiveForceLayoutPositions =
    forceLayoutRuntimeModel.active && forceLiveState !== "off" && forceLivePositions
      ? forceLivePositions
      : forceLayoutPositions;
  const forceLiveOverlayActive =
    forceLiveState === "running" || forceLiveState === "paused";
  const forcePositionedBaseNodes = useMemo(() => {
    if (!effectiveForceLayoutPositions) return baseNodes;
    return baseNodes.map((node) => ({
      ...node,
      position: effectiveForceLayoutPositions.get(node.id) ?? node.position,
    }));
  }, [baseNodes, effectiveForceLayoutPositions]);
  const positionedBaseNodes = useMemo(
    () => applySpecGraphCanvasLayoutOverrides(forcePositionedBaseNodes, layoutOverrides),
    [forcePositionedBaseNodes, layoutOverrides],
  );
  const selectedEdgeEndpointIds = useMemo(() => {
    if (!activeSelectedEdgeId) return new Set<string>();
    const selectedEdge = edges.find((edge) => edge.id === activeSelectedEdgeId);
    return selectedEdge ? new Set([selectedEdge.source, selectedEdge.target]) : new Set<string>();
  }, [activeSelectedEdgeId, edges]);
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
  const toggleSubtreeCollapse = useCallback(
    (nodeId: string) => {
      clearHoverPreview();
      setCollapsedSubtreeNodeIds((current) => {
        const next = new Set(current);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    },
    [clearHoverPreview],
  );
  const expandAllSubtrees = useCallback(() => {
    clearHoverPreview();
    setCollapsedSubtreeNodeIds(new Set());
  }, [clearHoverPreview]);
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
          forceGlyph: forceLayoutRuntimeModel.active,
          lifecycleBadge: lifecycleBadgesByNode?.get(node.id) ?? null,
          edgeEndpointHighlighted: selectedEdgeEndpointIds.has(node.id),
          overlay: overlays?.nodesById.get(node.id) ?? null,
          subtreeCollapsed: collapsedSubtreeNodeIds.has(node.id),
          subtreeChildCount:
            subtreeCollapseModel.childCountsByNodeId.get(node.id) ?? 0,
          subtreeDescendantCount:
            subtreeCollapseModel.descendantCountsByNodeId.get(node.id) ?? 0,
          subtreeHiddenDescendantCount:
            subtreeCollapseModel.hiddenDescendantCountsByNodeId.get(node.id) ?? 0,
          onHoverPreviewIntent: showHoverPreviewAfterDelay,
          onHoverPreviewClear: clearHoverPreview,
          onOverlayClick: onNodeOverlayClick,
          onSubtreeCollapseToggle: toggleSubtreeCollapse,
        },
        })),
    [
      activeSelectedNodeId,
      clearHoverPreview,
      collapsedSubtreeNodeIds,
      lifecycleBadgesByNode,
      forceLayoutRuntimeModel.active,
      onNodeOverlayClick,
      overlays,
      positionedBaseNodes,
      selectedEdgeEndpointIds,
      showHoverPreviewAfterDelay,
      subtreeCollapseModel.childCountsByNodeId,
      subtreeCollapseModel.descendantCountsByNodeId,
      subtreeCollapseModel.hiddenDescendantCountsByNodeId,
      toggleSubtreeCollapse,
      visibleNodeIds,
    ],
  );
  const flowEdges = useMemo(
    () =>
      edges
        .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .filter((edge) =>
          isSpecGraphCanvasEdgeVisible(edge.data!.specEdge, effectiveEdgeDetailMode, {
            selectedEdgeId: activeSelectedEdgeId,
            selectedNodeId: activeSelectedNodeId,
          })
        )
        .map((edge): SpecFlowEdge => ({
          ...edge,
          selected: edge.id === activeSelectedEdgeId,
          data: {
            specEdge: edge.data!.specEdge,
            forceStraight: forceLayoutRuntimeModel.active,
            route: edgeRouteMode,
            overlay: overlays?.edgesById.get(edge.id) ?? null,
            onOverlayClick: onEdgeOverlayClick,
          },
        })),
    [
      activeSelectedEdgeId,
      activeSelectedNodeId,
      edges,
      edgeRouteMode,
      effectiveEdgeDetailMode,
      forceLayoutRuntimeModel.active,
      onEdgeOverlayClick,
      overlays,
      visibleNodeIds,
    ],
  );
  const forceLiveOverlayEdges = useMemo((): ForceLiveOverlayEdge[] => {
    if (
      !effectiveForceLayoutPositions ||
      !forceLiveOverlayActive
    ) {
      return [];
    }
    return flowEdges.flatMap((edge) => {
      const source = effectiveForceLayoutPositions.get(edge.source);
      const target = effectiveForceLayoutPositions.get(edge.target);
      if (!source || !target) return [];
      const sourceX = source.x + FORCE_GLYPH_RADIUS;
      const sourceY = source.y + FORCE_GLYPH_RADIUS;
      const targetX = target.x + FORCE_GLYPH_RADIUS;
      const targetY = target.y + FORCE_GLYPH_RADIUS;
      const deltaX = targetX - sourceX;
      const deltaY = targetY - sourceY;
      const length = Math.hypot(deltaX, deltaY);
      if (length <= 0) return [];
      const trim = Math.max(
        0,
        Math.min(FORCE_GLYPH_RADIUS + 2, length / 2 - 1),
      );
      const unitX = deltaX / length;
      const unitY = deltaY / length;
      const startX = sourceX + unitX * trim;
      const startY = sourceY + unitY * trim;
      const endX = targetX - unitX * trim;
      const endY = targetY - unitY * trim;
      const selected = edge.id === activeSelectedEdgeId;
      const stroke =
        selected
          ? "var(--gs-accent)"
          : typeof edge.style?.stroke === "string"
            ? edge.style.stroke
            : "#4e689b";
      const strokeDasharray =
        typeof edge.style?.strokeDasharray === "string"
          ? edge.style.strokeDasharray
          : undefined;
      const baseOpacity = cssNumericValue(edge.style?.opacity, 0.88);
      const baseStrokeWidth = cssNumericValue(edge.style?.strokeWidth, 1.65);
      return [
        {
          id: edge.id,
          path: [
            `M ${startX}`,
            `${startY}`,
            `L ${endX}`,
            `${endY}`,
          ].join(" "),
          opacity: selected ? 1 : baseOpacity,
          stroke,
          strokeDasharray,
          strokeWidth: selected
            ? Math.max(baseStrokeWidth * 1.45, 2.2)
            : baseStrokeWidth,
        },
      ];
    });
  }, [
    activeSelectedEdgeId,
    effectiveForceLayoutPositions,
    forceLiveOverlayActive,
    flowEdges,
  ]);
  const fullSelection = useMemo(
    () =>
      buildSpecGraphSelection(
        state.data,
        activeSelectedNodeId ?? null,
      ),
    [activeSelectedNodeId, state.data],
  );
  const selection = useMemo(
    () =>
      activeSelectedNodeId && !subtreeVisibleNodeIds.has(activeSelectedNodeId)
        ? null
        : fullSelection,
    [activeSelectedNodeId, fullSelection, subtreeVisibleNodeIds],
  );
  const collapsedSubtreeCount = useMemo(
    () => subtreeCollapseModel.visibleCollapsedNodeIds.size,
    [subtreeCollapseModel.visibleCollapsedNodeIds],
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
  const forceLayoutBlocked = !forceLayoutBudgetModel.active;
  const forceLayoutGuardDiagnostic = forceLayoutGuardDiagnosticState(
    forceLayoutRuntimeModel.guard,
    forceLayoutBudgetModel.guard,
  );
  const forceLayoutInactiveMessage = forceLayoutBudgetModel.guard.available
    ? [
        "Enable guarded Force:",
        `${forceLayoutBudgetModel.guard.nodeCount} nodes,`,
        `${forceLayoutBudgetModel.guard.edgeCount} edges`,
      ].join(" ")
    : forceLayoutBudgetModel.message;
  const forceLiveButtonLabel = forceLiveControlLabel(forceLiveState);
  const forceLiveStateLabel = forceLiveControlStateLabel(forceLiveState);
  const forceLiveButtonTitle = forceLiveControlTitle(forceLiveState);
  const forceLiveRuntimeStatusLabel = forceLiveStatusLabel(forceLiveState);
  const forceLiveAriaLabel = forceLiveStateLabel
    ? `${forceLiveButtonLabel} Force relaxation (${forceLiveStateLabel})`
    : `${forceLiveButtonLabel} Force relaxation`;
  const layoutOverrideCount = Object.keys(layoutOverrides).length;
  const updateLayoutPreset = useCallback((preset: SpecGraphCanvasLayoutPreset) => {
    clearHoverPreview();
    setForceLayoutEnabled(false);
    setForceLiveState("off");
    setForceLivePositions(null);
    setLayoutPreset(preset);
    writeSpecGraphCanvasLayoutPreset(
      getSpecGraphCanvasLayoutPresetStorage(),
      preset,
    );
  }, [clearHoverPreview]);
  const toggleForceLayout = useCallback(() => {
    clearHoverPreview();
    setForceLayoutEnabled((current) => {
      if (current) {
        setForceLiveState("off");
        setForceLivePositions(null);
        return false;
      }
      return forceLayoutBudgetModel.active;
    });
  }, [clearHoverPreview, forceLayoutBudgetModel.active]);
  const startForceLiveLayout = useCallback(() => {
    if (!forceLayoutRuntimeModel.active || !forceLayoutPositions) return;
    clearHoverPreview();
    setCanvasViewport(canvasViewportRef.current);
    forceLiveAlphaRef.current = FORCE_LIVE_INITIAL_ALPHA;
    setForceLivePositions((current) => current ?? new Map(forceLayoutPositions));
    setForceLiveState("running");
  }, [clearHoverPreview, forceLayoutPositions, forceLayoutRuntimeModel.active]);
  const pauseForceLiveLayout = useCallback(() => {
    clearHoverPreview();
    setForceLiveState((current) => (current === "running" ? "paused" : current));
  }, [clearHoverPreview]);
  const resumeForceLiveLayout = useCallback(() => {
    clearHoverPreview();
    setCanvasViewport(canvasViewportRef.current);
    setForceLiveState((current) => (current === "paused" ? "running" : current));
  }, [clearHoverPreview]);
  const toggleForceLiveLayout = useCallback(() => {
    if (forceLiveState === "running") pauseForceLiveLayout();
    else if (forceLiveState === "paused") resumeForceLiveLayout();
    else startForceLiveLayout();
  }, [
    forceLiveState,
    pauseForceLiveLayout,
    resumeForceLiveLayout,
    startForceLiveLayout,
  ]);
  const reheatForceLiveLayout = useCallback(() => {
    if (!forceLayoutRuntimeModel.active || forceLiveState === "off") return;
    setCanvasViewport(canvasViewportRef.current);
    forceLiveAlphaRef.current = FORCE_LIVE_INITIAL_ALPHA;
    setForceLiveState("running");
  }, [forceLayoutRuntimeModel.active, forceLiveState]);
  const updateEdgeDetailMode = useCallback((mode: SpecGraphCanvasEdgeDetailMode) => {
    clearHoverPreview();
    setEdgeDetailMode(mode);
    writeSpecGraphCanvasEdgeDetailMode(
      getSpecGraphCanvasEdgeDetailStorage(),
      mode,
    );
  }, [clearHoverPreview]);
  const updateEdgeRouteMode = useCallback((mode: SpecGraphCanvasEdgeRouteMode) => {
    clearHoverPreview();
    setEdgeRouteMode(mode);
    writeSpecGraphCanvasEdgeRouteMode(
      getSpecGraphCanvasEdgeDetailStorage(),
      mode,
    );
  }, [clearHoverPreview]);

  useOnViewportChange({
    onChange: (viewport) => {
      const { zoom } = viewport;
      const nextViewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      };
      canvasViewportRef.current = nextViewport;
      setCanvasZoom((currentZoom) =>
        Math.abs(currentZoom - zoom) < 0.02 ? currentZoom : zoom,
      );
      if (!forceLiveOverlayActive) return;
      setCanvasViewport((currentViewport) =>
        Math.abs(currentViewport.x - nextViewport.x) < 0.5 &&
        Math.abs(currentViewport.y - nextViewport.y) < 0.5 &&
        Math.abs(currentViewport.zoom - nextViewport.zoom) < 0.01
          ? currentViewport
          : nextViewport,
      );
    },
  });

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

      if (forceLayoutRuntimeModel.active) {
        setForceLivePositions((current) => {
          const next = new Map(current ?? forceLayoutPositions ?? []);
          for (const change of positionChanges) {
            next.set(change.id, change.position);
          }
          return next;
        });
        reheatForceLiveLayout();
        return;
      }

      setLayoutOverrides((current) => {
        let next = current;
        for (const change of positionChanges) {
          next = upsertSpecGraphCanvasLayoutOverride(next, change.id, change.position);
        }
        return next;
      });
    },
    [
      forceLayoutPositions,
      forceLayoutRuntimeModel.active,
      reheatForceLiveLayout,
    ],
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
    onVisibleNodeIdsChange?.(visibleNodeIds);
  }, [onVisibleNodeIdsChange, visibleNodeIds]);

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
    if (forceLiveOverlayActive) setCanvasViewport(canvasViewportRef.current);
  }, [forceLiveOverlayActive]);

  useEffect(() => {
    if (forceLayoutEnabled && !forceLayoutBudgetModel.active) {
      setForceLayoutEnabled(false);
      setForceLiveState("off");
      setForceLivePositions(null);
    }
  }, [forceLayoutBudgetModel.active, forceLayoutEnabled]);

  useEffect(() => {
    setForceLiveState("off");
    setForceLivePositions(null);
    forceLiveAlphaRef.current = FORCE_LIVE_INITIAL_ALPHA;
  }, [forceLayoutTickInput]);

  useEffect(() => {
    if (!forceLayoutRuntimeModel.active) {
      setForceLiveState("off");
      setForceLivePositions(null);
      forceLiveAlphaRef.current = FORCE_LIVE_INITIAL_ALPHA;
    }
  }, [forceLayoutRuntimeModel.active]);

  useEffect(() => {
    if (
      !forceLayoutRuntimeModel.active ||
      forceLiveState !== "running" ||
      !forceLayoutPositions
    ) {
      return undefined;
    }

    let cancelled = false;
    const tick = () => {
      setForceLivePositions((current) => {
        const seed = current ?? forceLayoutPositions;
        const result = advanceSpecGraphForceLayoutPositions(
          forceLayoutTickInput,
          seed,
          forceLiveAlphaRef.current,
        );
        forceLiveAlphaRef.current *= FORCE_LIVE_ALPHA_DECAY;

        if (
          forceLiveAlphaRef.current < FORCE_LIVE_SETTLED_ALPHA ||
          result.maxMovement < FORCE_LIVE_SETTLED_MOVEMENT
        ) {
          setForceLiveState("settled");
        }

        return result.positions;
      });

      if (!cancelled) {
        forceLiveFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    forceLiveFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (forceLiveFrameRef.current !== null) {
        window.cancelAnimationFrame(forceLiveFrameRef.current);
        forceLiveFrameRef.current = null;
      }
    };
  }, [
    forceLayoutPositions,
    forceLayoutRuntimeModel.active,
    forceLayoutTickInput,
    forceLiveState,
  ]);

  useEffect(() => {
    if (activeSelectedNodeId && !selection) updateSelectedNodeId(null);
  }, [activeSelectedNodeId, selection, updateSelectedNodeId]);

  useEffect(() => {
    if (
      activeSelectedEdgeId &&
      !edges.some((edge) => edge.id === activeSelectedEdgeId)
    ) {
      updateSelectedEdgeId(null);
    }
  }, [activeSelectedEdgeId, edges, updateSelectedEdgeId]);

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

  useEffect(() => {
    if (!activeSelectedEdgeId) {
      focusedEdgeIdRef.current = null;
      return;
    }
    if (!viewportInitialized || focusedEdgeIdRef.current === activeSelectedEdgeId) return;

    const selectedEdge = flowEdges.find((edge) => edge.id === activeSelectedEdgeId);
    if (!selectedEdge) return;

    const sourceNode =
      getNode(selectedEdge.source) ??
      positionedBaseNodes.find((node) => node.id === selectedEdge.source);
    const targetNode =
      getNode(selectedEdge.target) ??
      positionedBaseNodes.find((node) => node.id === selectedEdge.target);
    const endpointBounds = getSpecGraphEdgeEndpointBounds(sourceNode, targetNode);
    if (!endpointBounds) return;

    focusedEdgeIdRef.current = activeSelectedEdgeId;
    void fitBounds(endpointBounds, {
      duration: 360,
      padding: 0.28,
    });
  }, [
    activeSelectedEdgeId,
    fitBounds,
    flowEdges,
    getNode,
    positionedBaseNodes,
    viewportInitialized,
  ]);

  useEffect(() => clearHoverPreview, [clearHoverPreview]);

  return (
    <section
      className={classNames}
      aria-label="SpecGraph canvas"
      data-testid="spec-graph-canvas"
      data-gap-filter={gapFilter}
      data-layout-preset={layoutPreset}
      data-edge-detail-mode={edgeDetailMode}
      data-edge-detail-effective={effectiveEdgeDetailMode}
      data-edge-detail-layout={layoutPreset}
      data-edge-route-mode={edgeRouteMode}
      data-collapsed-subtrees={collapsedSubtreeCount}
      data-hidden-subtree-nodes={subtreeCollapseModel.hiddenNodeIds.size}
      data-force-layout={forceLayoutRuntimeModel.active ? "enabled" : "disabled"}
      data-force-layout-guard={forceLayoutGuardDiagnostic}
      data-force-live-layout={forceLiveState}
      data-source={state.source}
    >
      <div className={styles.canvasFilterDock}>
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
        </div>
        <div className={styles.layoutPresetDock} aria-label="Canvas layout presets">
          {SPEC_GRAPH_CANVAS_LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={[
                styles.gapFilterButton,
                layoutPreset === preset ? styles.gapFilterButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={layoutPreset === preset}
              onClick={() => updateLayoutPreset(preset)}
            >
              <span>{SPEC_GRAPH_CANVAS_LAYOUT_PRESET_LABELS[preset]}</span>
            </button>
          ))}
          <button
            type="button"
            className={[
              styles.gapFilterButton,
              styles.forceLayoutButton,
              forceLayoutRuntimeModel.active ? styles.gapFilterButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={forceLayoutRuntimeModel.active}
            disabled={forceLayoutBlocked}
            title={
              forceLayoutRuntimeModel.active
                ? forceLayoutRuntimeModel.message
                : forceLayoutInactiveMessage
            }
            onClick={toggleForceLayout}
          >
            <span>Force</span>
            {forceLayoutRuntimeModel.active || forceLayoutBlocked ? (
              <span>{forceLayoutRuntimeModel.active ? "On" : "Blocked"}</span>
            ) : null}
          </button>
          {forceLayoutRuntimeModel.active ? (
            <button
              type="button"
              className={[
                styles.gapFilterButton,
                styles.forceLiveButton,
                forceLiveState === "running" ? styles.gapFilterButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={forceLiveAriaLabel}
              title={forceLiveButtonTitle}
              onClick={toggleForceLiveLayout}
            >
              <span>{forceLiveButtonLabel}</span>
              {forceLiveStateLabel ? <span>{forceLiveStateLabel}</span> : null}
            </button>
          ) : null}
        </div>
        {forceLayoutRuntimeModel.active || forceLayoutBlocked ? (
          <div
            className={[
              styles.forceLayoutStatus,
              forceLayoutRuntimeModel.active ? styles.forceLayoutStatusActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={
              forceLayoutRuntimeModel.active
                ? forceLayoutRuntimeModel.message
                : forceLayoutInactiveMessage
            }
          >
            {forceLayoutRuntimeModel.active
              ? forceLiveRuntimeStatusLabel || "Force active"
              : forceLayoutInactiveMessage}
          </div>
        ) : null}
        <div className={styles.edgeDetailDock} aria-label="Canvas edge detail">
          {SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={[
                styles.gapFilterButton,
                edgeDetailMode === mode ? styles.gapFilterButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS[mode]}
              aria-pressed={edgeDetailMode === mode}
              onClick={() => updateEdgeDetailMode(mode)}
              title={
                mode === "auto"
                  ? `Auto edge detail: ${SPEC_GRAPH_CANVAS_EFFECTIVE_EDGE_DETAIL_LABELS[effectiveEdgeDetailMode]} at current zoom`
                  : `${SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS[mode]} edge detail`
              }
            >
              <span>{SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS[mode]}</span>
              {mode === "auto" ? (
                <span aria-hidden="true">
                  {SPEC_GRAPH_CANVAS_EFFECTIVE_EDGE_DETAIL_LABELS[effectiveEdgeDetailMode]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className={styles.edgeRouteDock} aria-label="Canvas edge routing">
          {SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={[
                styles.gapFilterButton,
                edgeRouteMode === mode ? styles.gapFilterButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={SPEC_GRAPH_CANVAS_EDGE_ROUTE_LABELS[mode]}
              aria-pressed={edgeRouteMode === mode}
              onClick={() => updateEdgeRouteMode(mode)}
              title={`${SPEC_GRAPH_CANVAS_EDGE_ROUTE_LABELS[mode]} edge routing`}
            >
              <span>{SPEC_GRAPH_CANVAS_EDGE_ROUTE_LABELS[mode]}</span>
            </button>
          ))}
        </div>
        <div
          className={styles.edgeDirectionDock}
          aria-label="Canvas edge direction legend"
        >
          {edgeDirectionLegend.map((item) => (
            <span
              key={item.edgeKind}
              className={styles.edgeDirectionChip}
              aria-label={`${item.label}: ${item.displayDirection}`}
              title={item.title}
            >
              <span
                className={[
                  styles.edgeDirectionSwatch,
                  edgeDirectionToneClassName(item.tone),
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ color: item.toneColor }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <span>{item.displayDirection}</span>
            </span>
          ))}
        </div>
        {collapsedSubtreeCount > 0 ? (
          <button
            type="button"
            className={[styles.gapFilterButton, styles.expandSubtreesButton].join(" ")}
            onClick={expandAllSubtrees}
          >
            <span>Expand all</span>
            <span>{collapsedSubtreeCount}</span>
          </button>
        ) : null}
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
      <ReactFlow<SpecFlowNode, SpecFlowEdge>
        className={styles.flow}
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        defaultEdgeOptions={{ type: "specEdge" }}
        minZoom={0.08}
        maxZoom={1.6}
        nodesDraggable
        onNodesChange={updateLiveLayoutOverrides}
        onNodeClick={(_, node) => {
          clearHoverPreview();
          updateSelectedEdgeId(null);
          updateSelectedNodeId(node.id);
        }}
        onNodeDragStart={() => {
          clearHoverPreview();
          reheatForceLiveLayout();
        }}
        onNodeDragStop={(_, node) => {
          clearHoverPreview();
          if (forceLayoutRuntimeModel.active) {
            setForceLivePositions((current) => {
              const next = new Map(current ?? forceLayoutPositions ?? []);
              next.set(node.id, node.position);
              return next;
            });
            reheatForceLiveLayout();
            return;
          }
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
          nodeColor={MINIMAP_NODE_COLOR}
          nodeStrokeColor={MINIMAP_NODE_STROKE_COLOR}
          nodeStrokeWidth={1.4}
          maskColor="rgba(244, 242, 237, 0.68)"
          maskStrokeColor={MINIMAP_MASK_STROKE_COLOR}
          maskStrokeWidth={1}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {forceLiveOverlayEdges.length > 0 ? (
        <svg className={styles.forceLiveEdgeOverlay} aria-hidden="true">
          <g
            transform={`translate(${canvasViewport.x} ${canvasViewport.y}) scale(${canvasViewport.zoom})`}
          >
            {forceLiveOverlayEdges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                opacity={edge.opacity}
                stroke={edge.stroke}
                strokeDasharray={edge.strokeDasharray}
                strokeLinecap="round"
                strokeWidth={edge.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>
      ) : null}
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
