import { describe, expect, it } from "vitest";
import { parseOntologyOwnerDecisionAcknowledgementState } from "./use-ontology-owner-decision-acknowledgements";

const acknowledgementState = {
  artifact_kind: "specspace_ontology_owner_decision_acknowledgement_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  state_path: "/tmp/specspace-state/ontology_owner_decision_acknowledgements.json",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  source_artifacts: {
    ontology_decision_import_preview: "runs/ontology_decision_import_preview.json",
  },
  acknowledgements: [
    {
      acknowledgement_id: "specspace-ack::ontology-decision-import-preview-accept-casfunction",
      preview_id: "ontology-decision-import-preview-accept-casfunction",
      decision_id: "ontology-owner-decision-accept-casfunction",
      candidate_id: "ontology-delta-candidate-examcalc-casfunction",
      intake_id: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      decision_state: "accepted",
      preview_state: "ready_for_operator_review",
      required_human_action: "operator_review_ontology_owner_decision",
      acknowledged_by: "operator",
      acknowledged_at: "2026-06-14T10:00:00Z",
      source_artifact: "runs/ontology_decision_import_preview.json",
      source_mtime_iso: "2026-06-14T09:59:00Z",
      canonical_mutations_allowed: false,
      imports_into_specgraph: false,
      closes_semantic_gate: false,
      mutates_canonical_specs: false,
      writes_ontology_package: false,
      updates_ontology_lockfile: false,
    },
  ],
  summary: {
    status: "acknowledgements_recorded",
    acknowledgement_count: 1,
    next_gap: "operator_review_acknowledgements_available",
  },
  consumer_boundary: {
    specspace_owned_state: true,
    for_operator_review_workflow: true,
    may_execute_prompt_agent: false,
    may_write_ontology_package: false,
    may_update_ontology_lockfile: false,
    may_mutate_canonical_specs: false,
    may_apply_preview: false,
    may_import_into_specgraph: false,
    may_close_semantic_gate: false,
  },
  authority_boundary: {
    acknowledgement_state_is_authority: false,
    ontology_package_authority: false,
    specgraph_import_authority: false,
    semantic_gate_authority: false,
    canonical_mutations_allowed: false,
  },
};

describe("parseOntologyOwnerDecisionAcknowledgementState", () => {
  it("parses SpecSpace-owned owner decision acknowledgement state", () => {
    const result = parseOntologyOwnerDecisionAcknowledgementState(acknowledgementState);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.summary.acknowledgementCount).toBe(1);
    expect(result.data.acknowledgements[0]?.previewId).toBe(
      "ontology-decision-import-preview-accept-casfunction",
    );
    expect(result.data.consumerBoundary.specspaceOwnedState).toBe(true);
    expect(result.data.consumerBoundary.mayImportIntoSpecgraph).toBe(false);
    expect(result.data.authorityBoundary.acknowledgementStateIsAuthority).toBe(false);
    expect(result.data.canonicalMutationsAllowed).toBe(false);
    expect(result.data.trackedArtifactsWritten).toBe(false);
  });

  it("rejects acknowledgement state that claims canonical mutation authority", () => {
    const expanded = {
      ...acknowledgementState,
      canonical_mutations_allowed: true,
    };

    const result = parseOntologyOwnerDecisionAcknowledgementState(expanded);

    expect(result.kind).toBe("parse-error");
    if (result.kind !== "parse-error") return;
    expect(result.message).toContain("cannot claim mutations");
  });

  it("rejects acknowledgement rows that claim SpecGraph import effects", () => {
    const expanded = structuredClone(acknowledgementState);
    expanded.acknowledgements[0].imports_into_specgraph = true;

    const result = parseOntologyOwnerDecisionAcknowledgementState(expanded);

    expect(result.kind).toBe("parse-error");
    if (result.kind !== "parse-error") return;
    expect(result.message).toContain("imports_into_specgraph");
  });
});
