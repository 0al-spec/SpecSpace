import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  OntologyComplianceReview,
  UseOntologyComplianceReviewState,
} from "../model/use-ontology-compliance-review";
import { OntologyComplianceReviewPanel } from "./OntologyComplianceReviewPanel";

const report: OntologyComplianceReview = {
  artifactKind: "spec_ontology_validation_report",
  schemaVersion: 1,
  proposalId: "0135",
  status: "report_only",
  reviewState: "ready_for_review",
  canonicalMutationsAllowed: false,
  trackedArtifactsWritten: false,
  ontologyIrRef: "ontology/packages/specgraph-core/generated/ontology.normalized.json",
  sourceBindingIndexKind: "spec_ontology_binding_index",
  validationModes: {
    legacySpecs: "report_only",
    generatedArtifacts: "review_required",
    hardGateEnabled: false,
  },
  summary: {
    specCount: 1,
    findingCount: 1,
    warningCount: 1,
    passedCheckCount: 2,
    nextGap: "review_spec_ontology_validation_findings",
  },
  entries: [
    {
      specId: "SG-SPEC-0001",
      path: "specs/nodes/SG-SPEC-0001.yaml",
      validationStatus: "report_only_findings",
      checks: [
        {
          checkId: "required_binding.sgcore_spec",
          status: "passed",
          ontologyRef: "sgcore:Spec",
          relationRef: null,
        },
        {
          checkId: "relation_contract.sgcore:hasAcceptanceCriterion",
          status: "passed",
          ontologyRef: null,
          relationRef: "sgcore:hasAcceptanceCriterion",
        },
      ],
      findings: [
        {
          findingId: "SG-SPEC-0001.gap.intent",
          severity: "warning",
          classification: "unknown_legacy_term",
          term: "intent",
          gapRef: "ontology-gap-sg-spec-0001-intent",
          suggestedAction: "review_ontology_gap",
        },
      ],
    },
  ],
};

const state: UseOntologyComplianceReviewState = {
  kind: "ok",
  data: report,
  meta: {
    path: "/tmp/runs/spec_ontology_validation_report.json",
    mtime: 1,
    mtime_iso: "2026-06-20T00:00:00+00:00",
  },
};

describe("OntologyComplianceReviewPanel", () => {
  it("renders ontology compliance findings as a read-only review surface", () => {
    const html = renderToStaticMarkup(
      createElement(OntologyComplianceReviewPanel, { state }),
    );

    expect(html).toContain("SG-RFC-0135");
    expect(html).toContain("SG-SPEC-0001");
    expect(html).toContain("unknown_legacy_term");
    expect(html).toContain("Hard gate");
    expect(html).toContain("false");
    expect(html).toContain("review_required");
    expect(html).not.toContain("<button");
  });
});
