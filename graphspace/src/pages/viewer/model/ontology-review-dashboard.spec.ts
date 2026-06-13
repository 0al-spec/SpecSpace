import { describe, expect, it } from "vitest";
import { parseOntologyReviewDashboard } from "./use-ontology-review-dashboard";

const dashboard = {
  artifact_kind: "ontology_review_dashboard",
  schema_version: 1,
  proposal_id: "0113",
  policy_basis: ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
  source_policy: "tools/ontology_semantic_control_policy.json",
  source_artifacts: {
    semantic_review_surface: "runs/ontology_semantic_review_surface.json",
    supervisor_semantic_gate: "runs/ontology_supervisor_semantic_gate.json",
    ontology_delta_draft_intake: "runs/ontology_delta_draft_intake.json",
    ontology_closed_loop_evidence: "runs/ontology_closed_loop_evidence.json",
  },
  target: {
    target_kind: "proposal",
    target_ref: "SG-RFC-0113",
  },
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  dashboard_sections: ["status_summary", "gate"],
  status_summary: {
    status: "blocked_by_semantic_gate",
    gate_state: "blocked",
    review_surface_status: "blocked_relation_conflict",
    intake_status: "blocked_by_semantic_gate",
    closed_loop_status: "blocked_by_semantic_gate",
    blocking_count: 1,
    review_required_count: 1,
    candidate_count: 1,
    draft_request_count: 1,
    evidence_entry_count: 1,
    pending_decision_count: 0,
    blocked_entry_count: 1,
    required_human_action: "resolve_blocking_ontology_semantic_findings",
    next_gap: "build_specspace_rich_ontology_review_panel",
  },
  gate: {
    gate_state: "blocked",
  },
  blocking_items: [
    {
      item_id: "semantic-finding-allows-policy",
      item_kind: "semantic_finding",
      review_state: "blocked",
      source: "ontology_semantic_lint_report.blocking_findings",
      term: "allows policy",
      classification: "relation_conflict",
      suggested_action: "use_accepted_relation",
    },
  ],
  review_required_items: [
    {
      item_id: "ontology-delta-candidate-examcalc-casfunction",
      item_kind: "ontology_delta_candidate",
      review_state: "needs_ontology_owner_review",
      source: "ontology_delta_candidate_review_packet.candidates",
      term: "examcalc:CASFunction",
      suggested_actions: [
        "approve_for_ontology_package_draft",
        "reject_candidate",
      ],
    },
  ],
  delta_candidates: [
    {
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
    },
  ],
  draft_requests: [
    {
      intake_id: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
      review_state: "needs_ontology_owner_review",
      intake_state: "blocked_by_semantic_gate",
      required_human_action: "resolve_blocking_ontology_semantic_findings",
      blocked_by_gate_state: "blocked",
      writes_ontology_package: false,
      updates_ontology_lockfile: false,
      mutates_canonical_specs: false,
      marks_candidate_accepted: false,
    },
  ],
  closed_loop_entries: [
    {
      evidence_id: "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      intake_id: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
      source_intake_state: "blocked_by_semantic_gate",
      evidence_state: "blocked_by_semantic_gate",
      specgraph_review_state: "blocked",
      required_human_action: "resolve_blocking_ontology_semantic_findings",
      ontology_decision_ref: "",
      accepted_ontology_delta: false,
      closes_semantic_gate: false,
      mutates_canonical_specs: false,
    },
  ],
  review_actions: [
    {
      action: "approve_for_ontology_package_draft",
      source: "ontology_delta_candidate_review_packet.review_actions",
      candidate_count: 1,
      writes_ontology_package: false,
      mutates_canonical_specs: false,
    },
  ],
  consumer_boundary: {
    for_specgraph_review_dashboard: true,
    for_specspace_review_dashboard: true,
    may_execute_prompt_agent: false,
    may_write_ontology_package: false,
    may_update_ontology_lockfile: false,
    may_mutate_canonical_specs: false,
    may_mark_candidate_accepted: false,
    may_import_owner_decision: false,
    may_close_semantic_gate: false,
  },
  authority_boundary: {
    ontology_review_dashboard_is_authority: false,
  },
  output_artifact: "runs/ontology_review_dashboard.json",
};

describe("parseOntologyReviewDashboard", () => {
  it("parses a read-only 0113 dashboard artifact", () => {
    const result = parseOntologyReviewDashboard(dashboard);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.statusSummary.status).toBe("blocked_by_semantic_gate");
    expect(result.data.statusSummary.pendingDecisionCount).toBe(0);
    expect(result.data.blockingItems[0]?.itemId).toBe("semantic-finding-allows-policy");
    expect(result.data.draftRequests[0]?.intakeState).toBe("blocked_by_semantic_gate");
    expect(result.data.closedLoopEntries[0]?.acceptedOntologyDelta).toBe(false);
    expect(result.data.consumerBoundary.mayImportOwnerDecision).toBe(false);
  });

  it("rejects owner-decision import authority", () => {
    const expanded = {
      ...dashboard,
      consumer_boundary: {
        ...dashboard.consumer_boundary,
        may_import_owner_decision: true,
      },
    };

    const result = parseOntologyReviewDashboard(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("may_import_owner_decision");
  });
});
