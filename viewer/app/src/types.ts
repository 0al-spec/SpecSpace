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

export interface MessageNodeData extends Record<string, unknown> {
  role: "user" | "assistant" | string;
  content: string;
  messageId: string;
  index: number;
}

export interface SubflowHeaderData extends Record<string, unknown> {
  title: string;
  kind: string;
  conversationId: string;
  onToggleExpand: (conversationId: string) => void;
}

export interface ExpandedConversationGroupData extends SubflowHeaderData {
  hasBrokenLineage: boolean;
  diagnosticCount: number;
}

export interface Checkpoint {
  message_id: string;
  role: string;
  content: string;
}
