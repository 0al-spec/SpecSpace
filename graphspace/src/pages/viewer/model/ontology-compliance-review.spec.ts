import { describe, expect, it } from "vitest";
import { parseOntologyComplianceReview } from "./use-ontology-compliance-review";

const report = {
  artifact_kind: "spec_ontology_validation_report",
  schema_version: 1,
  proposal_id: "0135",
  status: "report_only",
  review_state: "ready_for_review",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  ontology_ir_ref: "ontology/packages/specgraph-core/generated/ontology.normalized.json",
  source_binding_index_kind: "spec_ontology_binding_index",
  validation_modes: {
    legacy_specs: "report_only",
    generated_artifacts: "review_required",
    hard_gate_enabled: false,
  },
  summary: {
    spec_count: 1,
    finding_count: 1,
    warning_count: 1,
    passed_check_count: 2,
    next_gap: "review_spec_ontology_validation_findings",
  },
  entries: [
    {
      spec_id: "SG-SPEC-0001",
      path: "specs/nodes/SG-SPEC-0001.yaml",
      validation_status: "report_only_findings",
      checks: [
        {
          check_id: "required_binding.sgcore_spec",
          status: "passed",
          ontology_ref: "sgcore:Spec",
        },
        {
          check_id: "relation_contract.sgcore:hasAcceptanceCriterion",
          status: "passed",
          relation_ref: "sgcore:hasAcceptanceCriterion",
        },
      ],
      findings: [
        {
          finding_id: "SG-SPEC-0001.gap.intent",
          severity: "warning",
          classification: "unknown_legacy_term",
          term: "intent",
          gap_ref: "ontology-gap-sg-spec-0001-intent",
          suggested_action: "review_ontology_gap",
        },
      ],
    },
  ],
};

describe("parseOntologyComplianceReview", () => {
  it("parses a read-only 0135 validation report", () => {
    const result = parseOntologyComplianceReview(report);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.summary.specCount).toBe(1);
    expect(result.data.summary.findingCount).toBe(1);
    expect(result.data.entries[0]?.findings[0]?.classification).toBe("unknown_legacy_term");
    expect(result.data.validationModes.hardGateEnabled).toBe(false);
  });

  it("rejects hard gate authority", () => {
    const expanded = {
      ...report,
      validation_modes: {
        ...report.validation_modes,
        hard_gate_enabled: true,
      },
    };

    const result = parseOntologyComplianceReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("hard_gate_enabled");
  });

  it("rejects generated artifact authority expansion", () => {
    const expanded = {
      ...report,
      validation_modes: {
        ...report.validation_modes,
        generated_artifacts: "auto_apply",
      },
    };

    const result = parseOntologyComplianceReview(expanded);

    expect(result.kind).toBe("invariant-violation");
    if (result.kind !== "invariant-violation") return;
    expect(result.message).toContain("generated_artifacts");
  });
});
