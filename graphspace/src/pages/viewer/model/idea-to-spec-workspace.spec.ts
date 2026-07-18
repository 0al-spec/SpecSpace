import { describe, expect, it } from "vitest";
import { buildCandidateWorkflowTopology } from "./candidate-workflow-topology";
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
    expect(parsed.data.guidedFlow.stages).toHaveLength(12);
    expect(parsed.data.guidedFlow.stages[1].id).toBe("intake_clarification");
    expect(parsed.data.guidedFlow.stages[1].status).toBe("completed");
    expect(parsed.data.guidedFlow.stages[1].commandTemplate).toBeNull();
    expect(parsed.data.guidedFlow.stages[3].blockers).toEqual([
      "workspace_id_mismatch",
    ]);
    expect(
      parsed.data.guidedFlow.authorityBoundary.mayExecutePlatform,
    ).toBe(false);
    expect(parsed.data.productWorkspaceOverview.available).toBe(true);
    expect(parsed.data.productWorkspaceOverview.status).toBe("blocked");
    expect(parsed.data.productWorkspaceOverview.currentPhase).toBe("repair");
    expect(parsed.data.productWorkspaceOverview.nextSafeAction).toBe(
      "Replace the rerun request for the current workspace and repair session.",
    );
    expect(parsed.data.productWorkspaceOverview.actionRanking.available).toBe(true);
    expect(parsed.data.productWorkspaceOverview.actionRanking.policyId).toBe(
      "specspace.product-workspace.quality-guided-next-action.v0.1",
    );
    expect(
      parsed.data.productWorkspaceOverview.actionRanking.primaryAction.category,
    ).toBe("state_hygiene");
    expect(
      parsed.data.productWorkspaceOverview.actionRanking.primaryAction.rank,
    ).toBe(1);
    expect(
      parsed.data.productWorkspaceOverview.actionRanking.secondaryActions.map(
        (action) => action.category,
      ),
    ).toEqual(["clarification_repair", "approval"]);
    expect(parsed.data.productWorkspaceOverview.phases).toHaveLength(7);
    expect(parsed.data.productWorkspaceOverview.phases[4].id).toBe("repair");
    expect(parsed.data.productWorkspaceOverview.phases[4].state).toBe("blocked");
    expect(
      parsed.data.productWorkspaceOverview.lastSuccessfulHandoff.stageId,
    ).toBe("candidate_graph");
    expect(
      parsed.data.productWorkspaceOverview.authorityBoundary.mayExecutePlatform,
    ).toBe(false);
    expect(parsed.data.managedOperations.available).toBe(false);
    expect(parsed.data.managedOperations.operations).toHaveLength(0);
    expect(parsed.data.managedModeReadiness.available).toBe(false);
    expect(parsed.data.managedModeReadiness.status).toBe("missing");
    expect(parsed.data.guidedRepairPath.available).toBe(true);
    expect(parsed.data.guidedRepairPath.stage).toBe("ready_to_request_rerun");
    expect(parsed.data.guidedRepairPath.nextAction).toBe(
      "Request a controlled repair rerun.",
    );
    expect(parsed.data.guidedRepairPath.counts.acceptedAnswerCount).toBe(1);
    expect(parsed.data.guidedRepairPath.counts.unresolvedOntologyGapCount).toBe(7);
    expect(parsed.data.guidedRepairPath.state.rerunRequestStatus).toBeNull();
    expect(parsed.data.guidedRepairPath.checkpoints.map((item) => item.id)).toEqual([
      "product_spec_answers",
      "ontology_decisions",
      "project_local_ontology_review",
      "rerun_request",
      "repaired_handoff",
    ]);
    expect(parsed.data.guidedRepairPath.checkpoints[3].label).toBe(
      "Rerun request",
    );
    expect(parsed.data.guidedRepairPath.checkpoints[3].count).toBeNull();
    expect(
      parsed.data.guidedRepairPath.authorityBoundary.mayExecutePlatform,
    ).toBe(false);
    expect(parsed.data.realIdeaIntake.status).toBe("active_candidate_ready");
    expect(parsed.data.realIdeaIntake.clarificationProgress.questionCount).toBe(1);
    expect(parsed.data.realIdeaIntake.clarificationProgress.answeredCount).toBe(1);
    expect(parsed.data.realIdeaIntake.answerTemplate.requiredFields).toEqual([
      "value.follow_up",
      "value.refs[]",
    ]);
    expect(parsed.data.realIdeaIntake.continuationHandoff.safeToContinue).toBe(true);
    expect(parsed.data.realIdeaIntake.authorityBoundary.mayExecuteSpecgraph).toBe(false);
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
    expect(parsed.data.candidateOverview.candidateNodes.aliasCount).toBe(2);
    expect(
      parsed.data.candidateOverview.candidateNodes.aliasByNodeId[
        "candidate-spec.numeric-input"
      ],
    ).toBe("Capture numeric input");
    expect(parsed.data.candidateOverview.candidateNodes.nodes[1].label).toBe(
      "Capture numeric input",
    );
    expect(parsed.data.candidateOverview.topology.edges[0].toDisplayAlias).toBe(
      "Record a decision",
    );
    expect(parsed.data.candidateOverview.ontologyApplicability.status).toBe(
      "change_review_required",
    );
    expect(
      parsed.data.candidateOverview.ontologyApplicability.profiles[0].appliesTo
        .lifecyclePhases,
    ).toEqual(["draft_spec_authoring"]);
    expect(
      parsed.data.candidateOverview.ontologyApplicability.profiles[0].appliesTo
        .contexts,
    ).toEqual(["idea_to_spec"]);
    expect(
      parsed.data.candidateOverview.ontologyApplicability.profiles[0].assumptions[0]
        .text,
    ).toBe("Candidate interpretation remains review-only.");
    expect(
      parsed.data.candidateOverview.ontologyApplicability.changeClassification
        .classifiedChangeCount,
    ).toBe(2);
    expect(
      parsed.data.candidateOverview.ontologyApplicability.changeClassification
        .matchedPackageRefs,
    ).toEqual(["org.0al.specgraph.core@0.1.0"]);
    expect(
      parsed.data.candidateOverview.ontologyApplicability.changeClassification
        .structuralChanges[0],
    ).toMatchObject({
      targetKind: "class",
      before: "missing",
      after: "Spec",
      compatibility: "compatible",
    });
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

  it("parses managed operations observability", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_operations_observability = {
      available: true,
      surface_id: "specspace.managed-operations.observability.v0.1",
      surface_kind: "managed_operations_observability",
      summary: {
        operation_count: 1,
        completed_count: 1,
        failed_count: 0,
        stale_count: 0,
        request_needed_count: 0,
        new_request_required_count: 0,
        ready_to_execute_count: 0,
        gate_needed_count: 0,
      },
      status_counts: { completed: 1 },
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
          status: "completed",
          target_section: "idea-to-spec-workspace-initialization-path",
          next_safe_action: "Inspect the durable execution report.",
          input_refs: [
            {
              ref: "runs/product_workspace_initialization_execution_request.json",
              kind: "run_artifact",
              available: true,
              status: "ready",
            },
          ],
          output_reports: [
            {
              ref: "runs/platform_product_workspace_initialization_execution_report.json",
              kind: "run_artifact",
              available: true,
              status: "completed",
            },
          ],
          missing_input_refs: [],
          available_output_refs: [
            "runs/platform_product_workspace_initialization_execution_report.json",
          ],
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

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.managedOperations.available).toBe(true);
    expect(parsed.data.managedOperations.summary.operationCount).toBe(1);
    expect(parsed.data.managedOperations.groups[0].phase).toBe("workspace");
    expect(parsed.data.managedOperations.operations[0].status).toBe("completed");
    expect(parsed.data.managedOperations.operations[0].availableOutputRefs).toEqual([
      "runs/platform_product_workspace_initialization_execution_report.json",
    ]);
  });

  it("rejects managed operations observability authority expansion", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_operations_observability = {
      available: true,
      operations: [],
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_operations_observability_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: true,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toContain("managed operations observability");
  });

  it("rejects unknown managed operations authority flags", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_operations_observability = {
      available: true,
      operations: [
        {
          authority_boundary: {
            ...raw.guided_flow.authority_boundary,
            managed_operations_observability_is_authority: false,
            may_run_shell: false,
            may_publish_read_model: false,
            may_apply_answers: true,
          },
        },
      ],
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_operations_observability_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: false,
        may_apply_answers: true,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toContain("managed operations observability");
  });

  it("parses managed mode readiness", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_mode_readiness = {
      available: true,
      surface_id: "specspace.managed-mode.readiness.v0.1",
      surface_kind: "managed_mode_readiness",
      status: "read_only",
      mode: "read_only",
      next_safe_action: "Inspect workspace state or create request-only intents.",
      disabled_reasons: ["platform_execution_disabled"],
      executor: {
        enabled: false,
        configured: false,
        platform_dir_configured: false,
        platform_cli_present: false,
        timeout_seconds: 120,
      },
      operations: {
        registered_count: 12,
        enabled_count: 0,
        disabled_count: 12,
      },
      state: {
        specspace_state_dir_configured: true,
        specspace_state_dir_ready: true,
      },
      provider: {
        status: "ok",
        kind: "http-product-workspace",
        read_only: true,
      },
      workspace: {
        workspace_id: "team-decision-log",
        product_workspace: true,
        product_workspace_artifact_base_configured: true,
        artifact_base_status: "configured",
      },
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_mode_readiness_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: false,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.managedModeReadiness.available).toBe(true);
    expect(parsed.data.managedModeReadiness.status).toBe("read_only");
    expect(parsed.data.managedModeReadiness.executor.configured).toBe(false);
    expect(parsed.data.managedModeReadiness.operations.disabledCount).toBe(12);
    expect(parsed.data.managedModeReadiness.disabledReasons).toEqual([
      "platform_execution_disabled",
    ]);
  });

  it("parses hosted managed readiness and queue transport telemetry", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_mode_readiness = {
      available: true,
      surface_id: "specspace.managed-mode.readiness.v0.1",
      surface_kind: "managed_mode_readiness",
      status: "hosted_managed_ready",
      mode: "hosted_managed",
      next_safe_action: "Enqueue the next allowlisted operation.",
      disabled_reasons: [],
      executor: {
        enabled: true,
        configured: true,
        transport: "hosted_queue",
        platform_dir_configured: false,
        platform_cli_present: false,
        timeout_seconds: 5,
        hosted_enabled: true,
        hosted_service_configured: true,
        hosted_service_reachable: true,
        hosted_enabled_operation_ids: ["review_status_execute"],
        hosted_service_operation_ids: [
          "promotion_execute_dry_run",
          "review_status_execute",
        ],
        hosted_client_operation_ids: ["review_status_execute"],
      },
      operations: { registered_count: 12, enabled_count: 1, disabled_count: 11 },
      state: {
        durability: "ephemeral",
        restart_persistent: false,
        provider_kind: "file",
        provider_status: "ready",
        provider_ready: true,
        provider_contract_ref: null,
        provider_adapter: null,
        external_required: false,
      },
      provider: { status: "ok", kind: "local", read_only: false },
      workspace: { workspace_id: "pantry-control", product_workspace: true },
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_mode_readiness_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: false,
      },
    };
    raw.managed_operations_observability = {
      available: true,
      surface_id: "specspace.managed-operations.observability.v0.1",
      surface_kind: "managed_operations_observability",
      summary: { operation_count: 1 },
      groups: [],
      operations: [
        {
          operation_id: "workspace_initialization_execute",
          category: "workspace",
          lifecycle_stage: "workspace_initialization",
          ui_stage: "Workspace initialization",
          endpoint: "/api/v1/product-workspace-initialization/execute",
          platform_command: ["workspace", "execute-requested-initialization"],
          status: "running_or_waiting",
          input_refs: [],
          output_reports: [],
          hosted_transport: {
            available: true,
            status: "running",
            request_id:
              "managed-operation://pantry-control/workspace_initialization_execute/abc",
            attempt: 1,
            output_reports: [],
            transport_status_is_lifecycle_evidence: false,
          },
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

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.managedModeReadiness.mode).toBe("hosted_managed");
    expect(parsed.data.managedModeReadiness.executor.transport).toBe(
      "hosted_queue",
    );
    expect(parsed.data.managedModeReadiness.executor.hostedServiceReachable).toBe(
      true,
    );
    expect(
      parsed.data.managedModeReadiness.executor.hostedClientOperationIds,
    ).toEqual(["review_status_execute"]);
    expect(
      parsed.data.managedModeReadiness.executor.hostedServiceOperationIds,
    ).toEqual(["promotion_execute_dry_run", "review_status_execute"]);
    expect(parsed.data.managedModeReadiness.state.durability).toBe("ephemeral");
    expect(parsed.data.managedModeReadiness.state.restartPersistent).toBe(false);
    expect(parsed.data.managedModeReadiness.state.providerKind).toBe("file");
    expect(parsed.data.managedModeReadiness.state.providerReady).toBe(true);
    expect(parsed.data.managedModeReadiness.state.externalRequired).toBe(false);
    expect(
      parsed.data.managedOperations.operations[0].hostedTransport.status,
    ).toBe("running");
    expect(
      parsed.data.managedOperations.operations[0].hostedTransport
        .transportStatusIsLifecycleEvidence,
    ).toBe(false);
  });

  it("rejects managed mode readiness authority expansion", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.managed_mode_readiness = {
      available: true,
      authority_boundary: {
        ...raw.guided_flow.authority_boundary,
        managed_mode_readiness_is_authority: false,
        may_run_shell: false,
        may_publish_read_model: false,
        may_execute_platform: true,
      },
    };

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("parse-error");
    if (parsed.kind !== "parse-error") return;
    expect(parsed.reason).toContain("managed mode readiness");
  });

  it("maps legacy guided stage ids to fallback overview phases", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete raw.product_workspace_overview;
    raw.guided_flow.current_stage = "candidate_graph";
    raw.guided_flow.current_stage_label = "Candidate graph";
    raw.guided_flow.overall_status = "waiting_for_operator";

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.productWorkspaceOverview.available).toBe(false);
    expect(parsed.data.productWorkspaceOverview.currentPhase).toBe("candidate");
    expect(parsed.data.productWorkspaceOverview.currentPhaseLabel).toBe(
      "Candidate",
    );
    expect(
      parsed.data.productWorkspaceOverview.phases.find(
        (phase) => phase.id === "candidate",
      )?.state,
    ).toBe("current");
  });

  it("does not claim ranking availability without a valid primary action", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete raw.product_workspace_overview.action_ranking.primary_action;

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.productWorkspaceOverview.actionRanking.available).toBe(
      false,
    );
    expect(
      parsed.data.productWorkspaceOverview.actionRanking.primaryAction.id,
    ).toBe("quality.legacy_overview");
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
      effective_review: {
        available: true,
        readiness: {
          ready: true,
          review_state: "project_local_ontology_decision_effect_ready",
          blocked_by: [],
          next_artifact: "idea_maturity_metrics_report",
        },
        summary: {
          status: "project_local_ontology_decision_effect_ready",
          accepted_decision_count: 1,
          maturity_evidence_decision_count: 1,
          keep_project_local_count: 1,
          blocking_decision_count: 0,
          ready_for_maturity: true,
        },
        status: "project_local_ontology_decision_effect_ready",
        accepted_decision_count: 1,
        maturity_evidence_decision_count: 1,
        keep_project_local_count: 1,
        bind_existing_count: 0,
        alias_count: 0,
        request_promotion_count: 0,
        reject_count: 0,
        deferred_count: 0,
        non_resolving_decision_count: 0,
        invalid_decision_count: 0,
        missing_decision_count: 0,
        blocking_decision_count: 0,
        follow_up_decision_count: 0,
        effect_count: 1,
        ready_for_maturity: true,
        source_ref: "runs/project_local_ontology_decision_effect_report.json",
        action_boundary: {
          inspect_only: true,
          acknowledge_only: true,
          may_apply_decisions: false,
          may_mutate_candidate_artifacts: false,
          may_accept_ontology_terms: false,
          may_write_ontology_package: false,
          may_create_branch_or_commit: false,
        },
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
    expect(parsed.data.projectLocalOntologyReview.effectiveReview.available).toBe(
      true,
    );
    expect(parsed.data.projectLocalOntologyReview.effectiveReview.status).toBe(
      "project_local_ontology_decision_effect_ready",
    );
    expect(
      parsed.data.projectLocalOntologyReview.effectiveReview
        .blockingDecisionCount,
    ).toBe(0);
    expect(parsed.data.projectLocalOntologyReview.terms[0]?.termKey).toBe(
      "decisionrecord",
    );
    expect(
      parsed.data.projectLocalOntologyReview.terms[0]?.effect
        .candidateReadinessEffect,
    ).toBe("blocks_until_reviewed");
  });

  it("parses backend workspace initialization evidence", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.workspace_creation = {
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
    payload.workspace_initialization_path = {
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

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.workspaceCreation.status).toBe("workspace_initialized");
    expect(parsed.data.workspaceCreation.nextGap).toBe("start_real_idea_intake");
    expect(parsed.data.workspaceCreation.activeRequest?.status).toBe(
      "initialized",
    );
    expect(parsed.data.workspaceCreation.activeRequest?.rootIntentSummary).toBe(
      "Track pantry stock before food expires.",
    );
    expect(parsed.data.workspaceInitializationPath.status).toBe("initialized");
    expect(parsed.data.workspaceInitializationPath.initialIdeaPresent).toBe(true);
    expect(parsed.data.workspaceInitializationPath.nextSafeAction).toBe(
      "Start or continue raw idea intake in this workspace.",
    );
    expect(parsed.data.workspaceCreation.initialization).toMatchObject({
      available: true,
      trusted: true,
      initialized: true,
      requestStatus: "workspace_initialization_execution_requested",
      requestReadyForManagedExecution: true,
      requestedOperation: "workspace.execute-initialization-plan",
      idempotencyKey: "a".repeat(64),
      executionStatus: "workspace_initialization_executed",
      catalogWritten: true,
      workspaceFilesCreated: true,
    });
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

  it("sanitizes controlled promotion local display refs", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.controlled_promotion.candidate_approval_execution.gate_report_ref =
      "/Users/egor/Development/GitHub/0AL/SpecGraph/runs/platform_candidate_approval_intent_gate_report.json";
    payload.controlled_promotion.candidate_approval_execution.candidate_approval_decision_ref =
      "/Users/egor/Development/GitHub/0AL/SpecGraph/runs/candidate_approval_decision.json";
    payload.controlled_promotion.product_promotion_execution.workspace_dir =
      "/private/tmp/specgraph-product-promotion-review-worktree";
    payload.controlled_promotion.product_promotion_execution.repository_dir =
      "/Users/egor/Development/GitHub/0AL/SpecGraph";
    payload.controlled_promotion.product_promotion_execution.materialized_source_dir =
      "/Users/egor/Development/GitHub/0AL/SpecGraph/runs/materialized_candidate_specs";
    payload.controlled_promotion.product_promotion_execution.child_report_refs = {
      prepare_worktree:
        "/private/tmp/specgraph-product-promotion-review-worktree/.platform/graph_repository_worktree_prepare_report.json",
    };
    payload.controlled_promotion.review_status.graph_repository_review_status_report_ref =
      "/private/tmp/specgraph-product-promotion-review-worktree/.platform/graph_repository_review_status_report.json";
    payload.controlled_promotion.read_model_publication.output_dir =
      "/private/tmp/specgraph-read-model/team-decision-log";
    payload.controlled_promotion.read_model_publication.bundle_dir =
      "/Users/egor/Development/GitHub/0AL/SpecGraph/dist/specgraph-public";

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    const rendered = JSON.stringify(parsed.data.controlledPromotion);
    expect(rendered).not.toContain("/Users/");
    expect(rendered).not.toContain("/tmp/");
    expect(rendered).not.toContain("/private/tmp/");
    expect(rendered).toContain(
      "runs/platform_candidate_approval_intent_gate_report.json",
    );
    expect(rendered).toContain(
      "local:specgraph-product-promotion-review-worktree",
    );
    expect(rendered).toContain(
      ".platform/graph_repository_worktree_prepare_report.json",
    );
    expect(rendered).toContain("local:team-decision-log");
    expect(rendered).toContain("local:specgraph-public");
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

  it("rejects candidate overview ontology applicability authority expansion", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.candidate_overview.ontology_applicability.authority_boundary.may_infer_applicability =
      true;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects candidate overview ontology applicability with unknown authority", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.candidate_overview.ontology_applicability.authority_boundary.may_execute_runtime =
      true;

    const parsed = parseIdeaToSpecWorkspace(payload);

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

  it("parses idea maturity structural depth observations", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(
      parsed.data.ideaMaturity.report.metrics.candidateStructureDepth,
    ).toMatchObject({
      available: true,
      actorCount: 2,
      domainEventCount: 3,
      workflowEdgeCount: 8,
      acceptanceCriteriaCount: 8,
    });
  });

  it("parses structural depth repair effect from rerun materialization", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    const depthDelta =
      parsed.data.repairReview.rerunMaterialization.delta.structuralDepthDelta;
    expect(depthDelta).toMatchObject({
      available: true,
      proposalId: "0209",
      status: "improved",
      addedEventStormingEntryCount: 1,
      addedWorkflowRelationCount: 3,
      reviewOnly: true,
      canonicalMutationsAllowed: false,
      materializationDependency: false,
    });
    expect(depthDelta.delta.command_count).toBe(-1);
    expect(depthDelta.delta.workflow_edge_count).toBe(3);
    expect(depthDelta.addedEventStormingEntryRefs.actors).toEqual([
      "actor.shopping-planner",
    ]);
    expect(depthDelta.addedWorkflowRelations[0]).toMatchObject({
      relation: "command_emits_event",
      sourceRef: "command.record-pantry-item",
      targetRef: "event.pantry-item-recorded",
    });
  });

  it("preserves explicitly unavailable structural depth repair effect", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    raw.repair_review.rerun_materialization.delta.structural_depth_delta = {
      available: false,
      proposal_id: "0209",
      status: "missing",
      before: { actor_count: 9 },
      after: { actor_count: 9 },
      delta: { actor_count: 0 },
    };

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(
      parsed.data.repairReview.rerunMaterialization.delta.structuralDepthDelta,
    ).toMatchObject({
      available: false,
      proposalId: "0209",
      status: "missing",
    });
  });

  it("parses missing idea maturity structural depth as unpublished", () => {
    const raw = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete raw.idea_maturity.report.metrics.candidate_structure_depth;

    const parsed = parseIdeaToSpecWorkspace(raw);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(
      parsed.data.ideaMaturity.report.metrics.candidateStructureDepth,
    ).toMatchObject({
      available: false,
      actorCount: 0,
      workflowEdgeCount: 0,
    });
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

  it("rejects project-local ontology effective review authority expansion", () => {
    const payload: any = structuredClone(ideaToSpecWorkspace);
    payload.project_local_ontology_review = {
      ...payload.project_local_ontology_review,
      effective_review: {
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
      },
    };

    const parsed = parseIdeaToSpecWorkspace(payload);

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

  it("preserves real idea answer finding refs and next actions", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;

    const finding =
      parsed.data.intakeClarification.answerAuthoring.report.findings[0];
    expect(finding.findingId).toBe("answer_required_field_empty");
    expect(finding.targetRef).toBe(
      "clarification.intake.question-active-frame-domain-refs",
    );
    expect(finding.sourceRef).toBe(
      "runs/real_idea_smoke/real_idea_answer_set.json",
    );
    expect(finding.nextAction).toBe("Add at least one value.refs[] entry.");
  });

  it("preserves published workflow relation answer rows", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.intake_clarification.clarification_answers.answers = [
      {
        request_id: "clarification.depth.workflow-topology",
        answer_kind: "answer_question",
        status: "accepted_for_candidate",
        target_ref: "event_storming_hints.workflow_relations",
        relations: [
          {
            relation: "command_emits_event",
            source_ref: "command.record-pantry-item",
            target_ref: "event.pantry-item-recorded",
            rationale: "Pantry item creation emits the record event.",
          },
        ],
      },
    ];

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(
      parsed.data.intakeClarification.clarificationAnswers.answers[0].relations,
    ).toEqual([
      {
        relation: "command_emits_event",
        sourceRef: "command.record-pantry-item",
        targetRef: "event.pantry-item-recorded",
        rationale: "Pantry item creation emits the record event.",
      },
    ]);
  });

  it("preserves missing ontology applicability as not published evidence", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    delete payload.candidate_overview.ontology_applicability;

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.candidateOverview.ontologyApplicability.status).toBeNull();
    expect(parsed.data.candidateOverview.ontologyApplicability.profileCount).toBe(0);
    expect(parsed.data.candidateOverview.ontologyApplicability.reviewOnly).toBe(false);
  });

  it("builds a deterministic candidate workflow topology view", () => {
    const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;

    const topology = buildCandidateWorkflowTopology(
      parsed.data.candidateOverview,
    );

    expect(topology.columns.map((column) => column.id)).toEqual([
      "actors",
      "commands",
      "events",
      "policies",
      "constraints",
    ]);
    expect(topology.columns[0].nodes[0].label).toBe("Team member");
    expect(topology.columns[1].nodes[0].label).toBe("Record decision");
    expect(topology.edges[0].relationLabel).toBe("actor triggers command");
    expect(topology.edges[0].fromNode?.columnId).toBe("actors");
    expect(topology.edges[0].toNode?.columnId).toBe("commands");
    expect(topology.unresolvedEdges).toHaveLength(0);
    expect(topology.workflowEdgeCount).toBe(3);
  });

  it("keeps unresolved topology references visible for review", () => {
    const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace));
    payload.candidate_overview.topology.edges.push({
      id: "edge.unknown-event",
      relation: "event_informs_constraint",
      from: "event.unknown",
      to: "constraint.team-local",
      label: "Unknown event informs team-local constraint",
    });

    const parsed = parseIdeaToSpecWorkspace(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;

    const topology = buildCandidateWorkflowTopology(
      parsed.data.candidateOverview,
    );

    expect(topology.unresolvedEdges).toHaveLength(1);
    expect(topology.unresolvedEdges[0].relationLabel).toBe(
      "event informs constraint",
    );
    expect(topology.unresolvedEdges[0].unresolvedRefs).toEqual([
      "event.unknown",
    ]);
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
