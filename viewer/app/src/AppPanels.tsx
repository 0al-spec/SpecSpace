import type { Dispatch, SetStateAction } from "react";
import type { Node } from "@xyflow/react";
import ErrorBoundary from "./ErrorBoundary";
import SpecInspector from "./SpecInspector";
import SpecLens from "./SpecLens.tsx";
import SpecPMExportPreview from "./SpecPMExportPreview.tsx";
import SpecCompileOverlay from "./SpecCompileOverlay";
import ExplorationSurfacesPanel from "./ExplorationSurfacesPanel";
import InspectorOverlay from "./InspectorOverlay";
import AgentChat, { AgentChatTrigger } from "./AgentChat";
import SearchPalette from "./SearchPalette";
import TelemetryOverlay from "./TelemetryOverlay";
import SpecHoverCard from "./SpecHoverCard";
import EdgeHoverCard from "./EdgeHoverCard";
import type { ApiSpecGraph, ApiSpecNode, GraphMode, SpecLensMode, SpecOverlayMap } from "./types";
import type { NavHistory } from "./useNavHistory";
import type { EdgeVisualState } from "./useSpecGraphData";

type HoveredPreview = { node: ApiSpecNode; rect: DOMRect } | null;
type HoveredEdge = {
  kind: string;
  visualState?: EdgeVisualState;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
} | null;

interface AppPanelsProps {
  graphMode: GraphMode;
  selectedConversationId: string | null;
  setSelectedConversationId: (value: string | null) => void;
  selectedMessageId: string | null;
  setSelectedMessageId: (value: string | null) => void;
  selectedSubItemId: string | null;
  setSelectedSubItemId: Dispatch<SetStateAction<string | null>>;
  dismissInspector: () => void;
  onFocusNode: (nodeId: string) => void;
  lensNodeId: string | null;
  setLensNodeId: Dispatch<SetStateAction<string | null>>;
  navigateToSpec: (nodeId: string) => void;
  specpmPreviewOpen: boolean;
  setSpecpmPreviewOpen: Dispatch<SetStateAction<boolean>>;
  explorationSurfacesOpen: boolean;
  setExplorationSurfacesOpen: Dispatch<SetStateAction<boolean>>;
  specCompileRootId: string | null;
  setSpecCompileRootId: Dispatch<SetStateAction<string | null>>;
  specpmPreviewAvailable: boolean;
  explorationSurfacesAvailable: boolean;
  specCompileAvailable: boolean;
  specOverlays: SpecOverlayMap;
  specLens: SpecLensMode;
  rawGraph: ApiSpecGraph | null;
  pinnedNodeId: string | null;
  setPinnedNodeId: Dispatch<SetStateAction<string | null>>;
  specNav: NavHistory<string>;
  onSpecNavBack: () => void;
  onSpecNavForward: () => void;
  specNavBackLabel: string;
  specNavForwardLabel: string;
  refresh: () => void;
  compileTargetConversationId: string | null;
  compileTargetMessageId: string | null;
  setCompileTarget: (conversationId: string | null, messageId: string | null) => void;
  compileAvailable: boolean;
  chatOpen: boolean;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  agentAvailable: boolean;
  hoveredPreview: HoveredPreview;
  hoveredEdge: HoveredEdge;
  specNodeTitleMap: Map<string, string>;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  nodes: Node[];
  onSearchSelectConversation: (conversationId: string) => void;
  onSearchSelectSpec: (nodeId: string) => void;
  setSearchMatchIds: Dispatch<SetStateAction<Set<string> | null>>;
  telemetryEnabled: boolean;
}

export default function AppPanels({
  graphMode,
  selectedConversationId,
  setSelectedConversationId,
  selectedMessageId,
  setSelectedMessageId,
  selectedSubItemId,
  setSelectedSubItemId,
  dismissInspector,
  onFocusNode,
  lensNodeId,
  setLensNodeId,
  navigateToSpec,
  specpmPreviewOpen,
  setSpecpmPreviewOpen,
  explorationSurfacesOpen,
  setExplorationSurfacesOpen,
  specCompileRootId,
  setSpecCompileRootId,
  specpmPreviewAvailable,
  explorationSurfacesAvailable,
  specCompileAvailable,
  specOverlays,
  specLens,
  rawGraph,
  pinnedNodeId,
  setPinnedNodeId,
  specNav,
  onSpecNavBack,
  onSpecNavForward,
  specNavBackLabel,
  specNavForwardLabel,
  refresh,
  compileTargetConversationId,
  compileTargetMessageId,
  setCompileTarget,
  compileAvailable,
  chatOpen,
  setChatOpen,
  agentAvailable,
  hoveredPreview,
  hoveredEdge,
  specNodeTitleMap,
  searchOpen,
  setSearchOpen,
  nodes,
  onSearchSelectConversation,
  onSearchSelectSpec,
  setSearchMatchIds,
  telemetryEnabled,
}: AppPanelsProps) {
  return (
    <>
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
            rawGraph={rawGraph}
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

      {specpmPreviewOpen && (
        <ErrorBoundary label="SpecPMExportPreview">
          <SpecPMExportPreview onClose={() => setSpecpmPreviewOpen(false)} />
        </ErrorBoundary>
      )}

      {specCompileRootId && (
        <ErrorBoundary label="SpecCompileOverlay">
          <SpecCompileOverlay
            rootId={specCompileRootId}
            onClose={() => setSpecCompileRootId(null)}
          />
        </ErrorBoundary>
      )}

      {explorationSurfacesOpen && (
        <ErrorBoundary label="ExplorationSurfacesPanel">
          <ExplorationSurfacesPanel
            onClose={() => setExplorationSurfacesOpen(false)}
          />
        </ErrorBoundary>
      )}

      <AgentChatTrigger onClick={() => setChatOpen((open) => !open)} active={chatOpen} />
      {agentAvailable && (
        <AgentChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          contextNodeId={graphMode === "specifications" ? selectedConversationId : null}
        />
      )}

      {hoveredPreview && graphMode === "specifications" && (
        <SpecHoverCard node={hoveredPreview.node} rect={hoveredPreview.rect} />
      )}

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
    </>
  );
}
