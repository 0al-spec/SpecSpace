export type ExplorationNodeKind =
  | "intent"
  | "assumption_cluster"
  | "hypothesis_cluster"
  | "proposal_cluster"
  | "review_gate";

export type ExplorationEdgeKind =
  | "structures_assumptions"
  | "raises_hypotheses"
  | "suggests_proposals"
  | "requires_human_review";

export interface ExplorationPreviewNode {
  id: string;
  kind: ExplorationNodeKind;
  label: string;
  text: string;
  status: string;
  authority: string;
  confidence: string;
  layer: string;
}

export interface ExplorationPreviewEdge {
  source: string;
  target: string;
  edge_kind: ExplorationEdgeKind;
}

export interface ExplorationPreview {
  artifact_kind: "exploration_preview";
  schema_version: 1;
  generated_at: string;
  mode: "assumption";
  input: {
    source_kind: "inline_operator_intent" | "none";
    text: string;
    text_sha256: string;
    input_status: "root_intent_provided" | "missing_root_intent";
  };
  review_state: "preview_only" | "blocked";
  next_gap: "human_review_before_promotion" | "provide_root_intent_text";
  canonical_mutations_allowed: false;
  tracked_artifacts_written: false;
  node_count: number;
  edge_count: number;
  nodes: ExplorationPreviewNode[];
  edges: ExplorationPreviewEdge[];
  promotion_candidates: Array<{
    target_kind: string;
    review_required: true;
    auto_promote: false;
  }>;
}

export interface ExplorationPreviewResponse {
  path: string;
  mtime: number;
  mtime_iso: string;
  data: ExplorationPreview;
}

export interface ExplorationPreviewBuildResponse {
  exit_code: number;
  stderr_tail: string;
  path: string | null;
  artifact_exists: boolean;
  built_at: string;
}

export const NODE_KIND_COLORS: Record<ExplorationNodeKind, string> = {
  intent: "var(--color-intent, #2563eb)",
  assumption_cluster: "var(--color-assumption, #d97706)",
  hypothesis_cluster: "var(--color-hypothesis, #3b82f6)",
  proposal_cluster: "var(--color-proposal, #7c3aed)",
  review_gate: "var(--color-review-gate, #6b7280)",
};
