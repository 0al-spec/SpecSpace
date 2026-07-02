import { describe, expect, it } from "vitest";
import { ideaToSpecWorkspace } from "./idea-to-spec-workspace.fixture";
import { parseIdeaToSpecWorkspace } from "./use-idea-to-spec-workspace";

describe("parseIdeaToSpecWorkspace", () => {
  it("parses the readonly idea-to-spec workspace contract", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.summary.status).toBe("blocked");
    expect(parsed.data.summary.candidateNodeCount).toBe(2);
    expect(parsed.data.summary.ontologySeedGapCount).toBe(2);
    expect(parsed.data.summary.ontologySeedBindingCount).toBe(5);
    expect(parsed.data.selectedWorkspaceId).toBe("team-decision-log");
    expect(parsed.data.workspace.id).toBe("team-decision-log");
    expect(parsed.data.workspace.targetRepositoryRole).toBe(
      "product_spec_workspace",
    );
    expect(parsed.data.summary.promotionGateBlockerCount).toBe(1);
    expect(parsed.data.summary.clarificationRequestCount).toBe(1);
    expect(parsed.data.summary.ontologyDecisionCount).toBe(1);
    expect(parsed.data.summary.projectLocalOntologyTermCount).toBe(0);
    expect(parsed.data.summary.projectLocalOntologyImportAcceptedCount).toBe(0);
    expect(parsed.data.summary.projectLocalOntologyImportMissingCount).toBe(0);
    expect(parsed.data.summary.projectLocalOntologyImportInvalidCount).toBe(0);
    expect(parsed.data.summary.resolvedOntologyGapCount).toBe(1);
    expect(parsed.data.summary.unresolvedOntologyGapCount).toBe(7);
    expect(parsed.data.summary.rerunRemovedGapCount).toBe(1);
    expect(parsed.data.summary.gitServiceOperationCount).toBe(3);
    expect(parsed.data.summary.approvalReady).toBe(true);
    expect(parsed.data.summary.repairSessionReadyForCandidateApproval).toBe(
      false,
    );
    expect(parsed.data.summary.repairSessionReadyForPlatformPromotion).toBe(
      false,
    );
    expect(parsed.data.summary.reviewMerged).toBe(false);
    expect(parsed.data.summary.readModelPublished).toBe(false);
    expect(parsed.data.workflow.stage).toBe("repair_required");
    expect(parsed.data.workflow.items).toHaveLength(17);
    expect(parsed.data.workflow.items[2].id).toBe("ontology_seed");
    expect(parsed.data.workflow.items[6].id).toBe(
      "product_repair_rerun_execution",
    );
    expect(parsed.data.workflow.items[7].id).toBe(
      "product_repair_rerun_publication",
    );
    expect(parsed.data.workflow.items[10].id).toBe(
      "candidate_approval_execution",
    );
    expect(parsed.data.workflow.nextHandoff.kind).toBe("operator_repair_review");
    expect(parsed.data.workflow.nextHandoff.authorityBoundary).toBe("operator_only");
    expect(parsed.data.guidedFlow.currentStage).toBe("repair_review");
    expect(parsed.data.guidedFlow.overallStatus).toBe("blocked");
    expect(parsed.data.guidedFlow.nextActions[0].targetSection).toBe(
      "idea-to-spec-workspace-state-hygiene",
    );
    expect(parsed.data.guidedFlow.nextActions[0].label).toBe(
      "Replace the rerun request for the current workspace and repair session.",
    );
    expect(parsed.data.guidedFlow.stages).toHaveLength(11);
    expect(parsed.data.guidedFlow.stages[2].blockers).toEqual([
      "workspace_id_mismatch",
    ]);
    expect(
      parsed.data.guidedFlow.authorityBoundary.mayExecutePlatform,
    ).toBe(false);
    expect(parsed.data.intake.activeFrame.project).toBe("DemoCalculator");
    expect(parsed.data.ontologySeed.readiness.ready).toBe(true);
    expect(parsed.data.ontologySeed.summary.ontologyBindingCount).toBe(5);
    expect(parsed.data.ontologySeed.gaps[0].id).toBe("ontology-gap.numeric-input");
    expect(parsed.data.ontologySeed.bindings[0].term).toBe("Spec");
    expect(parsed.data.candidateGraph.nodes[1].id).toBe(
      "candidate-spec.numeric-input",
    );
    expect(parsed.data.candidateOverview.available).toBe(true);
    expect(parsed.data.candidateOverview.summary.graphSource).toBe(
      "repaired_candidate_graph",
    );
    expect(parsed.data.candidateOverview.narrative.productIntent).toBe(
      "Capture team decisions with explicit owner and outcome.",
    );
    expect(
      parsed.data.candidateOverview.topology.relationCounts
        .actor_triggers_command,
    ).toBe(1);
    expect(parsed.data.candidateOverview.nextAction.label).toBe(
      "Resolve repair blockers",
    );
    expect(parsed.data.preSib.findings[0].findingId).toBe(
      "pre_sib_ontology_coverage_gap",
    );
    expect(parsed.data.repairLoop.actions[1].status).toBe("requires_context");
    expect(parsed.data.repairSession.sourceMode).toBe("journal");
    expect(parsed.data.repairSession.session.sessionId).toBe(
      "repair-session.team-decision-log",
    );
    expect(
      parsed.data.repairSession.readinessImpact.unresolvedOntologyGapCount,
    ).toBe(7);
    expect(parsed.data.repairSession.openBlockers[2].id).toBe(
      "candidate_not_ready_for_approval",
    );
    expect(parsed.data.repairSession.acceptedAnswers[0].answerKind).toBe(
      "propose_project_local_term",
    );
    expect(parsed.data.repairReview.clarificationRequests.requests[0].kind).toBe(
      "ontology_gap",
    );
    expect(parsed.data.repairReview.ontologyDecisions.decisions[0].decisionType).toBe(
      "propose_project_local_term",
    );
    expect(
      parsed.data.repairReview.rerunPreview.candidateQualityPreview.reviewState,
    ).toBe("candidate_quality_improved");
    expect(
      parsed.data.repairReview.rerunMaterialization.delta.removedGapIds,
    ).toEqual(["ontology-gap.numeric-input"]);
    expect(parsed.data.repairReview.platformExecution.available).toBe(true);
    expect(parsed.data.repairReview.platformExecution.execution.status).toBe(
      "completed",
    );
    expect(
      parsed.data.repairReview.platformExecution.execution.operations[0].name,
    ).toBe("execute_specgraph_requested_rerun");
    expect(parsed.data.repairReview.platformExecution.publication.status).toBe(
      "published",
    );
    expect(parsed.data.workspaceStateHygiene.status).toBe("blocked");
    expect(parsed.data.workspaceStateHygiene.staleStateCount).toBe(1);
    expect(parsed.data.workspaceStateHygiene.states[1].kind).toBe(
      "repair_rerun_request",
    );
    expect(parsed.data.workspaceStateHygiene.states[1].reason).toBe(
      "workspace_id_mismatch",
    );
    expect(
      parsed.data.repairReview.platformExecution.actionBoundary
        .mayExecutePlatformAdapter,
    ).toBe(false);
    expect(parsed.data.ideaMaturity.status).toBe("available");
    expect(parsed.data.ideaMaturity.trusted).toBe(true);
    expect(parsed.data.ideaMaturity.report.derivedState.lifecycleState).toBe(
      "repair_required",
    );
    expect(
      parsed.data.ideaMaturity.report.metrics.ontologyGapResolutionRate,
    ).toBe(1);
    expect(
      parsed.data.ideaMaturity.report.metrics.projectLocalOntologyReview.status,
    ).toBe("project_local_ontology_decision_effect_ready");
    expect(
      parsed.data.ideaMaturity.report.metrics.projectLocalOntologyReview
        .acceptedDecisionCount,
    ).toBe(2);
    expect(
      parsed.data.ideaMaturity.report.metrics.projectLocalOntologyReview
        .keepProjectLocalCount,
    ).toBe(1);
    expect(
      parsed.data.ideaMaturity.report.metrics.projectLocalOntologyReview
        .bindExistingCount,
    ).toBe(1);
    expect(
      parsed.data.ideaMaturity.report.metrics.projectLocalOntologyReview
        .readyForMaturity,
    ).toBe(true);
    expect(
      parsed.data.ideaMaturity.report.metrics.timeToApprovalReadySeconds,
    ).toBeNull();
    expect(parsed.data.ideaMaturity.report.contract.schemaRef).toBe(
      "schemas/idea_maturity_metrics_report.schema.json",
    );
    expect(
      parsed.data.ideaMaturity.report.contract.validationReportSchemaRef,
    ).toBe("schemas/idea_maturity_metrics_validation_report.schema.json");
    expect(parsed.data.ideaMaturity.report.contract.validatorVersion).toBe("0.1.0");
    expect(parsed.data.ideaMaturity.report.contract.compatibilityPolicy).toBe(
      "additive_v1",
    );
    expect(parsed.data.ideaMaturity.validation.validator.version).toBe("0.1.0");
    expect(parsed.data.ideaMaturity.validation.validator.schemaRef).toBe(
      "schemas/idea_maturity_metrics_report.schema.json",
    );
    expect(
      parsed.data.ideaMaturity.validation.validator.validationReportSchemaRef,
    ).toBe("schemas/idea_maturity_metrics_validation_report.schema.json");
    expect(parsed.data.ideaMaturity.report.readinessExplainers[0].id).toBe(
      "readiness-explainer.pre-sib-ontology-coverage-gap",
    );
    expect(parsed.data.ideaMaturity.report.readinessExplainers[0].kind).toBe(
      "pre_sib_finding",
    );
    expect(parsed.data.ideaMaturity.report.readinessExplainers[0].blocks).toEqual([
      "pre_sib_review",
      "candidate_approval",
    ]);
    expect(parsed.data.ideaMaturity.validation.reports[0].status).toBe("ok");
    expect(
      parsed.data.ideaMaturity.actionBoundary.mayRecalculateMetrics,
    ).toBe(false);
    expect(parsed.data.approvalReadiness.status).toBe("blocked");
    expect(parsed.data.approvalReadiness.readyForCandidateApproval).toBe(false);
    expect(parsed.data.approvalReadiness.promotionReviewCanBeRequested).toBe(
      false,
    );
    expect(parsed.data.approvalReadiness.resolvedOntologyGapCount).toBe(1);
    expect(parsed.data.approvalReadiness.unresolvedOntologyGapCount).toBe(7);
    expect(parsed.data.approvalReadiness.blockers[0]).toBe(
      "repair_context_required",
    );
    expect(
      parsed.data.approvalReadiness.actionBoundary
        .mayMaterializeCandidateApprovalDecision,
    ).toBe(false);
    expect(parsed.data.promotionGate.readiness.reviewState).toBe(
      "idea_to_spec_promotion_blocked",
    );
    expect(parsed.data.controlledPromotion.platformRequest.candidateBranch).toBe(
      "graph-candidate/idea-alpha",
    );
    expect(
      parsed.data.controlledPromotion.candidateApprovalExecution.status,
    ).toBe("candidate_approval_materialized");
    expect(
      parsed.data.controlledPromotion.candidateApprovalExecution
        .decisionWritten,
    ).toBe(true);
    expect(
      parsed.data.controlledPromotion.candidateApprovalExecution.operations[1]
        .status,
    ).toBe("succeeded");
    expect(parsed.data.controlledPromotion.candidateApproval.decisionState).toBe(
      "approved",
    );
    expect(parsed.data.controlledPromotion.productPromotionExecution.commitSha).toBe(
      "abc1234",
    );
    expect(
      parsed.data.controlledPromotion.productPromotionExecution.openReviewDryRun,
    ).toBe(true);
    expect(
      parsed.data.controlledPromotion.productPromotionExecution.diagnosticCount,
    ).toBe(0);
    expect(parsed.data.controlledPromotion.gitServiceExecution.operations[2].status).toBe(
      "dry_run",
    );
    expect(parsed.data.controlledPromotion.reviewStatus.reviewState).toBe("open");
    expect(parsed.data.controlledPromotion.reviewStatus.sourceMode).toBe(
      "product",
    );
    expect(parsed.data.controlledPromotion.reviewStatus.reviewNumber).toBe(12);
    expect(parsed.data.controlledPromotion.reviewStatus.baseBranch).toBe("main");
    expect(parsed.data.controlledPromotion.reviewStatus.nextAction).toBe(
      "wait_for_review_merge",
    );
    expect(
      parsed.data.controlledPromotion.reviewStatus.operations[1].name,
    ).toBe("inspect_review_status");
    expect(parsed.data.controlledPromotion.readModelPublication.published).toBe(
      false,
    );
    expect(parsed.data.controlledPromotion.readModelPublication.sourceMode).toBe(
      "product",
    );
    expect(parsed.data.controlledPromotion.readModelPublication.status).toBe(
      "dry_run",
    );
    expect(parsed.data.controlledPromotion.readModelPublication.nextAction).toBe(
      "run_real_read_model_publication",
    );
    expect(
      parsed.data.controlledPromotion.readModelPublication
        .productReviewStatusReportRef,
    ).toBe("runs/product_candidate_promotion_review_status_report.json");
    expect(parsed.data.authorityBoundary.mayMutateCanonicalSpecs).toBe(false);
  });

  it("parses project-local ontology review lane terms", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.summary.project_local_ontology_term_count = 1;
    payload.project_local_ontology_review = {
      available: true,
      readiness: {
        ready: false,
        review_state: "project_local_ontology_review_required",
        blocked_by: ["project_local_ontology_terms_unreviewed"],
        next_artifact: "SpecSpace project-local ontology review lane",
      },
      summary: {
        status: "project_local_ontology_review_required",
        term_count: 1,
        reviewed_term_count: 0,
        blocking_term_count: 1,
        unreviewed_term_count: 1,
        deferred_term_count: 0,
        status_counts: { unreviewed: 1 },
      },
      context: {
        workspace_id: "team-decision-log",
        candidate_id: "team-decision-log",
        repair_session_id: "repair-session.team-decision-log",
        workflow_lane: "product_idea_to_spec",
        domain_refs: ["domain.team-decision-log"],
        context_refs: ["context.idea-to-spec"],
        ontology_refs: ["ontology://specgraph-core"],
      },
      source_artifacts: {
        candidate_graph: { source_ref: "runs/candidate_spec_graph.json" },
      },
      supported_actions: ["keep_project_local", "bind_existing"],
      authority: "operator_intent_only",
      request_workspace_promotion_effect: "proposal_only_no_ontology_write",
      term_count: 1,
      reviewed_term_count: 0,
      blocking_term_count: 1,
      unreviewed_term_count: 1,
      deferred_term_count: 0,
      status_counts: { unreviewed: 1 },
      terms: [
        {
          id: "project-local-ontology-term.decision-record",
          term: "Decision Record",
          term_key: "decisionrecord",
          status: "unreviewed",
          selected_decision_id: null,
          source_refs: ["command.record-decision"],
          suggested_actions: ["keep_project_local", "bind_existing"],
          evidence_refs: ["runs/candidate_spec_graph.json"],
          gap_refs: [
            {
              gap_id: "ontology-gap.decision-record",
              node_id: "candidate-spec.decision-record",
              target_ref:
                "candidate-spec.decision-record.gaps.ontology-gap.decision-record",
              statement: "Decision Record needs review.",
            },
          ],
          resolved_gap_refs: [],
          decisions: [],
          effect: {
            candidate_readiness_effect: "blocks_until_reviewed",
            next_action: "choose_project_local_ontology_decision",
          },
        },
      ],
      findings: [
        {
          finding_id: "project_local_ontology_terms_unreviewed",
          severity: "review_required",
          message: "Some terms need review.",
        },
      ],
      warnings: [],
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_apply_decisions: false,
        may_mutate_candidate_artifacts: false,
        may_accept_ontology_terms: false,
        may_write_ontology_package: false,
        may_create_branch_or_commit: false,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.projectLocalOntologyReview.available).toBe(true);
    expect(parsed.data.projectLocalOntologyReview.termCount).toBe(1);
    expect(parsed.data.projectLocalOntologyReview.terms[0]?.termKey).toBe(
      "decisionrecord",
    );
    expect(
      parsed.data.projectLocalOntologyReview.terms[0]?.effect
        .candidateReadinessEffect,
    ).toBe("blocks_until_reviewed");
  });

  it("parses project-local ontology decision import preview", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.summary.project_local_ontology_import_accepted_count = 1;
    payload.summary.project_local_ontology_import_missing_count = 0;
    payload.summary.project_local_ontology_import_invalid_count = 1;
    payload.project_local_ontology_decision_import_preview = {
      available: true,
      readiness: {
        ready: false,
        review_state: "project_local_ontology_decision_import_review_required",
        blocked_by: ["project_local_decision_invalid_decisionrecord"],
        next_artifact: "SpecSpace project-local ontology review decisions",
      },
      summary: {
        status: "project_local_ontology_decision_import_review_required",
        decision_count: 2,
        accepted_decision_count: 1,
        non_resolving_decision_count: 0,
        invalid_decision_count: 1,
        missing_decision_count: 0,
        finding_count: 1,
      },
      decision_count: 2,
      accepted_decision_count: 1,
      non_resolving_decision_count: 0,
      invalid_decision_count: 1,
      missing_decision_count: 0,
      finding_count: 1,
      context: {
        workspace_id: "team-decision-log",
        candidate_id: "team-decision-log",
        repair_session_id: "repair-session.team-decision-log",
        workflow_lane: "product_idea_to_spec",
        domain_refs: ["domain.team-decision-log"],
        context_refs: ["context.idea-to-spec"],
        ontology_refs: ["ontology://specgraph-core"],
      },
      source_artifacts: {
        decision_state: {
          source_ref:
            "specspace-state://project_local_ontology_review_decisions.json",
        },
      },
      accepted_decisions: [
        {
          id: "specspace-project-local-ontology-import.decisionrecord.keep",
          source_decision_id: "project-local-decision.decisionrecord",
          source_artifact:
            "specspace-state://project_local_ontology_review_decisions.json",
          decision_type: "propose_project_local_term",
          review_action: "keep_project_local",
          status: "accepted_for_project_local_preview",
          materialization_intent: "review_overlay_only",
          term: "Decision Record",
          term_key: "decisionrecord",
          target_ref: "candidate-spec.decision-record.gaps.ontology-gap",
          gap_refs: [
            {
              gap_id: "ontology-gap.decision-record",
              node_id: "candidate-spec.decision-record",
              target_ref: "candidate-spec.decision-record.gaps.ontology-gap",
            },
          ],
          decision_value: {
            term: "Decision Record",
            reason: "Keep as project-local.",
          },
          writes_ontology_package: false,
          accepts_ontology_terms: false,
          applies_to_specgraph: false,
        },
      ],
      non_resolving_decisions: [],
      invalid_decisions: [
        {
          id: "project-local-decision.bad",
          decision_id: "project-local-decision.bad",
          term_key: "decisionrecord",
          action: "bind_existing",
          reason: "bind_existing_requires_ontology_ref",
        },
      ],
      missing_decisions: [],
      decision_candidates: [
        {
          id: "specspace-project-local-ontology-import.decisionrecord.keep",
          decision_type: "propose_project_local_term",
          review_action: "keep_project_local",
          term: "Decision Record",
          term_key: "decisionrecord",
          writes_ontology_package: false,
          accepts_ontology_terms: false,
          applies_to_specgraph: false,
        },
      ],
      findings: [
        {
          finding_id: "project_local_decision_invalid_decisionrecord",
          severity: "blocking",
          message: "Decision failed validation.",
        },
      ],
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_apply_decisions: false,
        may_mutate_candidate_artifacts: false,
        may_accept_ontology_terms: false,
        may_write_ontology_package: false,
        may_create_branch_or_commit: false,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    const preview = parsed.data.projectLocalOntologyDecisionImportPreview;
    expect(preview.available).toBe(true);
    expect(preview.acceptedDecisionCount).toBe(1);
    expect(preview.invalidDecisionCount).toBe(1);
    expect(preview.acceptedDecisions[0]?.termKey).toBe("decisionrecord");
    expect(preview.invalidDecisions[0]?.reason).toBe(
      "bind_existing_requires_ontology_ref",
    );
    expect(preview.findings[0]?.findingId).toBe(
      "project_local_decision_invalid_decisionrecord",
    );
    expect(parsed.data.summary.projectLocalOntologyImportInvalidCount).toBe(1);
  });

  it("rejects authority expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      authority_boundary: {
        ...ideaToSpecWorkspace.authority_boundary,
        may_mutate_canonical_specs: true,
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects project-local ontology import preview authority expansion", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.project_local_ontology_decision_import_preview = {
      available: true,
      action_boundary: {
        inspect_only: true,
        acknowledge_only: true,
        may_apply_decisions: true,
        may_mutate_candidate_artifacts: false,
        may_accept_ontology_terms: false,
        may_write_ontology_package: false,
        may_create_branch_or_commit: false,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects controlled promotion action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      controlled_promotion: {
        ...ideaToSpecWorkspace.controlled_promotion,
        action_boundary: {
          ...ideaToSpecWorkspace.controlled_promotion.action_boundary,
          may_execute_git_service: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects candidate overview action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      candidate_overview: {
        ...ideaToSpecWorkspace.candidate_overview,
        action_boundary: {
          ...ideaToSpecWorkspace.candidate_overview.action_boundary,
          may_execute_specgraph: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects repair session action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      repair_session: {
        ...ideaToSpecWorkspace.repair_session,
        action_boundary: {
          ...ideaToSpecWorkspace.repair_session.action_boundary,
          may_apply_decisions: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("parses legacy responses without a repair session surface", () => {
    const legacyWorkspace: Record<string, unknown> = { ...ideaToSpecWorkspace };
    delete legacyWorkspace.repair_session;
    const parsed = parseIdeaToSpecWorkspace(legacyWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.repairSession.available).toBe(false);
    expect(parsed.data.repairSession.sourceMode).toBe("legacy_artifacts");
  });

  it("parses legacy responses without approval readiness", () => {
    const legacyWorkspace: Record<string, unknown> = { ...ideaToSpecWorkspace };
    delete legacyWorkspace.approval_readiness;
    const parsed = parseIdeaToSpecWorkspace(legacyWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.approvalReadiness.available).toBe(false);
    expect(parsed.data.approvalReadiness.sourceMode).toBe("standard");
  });

  it("parses legacy responses without idea maturity", () => {
    const legacyWorkspace: Record<string, unknown> = { ...ideaToSpecWorkspace };
    delete legacyWorkspace.idea_maturity;
    const parsed = parseIdeaToSpecWorkspace(legacyWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.ideaMaturity.available).toBe(false);
    expect(parsed.data.ideaMaturity.status).toBe("missing");
    expect(parsed.data.ideaMaturity.trusted).toBe(false);
  });

  it("parses legacy idea maturity reports without contract metadata", () => {
    const legacyIdeaMaturity: Record<string, unknown> = {
      ...ideaToSpecWorkspace.idea_maturity,
    };
    const legacyReport: Record<string, unknown> = {
      ...ideaToSpecWorkspace.idea_maturity.report,
    };
    delete legacyReport.contract;
    legacyIdeaMaturity.report = legacyReport;
    const legacyWorkspace: Record<string, unknown> = {
      ...ideaToSpecWorkspace,
      idea_maturity: legacyIdeaMaturity,
    };
    const parsed = parseIdeaToSpecWorkspace(legacyWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.ideaMaturity.status).toBe("available");
    expect(parsed.data.ideaMaturity.report.contract.schemaRef).toBeNull();
    expect(
      parsed.data.ideaMaturity.report.contract.validationReportSchemaRef,
    ).toBeNull();
    expect(parsed.data.ideaMaturity.validation.validator.schemaRef).toBe(
      "schemas/idea_maturity_metrics_report.schema.json",
    );
  });

  it("parses idea maturity finding next actions", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      idea_maturity: {
        ...ideaToSpecWorkspace.idea_maturity,
        report: {
          ...ideaToSpecWorkspace.idea_maturity.report,
          findings: [
            {
              finding_id: "maturity.pre_sib.blocker",
              severity: "warning",
              message: "Candidate is blocked by Pre-SIB finding.",
              source: "pre_sib",
              next_action: "Inspect Pre-SIB coherence findings.",
            },
          ],
        },
      },
    });

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.ideaMaturity.report.findings[0].nextAction).toBe(
      "Inspect Pre-SIB coherence findings.",
    );
  });

  it("parses workspace state recommended actions", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(
      parsed.data.workspaceStateHygiene.enabledRecommendedActionCount,
    ).toBe(1);
    expect(parsed.data.workspaceStateHygiene.recommendedActions[0]).toMatchObject({
      id: "workspace_state.recreate_repair_rerun_request",
      enabled: true,
      targetState: "repair_rerun_request",
      uiIntent: "create_repair_rerun_request",
    });
  });

  it("rejects repair review action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      repair_review: {
        ...ideaToSpecWorkspace.repair_review,
        action_boundary: {
          ...ideaToSpecWorkspace.repair_review.action_boundary,
          may_accept_ontology_terms: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects approval readiness action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      approval_readiness: {
        ...ideaToSpecWorkspace.approval_readiness,
        action_boundary: {
          ...ideaToSpecWorkspace.approval_readiness.action_boundary,
          may_execute_git_service: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects idea maturity action expansion", () => {
    const parsed = parseIdeaToSpecWorkspace({
      ...ideaToSpecWorkspace,
      idea_maturity: {
        ...ideaToSpecWorkspace.idea_maturity,
        action_boundary: {
          ...ideaToSpecWorkspace.idea_maturity.action_boundary,
          may_execute_metrics_validator: true,
        },
      },
    });

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects guided flow action expansion", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.guided_flow.authority_boundary.may_execute_platform = true;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toBe("guided flow boundary expanded");
  });

  it("keeps real idea continuation unknown counts and drops malformed actions", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete payload.intake_clarification.answer_continuation.import_preview
      .accepted_answer_count;
    payload.intake_clarification.answer_continuation.recommended_actions = [
      {
        label: "Malformed action",
        next_action: "This action has no stable id.",
      },
      {
        id: "valid-action",
        label: "Valid action",
        next_action: "Use the stable action.",
      },
    ];

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    const continuation = parsed.data.intakeClarification.answerContinuation;
    expect(continuation.importPreview.acceptedAnswerCount).toBeNull();
    expect(continuation.recommendedActions).toHaveLength(1);
    expect(continuation.recommendedActions[0].id).toBe("valid-action");
  });

  it("rejects workspace state hygiene without explicit boundary false flags", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete payload.workspace_state_hygiene.authority_boundary.may_execute_platform;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toContain(
      "workspace state hygiene boundary must explicitly disable: may_execute_platform",
    );
  });

  it("rejects workspace state recommended action authority expansion", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.workspace_state_hygiene.recommended_actions[0].authority_boundary.may_execute_platform = true;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toBe(
      "workspace state hygiene recommended action boundary expanded: may_execute_platform",
    );
  });
});
