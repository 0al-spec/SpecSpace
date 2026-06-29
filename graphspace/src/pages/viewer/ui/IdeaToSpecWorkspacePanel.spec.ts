import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ideaToSpecWorkspace } from "../model/idea-to-spec-workspace.fixture";
import {
  parseIdeaToSpecWorkspace,
  type UseIdeaToSpecWorkspaceState,
} from "../model/use-idea-to-spec-workspace";
import { IdeaToSpecWorkspacePanel } from "./IdeaToSpecWorkspacePanel";

const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);
if (parsed.kind !== "ok") {
  throw new Error("Idea-to-spec fixture must parse");
}

const state: UseIdeaToSpecWorkspaceState = {
  kind: "ok",
  data: parsed.data,
};

describe("IdeaToSpecWorkspacePanel", () => {
  it("renders candidate graph, pre-SIB metrics, and repair actions read-only", () => {
    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, { state }),
    );

    expect(html).toContain("Idea-to-Spec Workspace");
    expect(html).toContain("Workflow lane");
    expect(html).toContain("repair required");
    expect(html).toContain("Resolve context-required repairs before promotion");
    expect(html).toContain("operator_only");
    expect(html).toContain("Idea intake draft");
    expect(html).toContain("No local idea draft");
    expect(html).toContain("local_browser_draft");
    expect(html).toContain("Active workspace");
    expect(html).toContain("Team Decision Log");
    expect(html).toContain("product_spec_workspace");
    expect(html).toContain("DemoCalculator");
    expect(html).toContain("Source artifacts");
    expect(html).toContain("runs/candidate_spec_graph_seed.json");
    expect(html).toContain("runs/candidate_repair_loop_report.json");
    expect(html).toContain("Event-storming intake");
    expect(html).toContain("Ontology-bound seed");
    expect(html).toContain("ontology-gap.numeric-input");
    expect(html).toContain("confirm_bind_or_promote_domain_term");
    expect(html).toContain("Candidate graph");
    expect(html).toContain("candidate-spec.numeric-input");
    expect(html).toContain("Pre-SIB coherence");
    expect(html).toContain("pre_sib_ontology_coverage_gap");
    expect(html).toContain("Repair loop");
    expect(html).toContain("repair.add-ac.req-input-digits");
    expect(html).toContain("requires_context");
    expect(html).toContain("Repair session");
    expect(html).toContain("repair-session.team-decision-log");
    expect(html).toContain("repair_session_journal_ready");
    expect(html).toContain("candidate_quality_partially_improved");
    expect(html).toContain("candidate_not_ready_for_approval");
    expect(html).toContain("active_candidate_review_required");
    expect(html).toContain("propose_project_local_term");
    expect(html).toContain("Idea maturity");
    expect(html).toContain("Metrics contract");
    expect(html).toContain("schemas/idea_maturity_metrics_report.schema.json");
    expect(html).toContain(
      "schemas/idea_maturity_metrics_validation_report.schema.json",
    );
    expect(html).toContain("additive_v1");
    expect(html).toContain("VALIDATOR_CONTRACT.md#compatibility-policy");
    expect(html).toContain("Maturity navigation");
    expect(html).toContain("#idea-to-spec-repair-review");
    expect(html).toContain("#idea-to-spec-pre-sib");
    expect(html).toContain("#idea-to-spec-repair-session");
    expect(html).toContain("#idea-to-spec-materialization");
    expect(html).toContain("#idea-to-spec-approval-readiness");
    expect(html).toContain("#idea-to-spec-controlled-promotion");
    expect(html).toContain('id="idea-to-spec-repair-review"');
    expect(html).toContain('id="idea-to-spec-pre-sib"');
    expect(html).toContain('id="idea-to-spec-repair-session"');
    expect(html).toContain('id="idea-to-spec-materialization"');
    expect(html).toContain('id="idea-to-spec-approval-readiness"');
    expect(html).toContain('id="idea-to-spec-controlled-promotion"');
    expect(html).toContain("metrics.idea_maturity_metrics.validator.v0.1");
    expect(html).toContain("repair required");
    expect(html).toContain("Ontology grounding");
    expect(html).toContain("Candidate repair");
    expect(html).toContain("Rerun trend");
    expect(html).toContain("Ontology gaps resolved");
    expect(html).toContain("Candidate gaps resolved");
    expect(html).toContain("Remaining blockers");
    expect(html).toContain("Workflow friction and promotion");
    expect(html).toContain("Temporal progress");
    expect(html).toContain("Readiness explainers");
    expect(html).toContain("readiness-explainer.pre-sib-ontology-coverage-gap");
    expect(html).toContain("Ontology coverage is incomplete");
    expect(html).toContain("Inspect Pre-SIB coherence findings");
    expect(html).toContain(
      "runs/repaired_pre_sib_coherence_report.json#findings.pre-sib-ontology-coverage-gap",
    );
    expect(html).toContain("100%");
    expect(html).not.toContain("NaN");
    expect(html).toContain("Product repair review");
    expect(html).toContain("Repair rerun execution");
    expect(html).toContain("Repair rerun publication");
    expect(html).toContain("Platform repair rerun");
    expect(html).toContain("execute_specgraph_requested_rerun");
    expect(html).toContain("specspace_repair_draft_rerun_report");
    expect(html).toContain("dist/specgraph-public/artifact_manifest.json");
    expect(html).toContain("Ontology gap quality");
    expect(html).toContain("candidate_quality_improved");
    expect(html).toContain("product-ontology-decision.numeric-input.0");
    expect(html).toContain("rerun_overlay_only");
    expect(html).toContain("Promotion preview");
    expect(html).toContain("materialized_candidate_review_ready");
    expect(html).toContain("CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT");
    expect(html).toContain("platform_graph_repository_promotion_request");
    expect(html).toContain("Promotion gate");
    expect(html).toContain("idea_to_spec_promotion_blocked");
    expect(html).toContain("repair_context_required");
    expect(html).toContain("Approval readiness");
    expect(html).toContain("Candidate not approval-ready");
    expect(html).toContain("Approval-ready");
    expect(html).toContain("Promotion review");
    expect(html).toContain("Platform gate");
    expect(html).toContain("Approve candidate for promotion review");
    expect(html).toContain("Candidate approval intent");
    expect(html).toContain("Candidate approval intent loading");
    expect(html).toContain("SpecSpace-owned candidate approval intent state");
    expect(html).toContain("Controlled promotion");
    expect(html).toContain("Platform promotion request");
    expect(html).toContain("Candidate approval execution");
    expect(html).toContain("candidate_approval_materialized");
    expect(html).toContain("materialize_candidate_approval_decision");
    expect(html).toContain("Candidate approval");
    expect(html).toContain("candidate_approval_ready");
    expect(html).toContain("operator://workspace-owner");
    expect(html).toContain("Product promotion execution");
    expect(html).toContain("abc1234");
    expect(html).toContain("execute_git_service_promotion");
    expect(html).toContain("Git Service execution");
    expect(html).toContain("prepare worktree");
    expect(html).toContain("commit candidate");
    expect(html).toContain("open review");
    expect(html).toContain("Review status");
    expect(html).toContain("waiting_for_review_merge");
    expect(html).toContain("wait_for_review_merge");
    expect(html).toContain("inspect_review_status");
    expect(html).toContain("Read-model publication");
    expect(html).toContain("run_real_read_model_publication");
    expect(html).toContain("product_candidate_promotion_review_status_report.json");
    expect(html).toContain("graph_repository_publish_read_model");
    expect(html).toContain("published-read-model/artifact_manifest.json");
    expect(html).toContain("review status");
    expect(html).toContain("Repair drafts loading");
    expect(html).toContain("Repair rerun request loading");
    expect(html).toContain("Save draft");
    expect(html).toContain("Spec mutations");
    expect(html).toContain("false");
    expect(html).not.toContain("Apply to SpecGraph");
    expect(html).not.toContain("Accept ontology term");
    expect(html).not.toContain("Create branch");
  });

  it("renders failed dry-run approval execution as blocked", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.controlled_promotion.candidate_approval_execution.ok = false;
    raw.controlled_promotion.candidate_approval_execution.dry_run = true;
    raw.controlled_promotion.candidate_approval_execution.status =
      "candidate_approval_blocked";
    const parsedBlocked = parseIdeaToSpecWorkspace(raw);
    if (parsedBlocked.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedBlocked.data },
      }),
    );
    const approvalExecutionStart = html.indexOf("Candidate approval execution");
    const approvalExecutionSnippet = html.slice(
      approvalExecutionStart,
      approvalExecutionStart + 240,
    );

    expect(approvalExecutionSnippet).toContain("blocked");
    expect(approvalExecutionSnippet).not.toContain("dry_run");
  });

  it("renders failed idea maturity validation as untrusted", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.idea_maturity.status = "validation_failed";
    raw.idea_maturity.trusted = false;
    raw.idea_maturity.validation.summary.status = "invalid";
    raw.idea_maturity.validation.reports[0].status = "invalid";
    raw.idea_maturity.validation.reports[0].diagnostic_count = 2;
    const parsedInvalid = parseIdeaToSpecWorkspace(raw);
    if (parsedInvalid.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedInvalid.data },
      }),
    );

    expect(html).toContain("Idea maturity");
    expect(html).toContain("validation failed");
    expect(html).toContain("diagnostics 2");
  });

  it("renders idea maturity finding next actions", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.idea_maturity.report.findings = [
      {
        finding_id: "maturity.pre_sib.blocker",
        severity: "warning",
        message: "Candidate is blocked by Pre-SIB finding.",
        source: "pre_sib",
        next_action: "Inspect Pre-SIB coherence findings.",
      },
    ];
    const parsedWithFinding = parseIdeaToSpecWorkspace(raw);
    if (parsedWithFinding.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithFinding.data },
      }),
    );

    expect(html).toContain("maturity.pre_sib.blocker");
    expect(html).toContain("Candidate is blocked by Pre-SIB finding.");
    expect(html).toContain("Next action");
    expect(html).toContain("Inspect Pre-SIB coherence findings.");
  });

  it("derives idea maturity finding next actions when absent", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.idea_maturity.report.findings = [
      {
        finding_id: "maturity.promotion_gate.blocker",
        severity: "warning",
        message: "Candidate is blocked by promotion gate finding.",
        source: "promotion_gate",
      },
    ];
    const parsedWithFinding = parseIdeaToSpecWorkspace(raw);
    if (parsedWithFinding.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithFinding.data },
      }),
    );

    expect(html).toContain("maturity.promotion_gate.blocker");
    expect(html).toContain("Next action");
    expect(html).toContain(
      "Inspect promotion gates and controlled promotion reports.",
    );
  });

  it("renders product child Git operations without a standalone legacy report", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.controlled_promotion.git_service_execution.operations = [];
    raw.controlled_promotion.git_service_execution.operation_count = 0;
    raw.controlled_promotion.git_service_execution.completed_operation_count = 0;
    const parsedProductOnly = parseIdeaToSpecWorkspace(raw);
    if (parsedProductOnly.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedProductOnly.data },
      }),
    );

    expect(html).toContain("Product promotion execution");
    expect(html).toContain("platform_git_service_prepare_worktree_request");
  });

  it("renders product promotion execution with errors as blocked", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.controlled_promotion.product_promotion_execution.error_count = 1;
    const parsedBlocked = parseIdeaToSpecWorkspace(raw);
    if (parsedBlocked.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedBlocked.data },
      }),
    );
    const controlledPromotionStart = html.indexOf("Controlled promotion");
    const productExecutionStart = html.indexOf(
      "Product promotion execution",
      controlledPromotionStart,
    );
    const productExecutionSnippet = html.slice(
      productExecutionStart,
      productExecutionStart + 240,
    );

    expect(productExecutionSnippet).toContain("blocked");
  });
});
