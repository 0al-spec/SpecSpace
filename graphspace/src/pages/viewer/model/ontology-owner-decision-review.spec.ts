import { describe, expect, it } from "vitest";
import { parseOntologyOwnerDecisionReview } from "./use-ontology-owner-decision-review";

const review = {
  artifact_kind: "ontology_decision_import_preview",
  schema_version: 1,
  proposal_id: "0115",
  policy_basis: ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
  source_policy: "tools/ontology_semantic_control_policy.json",
  source_artifacts: {
    ontology_review_dashboard: "runs/ontology_review_dashboard.json",
    ontology_owner_decision_report: "runs/ontology_owner_decision_report.json",
    ontology_closed_loop_evidence: "runs/ontology_closed_loop_evidence.json",
  },
  target: {
    target_kind: "proposal",
    target_ref: "SG-RFC-0115",
  },
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  decision_import_previews: [
    {
      preview_id: "ontology-decision-import-preview-accept-casfunction",
      decision_id: "ontology-owner-decision-accept-casfunction",
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      intake_id: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      decision_state: "accepted",
      ontology_decision_ref:
        "ontology-decision://edu.university.examcalc/0.1.0/casfunction/accepted",
      decided_by: "ontology-owner",
      decided_at: "2026-06-13T00:00:00Z",
      reason: "accepted domain term",
      accepted_ontology_delta: true,
      matched_closed_loop_evidence_id:
        "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
      matched_source_intake_state: "awaiting_ontology_owner_review",
      matched_evidence_state: "pending_ontology_owner_decision",
      preview_state: "ready_for_operator_review",
      required_human_action: "operator_review_ontology_owner_decision",
      import_recommended: true,
      imports_into_specgraph: false,
      closes_semantic_gate: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      updates_ontology_lockfile: false,
    },
    {
      preview_id: "ontology-decision-import-preview-reject-legacyterm",
      decision_id: "ontology-owner-decision-reject-legacyterm",
      candidate_id: "ontology-delta-candidate-examcalc-legacyterm",
      intake_id: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-legacyterm",
      decision_state: "rejected",
      ontology_decision_ref:
        "ontology-decision://edu.university.examcalc/0.1.0/legacyterm/rejected",
      decided_by: "ontology-owner",
      decided_at: "2026-06-13T00:00:00Z",
      reason: "ambiguous legacy term",
      accepted_ontology_delta: false,
      matched_closed_loop_evidence_id:
        "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-legacyterm",
      matched_source_intake_state: "awaiting_ontology_owner_review",
      matched_evidence_state: "pending_ontology_owner_decision",
      preview_state: "rejected_by_owner",
      required_human_action: "record_owner_rejection_without_import",
      import_recommended: false,
      imports_into_specgraph: false,
      closes_semantic_gate: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      updates_ontology_lockfile: false,
    },
  ],
  ignored_owner_decisions: [
    {
      decision_id: "ontology-owner-decision-stale-example",
      candidate_id: "ontology-delta-candidate-stale-example",
      intake_id: "ontology-delta-draft-intake-stale-example",
      decision_state: "accepted",
      reason: "missing_closed_loop_evidence",
    },
  ],
  consumer_boundary: {
    for_specgraph_decision_import_preview: true,
    for_specspace_review_dashboard: true,
    may_execute_prompt_agent: false,
    may_write_ontology_package: false,
    may_update_ontology_lockfile: false,
    may_mutate_canonical_specs: false,
    may_mark_candidate_accepted: false,
    may_apply_preview: false,
    may_import_into_specgraph: false,
    may_close_semantic_gate: false,
  },
  authority_boundary: {
    ontology_decision_import_preview_is_authority: false,
    prompt_agent_execution_allowed: false,
    automatic_import_lock_update: false,
    automatic_canonical_node_update: false,
    canonical_mutations_allowed: false,
  },
  summary: {
    status: "ready_for_operator_review",
    preview_count: 2,
    accepted_count: 1,
    rejected_count: 1,
    clarification_count: 0,
    importable_count: 1,
    blocked_count: 0,
    unmatched_count: 0,
    ignored_decision_count: 1,
    next_gap: "build_specspace_owner_decision_review_surface",
  },
  output_artifact: "runs/ontology_decision_import_preview.json",
};

describe("parseOntologyOwnerDecisionReview", () => {
  it("parses accepted and rejected owner decisions as read-only review material", () => {
    const result = parseOntologyOwnerDecisionReview(review);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.summary.acceptedCount).toBe(1);
    expect(result.data.summary.rejectedCount).toBe(1);
    expect(result.data.decisionImportPreviews[0]?.matchedClosedLoopEvidenceId).toContain(
      "casfunction",
    );
    expect(result.data.decisionImportPreviews[1]?.previewState).toBe("rejected_by_owner");
    expect(result.data.ignoredOwnerDecisions[0]?.reason).toBe("missing_closed_loop_evidence");
    expect(result.data.consumerBoundary.mayApplyPreview).toBe(false);
  });

  it("rejects apply authority from the consumer boundary", () => {
    const expanded = {
      ...review,
      consumer_boundary: {
        ...review.consumer_boundary,
        may_apply_preview: true,
      },
    };

    const result = parseOntologyOwnerDecisionReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("may_apply_preview");
  });

  it("rejects ready decisions without a closed-loop evidence link", () => {
    const expanded = structuredClone(review);
    expanded.decision_import_previews[0].matched_closed_loop_evidence_id = "";

    const result = parseOntologyOwnerDecisionReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("closed-loop evidence");
  });

  it("rejects stale preview summary counts", () => {
    const expanded = {
      ...review,
      summary: {
        ...review.summary,
        preview_count: 3,
      },
    };

    const result = parseOntologyOwnerDecisionReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("preview_count");
  });

  it("rejects preview rows that request SpecGraph import", () => {
    const expanded = structuredClone(review);
    expanded.decision_import_previews[0].imports_into_specgraph = true;

    const result = parseOntologyOwnerDecisionReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("imports_into_specgraph");
  });
});
