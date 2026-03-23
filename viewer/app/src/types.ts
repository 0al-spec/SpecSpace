export interface ConversationNodeData extends Record<string, unknown> {
  title: string;
  conversationId: string;
  kind: "root" | "branch" | "merge";
  fileName: string;
  checkpointCount: number;
  isExpanded: boolean;
  hasBrokenLineage: boolean;
  diagnosticCount: number;
  onToggleExpand: (conversationId: string) => void;
}
