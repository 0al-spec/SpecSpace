import { useCallback, useEffect, useState } from "react";
import { MODE_KEY, COLLAPSE_KEY } from "./Sidebar";
import { useGraphData } from "./useGraphData";
import { useSpecGraphData } from "./useSpecGraphData";
import { useCapabilities } from "./useCapabilities";
import { useSelectionState } from "./useSelectionState";
import { useViewportSync } from "./useViewportSync";
import { useCanvasOverlayState } from "./useCanvasOverlayState";
import { useGraphInteractionState } from "./useGraphInteractionState";
import { useSpecOverlayData } from "./useSpecOverlayData";
import { useTelemetryToggle } from "./TelemetryOverlay";
import type { GraphMode, SpecLensMode, SpecViewOptions } from "./types";

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

export function useViewerAppController() {
  const telemetryEnabled = useTelemetryToggle();
  const [graphMode, setGraphMode] = useState<GraphMode>(loadInitialMode);
  const capabilities = useCapabilities();
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
  } = capabilities;
  const [specpmPreviewOpen, setSpecpmPreviewOpen] = useState(false);
  const [explorationSurfacesOpen, setExplorationSurfacesOpen] = useState(false);
  const [specCompileRootId, setSpecCompileRootId] = useState<string | null>(null);
  const [specLens, setSpecLens] = useState<SpecLensMode>("none");
  const [specViewOptions, setSpecViewOptions] = useState<SpecViewOptions>(DEFAULT_SPEC_VIEW);

  const convGraph = useGraphData();
  const { overlays: specOverlays } = useSpecOverlayData(specOverlayAvailable);

  const viewport = useViewportSync();
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
  } = viewport;

  const specGraph = useSpecGraphData(specViewOptions, specOverlays, autoCollapseExpanded);
  const activeGraph = graphMode === "conversations" ? convGraph : specGraph;
  const { nodes: graphNodes, edges: graphEdges, loading, error, refresh } = activeGraph;

  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (graphMode !== "specifications") setPinnedNodeId(null);
  }, [graphMode]);

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

  const selection = useSelectionState({
    graphNodes,
    specNodes: specGraph.rawGraph?.nodes,
    panToNode,
  });
  const {
    selectedConversationId,
    setSelectedConversationId,
    setSelectedMessageId,
    setSelectedSubItemId,
    navigateToSpec,
    onSpecNodeSelect,
    onSpecNavBack,
    onSpecNavForward,
  } = selection;

  const interactions = useGraphInteractionState({
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
    nodes,
    edges,
    highlightedEdge,
    searchMatchIds,
  } = interactions;

  const overlays = useCanvasOverlayState({
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

  return {
    telemetryEnabled,
    graphMode,
    setGraphMode,
    capabilities,
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
  };
}

export type ViewerAppController = ReturnType<typeof useViewerAppController>;
