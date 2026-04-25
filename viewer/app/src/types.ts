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

export interface CompileSuccess {
  status: "ok";
  compiled_md: string;
  manifest_json: string;
  provenance_json?: string;
  provenance_md?: string;
  exit_code: 0;
  stdout: string;
  stderr: string;
}

export interface CompileFailure {
  status: "error";
  error: string;
  details?: string;
  exit_code: number | null;
  stderr?: string;
  stdout?: string;
}

export type CompileResult = CompileSuccess | CompileFailure;

// ---------------------------------------------------------------------------
// SpecGraph types
// ---------------------------------------------------------------------------

export interface ApiSpecNode {
  node_id: string;
  file_name: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
  acceptance_count: number;
  decisions_count: number;
  evidence_gap: number;
  input_gap: number;
  execution_gap: number;
  gap_count: number;
  depends_on: string[];
  refines: string[];
  relates_to: string[];
  diagnostics: Array<{ message: string; edge_kind?: string }>;
  created_at?: string | null;
  updated_at?: string | null;
  /** presence.state from the spec YAML, e.g. "historical" */
  presence_state?: string | null;
}

export interface ApiSpecEdge {
  edge_id: string;
  edge_kind: "depends_on" | "refines" | "relates_to";
  source_id: string;
  target_id: string;
  status: "resolved" | "broken";
}

export interface ApiSpecGraph {
  nodes: ApiSpecNode[];
  edges: ApiSpecEdge[];
  roots: string[];
  blocked_files: unknown[];
  diagnostics: unknown[];
  summary: {
    node_count: number;
    edge_count: number;
    root_count: number;
    blocked_file_count: number;
    diagnostic_count: number;
    broken_edge_count: number;
  };
}

export type GraphMode = "conversations" | "specifications" | "dashboard";

/** Spec view mode within the specifications graph mode */
export type SpecViewMode = "tree" | "linear" | "canonical" | "force";

/** Spec lens — overlay applied on top of the view mode */
export type SpecLensMode = "none" | "health" | "implementation" | "evidence";

export interface SpecOverlayEntry {
  health?: {
    gate_state?: string;
    signals?: string[];
    recommended_actions?: string[];
    filters?: string[];
  };
  implementation?: {
    implementation_state?: string;
    freshness?: string;
    acceptance_coverage?: string;
    filters?: string[];
  };
  evidence?: {
    chain_status?: string;
    artifact_stage?: string;
    observation_coverage?: string;
    outcome_coverage?: string;
    adoption_coverage?: string;
    filters?: string[];
  };
}

export type SpecOverlayMap = Record<string, SpecOverlayEntry>;

/** Options controlling which secondary edges are displayed in tree mode */
export interface SpecViewOptions {
  viewMode: SpecViewMode;
  showCrossLinks: boolean;
  showBlocking: boolean;
  /** Linear mode: show/hide depends_on edges */
  showDependsOn: boolean;
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
