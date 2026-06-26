import { describe, expect, it } from "vitest";
import { parseIdeaToSpecRepairRerunRequestState } from "./use-idea-to-spec-repair-rerun-requests";

const rerunRequestState = {
  artifact_kind: "specspace_idea_to_spec_repair_rerun_request_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/idea_to_spec_repair_rerun_requests.json",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    idea_to_spec_repair_session: "runs/idea_to_spec_repair_session.json",
    specspace_repair_draft_import_preview: "runs/specspace_repair_draft_import_preview.json",
  },
  requests: [
    {
      id: "repair-rerun-request.team-decision-log.20260626T100000Z",
      status: "requested",
      requested_action: "prepare_repair_draft_rerun",
      workspace_id: "team-decision-log",
      candidate_id: "team-decision-log",
      repair_session_id: "repair-session.team-decision-log",
      repair_session_ref: "runs/idea_to_spec_repair_session.json",
      draft_state_ref: "specspace-state://idea_to_spec_repair_drafts.json",
      import_preview_ref: "runs/specspace_repair_draft_import_preview.json",
      rerun_report_ref: "runs/specspace_repair_draft_rerun_report.json",
      requested_by: "operator://specspace-local",
      created_at: "2026-06-26T10:00:00Z",
      updated_at: "2026-06-26T10:00:00Z",
      draft_count: 1,
      accepted_for_rerun_count: 1,
      operator_command:
        "make product-workspace-repair-draft-rerun SPECSPACE_REPAIR_DRAFT_RERUN_IMPORT_PREVIEW=runs/specspace_repair_draft_import_preview.json",
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      may_execute_specgraph: false,
      may_run_make_target: false,
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
    status: "rerun_requested",
    request_count: 1,
    active_request_count: 1,
    workspace_count: 1,
    next_gap: "execute_specgraph_repair_draft_rerun_in_controlled_environment",
  },
  workflow_status: {
    drafts_saved: true,
    draft_count: 1,
    import_preview_status: "ready",
    import_preview_ref: "runs/specspace_repair_draft_import_preview.json",
    accepted_for_rerun_count: 1,
    rerun_status: "not_prepared",
    rerun_report_ref: "runs/specspace_repair_draft_rerun_report.json",
    latest_journal_state: "fresh",
    operator_command:
      "make product-workspace-repair-draft-rerun SPECSPACE_REPAIR_DRAFT_RERUN_IMPORT_PREVIEW=runs/specspace_repair_draft_import_preview.json",
    request_ready: true,
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_product_repair_workflow: true,
    may_execute_specgraph: false,
    may_execute_prompt_agent: false,
    may_apply_to_specgraph: false,
    may_apply_answers: false,
    may_apply_decisions: false,
    may_mutate_candidate_source_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_execute_git_service_operation: false,
  },
  authority_boundary: {
    rerun_request_state_is_authority: false,
    specgraph_execution_authority: false,
    specgraph_artifact_authority: false,
    ontology_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseIdeaToSpecRepairRerunRequestState", () => {
  it("parses SpecSpace-owned repair rerun request state", () => {
    const parsed = parseIdeaToSpecRepairRerunRequestState(rerunRequestState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.activeRequestCount).toBe(1);
    expect(parsed.data.workflowStatus.importPreviewStatus).toBe("ready");
    expect(parsed.data.workflowStatus.requestReady).toBe(true);
    expect(parsed.data.requests[0]?.requestedAction).toBe(
      "prepare_repair_draft_rerun",
    );
    expect(parsed.data.requests[0]?.mayExecuteSpecgraph).toBe(false);
    expect(parsed.data.consumerBoundary.mayExecuteSpecgraph).toBe(false);
    expect(parsed.data.authorityBoundary.rerunRequestStateIsAuthority).toBe(
      false,
    );
  });

  it("rejects state that claims SpecGraph execution authority", () => {
    const expanded = structuredClone(rerunRequestState);
    expanded.consumer_boundary.may_execute_specgraph = true;

    const parsed = parseIdeaToSpecRepairRerunRequestState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("may_execute_specgraph");
  });

  it("rejects request records that claim make target execution", () => {
    const expanded = structuredClone(rerunRequestState);
    expanded.requests[0].may_run_make_target = true;

    const parsed = parseIdeaToSpecRepairRerunRequestState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("may_run_make_target");
  });
});
