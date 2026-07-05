import { describe, expect, it } from "vitest";

import { parseIdeaToSpecWorkspace } from "./use-idea-to-spec-workspace";

function guidedFlowBoundary() {
  return {
    inspect_only: true,
    acknowledge_only: true,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_execute_git_service: false,
    may_mutate_candidate_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_merge_review: false,
  };
}

function minimalWorkspacePayload() {
  return {
    api_version: "v1",
    artifact_kind: "specspace_idea_to_spec_workspace",
    schema_version: 1,
    read_only: true,
    canonical_mutations_allowed: false,
    tracked_artifacts_written: false,
    authority_boundary: {
      idea_to_spec_workspace_is_authority: false,
      may_execute_prompt_agent: false,
      may_mutate_candidate_source_artifacts: false,
      may_mutate_canonical_specs: false,
      may_write_ontology_package: false,
      may_create_branch_or_commit: false,
      may_execute_git_service_operation: false,
      may_mark_candidate_accepted: false,
    },
    guided_approval_path: {
      available: true,
      stage: "promotion_request_needed",
      status: "waiting_for_operator",
      next_action: "Create the report-only graph repository promotion request.",
      target_section: "idea-to-spec-controlled-promotion",
      blockers: [],
      counts: {
        promotion_path_count: 1,
        remaining_blocker_count: 0,
        approved_path_count: 1,
        promotion_commit_path_count: 0,
        promotion_operation_count: 0,
      },
      state: {
        approval_readiness_status: "approval_decision_materialized",
        approval_intent_status: "usable",
        approval_execution_status: "candidate_approval_decision_materialized",
        candidate_approval_state: "approved",
        promotion_request_ok: false,
        promotion_execution_status: null,
        review_state: null,
        read_model_published: false,
      },
      checkpoints: [
        {
          id: "approval_decision",
          label: "Approval decision",
          status: "completed",
          target_section: "idea-to-spec-controlled-promotion",
          evidence_refs: ["runs/candidate_approval_decision.json"],
          detail: "approved",
        },
      ],
      evidence_refs: ["runs/candidate_approval_decision.json"],
      authority_boundary: {
        ...guidedFlowBoundary(),
        may_materialize_candidate_approval_decision: false,
        may_create_promotion_request: false,
        may_publish_read_model: false,
      },
    },
    repair_review: {
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_apply_answers: false,
        may_apply_decisions: false,
        may_mutate_candidate_artifacts: false,
        may_accept_ontology_terms: false,
        may_write_ontology_package: false,
        may_create_branch_or_commit: false,
      },
      platform_execution: {
        action_boundary: {
          inspect_only: true,
          acknowledge_only: true,
          may_execute_platform_adapter: false,
          may_run_specgraph_make_target: false,
          may_publish_bundle: false,
          may_create_branch_or_commit: false,
          may_open_pull_request: false,
          may_write_ontology_package: false,
          may_accept_ontology_terms: false,
          may_mutate_canonical_specs: false,
        },
      },
    },
    controlled_promotion: {
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_execute_git_service: false,
        may_create_branch_or_commit: false,
        may_merge_review: false,
        may_mutate_specs: false,
      },
    },
  };
}

describe("parseIdeaToSpecWorkspace guided approval path", () => {
  it("parses the approval path lifecycle surface", () => {
    const parsed = parseIdeaToSpecWorkspace(minimalWorkspacePayload());

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.guidedApprovalPath.stage).toBe("promotion_request_needed");
    expect(parsed.data.guidedApprovalPath.counts.approvedPathCount).toBe(1);
    expect(parsed.data.guidedApprovalPath.state.candidateApprovalState).toBe(
      "approved",
    );
    expect(parsed.data.guidedApprovalPath.checkpoints).toHaveLength(1);
  });

  it("rejects approval path authority expansion", () => {
    const payload = minimalWorkspacePayload();
    payload.guided_approval_path.authority_boundary.may_create_promotion_request =
      true;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toBe("guided approval path boundary expanded");
  });

  it("rejects unlisted truthy approval path authority flags", () => {
    const payload = minimalWorkspacePayload();
    const boundary = payload.guided_approval_path.authority_boundary as Record<
      string,
      unknown
    >;
    boundary.may_execute_prompt_agent = true;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toBe("guided approval path boundary expanded");
  });
});
