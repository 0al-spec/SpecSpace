import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  OntologyOwnerDecisionReview,
  UseOntologyOwnerDecisionReviewState,
} from "../model/use-ontology-owner-decision-review";
import { OntologyOwnerDecisionReviewPanel } from "./OntologyOwnerDecisionReviewPanel";

const review: OntologyOwnerDecisionReview = {
  artifactKind: "ontology_decision_import_preview",
  schemaVersion: 1,
  proposalId: "0115",
  policyBasis: ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
  sourcePolicy: "tools/ontology_semantic_control_policy.json",
  sourceArtifacts: {
    ontology_review_dashboard: "runs/ontology_review_dashboard.json",
    ontology_owner_decision_report: "runs/ontology_owner_decision_report.json",
    ontology_closed_loop_evidence: "runs/ontology_closed_loop_evidence.json",
  },
  target: {
    targetKind: "proposal",
    targetRef: "SG-RFC-0115",
  },
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  decisionImportPreviews: [
    {
      previewId: "ontology-decision-import-preview-accept-casfunction",
      decisionId: "ontology-owner-decision-accept-casfunction",
      candidateId: "ontology-delta-candidate-examcalc-casfunction",
      intakeId: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      decisionState: "accepted",
      ontologyDecisionRef:
        "ontology-decision://edu.university.examcalc/0.1.0/casfunction/accepted",
      decidedBy: "ontology-owner",
      decidedAt: "2026-06-13T00:00:00Z",
      reason: "accepted domain term",
      acceptedOntologyDelta: true,
      matchedClosedLoopEvidenceId:
        "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
      matchedSourceIntakeState: "awaiting_ontology_owner_review",
      matchedEvidenceState: "pending_ontology_owner_decision",
      previewState: "ready_for_operator_review",
      requiredHumanAction: "operator_review_ontology_owner_decision",
      importRecommended: true,
      importsIntoSpecgraph: false,
      closesSemanticGate: false,
      mutatesCanonicalSpecs: false,
      writesOntologyPackage: false,
      updatesOntologyLockfile: false,
    },
    {
      previewId: "ontology-decision-import-preview-reject-legacyterm",
      decisionId: "ontology-owner-decision-reject-legacyterm",
      candidateId: "ontology-delta-candidate-examcalc-legacyterm",
      intakeId: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-legacyterm",
      decisionState: "rejected",
      ontologyDecisionRef:
        "ontology-decision://edu.university.examcalc/0.1.0/legacyterm/rejected",
      decidedBy: "ontology-owner",
      decidedAt: "2026-06-13T00:00:00Z",
      reason: "ambiguous legacy term",
      acceptedOntologyDelta: false,
      matchedClosedLoopEvidenceId:
        "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-legacyterm",
      matchedSourceIntakeState: "awaiting_ontology_owner_review",
      matchedEvidenceState: "pending_ontology_owner_decision",
      previewState: "rejected_by_owner",
      requiredHumanAction: "record_owner_rejection_without_import",
      importRecommended: false,
      importsIntoSpecgraph: false,
      closesSemanticGate: false,
      mutatesCanonicalSpecs: false,
      writesOntologyPackage: false,
      updatesOntologyLockfile: false,
    },
  ],
  ignoredOwnerDecisions: [
    {
      decisionId: "ontology-owner-decision-stale-example",
      candidateId: "ontology-delta-candidate-stale-example",
      intakeId: "ontology-delta-draft-intake-stale-example",
      decisionState: "accepted",
      reason: "missing_closed_loop_evidence",
      sourceEvidenceState: null,
      sourceIntakeState: null,
    },
  ],
  consumerBoundary: {
    forSpecgraphDecisionImportPreview: true,
    forSpecspaceReviewDashboard: true,
    mayExecutePromptAgent: false,
    mayWriteOntologyPackage: false,
    mayUpdateOntologyLockfile: false,
    mayMutateCanonicalSpecs: false,
    mayMarkCandidateAccepted: false,
    mayApplyPreview: false,
    mayImportIntoSpecgraph: false,
    mayCloseSemanticGate: false,
  },
  authorityBoundary: {
    ontologyDecisionImportPreviewIsAuthority: false,
    promptAgentExecutionAllowed: false,
    automaticImportLockUpdate: false,
    automaticCanonicalNodeUpdate: false,
    canonicalMutationsAllowed: false,
  },
  summary: {
    status: "ready_for_operator_review",
    previewCount: 2,
    acceptedCount: 1,
    rejectedCount: 1,
    clarificationCount: 0,
    importableCount: 1,
    blockedCount: 0,
    unmatchedCount: 0,
    ignoredDecisionCount: 1,
    nextGap: "build_specspace_owner_decision_review_surface",
  },
  outputArtifact: "runs/ontology_decision_import_preview.json",
};

const state: UseOntologyOwnerDecisionReviewState = {
  kind: "ok",
  data: review,
  meta: {
    path: "/tmp/runs/ontology_decision_import_preview.json",
    mtime: 1,
    mtime_iso: "2026-06-13T00:00:00+00:00",
  },
};

describe("OntologyOwnerDecisionReviewPanel", () => {
  it("renders owner decisions, evidence links, affected items, and acknowledge action", () => {
    const html = renderToStaticMarkup(
      createElement(OntologyOwnerDecisionReviewPanel, { state }),
    );

    expect(html).toContain("ready_for_operator_review");
    expect(html).toContain("ontology-owner-decision-accept-casfunction");
    expect(html).toContain("ontology-owner-decision-reject-legacyterm");
    expect(html).toContain(
      "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
    );
    expect(html).toContain("ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction");
    expect(html).toContain("pending_ontology_owner_decision");
    expect(html).toContain("operator_review_pending");
    expect(html).toContain("owner_rejected_no_import");
    expect(html).toContain("missing_closed_loop_evidence");
    expect(html).toContain("Acknowledge");
    expect(html).not.toContain("Apply preview</button>");
  });
});
