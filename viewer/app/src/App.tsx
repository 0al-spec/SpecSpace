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
import { useCanvasOverlayState } from "./useCanvasOverlayState";
import { CompileTargetContext } from "./CompileTargetContext";
import { ToastProvider } from "./Toast";
import GraphCanvas from "./GraphCanvas";
import CanvasOverlays from "./CanvasOverlays";
import TelemetryOverlay, { useTelemetryToggle } from "./TelemetryOverlay";
import { useSpecOverlayData } from "./useSpecOverlayData";
import type { SpecLensMode } from "./types";
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

  const {
    displayNodes,
    displayEdges,
    timelineOpen,
    timelineField,
    timelineFullRange,
    timelineRange,
    setTimelineRange,
    handleTimelineFieldChange,
    toggleTimeline,
    recentOpen,
    recentUnreadCount,
    recentMultiSelectIds,
    setRecentMultiSelectIds,
    toggleRecent,
    onRecentSelect,
    filterOpen,
    setFilterOpen,
    filterOptions,
    setFilterOptions,
  } = useCanvasOverlayState({
    graphMode,
    specLens,
    specNodes: specGraph.rawGraph?.nodes,
    specOverlays,
    nodes,
    edges,
    highlightedEdge,
    searchMatchIds,
    setSearchOpen,
    navigateToSpec,
    onSpecNavBack,
    onSpecNavForward,
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

          <CanvasOverlays
            graphMode={graphMode}
            specViewOptions={specViewOptions}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            timelineOpen={timelineOpen}
            timelineField={timelineField}
            timelineFullRange={timelineFullRange}
            timelineRange={timelineRange}
            onTimelineFieldChange={handleTimelineFieldChange}
            onTimelineRangeChange={setTimelineRange}
            onToggleTimeline={toggleTimeline}
            recentOpen={recentOpen}
            recentUnreadCount={recentUnreadCount}
            recentMultiSelectIds={recentMultiSelectIds}
            onRecentMultiSelectChange={setRecentMultiSelectIds}
            onToggleRecent={toggleRecent}
            onRecentSelect={onRecentSelect}
            specNodes={specGraph.rawGraph?.nodes}
            selectedNodeId={selectedConversationId}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            filterOptions={filterOptions}
            setFilterOptions={setFilterOptions}
          />

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
