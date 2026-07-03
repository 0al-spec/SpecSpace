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
    expect(html).toContain("Guided product flow");
    expect(html).toContain("Replace the rerun request for the current workspace and repair session.");
    expect(html).toContain("#idea-to-spec-workspace-state-hygiene");
    expect(html).toContain("#idea-to-spec-idea-intake");
    expect(html).toContain("#idea-to-spec-candidate-graph");
    expect(html).toContain('id="idea-to-spec-candidate-overview"');
    expect(html).toContain("Candidate overview");
    expect(html).toContain("Capture team decisions with explicit owner and outcome.");
    expect(html).toContain("Decision capture, review, and retrieval for one product team.");
    expect(html).toContain("Resolve repair blockers");
    expect(html).toContain("Workflow topology");
    expect(html).toContain("Workflow topology map");
    expect(html).toContain("Actors");
    expect(html).toContain("Commands");
    expect(html).toContain("Events");
    expect(html).toContain("review-only topology");
    expect(html).toContain("actor triggers command");
    expect(html).toContain("Team member");
    expect(html).toContain("Record decision");
    expect(html).toContain("Git dry-run");
    expect(html).toContain("scripts/platform.py product-repair-rerun smoke --profile happy-path-promotion-dry-run");
    expect(html).toContain("Workflow lane");
    expect(html).toContain("repair required");
    expect(html).toContain("Resolve context-required repairs before promotion");
    expect(html).toContain("operator_only");
    expect(html).toContain("Idea intake");
    expect(html).toContain("Real idea intake");
    expect(html).toContain("Start from raw idea");
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
    expect(html).toContain("Intake clarification");
    expect(html).toContain('id="idea-to-spec-intake-clarification"');
    expect(html).toContain("active candidate ready");
    expect(html).toContain("make real-idea-intake-continue-from-specspace-answers");
    expect(html).toContain("Real idea answer authoring");
    expect(html).toContain("Real idea answer continuation");
    expect(html).toContain("answer_template_ready");
    expect(html).toContain("real_idea_answer_continuation_ready");
    expect(html).toContain("runs/idea_intake_clarification_answers.json");
    expect(html).toContain("Template-backed answer");
    expect(html).toContain("value.refs[]");
    expect(html).toContain("active_frame_ref");
    expect(html).toContain("Answer requires refs before materialization.");
    expect(html).toContain("SpecSpace-owned intake clarification answer state");
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
    expect(
      html.split("schemas/idea_maturity_metrics_report.schema.json").length - 1,
    ).toBe(2);
    expect(
      html.split("schemas/idea_maturity_metrics_validation_report.schema.json")
        .length - 1,
    ).toBe(1);
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
    expect(html).toContain("Project-local review");
    expect(html).toContain("project_local_ontology_decision_effect_ready");
    expect(html).toContain("Review evidence");
    expect(html).toContain("Ready for maturity");
    expect(html).toContain("Kept local");
    expect(html).toContain("Bound / alias");
    expect(html).toContain("Promotion follow-ups");
    expect(html).toContain("Blocking decisions");
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
    expect(html).toContain("Workspace state preflight");
    expect(html).toContain("Current workspace state");
    expect(html).toContain("repair rerun request");
    expect(html).toContain("workspace_id_mismatch");
    expect(html).toContain("local-subscription-control");
    expect(html).toContain("Replace the rerun request");
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
    expect(html).toContain("Ontology gap term");
    expect(html).toContain("Term");
    expect(html).toContain("Spec mutations");
    expect(html).toContain("false");
    expect(html).not.toContain("Apply to SpecGraph");
    expect(html).not.toContain("Accept ontology term");
    expect(html).not.toContain("Create branch");
  });

  it("renders template-backed intake answers for all required fields", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    const target =
      raw.intake_clarification.answer_authoring.template.targets[0];
    target.required_fields_by_action.answer_question = [
      "value.refs[]",
      "value.context",
    ];
    target.value_templates_by_action.answer_question = {
      refs: [""],
      context: "",
    };
    const parsedWithMultiFieldTemplate = parseIdeaToSpecWorkspace(raw);
    if (parsedWithMultiFieldTemplate.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithMultiFieldTemplate.data },
      }),
    );

    expect(html).toContain("value.refs[], value.context");
    expect(html).toContain("emits refs, context");
  });

  it("renders template-backed term list answers with compatible payload keys", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    const target =
      raw.intake_clarification.answer_authoring.template.targets[0];
    target.required_fields_by_action.answer_question = ["value.terms[]"];
    target.value_templates_by_action.answer_question = {
      terms: [""],
    };
    const parsedWithTermTemplate = parseIdeaToSpecWorkspace(raw);
    if (parsedWithTermTemplate.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithTermTemplate.data },
      }),
    );

    expect(html).toContain("value.terms[]");
    expect(html).toContain("emits terms");
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

  it("renders aggregate answer accounting", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.idea_maturity.report.metrics.materialized_answer_count = 5;
    raw.idea_maturity.report.metrics.unmaterialized_answer_count = 3;
    raw.idea_maturity.report.metrics.per_gap_materialized_answer_count = 0;
    raw.idea_maturity.report.metrics.closure_evidence_answer_count = 0;
    raw.idea_maturity.report.metrics.ordinary_unmaterialized_answer_count = 0;
    const parsed = parseIdeaToSpecWorkspace(raw);
    if (parsed.kind !== "ok") {
      throw new Error("Idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsed.data },
      }),
    );

    expect(html).toContain("Per-gap materialized");
    expect(html).toContain("Aggregate closure");
    expect(html).toContain("Dismissed");
    expect(html).toContain("Closure evidence");
    expect(html).toContain("Ordinary unmaterialized");
    expect(html).toMatch(/Per-gap materialized<\/span><span[^>]*>0 \/ 5/);
    expect(html).toMatch(/Closure evidence<\/span><span[^>]*>0 \/ 5/);
    expect(html).toMatch(/Ordinary unmaterialized<\/span><span[^>]*>0/);
  });

  it("does not prefill project-local keep decisions with the term text", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.project_local_ontology_review = {
      available: true,
      readiness: { ready: false, review_state: "project_local_ontology_review_required" },
      summary: { status: "project_local_ontology_review_required", term_count: 1 },
      context: { workspace_id: "team-decision-log", candidate_id: "team-decision-log" },
      supported_actions: ["keep_project_local", "bind_existing"],
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_apply_decisions: false,
        may_mutate_candidate_artifacts: false,
        may_accept_ontology_terms: false,
        may_write_ontology_package: false,
        may_create_branch_or_commit: false,
      },
      terms: [
        {
          id: "project-local-ontology-term.local-price-rule",
          term: "Local Price Rule",
          term_key: "localpricerule",
          status: "unreviewed",
          suggested_actions: ["keep_project_local", "bind_existing"],
          effect: {
            candidate_readiness_effect: "requires_operator_review",
            next_action: "record_project_local_ontology_decision",
            resolved_gap_count: 0,
          },
        },
      ],
    };
    const parsedWithProjectLocal = parseIdeaToSpecWorkspace(raw);
    if (parsedWithProjectLocal.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithProjectLocal.data },
      }),
    );
    const textareaStart = html.indexOf(
      'aria-label="Project-local ontology review decision"',
    );
    const textareaEnd = html.indexOf("</textarea>", textareaStart);
    expect(textareaStart).toBeGreaterThanOrEqual(0);
    expect(textareaEnd).toBeGreaterThan(textareaStart);
    const textareaSnippet = html.slice(textareaStart, textareaEnd);

    expect(html).toContain("Local Price Rule");
    expect(textareaSnippet).not.toContain("Local Price Rule");
    expect(html).toContain('Will keep &quot;Local Price Rule&quot; project-local');
    expect(html).toContain("Project-local rationale");
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

  it("renders structured product/spec gap repair controls", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.repair_review.clarification_requests.requests.push({
      id: "clarification.candidate-gap.subscription-payment-enforcement",
      kind: "candidate_gap",
      severity: "blocking",
      status: "open",
      target_ref:
        "candidate-spec.subscription-payment.gaps.subscription-payment.enforcement-mechanism",
      target_artifact: "runs/candidate_spec_graph.json",
      question: "How should subscription payment enforcement be described?",
      suggested_actions: [
        "provide_candidate_context",
        "answer_question",
        "reject",
        "defer",
      ],
    });
    raw.repair_review.clarification_requests.repair_targets = [
      ...(raw.repair_review.clarification_requests.repair_targets ?? []),
      {
        request_id: "clarification.candidate-gap.subscription-payment-enforcement",
        kind: "missing_enforcement_mechanism",
        label: "Backend enforcement target",
        target_ref:
          "candidate-spec.subscription-payment.gaps.subscription-payment.enforcement-mechanism",
        source_ref: "runs/candidate_spec_graph.json",
        statement: "How should subscription payment enforcement be described?",
        recommended_action: "Describe the concrete enforcement mechanism and its owner.",
        accepted_actions: [
          "provide_candidate_context",
          "answer_question",
          "reject",
          "defer",
        ],
        expected_effect: "enforcement_mechanism_added",
      },
    ];
    raw.repair_review.clarification_requests.request_count += 1;
    const parsedProductGap = parseIdeaToSpecWorkspace(raw);
    if (parsedProductGap.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedProductGap.data },
      }),
    );

    expect(html).toContain("How should subscription payment enforcement be described?");
    expect(html).toContain("Repair target");
    expect(html).toContain("Backend enforcement target");
    expect(html).toContain("Expected effect");
    expect(html).toContain("enforcement_mechanism_added");
    expect(html).toContain("Resolution intent");
    expect(html).toContain("Mechanism / context");
    expect(html).toContain("Owner");
    expect(html).toContain("Scope");
    expect(html).toContain("Risk decision");
    expect(html).toContain("Mitigation");
  });

  it("renders unknown accepted answer count for unavailable continuation preview", () => {
    const data = {
      ...parsed.data,
      intakeClarification: {
        ...parsed.data.intakeClarification,
        answerContinuation: {
          ...parsed.data.intakeClarification.answerContinuation,
          importPreview: {
            ...parsed.data.intakeClarification.answerContinuation.importPreview,
            acceptedAnswerCount: null,
          },
        },
      },
    };
    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data },
      }),
    );

    expect(html).toContain("Accepted answers");
    expect(html).toContain("unknown");
  });

  it("renders project-local ontology readiness and follow-up counters", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    const review =
      raw.idea_maturity.report.metrics.project_local_ontology_review;
    review.request_promotion_count = 1;
    review.follow_up_decision_count = 7;
    review.blocking_decision_count = 4;
    review.ready_for_maturity = false;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
      }),
    );

    expect(html).toMatch(/Ready for maturity[\s\S]*?>no</);
    expect(html).toMatch(/Promotion follow-ups[\s\S]*?>7</);
    expect(html).toMatch(/Blocking decisions[\s\S]*?>4</);
  });

  it("labels sampled topology refs and hidden workflow edge counts accurately", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.candidate_overview.event_storming.actor_count = 2;
    raw.candidate_overview.topology.workflow_edge_count = 30;
    raw.candidate_overview.topology.edges = [
      {
        id: "edge.hidden-actor",
        relation: "actor_triggers_command",
        from: "actor.hidden-by-sample",
        to: "command.record-decision",
        label: "Hidden actor records decision",
      },
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `edge.sampled-${index}`,
        relation: "command_emits_event",
        from: "command.record-decision",
        to: "event.decision-recorded",
        label: "Record decision emits event",
      })),
    ];
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Sampled topology fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
      }),
    );

    expect(html).toContain("Topology refs outside displayed sample");
    expect(html).toContain(
      "Some endpoints may be valid source items hidden by the workspace API sample limit.",
    );
    expect(html).toContain("+22 more workflow edges");
    expect(html).toContain("4 additional sampled rows");
    expect(html).not.toContain("Unresolved topology refs");
  });
});
