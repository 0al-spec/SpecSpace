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
  it("rejects write-capable guided repair path payloads", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.authority_boundary.may_execute_platform = true;

    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);

    expect(parsedWorkspace.kind).toBe("parse-error");
    if (parsedWorkspace.kind === "parse-error") {
      expect(parsedWorkspace.reason).toBe("guided repair path boundary expanded");
    }
  });

  it("rejects answer-applying guided repair path payloads", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.authority_boundary.may_apply_answers = true;

    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);

    expect(parsedWorkspace.kind).toBe("parse-error");
    if (parsedWorkspace.kind === "parse-error") {
      expect(parsedWorkspace.reason).toBe("guided repair path boundary expanded");
    }
  });

  it("rejects malformed truthy guided repair path authority flags", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.authority_boundary.may_apply_decisions = "true";

    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);

    expect(parsedWorkspace.kind).toBe("parse-error");
    if (parsedWorkspace.kind === "parse-error") {
      expect(parsedWorkspace.reason).toBe("guided repair path boundary expanded");
    }
  });

  it("rejects write-capable guided approval path payloads", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.authority_boundary.may_publish_read_model = true;

    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);

    expect(parsedWorkspace.kind).toBe("parse-error");
    if (parsedWorkspace.kind === "parse-error") {
      expect(parsedWorkspace.reason).toBe("guided approval path boundary expanded");
    }
  });

  it("rejects write-capable product workspace overview payloads", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.product_workspace_overview = {
      available: true,
      status: "repair",
      current_phase: "repair",
      current_phase_label: "Repair",
      next_safe_action: "Inspect repair state.",
      primary_target_section: "idea-to-spec-guided-repair-path",
      readiness: {
        status: "blocked",
        ready: false,
        blocker_count: 1,
        blockers: ["repair_required"],
      },
      completed_phase_count: 4,
      total_phase_count: 7,
      last_successful_handoff: {},
      confidence: { level: "trusted", source_refs: [] },
      phases: [],
      authority_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_execute_specgraph: false,
        may_execute_platform: false,
        may_execute_git_service: false,
        may_mutate_candidate_artifacts: false,
        may_mutate_canonical_specs: false,
        may_write_ontology_package: false,
        may_accept_ontology_terms: false,
        may_create_branch_or_commit: false,
        may_open_pull_request: false,
        may_merge_review: false,
        may_publish_read_model: true,
      },
    };

    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);

    expect(parsedWorkspace.kind).toBe("parse-error");
    if (parsedWorkspace.kind === "parse-error") {
      expect(parsedWorkspace.reason).toBe(
        "product workspace overview boundary expanded",
      );
    }
  });

  it("shows managed operations observability rows", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_operations_observability = {
      available: true,
      surface_id: "specspace.managed-operations.observability.v0.1",
      surface_kind: "managed_operations_observability",
      summary: {
        operation_count: 1,
        completed_count: 0,
        failed_count: 0,
        stale_count: 0,
        request_needed_count: 1,
        new_request_required_count: 0,
        ready_to_execute_count: 0,
        gate_needed_count: 0,
      },
      status_counts: { request_needed: 1 },
      groups: [
        {
          phase: "workspace",
          label: "Workspace",
          operation_ids: ["workspace_initialization_execute"],
        },
      ],
      operations: [
        {
          operation_id: "workspace_initialization_execute",
          category: "workspace",
          lifecycle_stage: "workspace_initialization",
          ui_stage: "Workspace initialization",
          endpoint: "/api/v1/product-workspace-initialization/execute",
          platform_command: ["workspace", "execute-requested-initialization"],
          status: "request_needed",
          target_section: "idea-to-spec-workspace-initialization-path",
          next_safe_action: "Complete required request evidence.",
          input_refs: [
            {
              ref: "runs/product_workspace_initialization_execution_request.json",
              kind: "run_artifact",
              available: false,
              status: "missing",
            },
          ],
          output_reports: [],
          missing_input_refs: [
            "runs/product_workspace_initialization_execution_request.json",
          ],
          available_output_refs: [],
          idempotency_key: "execution_request.summary.idempotency_key",
          overwrite_policy: "reject mismatched request",
          timeout_policy: "bounded",
          replay_policy: "idempotent",
          dry_run_only: false,
          irreversible: false,
          requires_explicit_confirmation: false,
          authority_boundary: {
            ...raw.guided_flow.authority_boundary,
            managed_operations_observability_is_authority: false,
            may_run_shell: false,
            may_publish_read_model: false,
          },
        },
      ],
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_operations_observability_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: false,
      },
    };
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
      }),
    );

    expect(html).toContain("Managed operations");
    expect(html).toContain("Workspace initialization");
    expect(html).toContain("request needed");
    expect(html).toContain("workspace execute-requested-initialization");
  });

  it("hides guided repair checkpoint rail when path is unavailable", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.available = false;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    expect(parsedWorkspace.kind).toBe("ok");
    if (parsedWorkspace.kind !== "ok") return;

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
      }),
    );

    expect(html).toContain("Repair path unavailable");
    expect(html).not.toContain("Product/spec answers");
  });

  it("renders candidate graph, pre-SIB metrics, and repair actions read-only", () => {
    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, { state }),
    );

    expect(html).toContain("Idea-to-Spec Workspace");
    expect(html).toContain("Product workspace overview");
    expect(html).toContain('id="idea-to-spec-product-workspace-overview"');
    expect(html).toContain("Next safe action");
    expect(html).toContain("Current phase");
    expect(html).toContain("Progress");
    expect(html).toContain("Workspace");
    expect(html).toContain("Publication");
    expect(html).toContain('data-testid="product-workspace-phase-timeline"');
    expect(html).toContain("Guided product flow");
    expect(html).toContain("Request a controlled repair rerun.");
    expect(html).toContain("#idea-to-spec-workspace-state-hygiene");
    expect(html).toContain("Guided repair path");
    expect(html).toContain('id="idea-to-spec-guided-repair-path"');
    expect(html).toContain("Candidate repair route");
    expect(html).toContain("ready to request rerun");
    expect(html).toContain("Product/spec answers");
    expect(html).toContain("Project-local ontology");
    expect(html).toContain("Rerun request");
    expect(html).toContain("Evidence pending");
    expect(html).not.toContain("0 evidence items");
    expect(html).toContain("Guided approval path");
    expect(html).toContain('id="idea-to-spec-guided-approval-path"');
    expect(html).toContain("Approval and promotion route");
    expect(html).toContain("Resolve approval readiness blockers before promotion review.");
    expect(html).toContain("repair_context_required");
    expect(html).toContain("Promotion paths");
    expect(html).toContain("Approval decision");
    expect(html).toContain("Promotion request");
    expect(html).toContain("Promotion execution");
    expect(html).toContain("Review status");
    expect(html).toContain("Read-model publication");
    expect(html).toContain("Open ontology");
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
    expect(html).toContain("Platform intake execution");
    expect(html).toContain("execute_specgraph_real_idea_entry_intake");
    expect(html).toContain("entry_intake_report");
    expect(html).toContain("real_idea_entry_request_intake_report.json");
    expect(html).toContain('id="idea-to-spec-start-raw-idea"');
    expect(html).toContain("Start here: raw product idea");
    expect(html.indexOf("Start here: raw product idea")).toBeLessThan(
      html.indexOf("Guided product flow"),
    );
    expect(html).toContain(
      "Enter the user&#x27;s product idea here. SpecSpace stores only",
    );
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
    expect(html).toContain("Guided clarification path");
    expect(html).toContain("candidate_ready");
    expect(html).toContain("Candidate ready");
    expect(html).toContain("active candidate ready");
    expect(html).toContain("make real-idea-intake-continue-from-specspace-answers");
    expect(html).toContain("Real idea answer authoring");
    expect(html).toContain("Real idea answer continuation");
    expect(html).toContain("answer_template_ready");
    expect(html).toContain("real_idea_answer_continuation_ready");
    expect(html).toContain("runs/idea_intake_clarification_answers.json");
    expect(html).toContain(
      "specspace-state://idea_to_spec_intake_clarification_answers.json",
    );
    expect(html).toContain("product-real-idea-continuation execute");
    expect(html).toContain("Template-backed answer");
    expect(html).toContain("value.refs[]");
    expect(html).toContain("active_frame_ref");
    expect(html).toContain("Answer requires refs before materialization.");
    expect(html).toContain("answer_required_field_empty");
    expect(html).toContain(
      "clarification.intake.question-active-frame-domain-refs",
    );
    expect(html).toContain("runs/real_idea_smoke/real_idea_answer_set.json");
    expect(html).toContain("Add at least one value.refs[] entry.");
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

  it("shows managed repair request gate action when the gate is the next step", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.stage = "rerun_request_gate_needed";
    raw.guided_repair_path.next_action =
      "Build or refresh the repair rerun request gate.";
    raw.guided_repair_path.state.rerun_request_status = "usable";
    raw.guided_repair_path.state.request_gate_status = "missing";
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        repairRerunRequestGateExecuteUrl:
          "/api/v1/idea-to-spec-repair-rerun-request-gate/execute",
      }),
    );

    expect(html).toContain("Build or refresh the repair rerun request gate.");
    expect(html).toContain("Run controlled request gate");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform request-gate operation.",
    );
  });

  it("shows managed repair rerun action after the request gate is ready", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.stage = "rerun_requested";
    raw.guided_repair_path.next_action =
      "Wait for Platform to execute the requested repair rerun.";
    raw.guided_repair_path.state.rerun_request_status = "usable";
    raw.guided_repair_path.state.request_gate_status =
      "specspace_repair_rerun_request_gate_ready";
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        repairRerunExecuteUrl: "/api/v1/idea-to-spec-repair-rerun/execute",
      }),
    );

    expect(html).toContain(
      "Wait for Platform to execute the requested repair rerun.",
    );
    expect(html).toContain("Run controlled repair rerun");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform plan and repair rerun operations.",
    );
  });

  it("shows managed repair publication action after rerun execution completes", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_repair_path.stage = "rerun_running_or_waiting";
    raw.guided_repair_path.next_action = "Wait for repaired artifacts to publish.";
    raw.guided_repair_path.state.rerun_request_status = "requested";
    raw.guided_repair_path.state.request_gate_status =
      "specspace_repair_rerun_request_gate_ready";
    raw.guided_repair_path.state.rerun_execution_status = "completed";
    raw.guided_repair_path.state.rerun_publication_status = null;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        repairRerunPublishUrl: "/api/v1/idea-to-spec-repair-rerun/publish",
      }),
    );

    expect(html).toContain("Wait for repaired artifacts to publish.");
    expect(html).toContain("Publish repaired artifacts");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform repair publication operation.",
    );
  });

  it("shows managed candidate approval action after approval intent is ready", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "approval_execution_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Run Platform candidate approval materialization.";
    raw.guided_approval_path.state.approval_intent_status = "usable";
    raw.guided_approval_path.state.approval_execution_status = null;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        candidateApprovalExecuteUrl:
          "/api/v1/idea-to-spec-candidate-approval/execute",
      }),
    );

    expect(html).toContain("Run Platform candidate approval materialization.");
    expect(html).toContain("Materialize approval decision");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform candidate approval operation.",
    );
  });

  it("keeps managed candidate approval retry available after failed execution", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "approval_execution_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Run Platform candidate approval materialization.";
    raw.guided_approval_path.state.approval_intent_status = "usable";
    raw.guided_approval_path.state.approval_execution_status = "failed";
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        candidateApprovalExecuteUrl:
          "/api/v1/idea-to-spec-candidate-approval/execute",
      }),
    );

    expect(html).toContain("Materialize approval decision");
  });

  it("shows managed promotion request action after approval decision is ready", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "promotion_request_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Create the report-only graph repository promotion request.";
    raw.guided_approval_path.state.candidate_approval_state = "approved";
    raw.guided_approval_path.state.promotion_request_ok = false;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        promotionRequestExecuteUrl:
          "/api/v1/idea-to-spec-promotion-request/execute",
      }),
    );

    expect(html).toContain(
      "Create the report-only graph repository promotion request.",
    );
    expect(html).toContain("Create promotion request");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform promotion request operation.",
    );
  });

  it("shows managed promotion execution dry-run action after promotion request is ready", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "promotion_execution_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Run controlled product promotion execution.";
    raw.guided_approval_path.state.promotion_request_ok = true;
    raw.guided_approval_path.state.promotion_execution_status = null;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        promotionExecuteUrl: "/api/v1/idea-to-spec-promotion/execute",
      }),
    );

    expect(html).toContain("Run controlled product promotion execution.");
    expect(html).toContain("Run promotion dry-run");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform promotion execution dry-run.",
    );
  });

  it("shows managed promotion review action after promotion dry-run evidence", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "promotion_execution_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Run non-dry-run product promotion execution when ready.";
    raw.guided_approval_path.state.promotion_request_ok = true;
    raw.guided_approval_path.state.promotion_execution_status = "completed";
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        promotionExecuteUrl: "/api/v1/idea-to-spec-promotion/execute",
        promotionReviewExecuteUrl:
          "/api/v1/idea-to-spec-promotion-review/execute",
      }),
    );

    expect(html).toContain(
      "Run non-dry-run product promotion execution when ready.",
    );
    expect(html).toContain("Open review PR");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform non-dry-run promotion execution.",
    );
    expect(html).not.toContain("Run promotion dry-run");
  });

  it("keeps managed promotion dry-run retry available after execution failure", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "promotion_execution_needed";
    raw.guided_approval_path.status = "blocked";
    raw.guided_approval_path.next_action =
      "Repair controlled product promotion execution.";
    raw.guided_approval_path.state.promotion_request_ok = true;
    raw.guided_approval_path.state.promotion_execution_status = "failed";
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        promotionExecuteUrl: "/api/v1/idea-to-spec-promotion/execute",
        promotionReviewExecuteUrl:
          "/api/v1/idea-to-spec-promotion-review/execute",
      }),
    );

    expect(html).toContain("Repair controlled product promotion execution.");
    expect(html).toContain("Run promotion dry-run");
    expect(html).not.toContain("Open review PR");
  });

  it("shows managed review-status inspection action after promotion execution opens review", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "review_merge_waiting";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Inspect repository review status for the opened promotion PR.";
    raw.guided_approval_path.state.promotion_request_ok = true;
    raw.guided_approval_path.state.promotion_execution_status = null;
    raw.guided_approval_path.state.review_state = null;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        reviewStatusExecuteUrl: "/api/v1/idea-to-spec-review-status/execute",
      }),
    );

    expect(html).toContain(
      "Inspect repository review status for the opened promotion PR.",
    );
    expect(html).toContain("Inspect review status");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform review-status inspection.",
    );
  });

  it("shows managed read-model publication action after review is merged", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.guided_approval_path.available = true;
    raw.guided_approval_path.stage = "read_model_publication_needed";
    raw.guided_approval_path.status = "waiting_for_operator";
    raw.guided_approval_path.next_action =
      "Publish the public read model after repository review merge.";
    raw.guided_approval_path.state.review_state = null;
    raw.guided_approval_path.state.read_model_published = false;
    const parsedWorkspace = parseIdeaToSpecWorkspace(raw);
    if (parsedWorkspace.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWorkspace.data },
        readModelPublicationExecuteUrl:
          "/api/v1/idea-to-spec-read-model-publication/execute",
      }),
    );

    expect(html).toContain(
      "Publish the public read model after repository review merge.",
    );
    expect(html).toContain("Publish read model");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform read-model publication.",
    );
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

  it("renders backend workspace initialization evidence", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "pantry-rotation",
      active_request: {
        request_id: "product-workspace-request.pantry-rotation",
        workspace_id: "pantry-rotation",
        display_name: "Pantry Rotation",
        route: "/pantry-rotation",
        root_intent_summary: "Track pantry stock before food expires.",
        status: "initialized",
        created_at: "2026-07-04T08:00:00Z",
        updated_at: "2026-07-04T08:05:00Z",
      },
      summary: {
        status: "workspace_initialized",
        request_count: 1,
        active_requested_count: 1,
        invalid_request_count: 0,
        next_gap: "start_real_idea_intake",
      },
      initialization: {
        available: true,
        trusted: true,
        initialized: true,
        execution_request: {
          status: "workspace_initialization_execution_requested",
          ready_for_managed_execution: true,
          requested_operation: "workspace.execute-initialization-plan",
          idempotency_key: "a".repeat(64),
        },
        execution: {
          status: "workspace_initialization_executed",
          catalog_written: true,
          workspace_files_created: true,
        },
      },
    };
    raw.workspace_initialization_path = {
      available: true,
      status: "initialized",
      workspace_id: "pantry-rotation",
      display_name: "Pantry Rotation",
      initial_idea_present: true,
      creation_request_ref: "specspace-state://product_workspace_creation_requests.json",
      initialization_request_ref:
        "runs/pantry-rotation/product_workspace_initialization_plan.json",
      initialization_report_ref:
        "runs/platform_product_workspace_initialization_execution_report.json",
      next_safe_action: "Start or continue raw idea intake in this workspace.",
      blockers: [],
    };
    const parsedInitialized = parseIdeaToSpecWorkspace(raw);
    if (parsedInitialized.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedInitialized.data },
      }),
    );

    expect(html).toContain("Workspace initialized through backend-owned state.");
    expect(html).toContain("Guided workspace initialization");
    expect(html).toContain("Start or continue raw idea intake in this workspace.");
    expect(html).toContain("Initial idea");
    expect(html).toContain("present");
    expect(html).toContain("workspace initialized");
    expect(html).toContain("Pantry Rotation");
    expect(html).toContain("/pantry-rotation");
    expect(html).toContain("Initialized");
    expect(html).toContain("workspace_initialization_executed");
    expect(html).toContain("Execution request");
    expect(html).toContain("workspace_initialization_execution_requested");
    expect(html).toContain("Managed ready");
    expect(html).toContain("Requested operation");
    expect(html).toContain("workspace.execute-initialization-plan");
    expect(html).toContain("Idempotency");
    expect(html).toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(html).toContain("Catalog binding");
    expect(html).toContain("written");
  });

  it("renders backend-managed workspace initialization action when requested", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "pantry-rotation",
      active_request: {
        request_id: "product-workspace-request.pantry-rotation",
        workspace_id: "pantry-rotation",
        display_name: "Pantry Rotation",
        route: "/pantry-rotation",
        root_intent_summary: "Track pantry stock before food expires.",
        status: "creation_requested",
        created_at: "2026-07-04T08:00:00Z",
        updated_at: "2026-07-04T08:05:00Z",
      },
      summary: {
        status: "workspace_creation_requested",
        request_count: 1,
        active_requested_count: 1,
        invalid_request_count: 0,
        next_gap: "run_platform_workspace_initialization",
      },
      initialization: {
        available: true,
        trusted: true,
        initialized: false,
        execution_request: {
          status: "workspace_initialization_execution_requested",
          ready_for_managed_execution: true,
          requested_operation: "workspace.execute-initialization-plan",
          idempotency_key: "a".repeat(64),
        },
      },
    };
    raw.workspace_initialization_path = {
      available: true,
      status: "initialization_request_ready",
      workspace_id: "pantry-rotation",
      display_name: "Pantry Rotation",
      initial_idea_present: true,
      creation_request_ref: "specspace-state://product_workspace_creation_requests.json",
      initialization_request_ref:
        "runs/pantry-rotation/product_workspace_initialization_execution_request.json",
      initialization_report_ref: null,
      next_safe_action: "Run controlled Platform workspace initialization.",
      blockers: [],
      managed_execution_available: true,
    };
    const parsedRequested = parseIdeaToSpecWorkspace(raw);
    if (parsedRequested.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedRequested.data },
        productWorkspaceInitializationExecuteUrl:
          "/api/v1/product-workspace-initialization/execute?workspace=pantry-rotation",
      }),
    );

    expect(html).toContain("Run controlled initialization");
    expect(html).toContain(
      "SpecSpace backend will call the allowlisted Platform operation.",
    );
    expect(html).toContain(
      "runs/pantry-rotation/product_workspace_initialization_execution_request.json",
    );
  });

  it("does not enable backend-managed workspace initialization when backend capability is unavailable", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "pantry-rotation",
      active_request: {
        request_id: "product-workspace-request.pantry-rotation",
        workspace_id: "pantry-rotation",
        display_name: "Pantry Rotation",
        route: "/pantry-rotation",
        root_intent_summary: "Track pantry stock before food expires.",
        status: "creation_requested",
        created_at: "2026-07-04T08:00:00Z",
        updated_at: "2026-07-04T08:05:00Z",
      },
      summary: {
        status: "workspace_creation_requested",
        request_count: 1,
        active_requested_count: 1,
        invalid_request_count: 0,
        next_gap: "run_platform_workspace_initialization",
      },
      initialization: {
        available: true,
        trusted: true,
        initialized: false,
        execution_request: {
          status: "workspace_initialization_execution_requested",
          ready_for_managed_execution: true,
          requested_operation: "workspace.execute-initialization-plan",
          idempotency_key: "a".repeat(64),
        },
      },
    };
    raw.workspace_initialization_path = {
      available: true,
      status: "initialization_request_ready",
      workspace_id: "pantry-rotation",
      display_name: "Pantry Rotation",
      initial_idea_present: true,
      creation_request_ref: "specspace-state://product_workspace_creation_requests.json",
      initialization_request_ref:
        "runs/pantry-rotation/product_workspace_initialization_execution_request.json",
      initialization_report_ref: null,
      next_safe_action: "Run controlled Platform workspace initialization.",
      blockers: [],
      managed_execution_available: false,
    };
    const parsedRequested = parseIdeaToSpecWorkspace(raw);
    if (parsedRequested.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedRequested.data },
        productWorkspaceInitializationExecuteUrl:
          "/api/v1/product-workspace-initialization/execute?workspace=pantry-rotation",
      }),
    );

    expect(html).toContain("Run controlled initialization");
    expect(html).toContain(
      "Managed backend execution is not configured; use the Platform command hint.",
    );
    expect(html).toContain("disabled");
  });

  it("does not treat a different active candidate as selected route readiness", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.selected_workspace_id = "pantry-rotation";
    raw.workspace = {
      ...raw.workspace,
      available: true,
      ready: true,
      id: "team-decision-log",
      display_name: "Team Decision Log",
      public_route: "/team-decision-log",
    };
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "pantry-rotation",
      summary: {
        status: "route_only_workspace",
        request_count: 0,
        active_requested_count: 0,
        invalid_request_count: 0,
        next_gap: "submit_product_workspace_creation_request",
      },
      initialization: {
        available: false,
        trusted: true,
        initialized: false,
      },
    };
    const parsedRouteOnly = parseIdeaToSpecWorkspace(raw);
    if (parsedRouteOnly.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedRouteOnly.data },
      }),
    );

    expect(html).toContain("Workspace gate");
    expect(html).toContain("route only");
    expect(html).toContain(
      "Request and initialize this workspace before submitting a raw idea.",
    );
    expect(html).not.toContain("Raw idea intake will use this workspace namespace.");
  });

  it("focuses a route-only workspace on creation before diagnostics", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.selected_workspace_id = "pantry-rotation";
    raw.workspace = {
      ...raw.workspace,
      id: "pantry-rotation",
      display_name: "Pantry Rotation",
      public_route: "/pantry-rotation",
      available: false,
      ready: false,
    };
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "pantry-rotation",
      summary: {
        status: "route_only_workspace",
        request_count: 0,
        active_requested_count: 0,
        invalid_request_count: 0,
        next_gap: "submit_product_workspace_creation_request",
      },
      initialization: {
        available: false,
        trusted: true,
        initialized: false,
      },
    };
    raw.workspace_initialization_path = {
      available: true,
      status: "route_only",
      workspace_id: "pantry-rotation",
      display_name: "Pantry Rotation",
      initial_idea_present: false,
      creation_request_ref: null,
      initialization_request_ref: null,
      initialization_report_ref: null,
      next_safe_action: "Create this workspace before raw idea intake.",
      blockers: ["workspace_creation_request_missing"],
    };
    raw.product_workspace_overview = {
      available: true,
      status: "route_only",
      current_phase: "workspace",
      current_phase_label: "Workspace",
      next_safe_action: "Create this workspace before raw idea intake.",
      primary_target_section: "idea-to-spec-workspace-creation",
      readiness: {
        status: "action_required",
        ready: false,
        blocker_count: 1,
        blockers: ["workspace_creation_request_missing"],
      },
      completed_phase_count: 0,
      total_phase_count: 7,
      last_successful_handoff: {},
      confidence: {
        level: "route_only",
        reason: "Route opened without backend workspace state.",
        source_refs: [],
      },
      phases: [
        {
          id: "workspace",
          label: "Workspace",
          state: "current",
          target_section: "idea-to-spec-workspace-creation",
          blockers: ["workspace_creation_request_missing"],
          evidence_refs: [],
        },
      ],
      authority_boundary: raw.guided_flow.authority_boundary,
    };
    const parsedRouteOnly = parseIdeaToSpecWorkspace(raw);
    if (parsedRouteOnly.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedRouteOnly.data },
      }),
    );
    const focusIndex = html.indexOf("Fresh workspace focus");
    const creationIndex = html.indexOf("Workspace creation");
    const diagnosticsIndex = html.indexOf("Diagnostics / advanced artifacts");
    const rawIdeaIndex = html.indexOf("Start here: raw product idea");
    const candidateGraphIndex = html.indexOf('id="idea-to-spec-candidate-graph"');
    const guidedFlowIndex = html.indexOf("Guided product flow");

    expect(html).toContain('data-testid="fresh-workspace-focus"');
    expect(html).toContain('data-testid="fresh-workspace-diagnostics"');
    expect(focusIndex).toBeGreaterThanOrEqual(0);
    expect(creationIndex).toBeGreaterThan(focusIndex);
    expect(diagnosticsIndex).toBeGreaterThan(creationIndex);
    expect(guidedFlowIndex).toBeGreaterThan(diagnosticsIndex);
    expect(rawIdeaIndex).toBeGreaterThan(diagnosticsIndex);
    expect(candidateGraphIndex).toBeGreaterThan(diagnosticsIndex);
    expect(html).toContain("Create this workspace before raw idea intake.");
  });

  it("focuses an initialized workspace on raw idea intake", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.product_workspace_overview.status = "initialized";
    raw.product_workspace_overview.current_phase = "intake";
    raw.product_workspace_overview.current_phase_label = "Intake";
    raw.product_workspace_overview.next_safe_action =
      "Start or continue raw idea intake in this workspace.";
    raw.product_workspace_overview.primary_target_section = "idea-to-spec-idea-intake";
    raw.product_workspace_overview.readiness = {
      status: "action_required",
      ready: false,
      blocker_count: 0,
      blockers: [],
    };
    raw.workspace_creation = {
      artifact_kind: "specspace_product_workspace_creation_request_state",
      selected_workspace_id: "team-decision-log",
      active_request: {
        request_id: "product-workspace-request.team-decision-log",
        workspace_id: "team-decision-log",
        display_name: "Team Decision Log",
        route: "/team-decision-log",
        root_intent_summary: "Capture team decisions.",
        status: "initialized",
      },
      summary: {
        status: "workspace_initialized",
        request_count: 1,
        active_requested_count: 1,
        invalid_request_count: 0,
        next_gap: "start_real_idea_intake",
      },
      initialization: {
        available: true,
        trusted: true,
        initialized: true,
      },
    };
    const parsedInitialized = parseIdeaToSpecWorkspace(raw);
    if (parsedInitialized.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedInitialized.data },
      }),
    );
    const focusIndex = html.indexOf("Fresh workspace focus");
    const intakeIndex = html.indexOf("Start here: raw product idea");
    const diagnosticsIndex = html.indexOf("Diagnostics / advanced artifacts");
    const repairPathIndex = html.indexOf("Guided repair path");

    expect(focusIndex).toBeGreaterThanOrEqual(0);
    expect(intakeIndex).toBeGreaterThan(focusIndex);
    expect(intakeIndex).toBeLessThan(diagnosticsIndex);
    expect(repairPathIndex).toBeGreaterThan(diagnosticsIndex);
    expect(html).toContain("Start or continue raw idea intake in this workspace.");
  });

  it("focuses clarification work before later lifecycle diagnostics", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.product_workspace_overview.status = "clarification";
    raw.product_workspace_overview.current_phase = "clarification";
    raw.product_workspace_overview.current_phase_label = "Clarification";
    raw.product_workspace_overview.next_safe_action =
      "Answer intake clarification questions before candidate generation.";
    raw.product_workspace_overview.primary_target_section =
      "idea-to-spec-intake-clarification";
    raw.product_workspace_overview.readiness = {
      status: "action_required",
      ready: false,
      blocker_count: 1,
      blockers: ["clarification_answers_required"],
    };
    const parsedClarification = parseIdeaToSpecWorkspace(raw);
    if (parsedClarification.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedClarification.data },
      }),
    );
    const focusIndex = html.indexOf("Fresh workspace focus");
    const clarificationIndex = html.indexOf("Guided clarification path");
    const diagnosticsIndex = html.indexOf("Diagnostics / advanced artifacts");
    const repairPathIndex = html.indexOf("Guided repair path");

    expect(focusIndex).toBeGreaterThanOrEqual(0);
    expect(clarificationIndex).toBeGreaterThan(focusIndex);
    expect(clarificationIndex).toBeLessThan(diagnosticsIndex);
    expect(repairPathIndex).toBeGreaterThan(diagnosticsIndex);
    expect(html).toContain("Answer intake clarification questions before candidate generation.");
  });

  it("keeps blocked clarification work focused and reachable", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.product_workspace_overview.status = "blocked";
    raw.product_workspace_overview.current_phase = "clarification";
    raw.product_workspace_overview.current_phase_label = "Clarification";
    raw.product_workspace_overview.next_safe_action =
      "Resolve clarification blockers before candidate generation.";
    raw.product_workspace_overview.primary_target_section =
      "idea-to-spec-intake-clarification";
    raw.product_workspace_overview.readiness = {
      status: "blocked",
      ready: false,
      blocker_count: 1,
      blockers: ["clarification_answers_invalid"],
    };
    const parsedBlockedClarification = parseIdeaToSpecWorkspace(raw);
    if (parsedBlockedClarification.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedBlockedClarification.data },
      }),
    );
    const focusIndex = html.indexOf("Fresh workspace focus");
    const clarificationIdIndex = html.indexOf('id="idea-to-spec-intake-clarification"');
    const diagnosticsIndex = html.indexOf("Diagnostics / advanced artifacts");
    const guidedFlowIndex = html.indexOf("Guided product flow");

    expect(html).toContain('data-testid="fresh-workspace-focus"');
    expect(html).toContain('href="#idea-to-spec-intake-clarification"');
    expect(focusIndex).toBeGreaterThanOrEqual(0);
    expect(clarificationIdIndex).toBeGreaterThan(focusIndex);
    expect(clarificationIdIndex).toBeLessThan(diagnosticsIndex);
    expect(guidedFlowIndex).toBeGreaterThan(diagnosticsIndex);
    expect(html).toContain("Resolve clarification blockers before candidate generation.");
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

  it("expands generic template value fields to the concrete template shape", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    const target =
      raw.intake_clarification.answer_authoring.template.targets[0];
    target.required_fields_by_action.answer_question = ["value"];
    target.value_templates_by_action.answer_question = {
      entries: [""],
    };
    target.suggested_answer_shape = "event_storming_entry[]";
    const parsedWithGenericTemplate = parseIdeaToSpecWorkspace(raw);
    if (parsedWithGenericTemplate.kind !== "ok") {
      throw new Error("Modified idea-to-spec fixture must parse");
    }

    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, {
        state: { kind: "ok", data: parsedWithGenericTemplate.data },
      }),
    );

    expect(html).toContain("value.entries[]");
    expect(html).toContain("emits entries");
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
