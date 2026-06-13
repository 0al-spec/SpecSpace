import { describe, expect, it } from "vitest";
import { parseOntologySemanticReviewSurface } from "./use-ontology-semantic-review-surface";

const payload = {
  artifact_kind: "ontology_semantic_review_surface",
  schema_version: 1,
  proposal_id: "0108",
  policy_basis: ["docs/proposals/0103_semantic_control.md"],
  source_policy: "tools/ontology_semantic_control_policy.json",
  source_artifacts: {
    semantic_context_pack: "runs/ontology_semantic_context_pack.json",
    semantic_lint_report: "runs/ontology_semantic_lint_report.json",
    ontology_delta_candidate_review_packet:
      "runs/ontology_delta_candidate_review_packet.json",
  },
  target: {
    target_kind: "proposal",
    target_ref: "SG-RFC-0108",
  },
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  grounding_summary: {
    source_context_status: "ready_with_gaps",
    source_lint_status: "blocked_relation_conflict",
    source_delta_candidate_status: "review_required",
    package_count: 1,
    accepted_term_count: 1,
  },
  display_sections: ["grounding_summary", "blocking_findings", "review_actions"],
  blocking_findings: [
    {
      term: "allows policy",
      classification: "relation_conflict",
      suggested_action: "use_accepted_relation",
    },
  ],
  review_required_findings: [],
  delta_candidates: [
    {
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
      review_state: "needs_ontology_owner_review",
    },
  ],
  review_items: [
    {
      item_id: "semantic-finding-allows-policy",
      item_kind: "semantic_finding",
      review_state: "blocked",
      source: "ontology_semantic_lint_report.blocking_findings",
      term: "allows policy",
      classification: "relation_conflict",
      suggested_action: "use_accepted_relation",
    },
    {
      item_id: "ontology-delta-candidate-examcalc-casfunction",
      item_kind: "ontology_delta_candidate",
      review_state: "needs_ontology_owner_review",
      source: "ontology_delta_candidate_review_packet.candidates",
      term: "examcalc:CASFunction",
      suggested_actions: [
        "approve_for_ontology_package_draft",
        "reject_candidate",
        "request_clarification",
      ],
    },
  ],
  review_actions: [
    {
      action: "use_accepted_relation",
      source: "ontology_semantic_lint_report.recommended_actions",
      term_count: 1,
      terms: ["allows policy"],
      writes_ontology_package: false,
      mutates_canonical_specs: false,
    },
  ],
  consumer_boundary: {
    for_supervisor_gate_evidence: true,
    for_specspace_review_surface: true,
    may_execute_prompt_agent: false,
    may_write_ontology_package: false,
    may_update_ontology_lockfile: false,
    may_mutate_canonical_specs: false,
    may_mark_candidate_accepted: false,
  },
  authority_boundary: {
    semantic_review_surface_is_authority: false,
  },
  summary: {
    status: "blocked_relation_conflict",
    blocking_count: 1,
    review_required_count: 1,
    candidate_count: 1,
    review_item_count: 2,
    next_gap: "build_specspace_semantic_review_surface_consumer",
  },
  output_artifact: "runs/ontology_semantic_review_surface.json",
};

describe("parseOntologySemanticReviewSurface", () => {
  it("parses a read-only 0108 review surface", () => {
    const parsed = parseOntologySemanticReviewSurface(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.proposalId).toBe("0108");
    expect(parsed.data.summary.reviewItemCount).toBe(2);
    expect(parsed.data.consumerBoundary.forSpecspaceReviewSurface).toBe(true);
    expect(parsed.data.consumerBoundary.mayExecutePromptAgent).toBe(false);
    expect(parsed.data.authorityBoundary.semanticReviewSurfaceIsAuthority).toBe(false);
    expect(parsed.data.reviewItems[1].suggestedActions).toEqual([
      "approve_for_ontology_package_draft",
      "reject_candidate",
      "request_clarification",
    ]);
  });

  it("rejects canonical mutation expansion", () => {
    const parsed = parseOntologySemanticReviewSurface({
      ...payload,
      canonical_mutations_allowed: true,
    });

    expect(parsed).toMatchObject({
      kind: "invariant-violation",
      message: "canonical_mutations_allowed must be false",
    });
  });

  it("rejects consumer boundary expansion", () => {
    const parsed = parseOntologySemanticReviewSurface({
      ...payload,
      consumer_boundary: {
        ...payload.consumer_boundary,
        may_execute_prompt_agent: true,
      },
    });

    expect(parsed).toMatchObject({
      kind: "invariant-violation",
      message: "consumer_boundary.may_execute_prompt_agent must be false",
    });
  });
});
