import { describe, expect, it } from "vitest";
import { parseIdeaToSpecCandidateApprovalIntentState } from "./use-idea-to-spec-candidate-approval-intents";

const approvalIntentState = {
  artifact_kind: "specspace_idea_to_spec_candidate_approval_intent_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/idea_to_spec_candidate_approval_intents.json",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    idea_to_spec_repair_session: "runs/idea_to_spec_repair_session.json",
    promotion_gate: "runs/idea_to_spec_promotion_gate.json",
  },
  intents: [
    {
      id: "candidate-approval-intent.team-decision-log.20260626T100000Z",
      status: "requested",
      requested_action: "approve_candidate_for_promotion_review",
      workspace_id: "team-decision-log",
      candidate_id: "team-decision-log",
      repair_session_id: "repair-session.team-decision-log",
      repair_session_ref: "runs/idea_to_spec_repair_session.json",
      promotion_gate_ref: "runs/idea_to_spec_promotion_gate.json",
      requested_by: "operator://specspace-local",
      reason: "Ready for promotion review.",
      created_at: "2026-06-26T10:00:00Z",
      updated_at: "2026-06-26T10:00:00Z",
      ready_for_candidate_approval: true,
      ready_for_platform_promotion: false,
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      may_execute_specgraph: false,
      may_execute_prompt_agent: false,
      may_apply_to_specgraph: false,
      may_mark_candidate_accepted: false,
      may_mutate_candidate_source_artifacts: false,
      may_mutate_canonical_specs: false,
      may_write_ontology_package: false,
      may_accept_ontology_terms: false,
      may_create_branch_or_commit: false,
      may_open_pull_request: false,
      may_execute_git_service_operation: false,
    },
  ],
  summary: {
    status: "approval_intent_requested",
    intent_count: 1,
    active_intent_count: 1,
    workspace_count: 1,
    next_gap: "platform_candidate_approval_decision",
  },
  workflow_status: {
    repair_session_status: "ready",
    repair_session_ref: "runs/idea_to_spec_repair_session.json",
    repair_session_ready: true,
    candidate_approval_ready: true,
    ready_for_platform_promotion: false,
    open_blocker_count: 0,
    promotion_gate_ref: "runs/idea_to_spec_promotion_gate.json",
    platform_execution_status: "ok",
    platform_execution_ok: true,
    platform_publication_status: "ok",
    platform_publication_ok: true,
    latest_journal_state: "fresh",
    request_ready: true,
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_candidate_approval_workflow: true,
    may_execute_specgraph: false,
    may_execute_prompt_agent: false,
    may_apply_to_specgraph: false,
    may_mark_candidate_accepted: false,
    may_mutate_candidate_source_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_execute_git_service_operation: false,
  },
  authority_boundary: {
    approval_intent_state_is_authority: false,
    specgraph_execution_authority: false,
    specgraph_artifact_authority: false,
    ontology_authority: false,
    candidate_approval_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseIdeaToSpecCandidateApprovalIntentState", () => {
  it("parses SpecSpace-owned candidate approval intent state", () => {
    const parsed = parseIdeaToSpecCandidateApprovalIntentState(approvalIntentState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.activeIntentCount).toBe(1);
    expect(parsed.data.workflowStatus.candidateApprovalReady).toBe(true);
    expect(parsed.data.workflowStatus.requestReady).toBe(true);
    expect(parsed.data.intents[0]?.requestedAction).toBe(
      "approve_candidate_for_promotion_review",
    );
    expect(parsed.data.intents[0]?.mayCreateBranchOrCommit).toBe(false);
    expect(parsed.data.consumerBoundary.mayMarkCandidateAccepted).toBe(false);
    expect(parsed.data.authorityBoundary.candidateApprovalAuthority).toBe(false);
  });

  it("rejects state that claims candidate approval authority", () => {
    const expanded = structuredClone(approvalIntentState);
    expanded.authority_boundary.candidate_approval_authority = true;

    const parsed = parseIdeaToSpecCandidateApprovalIntentState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("candidate_approval_authority");
  });

  it("rejects intent records that claim Git Service execution", () => {
    const expanded = structuredClone(approvalIntentState);
    expanded.intents[0].may_execute_git_service_operation = true;

    const parsed = parseIdeaToSpecCandidateApprovalIntentState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("may_execute_git_service_operation");
  });
});
