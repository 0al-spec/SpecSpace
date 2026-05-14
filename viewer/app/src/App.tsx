import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import {
  ReactFlowProvider,
  applyNodeChanges,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type NodeChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import "./MessageNode.css";
import SpecInspector from "./SpecInspector";
import SpecLens from "./SpecLens.tsx";
import SpecPMExportPreview from "./SpecPMExportPreview.tsx";
import SpecCompileOverlay from "./SpecCompileOverlay";
import ExplorationSurfacesPanel from "./ExplorationSurfacesPanel";
import "./SpecNode.css";
import AgentChat, { AgentChatTrigger } from "./AgentChat";
import SearchPalette from "./SearchPalette";
import Sidebar, { MODE_KEY, COLLAPSE_KEY } from "./Sidebar";
import InspectorOverlay from "./InspectorOverlay";
import { useGraphData } from "./useGraphData";
import { useSpecGraphData } from "./useSpecGraphData";
import { useCapabilities } from "./useCapabilities";
import { useSelectionState } from "./useSelectionState";
import { useViewportSync } from "./useViewportSync";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { CompileTargetContext } from "./CompileTargetContext";
import TimelineFilter, { type TimelineField } from "./TimelineFilter";
import RecentChangesOverlay from "./RecentChangesOverlay";
import FilterBar, { type FilterOptions, type FilterStatus, DEFAULT_FILTER, isFilterActive } from "./FilterBar";
import PanelBtn from "./PanelBtn";
import "./PanelBtn.css";
import { ToastProvider } from "./Toast";
import GraphCanvas from "./GraphCanvas";
import TelemetryOverlay, { useTelemetryToggle } from "./TelemetryOverlay";
import { useSpecOverlayData } from "./useSpecOverlayData";
import { lensStyleFor } from "./specLens";
import type { SpecLensMode } from "./types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faBars, faFilter, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import type { GraphMode, SpecViewOptions, ApiSpecNode } from "./types";
import SpecHoverCard from "./SpecHoverCard";
import EdgeHoverCard from "./EdgeHoverCard";
import type { EdgeVisualState } from "./useSpecGraphData";

function loadInitialMode(): GraphMode {
  try {
    const stored = sessionStorage.getItem(MODE_KEY);
    if (stored === "specifications") return "specifications";
  } catch {
    // ignore
  }
  return "conversations";
}

const DEFAULT_SPEC_VIEW: SpecViewOptions = {
  viewMode: "tree",
  showCrossLinks: false,
  showBlocking: true,
  showDependsOn: true,
};

function AppInner() {
  const telemetryEnabled = useTelemetryToggle();
  const [graphMode, setGraphMode] = useState<GraphMode>(loadInitialMode);
  const {
    specAvailable,
    compileAvailable,
    specCompileAvailable,
    dashboardAvailable,
    specOverlayAvailable,
    specpmPreviewAvailable,
    explorationSurfacesAvailable,
    viewerSurfacesBuildAvailable,
    agentAvailable,
  } = useCapabilities();
  const [specpmPreviewOpen, setSpecpmPreviewOpen] = useState(false);
  const [explorationSurfacesOpen, setExplorationSurfacesOpen] = useState(false);
  const [specCompileRootId, setSpecCompileRootId] = useState<string | null>(null);
  const [specLens, setSpecLens] = useState<SpecLensMode>("none");
  const [specViewOptions, setSpecViewOptions] = useState<SpecViewOptions>(DEFAULT_SPEC_VIEW);

  // Conversation graph data
  const convGraph = useGraphData();

  // Fetch spec overlay data (health / implementation / evidence planes)
  // Must come before useSpecGraphData so gate_state is available for edge classification.
  const { overlays: specOverlays } = useSpecOverlayData(specOverlayAvailable);

  const {
    savedViewport,
    hasFitView,
    isZoomedOut,
    autoCollapseExpanded,
    getZoom,
    panToPoint,
    panToNode,
    fitNodes,
    onMiniMapClick,
    onMoveEnd,
  } = useViewportSync();

  // Spec graph data (always fetched so it's ready when mode switches)
  const specGraph = useSpecGraphData(specViewOptions, specOverlays, autoCollapseExpanded);

  // Choose active graph data by mode
  const activeGraph = graphMode === "conversations" ? convGraph : specGraph;
  const { nodes: graphNodes, edges, loading, error, refresh } = activeGraph;

  const [nodes, setNodes] = useState<Node[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedEdge, setHighlightedEdge] = useState<{ id: string; source: string; target: string } | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);

  // ── Compare / pin ─────────────────────────────────────────────────────────
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  // Clear pin when leaving specifications mode
  useEffect(() => {
    if (graphMode !== "specifications") setPinnedNodeId(null);
  }, [graphMode]);

  // ── Hover preview card ───────────────────────────────────────────────────
  const [hoveredPreview, setHoveredPreview] = useState<{ node: ApiSpecNode; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Edge hover card ───────────────────────────────────────────────────────
  const [hoveredEdge, setHoveredEdge] = useState<{
    kind: string; visualState?: EdgeVisualState;
    sourceId: string; targetId: string; x: number; y: number;
  } | null>(null);
  const edgeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_event, rfNode) => {
    if (rfNode.type !== "spec") return;
    const apiNode = specGraph.rawGraph?.nodes.find((n) => n.node_id === rfNode.id);
    if (!apiNode) return;
    const el = (_event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredPreview({ node: apiNode, rect }), 700);
  }, [specGraph.rawGraph]);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredPreview(null);
  }, []);

  const onNodeDragStart: NodeMouseHandler = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredPreview(null);
  }, []);

  // ── Filter bar ────────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER);

  // ── Sidebar collapse ─────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return sessionStorage.getItem(COLLAPSE_KEY) === "true";
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }, []);

  // ── Recent changes overlay ────────────────────────────────────────────────
  const [recentOpen, setRecentOpen] = useState(false);
  // Multi-select set from Recent Changes panel (Shift = range, Cmd/Ctrl =
  // toggle). Non-null and non-empty when active; nodes outside the set get
  // dimmed on the graph alongside the existing search/timeline/filter dims.
  // Persists when the panel closes — closing the panel to focus on the graph
  // shouldn't drop the highlight. Cleared via Esc inside the panel or by
  // plain-clicking any row.
  const [recentMultiSelectIds, setRecentMultiSelectIds] = useState<Set<string> | null>(null);
  // lastSeenAt: ISO string in localStorage; init to "now" on first run so
  // we don't show 60 unread on a fresh session.
  const [recentLastSeen, setRecentLastSeen] = useState<string>(() => {
    const saved = localStorage.getItem("contextbuilder.recentLastSeen");
    if (saved) return saved;
    const now = new Date().toISOString();
    localStorage.setItem("contextbuilder.recentLastSeen", now);
    return now;
  });

  // ── Timeline filter ───────────────────────────────────────────────────────
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineField, setTimelineField] = useState<TimelineField>("updated_at");
  const [timelineRange, setTimelineRange] = useState<[number, number] | null>(null);

  const {
    selectedConversationId,
    setSelectedConversationId,
    selectedMessageId,
    setSelectedMessageId,
    selectedSubItemId,
    setSelectedSubItemId,
    lensNodeId,
    setLensNodeId,
    compileTargetConversationId,
    compileTargetMessageId,
    setCompileTarget,
    specNav,
    navigateToSpec,
    onSpecNodeSelect,
    onFocusNode,
    onSpecNavBack,
    onSpecNavForward,
    onConversationFileSelect,
    dismissInspector,
    specNavBackLabel,
    specNavForwardLabel,
  } = useSelectionState({
    graphNodes,
    specNodes: specGraph.rawGraph?.nodes,
    panToNode,
  });

  // Clear selection when graph mode changes. Do NOT clear `nodes` here:
  // spec and dashboard share the same underlying specGraph, so graphNodes
  // keeps the same reference and the repopulation effect below would not
  // re-fire — leaving the canvas empty after Specs → Dashboard → Specs.
  // The repopulation effect handles real graph swaps (conv ↔ spec) via its
  // `graphNodes` dep; node IDs don't overlap so positions won't bleed over.
  useEffect(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [graphMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset node positions (but keep selection) when spec view mode changes
  const prevViewMode = useRef(specViewOptions.viewMode);
  const pendingLayoutSwitch = useRef(false);
  useEffect(() => {
    if (prevViewMode.current !== specViewOptions.viewMode) {
      prevViewMode.current = specViewOptions.viewMode;
      pendingLayoutSwitch.current = true;
      setNodes([]);
    }
  }, [specViewOptions.viewMode]);

  useEffect(() => {
    setNodes((prev) => {
      const applySelection = (n: Node) =>
        selectedConversationId && n.id === selectedConversationId
          ? { ...n, selected: true }
          : n;

      if (prev.length === 0) return graphNodes.map(applySelection);
      const prevPositions = new Map<string, { x: number; y: number }>();
      for (const n of prev) {
        if (!n.parentId) {
          prevPositions.set(n.id, n.position);
        }
      }
      return graphNodes.map((n) => {
        if (n.parentId) return applySelection(n);
        const existing = prevPositions.get(n.id);
        const patched = existing ? { ...n, position: existing } : n;
        return applySelection(patched);
      });
    });
  }, [graphNodes, selectedConversationId]);

  // Clear stale selection
  useEffect(() => {
    if (!selectedConversationId || graphNodes.length === 0) return;
    const ids = new Set(
      graphNodes.filter((n) => !n.parentId).map((n) => n.id),
    );
    if (!ids.has(selectedConversationId)) {
      setSelectedConversationId(null);
      setSelectedMessageId(null);
    }
  }, [graphNodes, selectedConversationId, setSelectedConversationId, setSelectedMessageId]);

  // After layout switch: pan to the previously selected node once new nodes render
  useEffect(() => {
    if (!pendingLayoutSwitch.current) return;
    if (nodes.length === 0 || !selectedConversationId) return;
    pendingLayoutSwitch.current = false;
    const target = graphNodes.find((n) => n.id === selectedConversationId);
    if (!target) return;
    const nodeW = 220;
    const nodeH = 110;
    const cx = target.position.x + nodeW / 2;
    const cy = target.position.y + nodeH / 2;
    panToPoint(cx, cy, getZoom() || 1, 100);
  }, [nodes, selectedConversationId, graphNodes, getZoom, panToPoint]);

  const onSearchSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setSelectedMessageId(null);
      panToNode(conversationId, 50);
      setSearchOpen(false);
    },
    [setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  const onSearchSelectSpec = useCallback(
    (nodeId: string) => {
      onSpecNodeSelect(nodeId);
      setSearchOpen(false);
    },
    [onSpecNodeSelect],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Shift+click: ReactFlow handles multi-selection visually — skip inspector
      if (_event.shiftKey) return;

      // Clicking a free (potential/gap) handle on a spec node → open agent chat
      if (node.type === "spec" || node.type === "expandedSpec") {
        const target = (_event.target as HTMLElement).closest?.(
          ".spec-handle-potential, .spec-handle-gap",
        );
        if (target) {
          setSelectedConversationId(node.id);
          setSelectedMessageId(null);
          if (agentAvailable) setChatOpen(true);
          return;
        }
      }

      if (node.type === "conversation" || node.type === "group") {
        const convId =
          (node.data as { conversationId?: string }).conversationId || node.id;
        setSelectedConversationId(convId);
        setSelectedMessageId(null);
        panToNode(convId, 50, true);
      } else if (node.type === "message") {
        const msgData = node.data as { messageId?: string };
        const convId = node.parentId || null;
        setSelectedConversationId(convId);
        setSelectedMessageId(msgData.messageId || null);
      } else if (node.type === "spec" || node.type === "expandedSpec") {
        navigateToSpec(node.id);
        panToNode(node.id, 50, true); // keepZoom=true for canvas clicks
      } else if (node.type === "specSubItem") {
        // Select the parent spec for the inspector and highlight the sub-item
        const parentId = node.parentId ?? null;
        const subData = node.data as { subKind?: string; index?: number };
        if (parentId) {
          navigateToSpec(parentId);
          setSelectedSubItemId(
            subData.subKind != null && subData.index != null
              ? `${subData.subKind}-${subData.index}`
              : null,
          );
          panToNode(parentId, 50, true);
        }
      }
    },
    [navigateToSpec, setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode],
  );

  // ── Timeline computed values ──────────────────────────────────────────────
  const timelineFullRange = useMemo((): [number, number] | null => {
    if (!specGraph.rawGraph) return null;
    const timestamps = specGraph.rawGraph.nodes
      .map((n) => n[timelineField])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => new Date(v).getTime())
      .filter((t) => !isNaN(t));
    if (timestamps.length === 0) return null;
    return [Math.min(...timestamps), Math.max(...timestamps)];
  }, [specGraph.rawGraph, timelineField]);

  const timelineMatchIds = useMemo((): Set<string> | null => {
    if (!timelineOpen || !timelineRange || !specGraph.rawGraph) return null;
    const [minTs, maxTs] = timelineRange;
    return new Set(
      specGraph.rawGraph.nodes
        .filter((n) => {
          const v = n[timelineField];
          if (!v) return true; // no date → always shown
          const ts = new Date(v).getTime();
          return !isNaN(ts) && ts >= minTs && ts <= maxTs;
        })
        .map((n) => n.node_id),
    );
  }, [timelineOpen, timelineRange, timelineField, specGraph.rawGraph]);

  const filterMatchIds = useMemo((): Set<string> | null => {
    if (!isFilterActive(filterOptions) || !specGraph.rawGraph) return null;
    return new Set(
      specGraph.rawGraph.nodes
        .filter((n) => {
          const statusOk = filterOptions.statuses.size === 0 || filterOptions.statuses.has(n.status as FilterStatus);
          const gapsOk = !filterOptions.hasGaps || (n.gap_count ?? 0) > 0;
          const brokenOk = !filterOptions.hasBroken || n.diagnostics.length > 0;
          return statusOk && gapsOk && brokenOk;
        })
        .map((n) => n.node_id),
    );
  }, [filterOptions, specGraph.rawGraph]);

  const displayNodes = useMemo(() => {
    const edgeEndpoints = highlightedEdge
      ? new Set([highlightedEdge.source, highlightedEdge.target])
      : null;
    const lensActive = graphMode === "specifications" && specLens !== "none";
    // Treat empty multi-select set as "no filter" so we don't dim everything.
    const recentActive = recentMultiSelectIds !== null && recentMultiSelectIds.size > 0;
    if (!edgeEndpoints && !searchMatchIds && !timelineMatchIds && !filterMatchIds && !recentActive && !lensActive) return nodes;
    return nodes.map((n) => {
      const edgeHl = edgeEndpoints?.has(n.id);
      // For child nodes (messages), match against parent ID
      const matchKey = n.parentId ?? n.id;
      const searchDim = searchMatchIds ? !searchMatchIds.has(matchKey) : false;
      const timelineDim = timelineMatchIds ? !timelineMatchIds.has(matchKey) : false;
      const filterDim = filterMatchIds ? !filterMatchIds.has(matchKey) : false;
      const recentDim = recentActive ? !recentMultiSelectIds!.has(matchKey) : false;
      // Apply lens style to spec nodes only
      let lensStyle: ReturnType<typeof lensStyleFor> | undefined;
      if (lensActive && (n.type === "spec" || n.type === "expandedSpec")) {
        const ls = lensStyleFor(n.id, specLens, specOverlays);
        if (Object.keys(ls).length > 0) lensStyle = ls;
      }
      if (!edgeHl && !searchDim && !timelineDim && !filterDim && !recentDim && !lensStyle) return n;
      return {
        ...n,
        data: {
          ...n.data,
          ...(edgeHl ? { edgeHighlighted: true } : {}),
          ...(searchDim ? { searchDimmed: true } : {}),
          ...(timelineDim ? { timelineDimmed: true } : {}),
          ...(filterDim ? { filterDimmed: true } : {}),
          ...(recentDim ? { recentDimmed: true } : {}),
          ...(lensStyle ? { lensStyle } : {}),
        },
      };
    });
  }, [nodes, highlightedEdge, searchMatchIds, timelineMatchIds, filterMatchIds, recentMultiSelectIds, graphMode, specLens, specOverlays]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdge) return edges;
    return edges.map((e) =>
      e.id === highlightedEdge.id
        ? { ...e, className: ((e.className ?? "") + " edge-highlight").trim() }
        : e
    );
  }, [edges, highlightedEdge]);

  /** Reset the timeline range to match a specific field's full extent */
  const resetTimelineRangeForField = useCallback((f: TimelineField) => {
    const tss = (specGraph.rawGraph?.nodes ?? [])
      .map((n) => n[f])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => new Date(v).getTime())
      .filter((t) => !isNaN(t));
    if (tss.length > 0) setTimelineRange([Math.min(...tss), Math.max(...tss)]);
  }, [specGraph.rawGraph]);

  const handleTimelineFieldChange = useCallback((f: TimelineField) => {
    setTimelineField(f);
    resetTimelineRangeForField(f);
  }, [resetTimelineRangeForField]);

  const toggleTimeline = useCallback(() => {
    setTimelineOpen((open) => {
      if (open) {
        // closing — reset range so re-opening starts fresh
        setTimelineRange(null);
        return false;
      } else {
        // opening — initialise to full span; close Recent (mutually exclusive)
        if (timelineFullRange) setTimelineRange(timelineFullRange);
        setRecentOpen(false);
        return true;
      }
    });
  }, [timelineFullRange]);

  // ── Recent changes — unread count + open handler ──────────────────────────
  const recentUnreadCount = useMemo(() => {
    if (!specGraph.rawGraph) return 0;
    const lastMs = new Date(recentLastSeen).getTime();
    if (!Number.isFinite(lastMs)) return 0;
    return specGraph.rawGraph.nodes.reduce((n, node) => {
      if (!node.updated_at) return n;
      return new Date(node.updated_at).getTime() > lastMs ? n + 1 : n;
    }, 0);
  }, [specGraph.rawGraph, recentLastSeen]);

  const toggleRecent = useCallback(() => {
    setRecentOpen((open) => {
      if (!open) {
        // opening — mark everything as seen; close Timeline (mutually exclusive)
        const now = new Date().toISOString();
        localStorage.setItem("contextbuilder.recentLastSeen", now);
        setRecentLastSeen(now);
        setTimelineOpen(false);
        setTimelineRange(null);
      }
      return !open;
    });
  }, []);

  useKeyboardShortcuts({
    graphMode,
    recentMultiSelectIds,
    setSearchOpen,
    setRecentMultiSelectIds,
    onSpecNavBack,
    onSpecNavForward,
    toggleRecent,
    toggleTimeline,
  });

  const specNodeTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of specGraph.rawGraph?.nodes ?? []) m.set(n.node_id, n.title);
    return m;
  }, [specGraph.rawGraph]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setHighlightedEdge((prev) => {
      if (prev?.id === edge.id) return null;
      return { id: edge.id, source: edge.source, target: edge.target };
    });
    fitNodes([edge.source, edge.target]);
  }, [fitNodes]);

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((event, edge) => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current);
    const d = edge.data as { kind?: string; visualState?: EdgeVisualState } | undefined;
    if (!d?.kind) return;
    const x = event.clientX;
    const y = event.clientY;
    edgeHoverTimerRef.current = setTimeout(() => {
      setHoveredEdge({ kind: d.kind!, visualState: d.visualState, sourceId: edge.source, targetId: edge.target, x, y });
    }, 250);
  }, []);

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current);
    setHoveredEdge(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
    setHighlightedEdge(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  return (
    <CompileTargetContext.Provider
      value={{ compileTargetConversationId, compileTargetMessageId }}
    >
      <div className="app-layout">
        <Sidebar
          onRefresh={refresh}
          graphMode={graphMode}
          onGraphModeChange={setGraphMode}
          specAvailable={specAvailable}
          dashboardAvailable={dashboardAvailable}
          onOpenExplorationSurfaces={explorationSurfacesAvailable ? () => setExplorationSurfacesOpen(true) : undefined}
          specOverlayAvailable={specOverlayAvailable}
          specLens={specLens}
          onSpecLensChange={setSpecLens}
          specViewOptions={specViewOptions}
          onSpecViewOptionsChange={setSpecViewOptions}
          onSpecNodeSelect={onSpecNodeSelect}
          selectedSpecNodeId={graphMode === "specifications" ? selectedConversationId : null}
          onSelectFile={onConversationFileSelect}
          selectedFile={
            graphMode === "conversations" && selectedConversationId
              ? (graphNodes.find((n) => n.id === selectedConversationId)?.data as { fileName?: string })?.fileName ?? null
              : null
          }
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="app-main">
          {/* Initial load spinner — only when there are no nodes yet */}
          {loading && nodes.length === 0 && (
            <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
              Loading graph…
            </div>
          )}
          {error && nodes.length === 0 && (
            <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
              <p>Error loading graph: {error}</p>
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          <GraphCanvas
            graphMode={graphMode}
            specViewOptions={specViewOptions}
            specGraph={specGraph.rawGraph}
            selectedNodeId={selectedConversationId}
            onSpecNodeSelect={onSpecNodeSelect}
            viewerSurfacesBuildAvailable={viewerSurfacesBuildAvailable}
            nodes={displayNodes}
            edges={displayEdges}
            loading={loading}
            isZoomedOut={isZoomedOut}
            defaultViewport={savedViewport.current}
            fitView={hasFitView}
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
            onMiniMapClick={onMiniMapClick}
          />

          {/* ── Top-left canvas overlay: sidebar toggle + timeline filter ─── */}
          <div className="timeline-overlay">
            {/* Sidebar show button — visible only when sidebar is collapsed */}
            {sidebarCollapsed && (
              <PanelBtn
                icon={<FontAwesomeIcon icon={faBars} />}
                title="Show sidebar"
                onClick={toggleSidebar}
              />
            )}

            {/* Timeline filter — spec mode + ReactFlow view only */}
            {graphMode === "specifications" && specViewOptions.viewMode !== "force" && (
              <>
                <div className="timeline-header">
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faClock} />}
                    title={timelineOpen ? "Close timeline filter (T)" : "Open timeline filter (T)"}
                    onClick={toggleTimeline}
                    className={timelineOpen ? "timeline-btn-active" : undefined}
                  />
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
                    title={recentOpen ? "Close recent changes (R)" : "Show recently updated nodes (R)"}
                    onClick={toggleRecent}
                    className={recentOpen ? "timeline-btn-active" : undefined}
                    badge={recentOpen ? 0 : recentUnreadCount}
                  />
                  {timelineOpen && (
                    <div className="tl-segment">
                      <button
                        className={`tl-seg-btn${timelineField === "created_at" ? " active" : ""}`}
                        onClick={() => handleTimelineFieldChange("created_at")}
                      >Created</button>
                      <button
                        className={`tl-seg-btn${timelineField === "updated_at" ? " active" : ""}`}
                        onClick={() => handleTimelineFieldChange("updated_at")}
                      >Updated</button>
                    </div>
                  )}
                </div>
                {timelineOpen && timelineFullRange && timelineRange && (
                  <TimelineFilter
                    range={timelineRange}
                    onRangeChange={setTimelineRange}
                    fullRange={timelineFullRange}
                  />
                )}
                {recentOpen && specGraph.rawGraph && (
                  <RecentChangesOverlay
                    nodes={specGraph.rawGraph.nodes}
                    multiSelectIds={recentMultiSelectIds}
                    onMultiSelectChange={setRecentMultiSelectIds}
                    onSelect={(id, ts, source) => {
                      // T-30: clicking a row focuses a ±1h timeline window
                      // around the event and switches Recent → Timeline (mutex
                      // closes Recent automatically). Then pan/select the node
                      // so the inspector opens on the same target.
                      //
                      // The Timeline jump ONLY makes sense for Nodes source,
                      // where ts === node.updated_at exactly. For Activity/Runs
                      // ts is occurred_at / run timestamp, which has no
                      // semantic alignment with the timelineField axis — it
                      // would dim the clicked node (because its updated_at
                      // falls outside the window) and push knobs past the
                      // data-bounded scale. So for non-nodes sources we just
                      // navigate and close Recent.
                      const tsMs = new Date(ts).getTime();
                      if (source === "nodes" && Number.isFinite(tsMs)) {
                        const HOUR = 60 * 60 * 1000;
                        if (timelineField !== "updated_at") {
                          setTimelineField("updated_at");
                        }
                        // Clamp the window to the data's actual range so the
                        // knobs can never fly out of the timeline track even
                        // if some future caller hands us an out-of-range ts.
                        if (timelineFullRange) {
                          const [fullMin, fullMax] = timelineFullRange;
                          const lo = Math.max(fullMin, tsMs - HOUR);
                          const hi = Math.min(fullMax, tsMs + HOUR);
                          setTimelineRange([Math.min(lo, hi), Math.max(lo, hi)]);
                        } else {
                          setTimelineRange([tsMs - HOUR, tsMs + HOUR]);
                        }
                        setTimelineOpen(true);
                        setRecentOpen(false);
                      } else {
                        // Activity / Runs: just navigate; leave Timeline alone.
                        setRecentOpen(false);
                      }
                      navigateToSpec(id);
                    }}
                    selectedNodeId={selectedConversationId}
                  />
                )}
              </>
            )}
          </div>

          {/* ── Top-left canvas overlay: filter bar (independent position) ── */}
          {graphMode === "specifications" && specViewOptions.viewMode !== "force" && (
            <div className="filter-overlay">
              <PanelBtn
                icon={<FontAwesomeIcon icon={faFilter} />}
                title={filterOpen ? "Close filter" : "Filter nodes"}
                onClick={() => {
                  if (filterOpen) {
                    setFilterOpen(false);
                    setFilterOptions(DEFAULT_FILTER);
                  } else {
                    setFilterOpen(true);
                  }
                }}
                className={isFilterActive(filterOptions) ? "filter-btn-active" : undefined}
              />
              {filterOpen && (
                <FilterBar filter={filterOptions} onChange={setFilterOptions} />
              )}
            </div>
          )}

        </main>
        {/* Spec inspector */}
        {graphMode === "specifications" && (
          <ErrorBoundary label="SpecInspector">
            <SpecInspector
              selectedNodeId={selectedConversationId}
              selectedSubItemId={selectedSubItemId}
              onDismiss={dismissInspector}
              onFocusNode={onFocusNode}
              onSelectSubItem={setSelectedSubItemId}
              onOpenLens={setLensNodeId}
              onOpenSpecpmPreview={specpmPreviewAvailable ? () => setSpecpmPreviewOpen(true) : undefined}
              onOpenExplorationPreview={explorationSurfacesAvailable ? () => setExplorationSurfacesOpen(true) : undefined}
              onOpenSpecCompile={specCompileAvailable ? (nodeId) => setSpecCompileRootId(nodeId) : undefined}
              specOverlays={specOverlays}
              specLens={specLens}
              rawGraph={specGraph.rawGraph}
              pinnedNodeId={pinnedNodeId}
              onPin={setPinnedNodeId}
              canGoBack={specNav.canGoBack}
              canGoForward={specNav.canGoForward}
              onBack={onSpecNavBack}
              onForward={onSpecNavForward}
              backLabel={specNavBackLabel}
              forwardLabel={specNavForwardLabel}
            />
          </ErrorBoundary>
        )}

        {/* Conversation inspector */}
        {graphMode === "conversations" && (
          <ErrorBoundary label="InspectorOverlay">
            <InspectorOverlay
              selectedConversationId={selectedConversationId}
              selectedMessageId={selectedMessageId}
              onDismiss={dismissInspector}
              onGraphRefresh={refresh}
              compileTargetConversationId={compileTargetConversationId}
              compileTargetMessageId={compileTargetMessageId}
              onSetCompileTarget={setCompileTarget}
              compileAvailable={compileAvailable}
            />
          </ErrorBoundary>
        )}
        {/* Spec lens — floating content viewer (position: fixed, top-level) */}
        {graphMode === "specifications" && lensNodeId && (
          <ErrorBoundary label="SpecLens">
            <SpecLens
              nodeId={lensNodeId}
              onClose={() => setLensNodeId(null)}
              onNavigate={(id) => {
                setLensNodeId(id);
                navigateToSpec(id);
              }}
              selectedSubItemId={selectedSubItemId}
              onSelectSubItem={setSelectedSubItemId}
              canGoBack={specNav.canGoBack}
              canGoForward={specNav.canGoForward}
              onBack={() => {
                const id = specNav.back();
                if (!id) return;
                setLensNodeId(id);
                setSelectedConversationId(id);
                setSelectedMessageId(null);
                setSelectedSubItemId(null);
              }}
              onForward={() => {
                const id = specNav.forward();
                if (!id) return;
                setLensNodeId(id);
                setSelectedConversationId(id);
                setSelectedMessageId(null);
                setSelectedSubItemId(null);
              }}
              backLabel={specNavBackLabel}
              forwardLabel={specNavForwardLabel}
            />
          </ErrorBoundary>
        )}

        {/* SpecPM export preview overlay */}
        {specpmPreviewOpen && (
          <ErrorBoundary label="SpecPMExportPreview">
            <SpecPMExportPreview onClose={() => setSpecpmPreviewOpen(false)} />
          </ErrorBoundary>
        )}

        {/* Spec compile overlay */}
        {specCompileRootId && (
          <ErrorBoundary label="SpecCompileOverlay">
            <SpecCompileOverlay
              rootId={specCompileRootId}
              onClose={() => setSpecCompileRootId(null)}
            />
          </ErrorBoundary>
        )}

        {/* Exploration / proposals overlay */}
        {explorationSurfacesOpen && (
          <ErrorBoundary label="ExplorationSurfacesPanel">
            <ExplorationSurfacesPanel
              onClose={() => setExplorationSurfacesOpen(false)}
            />
          </ErrorBoundary>
        )}

        {/* Agent chat — trigger always visible; panel requires capabilities.agent */}
        <AgentChatTrigger onClick={() => setChatOpen((v) => !v)} active={chatOpen} />
        {agentAvailable && (
          <AgentChat
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            contextNodeId={graphMode === "specifications" ? selectedConversationId : null}
          />
        )}
        {/* Spec node hover preview — fixed overlay, above all ReactFlow stacking contexts */}
        {hoveredPreview && graphMode === "specifications" && (
          <SpecHoverCard node={hoveredPreview.node} rect={hoveredPreview.rect} />
        )}
        {/* Edge hover card */}
        {hoveredEdge && graphMode === "specifications" && (
          <EdgeHoverCard
            kind={hoveredEdge.kind}
            visualState={hoveredEdge.visualState}
            sourceId={hoveredEdge.sourceId}
            targetId={hoveredEdge.targetId}
            sourceTitle={specNodeTitleMap.get(hoveredEdge.sourceId)}
            targetTitle={specNodeTitleMap.get(hoveredEdge.targetId)}
            x={hoveredEdge.x}
            y={hoveredEdge.y}
          />
        )}

        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          graphMode={graphMode}
          nodes={nodes}
          onSelectConversation={onSearchSelectConversation}
          onSelectSpec={onSearchSelectSpec}
          onMatchingIdsChange={setSearchMatchIds}
        />
        {telemetryEnabled && <TelemetryOverlay />}
      </div>
    </CompileTargetContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary label="App">
        <ReactFlowProvider>
          <AppInner />
        </ReactFlowProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
