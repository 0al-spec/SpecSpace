import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  OntologySemanticReviewSurface,
  UseOntologySemanticReviewSurfaceState,
} from "../model/use-ontology-semantic-review-surface";
import { OntologySemanticReviewPanel } from "./OntologySemanticReviewPanel";

const surface: OntologySemanticReviewSurface = {
  artifactKind: "ontology_semantic_review_surface",
  schemaVersion: 1,
  proposalId: "0108",
  policyBasis: ["docs/proposals/0103_semantic_control.md"],
  sourcePolicy: "tools/ontology_semantic_control_policy.json",
  sourceArtifacts: {
    semantic_context_pack: "runs/ontology_semantic_context_pack.json",
    semantic_lint_report: "runs/ontology_semantic_lint_report.json",
  },
  target: {
    targetKind: "proposal",
    targetRef: "SG-RFC-0108",
  },
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  groundingSummary: {
    source_context_status: "ready_with_gaps",
  },
  displaySections: ["grounding_summary", "blocking_findings"],
  blockingFindings: [],
  reviewRequiredFindings: [],
  deltaCandidates: [],
  reviewItems: [
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
    forSupervisorGateEvidence: true,
    forSpecspaceReviewSurface: true,
    mayExecutePromptAgent: false,
    mayWriteOntologyPackage: false,
    mayUpdateOntologyLockfile: false,
    mayMutateCanonicalSpecs: false,
    mayMarkCandidateAccepted: false,
  },
  authorityBoundary: {
    semanticReviewSurfaceIsAuthority: false,
  },
  summary: {
    status: "blocked_relation_conflict",
    blockingCount: 1,
    reviewRequiredCount: 1,
    candidateCount: 1,
    reviewItemCount: 2,
    nextGap: "build_specspace_semantic_review_surface_consumer",
  },
  outputArtifact: "runs/ontology_semantic_review_surface.json",
};

const state: UseOntologySemanticReviewSurfaceState = {
  kind: "ok",
  data: surface,
  meta: {
    path: "/tmp/runs/ontology_semantic_review_surface.json",
    mtime: 1,
    mtime_iso: "2026-06-13T00:00:00+00:00",
  },
};

describe("OntologySemanticReviewPanel", () => {
  it("renders review items and declared actions without mutation controls", () => {
    const html = renderToStaticMarkup(createElement(OntologySemanticReviewPanel, { state }));

    expect(html).toContain("allows policy");
    expect(html).toContain("examcalc:CASFunction");
    expect(html).toContain("approve_for_ontology_package_draft");
    expect(html).toContain("Prompt agent");
    expect(html).not.toContain("<button");
  });
});
