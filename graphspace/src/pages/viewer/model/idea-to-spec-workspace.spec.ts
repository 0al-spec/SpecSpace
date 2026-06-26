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
    expect(parsed.data.workflow.items).toHaveLength(15);
    expect(parsed.data.workflow.items[2].id).toBe("ontology_seed");
    expect(parsed.data.workflow.items[6].id).toBe(
      "product_repair_rerun_execution",
    );
    expect(parsed.data.workflow.items[7].id).toBe(
      "product_repair_rerun_publication",
    );
    expect(parsed.data.workflow.nextHandoff.kind).toBe("operator_repair_review");
    expect(parsed.data.workflow.nextHandoff.authorityBoundary).toBe("operator_only");
    expect(parsed.data.intake.activeFrame.project).toBe("DemoCalculator");
    expect(parsed.data.ontologySeed.readiness.ready).toBe(true);
    expect(parsed.data.ontologySeed.summary.ontologyBindingCount).toBe(5);
    expect(parsed.data.ontologySeed.gaps[0].id).toBe("ontology-gap.numeric-input");
    expect(parsed.data.ontologySeed.bindings[0].term).toBe("Spec");
    expect(parsed.data.candidateGraph.nodes[1].id).toBe(
      "candidate-spec.numeric-input",
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
    expect(
      parsed.data.repairReview.platformExecution.actionBoundary
        .mayExecutePlatformAdapter,
    ).toBe(false);
    expect(parsed.data.promotionGate.readiness.reviewState).toBe(
      "idea_to_spec_promotion_blocked",
    );
    expect(parsed.data.controlledPromotion.platformRequest.candidateBranch).toBe(
      "graph-candidate/idea-alpha",
    );
    expect(parsed.data.controlledPromotion.candidateApproval.decisionState).toBe(
      "approved",
    );
    expect(parsed.data.controlledPromotion.gitServiceExecution.operations[2].status).toBe(
      "dry_run",
    );
    expect(parsed.data.controlledPromotion.reviewStatus.reviewState).toBe("open");
    expect(parsed.data.controlledPromotion.readModelPublication.published).toBe(
      false,
    );
    expect(parsed.data.authorityBoundary.mayMutateCanonicalSpecs).toBe(false);
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
});
