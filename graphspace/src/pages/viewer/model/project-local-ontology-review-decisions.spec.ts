import { describe, expect, it } from "vitest";
import { parseProjectLocalOntologyReviewDecisionState } from "./use-project-local-ontology-review-decisions";

const decisionState = {
  artifact_kind: "specspace_project_local_ontology_review_decision_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/project_local_ontology_review_decisions.json",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    project_local_ontology_review_lane: "runs/project_local_ontology_review_lane.json",
  },
  decisions: [
    {
      decision_id:
        "specspace-project-local-ontology-decision::team-decision-log::decisionrecord",
      workspace_id: "team-decision-log",
      candidate_id: "team-decision-log",
      repair_session_id: "repair-session.team-decision-log",
      project_local_ontology_review_lane_ref:
        "runs/project_local_ontology_review_lane.json",
      term_id: "project-local-ontology-term.decision-record",
      term: "Decision Record",
      term_key: "decisionrecord",
      current_status: "unreviewed",
      review_action: "keep_project_local",
      decision_value: {
        term: "Decision Record",
        term_scope: "project_local",
        reason: "Product-specific wording.",
      },
      operator_ref: "operator://specspace-local",
      created_at: "2026-07-02T06:00:00Z",
      updated_at: "2026-07-02T06:00:00Z",
      source_artifact: "runs/project_local_ontology_review_lane.json",
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      applies_to_specgraph: false,
      applies_to_candidate_artifacts: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      updates_ontology_lockfile: false,
      accepts_ontology_terms: false,
      creates_branch_or_commit: false,
      opens_pull_request: false,
    },
  ],
  summary: {
    status: "project_local_ontology_review_decisions_recorded",
    decision_count: 1,
    workspace_count: 1,
    action_counts: {
      keep_project_local: 1,
    },
    next_gap:
      "export_project_local_ontology_review_decisions_for_specgraph_validation",
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_project_local_ontology_review: true,
    may_execute_prompt_agent: false,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_apply_to_specgraph: false,
    may_apply_decisions: false,
    may_mutate_candidate_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_write_ontology_lockfile: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
  },
  authority_boundary: {
    project_local_ontology_review_decision_state_is_authority: false,
    specgraph_artifact_authority: false,
    ontology_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseProjectLocalOntologyReviewDecisionState", () => {
  it("parses SpecSpace-owned project-local ontology review decisions", () => {
    const parsed = parseProjectLocalOntologyReviewDecisionState(decisionState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.decisionCount).toBe(1);
    expect(parsed.data.decisions[0]?.termKey).toBe("decisionrecord");
    expect(parsed.data.decisions[0]?.reviewAction).toBe("keep_project_local");
    expect(parsed.data.decisions[0]?.writesOntologyPackage).toBe(false);
    expect(parsed.data.authorityBoundary.ontologyAuthority).toBe(false);
    expect(parsed.data.consumerBoundary.mayAcceptOntologyTerms).toBe(false);
  });

  it("rejects state that claims ontology authority", () => {
    const expanded = structuredClone(decisionState);
    expanded.authority_boundary.ontology_authority = true;

    const parsed = parseProjectLocalOntologyReviewDecisionState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("ontology_authority");
  });

  it("rejects decision rows that claim ontology writes", () => {
    const expanded = structuredClone(decisionState);
    expanded.decisions[0].writes_ontology_package = true;

    const parsed = parseProjectLocalOntologyReviewDecisionState(expanded);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.message).toContain("writes_ontology_package");
  });
});
