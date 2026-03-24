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

export interface CompileTarget {
  scope: "conversation" | "checkpoint";
  target_conversation_id: string;
  target_message_id: string | null;
  target_kind: "root" | "branch" | "merge";
  lineage_conversation_ids: string[];
  lineage_edge_ids: string[];
  lineage_paths: string[][];
  root_conversation_ids: string[];
  merge_parent_conversation_ids: string[];
  unresolved_parent_edge_ids: string[];
  is_lineage_complete: boolean;
  export_dir: string;
  target_checkpoint_index?: number;
  target_checkpoint_role?: string;
}
