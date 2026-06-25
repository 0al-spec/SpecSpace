import { describe, expect, it } from "vitest";
import { parseIdeaToSpecRepairDraftState } from "./use-idea-to-spec-repair-drafts";

const repairDraftState = {
  artifact_kind: "specspace_idea_to_spec_repair_draft_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/idea_to_spec_repair_drafts.json",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    idea_to_spec_repair_session: "runs/idea_to_spec_repair_session.json",
  },
  drafts: [
    {
      draft_id:
        "specspace-repair-draft::team-decision-log::clarification.candidate-gap.decision-record",
      workspace_id: "team-decision-log",
      candidate_id: "team-decision-log",
      repair_session_id: "repair-session.team-decision-log",
      repair_session_ref: "runs/idea_to_spec_repair_session.json",
      request_id: "clarification.candidate-gap.decision-record",
      request_kind: "ontology_gap",
      request_status: "open",
      target_ref: "ontology-gap.decision-record",
      target_artifact: "candidate_spec_graph_seed",
      allowed_action: "propose_project_local_term",
      answer_value: {
        terms: ["Decision Record"],
        term_scope: "project_local",
      },
      operator_ref: "operator://specspace-local",
      created_at: "2026-06-25T10:00:00Z",
      updated_at: "2026-06-25T10:00:00Z",
      source_artifact: "runs/idea_to_spec_repair_session.json",
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      applies_to_specgraph: false,
      applies_to_candidate_artifacts: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      accepts_ontology_terms: false,
      creates_branch_or_commit: false,
      opens_pull_request: false,
    },
  ],
  summary: {
    status: "repair_drafts_recorded",
    draft_count: 1,
    workspace_count: 1,
    action_counts: {
      propose_project_local_term: 1,
    },
    next_gap: "export_repair_drafts_for_specgraph_validation",
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_product_repair_workflow: true,
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
  },
  authority_boundary: {
    repair_draft_state_is_authority: false,
    specgraph_artifact_authority: false,
    ontology_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseIdeaToSpecRepairDraftState", () => {
  it("parses SpecSpace-owned idea-to-spec repair draft state", () => {
    const parsed = parseIdeaToSpecRepairDraftState(repairDraftState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.draftCount).toBe(1);
    expect(parsed.data.selectedWorkspaceId).toBe("team-decision-log");
    expect(parsed.data.drafts[0]?.requestId).toBe(
      "clarification.candidate-gap.decision-record",
    );
    expect(parsed.data.drafts[0]?.answerValue).toEqual({
      terms: ["Decision Record"],
      term_scope: "project_local",
    });
    expect(parsed.data.consumerBoundary.specspaceOwnedState).toBe(true);
    expect(parsed.data.consumerBoundary.mayApplyToSpecgraph).toBe(false);
    expect(parsed.data.authorityBoundary.repairDraftStateIsAuthority).toBe(
      false,
    );
    expect(parsed.data.canonicalMutationsAllowed).toBe(false);
    expect(parsed.data.trackedArtifactsWritten).toBe(false);
  });

  it("rejects repair draft state that claims canonical mutation authority", () => {
    const expanded = {
      ...repairDraftState,
      canonical_mutations_allowed: true,
    };

    const parsed = parseIdeaToSpecRepairDraftState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("canonical_mutations_allowed");
  });

  it("rejects repair draft rows that claim SpecGraph application effects", () => {
    const expanded = structuredClone(repairDraftState);
    expanded.drafts[0].applies_to_specgraph = true;

    const parsed = parseIdeaToSpecRepairDraftState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("applies_to_specgraph");
  });
});
