import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  OntologyReviewDashboard,
  UseOntologyReviewDashboardState,
} from "../model/use-ontology-review-dashboard";
import { OntologyReviewDashboardPanel } from "./OntologyReviewDashboardPanel";

const dashboard: OntologyReviewDashboard = {
  artifactKind: "ontology_review_dashboard",
  schemaVersion: 1,
  proposalId: "0113",
  policyBasis: ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
  sourcePolicy: "tools/ontology_semantic_control_policy.json",
  sourceArtifacts: {
    semantic_review_surface: "runs/ontology_semantic_review_surface.json",
    supervisor_semantic_gate: "runs/ontology_supervisor_semantic_gate.json",
    ontology_delta_draft_intake: "runs/ontology_delta_draft_intake.json",
    ontology_closed_loop_evidence: "runs/ontology_closed_loop_evidence.json",
  },
  target: {
    targetKind: "proposal",
    targetRef: "SG-RFC-0113",
  },
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  dashboardSections: ["status_summary", "gate"],
  statusSummary: {
    status: "blocked_by_semantic_gate",
    gateState: "blocked",
    reviewSurfaceStatus: "blocked_relation_conflict",
    intakeStatus: "blocked_by_semantic_gate",
    closedLoopStatus: "blocked_by_semantic_gate",
    blockingCount: 1,
    reviewRequiredCount: 1,
    candidateCount: 1,
    draftRequestCount: 1,
    evidenceEntryCount: 1,
    pendingDecisionCount: 0,
    blockedEntryCount: 1,
    requiredHumanAction: "resolve_blocking_ontology_semantic_findings",
    nextGap: "build_specspace_rich_ontology_review_panel",
  },
  gate: {
    gate_state: "blocked",
  },
  blockingItems: [
    {
      itemId: "semantic-finding-allows-policy",
      itemKind: "semantic_finding",
      reviewState: "blocked",
      source: "ontology_semantic_lint_report.blocking_findings",
      term: "allows policy",
      classification: "relation_conflict",
      suggestedAction: "use_accepted_relation",
      suggestedActions: [],
      payload: {},
    },
  ],
  reviewRequiredItems: [
    {
      itemId: "ontology-delta-candidate-examcalc-casfunction",
      itemKind: "ontology_delta_candidate",
      reviewState: "needs_ontology_owner_review",
      source: "ontology_delta_candidate_review_packet.candidates",
      term: "examcalc:CASFunction",
      classification: null,
      suggestedAction: null,
      suggestedActions: ["approve_for_ontology_package_draft", "reject_candidate"],
      payload: {},
    },
  ],
  deltaCandidates: [{ candidate_id: "ontology-delta-candidate-examcalc-casfunction" }],
  draftRequests: [
    {
      intakeId: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      candidateId: "ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
      reviewState: "needs_ontology_owner_review",
      intakeState: "blocked_by_semantic_gate",
      requiredHumanAction: "resolve_blocking_ontology_semantic_findings",
      blockedByGateState: "blocked",
      writesOntologyPackage: false,
      updatesOntologyLockfile: false,
      mutatesCanonicalSpecs: false,
      marksCandidateAccepted: false,
    },
  ],
  closedLoopEntries: [
    {
      evidenceId: "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
      candidateId: "ontology-delta-candidate-examcalc-casfunction",
      intakeId: "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
      term: "examcalc:CASFunction",
      sourceIntakeState: "blocked_by_semantic_gate",
      evidenceState: "blocked_by_semantic_gate",
      specgraphReviewState: "blocked",
      requiredHumanAction: "resolve_blocking_ontology_semantic_findings",
      ontologyDecisionRef: null,
      acceptedOntologyDelta: false,
      closesSemanticGate: false,
      mutatesCanonicalSpecs: false,
    },
  ],
  reviewActions: [
    {
      action: "approve_for_ontology_package_draft",
      source: "ontology_delta_candidate_review_packet.review_actions",
      effect: "Allows Ontology owner to draft package changes outside SpecSpace.",
      termCount: null,
      candidateCount: 1,
      terms: [],
      writesOntologyPackage: false,
      mutatesCanonicalSpecs: false,
    },
  ],
  consumerBoundary: {
    forSpecgraphReviewDashboard: true,
    forSpecspaceReviewDashboard: true,
    mayExecutePromptAgent: false,
    mayWriteOntologyPackage: false,
    mayUpdateOntologyLockfile: false,
    mayMutateCanonicalSpecs: false,
    mayMarkCandidateAccepted: false,
    mayImportOwnerDecision: false,
    mayCloseSemanticGate: false,
  },
  authorityBoundary: {
    ontologyReviewDashboardIsAuthority: false,
  },
  outputArtifact: "runs/ontology_review_dashboard.json",
};

const state: UseOntologyReviewDashboardState = {
  kind: "ok",
  data: dashboard,
  meta: {
    path: "/tmp/runs/ontology_review_dashboard.json",
    mtime: 1,
    mtime_iso: "2026-06-13T00:00:00+00:00",
  },
};

describe("OntologyReviewDashboardPanel", () => {
  it("renders dashboard status, intake, evidence, and actions without mutation controls", () => {
    const html = renderToStaticMarkup(createElement(OntologyReviewDashboardPanel, { state }));

    expect(html).toContain("blocked_by_semantic_gate");
    expect(html).toContain("Draft intake");
    expect(html).toContain("Closed loop evidence");
    expect(html).toContain("pending");
    expect(html).toContain("approve_for_ontology_package_draft");
    expect(html).toContain("Owner import");
    expect(html).not.toContain("<button");
  });
});
