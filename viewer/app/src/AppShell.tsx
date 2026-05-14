import AppSidebar from "./AppSidebar";
import GraphCanvas from "./GraphCanvas";
import CanvasOverlays from "./CanvasOverlays";
import AppPanels from "./AppPanels";
import { CompileTargetContext } from "./CompileTargetContext";
import type { ViewerAppController } from "./useViewerAppController";

interface AppShellProps {
  controller: ViewerAppController;
}

export default function AppShell({ controller }: AppShellProps) {
  const {
    telemetryEnabled,
    graphMode,
    setGraphMode,
    specAvailable,
    compileAvailable,
    specCompileAvailable,
    dashboardAvailable,
    specOverlayAvailable,
    specpmPreviewAvailable,
    explorationSurfacesAvailable,
    viewerSurfacesBuildAvailable,
    agentAvailable,
    specpmPreviewOpen,
    setSpecpmPreviewOpen,
    explorationSurfacesOpen,
    setExplorationSurfacesOpen,
    specCompileRootId,
    setSpecCompileRootId,
    specLens,
    setSpecLens,
    specViewOptions,
    setSpecViewOptions,
    specOverlays,
    savedViewport,
    hasFitView,
    isZoomedOut,
    onMiniMapClick,
    onMoveEnd,
    specGraph,
    graphNodes,
    loading,
    error,
    refresh,
    chatOpen,
    setChatOpen,
    searchOpen,
    setSearchOpen,
    pinnedNodeId,
    setPinnedNodeId,
    sidebarCollapsed,
    toggleSidebar,
    selection,
    interactions,
    overlays,
  } = controller;

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
  } = selection;

  const {
    nodes,
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
    setSearchMatchIds,
    hoveredPreview,
    hoveredEdge,
  } = interactions;

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
  } = overlays;

  return (
    <CompileTargetContext.Provider
      value={{ compileTargetConversationId, compileTargetMessageId }}
    >
      <div className="app-layout">
        <AppSidebar
          onRefresh={refresh}
          graphMode={graphMode}
          onGraphModeChange={setGraphMode}
          specAvailable={specAvailable}
          dashboardAvailable={dashboardAvailable}
          explorationSurfacesAvailable={explorationSurfacesAvailable}
          onOpenExplorationSurfaces={() => setExplorationSurfacesOpen(true)}
          specOverlayAvailable={specOverlayAvailable}
          specLens={specLens}
          onSpecLensChange={setSpecLens}
          specViewOptions={specViewOptions}
          onSpecViewOptionsChange={setSpecViewOptions}
          onSpecNodeSelect={onSpecNodeSelect}
          selectedConversationId={selectedConversationId}
          onConversationFileSelect={onConversationFileSelect}
          graphNodes={graphNodes}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="app-main">
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

        <AppPanels
          graphMode={graphMode}
          selectedConversationId={selectedConversationId}
          setSelectedConversationId={setSelectedConversationId}
          selectedMessageId={selectedMessageId}
          setSelectedMessageId={setSelectedMessageId}
          selectedSubItemId={selectedSubItemId}
          setSelectedSubItemId={setSelectedSubItemId}
          dismissInspector={dismissInspector}
          onFocusNode={onFocusNode}
          lensNodeId={lensNodeId}
          setLensNodeId={setLensNodeId}
          navigateToSpec={navigateToSpec}
          specpmPreviewOpen={specpmPreviewOpen}
          setSpecpmPreviewOpen={setSpecpmPreviewOpen}
          explorationSurfacesOpen={explorationSurfacesOpen}
          setExplorationSurfacesOpen={setExplorationSurfacesOpen}
          specCompileRootId={specCompileRootId}
          setSpecCompileRootId={setSpecCompileRootId}
          specpmPreviewAvailable={specpmPreviewAvailable}
          explorationSurfacesAvailable={explorationSurfacesAvailable}
          specCompileAvailable={specCompileAvailable}
          specOverlays={specOverlays}
          specLens={specLens}
          rawGraph={specGraph.rawGraph}
          pinnedNodeId={pinnedNodeId}
          setPinnedNodeId={setPinnedNodeId}
          specNav={specNav}
          onSpecNavBack={onSpecNavBack}
          onSpecNavForward={onSpecNavForward}
          specNavBackLabel={specNavBackLabel}
          specNavForwardLabel={specNavForwardLabel}
          refresh={refresh}
          compileTargetConversationId={compileTargetConversationId}
          compileTargetMessageId={compileTargetMessageId}
          setCompileTarget={setCompileTarget}
          compileAvailable={compileAvailable}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          agentAvailable={agentAvailable}
          hoveredPreview={hoveredPreview}
          hoveredEdge={hoveredEdge}
          specNodeTitleMap={specNodeTitleMap}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          nodes={nodes}
          onSearchSelectConversation={onSearchSelectConversation}
          onSearchSelectSpec={onSearchSelectSpec}
          setSearchMatchIds={setSearchMatchIds}
          telemetryEnabled={telemetryEnabled}
        />
      </div>
    </CompileTargetContext.Provider>
  );
}
