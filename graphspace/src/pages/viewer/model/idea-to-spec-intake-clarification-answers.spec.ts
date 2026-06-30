import { describe, expect, it } from "vitest";
import { parseIdeaToSpecIntakeClarificationAnswerState } from "./use-idea-to-spec-intake-clarification-answers";

const intakeAnswerState = {
  artifact_kind: "specspace_idea_intake_clarification_answer_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/idea_to_spec_intake_clarification_answers.json",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    intake_clarification_requests: "runs/idea_intake_clarification_requests.json",
  },
  answer_set: {
    artifact_kind: "idea_to_spec_clarification_answer_set",
    schema_version: 1,
    contract_ref: "specgraph.idea-to-spec.clarification-answer-set.v0.1",
    answers: [
      {
        request_id: "clarification.intake.question-active-frame-domain-refs",
        answer_kind: "answer_question",
        status: "accepted_for_candidate",
        authority: "operator_approved",
        value: { refs: ["domain.team_decision_log"] },
      },
    ],
  },
  answers: [
    {
      answer_id:
        "specspace-intake-answer::team-decision-log::clarification.intake.question-active-frame-domain-refs",
      workspace_id: "team-decision-log",
      candidate_id: "team-decision-log",
      request_id: "clarification.intake.question-active-frame-domain-refs",
      request_kind: "intake_context_gap",
      request_status: "open",
      target_ref: "active_frame.domain_refs",
      target_artifact: "user_idea_intake_session",
      answer_kind: "answer_question",
      status: "accepted_for_candidate",
      authority: "operator_approved",
      value: { refs: ["domain.team_decision_log"] },
      operator_ref: "operator://specspace-local",
      rationale: "",
      created_at: "2026-06-30T10:00:00Z",
      updated_at: "2026-06-30T10:00:00Z",
      source_artifact: "runs/idea_intake_clarification_requests.json",
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      applies_to_specgraph: false,
      applies_to_candidate_source: false,
      mutates_user_intent: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      accepts_ontology_terms: false,
      creates_branch_or_commit: false,
      opens_pull_request: false,
    },
  ],
  summary: {
    status: "intake_clarification_answers_recorded",
    answer_count: 1,
    accepted_answer_count: 1,
    workspace_count: 1,
    next_gap: "export_intake_clarification_answers_for_specgraph_rerun",
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_real_idea_intake_workflow: true,
    may_execute_specgraph: false,
    may_execute_prompt_agent: false,
    may_apply_to_specgraph: false,
    may_apply_answers: false,
    may_mutate_candidate_source_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_execute_git_service_operation: false,
  },
  authority_boundary: {
    intake_answer_state_is_authority: false,
    specgraph_artifact_authority: false,
    ontology_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseIdeaToSpecIntakeClarificationAnswerState", () => {
  it("parses SpecSpace-owned intake clarification answer state", () => {
    const parsed = parseIdeaToSpecIntakeClarificationAnswerState(intakeAnswerState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.answerCount).toBe(1);
    expect(parsed.data.answers[0]?.requestId).toBe(
      "clarification.intake.question-active-frame-domain-refs",
    );
    expect(parsed.data.answers[0]?.value).toEqual({
      refs: ["domain.team_decision_log"],
    });
    expect(parsed.data.consumerBoundary.mayApplyAnswers).toBe(false);
    expect(parsed.data.authorityBoundary.intakeAnswerStateIsAuthority).toBe(false);
  });

  it("rejects state with SpecGraph application authority", () => {
    const expanded = structuredClone(intakeAnswerState);
    expanded.consumer_boundary.may_apply_answers = true;

    const parsed = parseIdeaToSpecIntakeClarificationAnswerState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("may_apply_answers");
  });
});
