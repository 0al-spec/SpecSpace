import type { Node } from "@xyflow/react";
import Sidebar from "./Sidebar";
import type { GraphMode, SpecLensMode, SpecViewOptions } from "./types";

interface AppSidebarProps {
  onRefresh: () => void;
  graphMode: GraphMode;
  onGraphModeChange: (mode: GraphMode) => void;
  specAvailable: boolean;
  dashboardAvailable: boolean;
  explorationSurfacesAvailable: boolean;
  onOpenExplorationSurfaces: () => void;
  specOverlayAvailable: boolean;
  specLens: SpecLensMode;
  onSpecLensChange: (mode: SpecLensMode) => void;
  specViewOptions: SpecViewOptions;
  onSpecViewOptionsChange: (options: SpecViewOptions) => void;
  onSpecNodeSelect: (nodeId: string) => void;
  selectedConversationId: string | null;
  onConversationFileSelect: (fileName: string) => void;
  graphNodes: Node[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AppSidebar({
  onRefresh,
  graphMode,
  onGraphModeChange,
  specAvailable,
  dashboardAvailable,
  explorationSurfacesAvailable,
  onOpenExplorationSurfaces,
  specOverlayAvailable,
  specLens,
  onSpecLensChange,
  specViewOptions,
  onSpecViewOptionsChange,
  onSpecNodeSelect,
  selectedConversationId,
  onConversationFileSelect,
  graphNodes,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  return (
    <Sidebar
      onRefresh={onRefresh}
      graphMode={graphMode}
      onGraphModeChange={onGraphModeChange}
      specAvailable={specAvailable}
      dashboardAvailable={dashboardAvailable}
      onOpenExplorationSurfaces={explorationSurfacesAvailable ? onOpenExplorationSurfaces : undefined}
      specOverlayAvailable={specOverlayAvailable}
      specLens={specLens}
      onSpecLensChange={onSpecLensChange}
      specViewOptions={specViewOptions}
      onSpecViewOptionsChange={onSpecViewOptionsChange}
      onSpecNodeSelect={onSpecNodeSelect}
      selectedSpecNodeId={graphMode === "specifications" ? selectedConversationId : null}
      onSelectFile={onConversationFileSelect}
      selectedFile={
        graphMode === "conversations" && selectedConversationId
          ? (graphNodes.find((node) => node.id === selectedConversationId)?.data as { fileName?: string })?.fileName ?? null
          : null
      }
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  );
}
