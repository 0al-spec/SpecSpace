import { useCallback, useEffect, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { ReactFlowProvider } from "@xyflow/react";
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
import { useGraphInteractionState } from "./useGraphInteractionState";
import { CompileTargetContext } from "./CompileTargetContext";
import { ToastProvider } from "./Toast";
import GraphCanvas from "./GraphCanvas";
import CanvasOverlays from "./CanvasOverlays";
import TelemetryOverlay, { useTelemetryToggle } from "./TelemetryOverlay";
import { useSpecOverlayData } from "./useSpecOverlayData";
import type { SpecLensMode } from "./types";
import type { GraphMode, SpecViewOptions } from "./types";
import SpecHoverCard from "./SpecHoverCard";
import EdgeHoverCard from "./EdgeHoverCard";

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
  const { nodes: graphNodes, edges: graphEdges, loading, error, refresh } = activeGraph;

  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Compare / pin ─────────────────────────────────────────────────────────
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  // Clear pin when leaving specifications mode
  useEffect(() => {
    if (graphMode !== "specifications") setPinnedNodeId(null);
  }, [graphMode]);

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

  const {
    nodes,
    edges,
    highlightedEdge,
    searchMatchIds,
    setSearchMatchIds,
    hoveredPreview,
    hoveredEdge,
    specNodeTitleMap,
    onSearchSelectConversation,
    onSearchSelectSpec,
    onNodesChange,
    onNodeClick,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onNodeDragStart,
    onEdgeClick,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onPaneClick,
  } = useGraphInteractionState({
    graphMode,
    specViewMode: specViewOptions.viewMode,
    graphNodes,
    graphEdges,
    selectedConversationId,
    setSelectedConversationId,
    setSelectedMessageId,
    setSelectedSubItemId,
    setSearchOpen,
    navigateToSpec,
    onSpecNodeSelect,
    panToNode,
    panToPoint,
    getZoom,
    fitNodes,
    agentAvailable,
    setChatOpen,
    specNodes: specGraph.rawGraph?.nodes,
  });

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
