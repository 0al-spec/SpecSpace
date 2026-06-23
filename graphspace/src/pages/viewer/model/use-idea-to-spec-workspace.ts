import { useEffect, useState } from "react";

export type IdeaToSpecArtifactStatus = {
  available: boolean;
  path: string;
  reason: string | null;
  artifactKind: string | null;
  status: string | null;
  proposalId: string | null;
  contractRef: string | null;
};

export type IdeaToSpecActiveFrame = {
  project: string | null;
  subsystem: string | null;
  agentLayer: string | null;
  targetArtifact: string | null;
  lifecyclePhase: string | null;
  ontologyRefs: readonly string[];
  ontologyLayerRefs: readonly string[];
  modelApplicabilityRefs: readonly string[];
  domainRefs: readonly string[];
  contextRefs: readonly string[];
};

export type IdeaToSpecCandidateNode = {
  id: string;
  title: string | null;
  kind: string | null;
  ontologyRefs: readonly string[];
  requirementCount: number;
  acceptanceCriteriaCount: number;
  claimCount: number;
  gapCount: number;
};

export type IdeaToSpecFinding = {
  findingId: string;
  severity: string;
  message: string;
  sourceRef: string | null;
};

export type IdeaToSpecRepairAction = {
  id: string;
  kind: string;
  status: string;
  targetRef: string | null;
  rationale: string | null;
  sourceFindings: readonly string[];
};

export type IdeaToSpecMaterializedFile = {
  candidateNodeId: string;
  materializedId: string;
  path: string;
  promotionPath: string;
};

export type IdeaToSpecPromotionRequest = {
  pathArgument: string | null;
  platformArtifactKind: string | null;
  paths: readonly string[];
};

export type IdeaToSpecPlatformPromotionRequest = {
  available: boolean;
  ok: boolean;
  candidateId: string | null;
  candidateBranch: string | null;
  commitPaths: readonly string[];
  requestedOperations: readonly string[];
  review: {
    title: string | null;
    baseBranch: string | null;
  };
  summary: Record<string, unknown>;
};

export type IdeaToSpecGitServiceOperation = {
  name: string;
  status: string;
  requestArtifactKind: string | null;
  responseArtifactKind: string | null;
  reportRef: string | null;
  diagnosticCount: number;
};

export type IdeaToSpecGitServiceExecution = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  openReviewDryRun: boolean;
  candidateId: string | null;
  candidateRef: string | null;
  workspaceDir: string | null;
  operationCount: number;
  completedOperationCount: number;
  errorCount: number;
  copiedFileCount: number;
  operations: readonly IdeaToSpecGitServiceOperation[];
  reportRefs: Record<string, unknown>;
};

export type IdeaToSpecWorkflowItem = {
  id: string;
  label: string;
  status: string;
  artifactKey: string | null;
  artifactPath: string | null;
  detail: string | null;
};

export type IdeaToSpecNextHandoff = {
  kind: string;
  label: string;
  status: string;
  artifactKey: string | null;
  artifactPath: string | null;
  commandTemplate: string | null;
  authorityBoundary: string;
};

export type IdeaToSpecWorkflow = {
  stage: string;
  status: string;
  items: readonly IdeaToSpecWorkflowItem[];
  nextHandoff: IdeaToSpecNextHandoff;
};

export type IdeaToSpecWorkspaceIdentity = {
  available: boolean;
  id: string | null;
  displayName: string | null;
  publicRoute: string | null;
  workflowLane: string | null;
  targetRepositoryRole: string | null;
  governanceProfile: string | null;
  authorityProfile: string | null;
  sourceMode: string | null;
  ready: boolean;
  reviewState: string | null;
  blockedBy: readonly string[];
  nextArtifact: string | null;
};

export type IdeaToSpecWorkspace = {
  apiVersion: "v1";
  artifactKind: "specspace_idea_to_spec_workspace";
  schemaVersion: number;
  readOnly: true;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  source: Record<string, unknown>;
  selectedWorkspaceId: string | null;
  workspace: IdeaToSpecWorkspaceIdentity;
  summary: {
    status: string;
    availableArtifactCount: number;
    missingArtifactCount: number;
    candidateNodeCount: number;
    candidateEdgeCount: number;
    preSibFindingCount: number;
    repairActionCount: number;
    repairContextRequiredCount: number;
    materializedFileCount: number;
    promotionPathCount: number;
    promotionGateBlockerCount: number;
    platformMissingArtifactCount: number;
    gitServiceOperationCount: number;
    gitServiceErrorCount: number;
    nextArtifact: string | null;
  };
  workflow: IdeaToSpecWorkflow;
  intake: {
    available: boolean;
    activeFrame: IdeaToSpecActiveFrame;
    summary: {
      actorCount: number;
      domainEventCount: number;
      commandCount: number;
      policyCount: number;
      externalSystemCount: number;
      constraintCount: number;
      vocabularyQuestionCount: number;
      contextCompletionQuestionCount: number;
    };
  };
  candidateGraph: {
    available: boolean;
    activeFrame: IdeaToSpecActiveFrame;
    summary: {
      nodeCount: number;
      edgeCount: number;
      requirementCount: number;
      acceptanceCriteriaCount: number;
      claimCount: number;
      gapCount: number;
    };
    preSibReadiness: Record<string, unknown>;
    nodes: readonly IdeaToSpecCandidateNode[];
  };
  preSib: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    metrics: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
  };
  repairLoop: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    metricDeltaProjection: Record<string, unknown>;
    actions: readonly IdeaToSpecRepairAction[];
  };
  materialization: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    materializationSource: string | null;
    files: readonly IdeaToSpecMaterializedFile[];
    promotionRequest: IdeaToSpecPromotionRequest;
  };
  promotionGate: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    metricSnapshot: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
    promotionRequest: IdeaToSpecPromotionRequest;
  };
  controlledPromotion: {
    available: boolean;
    platformRequest: IdeaToSpecPlatformPromotionRequest;
    gitServiceExecution: IdeaToSpecGitServiceExecution;
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
      mayExecuteGitService: false;
      mayCreateBranchOrCommit: false;
      mayMergeReview: false;
      mayMutateSpecs: false;
    };
  };
  artifacts: Record<string, IdeaToSpecArtifactStatus>;
  authorityBoundary: {
    ideaToSpecWorkspaceIsAuthority: false;
    mayExecutePromptAgent: false;
    mayMutateCandidateSourceArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayCreateBranchOrCommit: false;
    mayExecuteGitServiceOperation: false;
    mayMarkCandidateAccepted: false;
  };
};

export type UseIdeaToSpecWorkspaceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecWorkspace }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | { kind: "parse-error"; reason: string; raw: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseActiveFrame(raw: unknown): IdeaToSpecActiveFrame {
  const frame = recordValue(raw);
  return {
    project: optionalString(frame.project),
    subsystem: optionalString(frame.subsystem),
    agentLayer: optionalString(frame.agent_layer),
    targetArtifact: optionalString(frame.target_artifact),
    lifecyclePhase: optionalString(frame.lifecycle_phase),
    ontologyRefs: strings(frame.ontology_refs),
    ontologyLayerRefs: strings(frame.ontology_layer_refs),
    modelApplicabilityRefs: strings(frame.model_applicability_refs),
    domainRefs: strings(frame.domain_refs),
    contextRefs: strings(frame.context_refs),
  };
}

function parseReadiness(raw: unknown) {
  const readiness = recordValue(raw);
  return {
    ready: readiness.ready === true,
    reviewState: optionalString(readiness.review_state),
    blockedBy: strings(readiness.blocked_by),
    nextArtifact: optionalString(readiness.next_artifact),
  };
}

function parseArtifactStatus(raw: unknown): IdeaToSpecArtifactStatus {
  const status = recordValue(raw);
  return {
    available: status.available === true,
    path: stringValue(status.path, "runs/unknown.json"),
    reason: optionalString(status.reason),
    artifactKind: optionalString(status.artifact_kind),
    status: optionalString(status.status),
    proposalId: optionalString(status.proposal_id),
    contractRef: optionalString(status.contract_ref),
  };
}

function parseCandidateNode(raw: unknown): IdeaToSpecCandidateNode | null {
  const node = recordValue(raw);
  const id = optionalString(node.id);
  if (!id) return null;
  return {
    id,
    title: optionalString(node.title),
    kind: optionalString(node.kind),
    ontologyRefs: strings(node.ontology_refs),
    requirementCount: numberValue(node.requirement_count),
    acceptanceCriteriaCount: numberValue(node.acceptance_criteria_count),
    claimCount: numberValue(node.claim_count),
    gapCount: numberValue(node.gap_count),
  };
}

function parseFinding(raw: unknown): IdeaToSpecFinding | null {
  const finding = recordValue(raw);
  const findingId = optionalString(finding.finding_id);
  if (!findingId) return null;
  return {
    findingId,
    severity: stringValue(finding.severity, "unknown"),
    message: stringValue(finding.message, "No message supplied."),
    sourceRef: optionalString(finding.source_ref),
  };
}

function parseRepairAction(raw: unknown): IdeaToSpecRepairAction | null {
  const action = recordValue(raw);
  const id = optionalString(action.id);
  if (!id) return null;
  return {
    id,
    kind: stringValue(action.kind, "unknown"),
    status: stringValue(action.status, "unknown"),
    targetRef: optionalString(action.target_ref),
    rationale: optionalString(action.rationale),
    sourceFindings: strings(action.source_findings),
  };
}

function parseMaterializedFile(raw: unknown): IdeaToSpecMaterializedFile | null {
  const file = recordValue(raw);
  const path = optionalString(file.path);
  if (!path) return null;
  return {
    candidateNodeId: stringValue(file.candidate_node_id, "candidate-node"),
    materializedId: stringValue(file.materialized_id, "candidate-spec"),
    path,
    promotionPath: stringValue(file.promotion_path, path),
  };
}

function parsePromotionRequest(raw: unknown): IdeaToSpecPromotionRequest {
  const request = recordValue(raw);
  return {
    pathArgument: optionalString(request.path_argument),
    platformArtifactKind: optionalString(request.platform_artifact_kind),
    paths: strings(request.paths),
  };
}

function parsePlatformPromotionRequest(
  raw: unknown,
): IdeaToSpecPlatformPromotionRequest {
  const request = recordValue(raw);
  const review = recordValue(request.review);
  return {
    available: request.available === true,
    ok: request.ok === true,
    candidateId: optionalString(request.candidate_id),
    candidateBranch: optionalString(request.candidate_branch),
    commitPaths: strings(request.commit_paths),
    requestedOperations: strings(request.requested_operations),
    review: {
      title: optionalString(review.title),
      baseBranch: optionalString(review.base_branch),
    },
    summary: recordValue(request.summary),
  };
}

function parseGitServiceOperation(
  raw: unknown,
): IdeaToSpecGitServiceOperation | null {
  const operation = recordValue(raw);
  const name = optionalString(operation.name);
  if (!name) return null;
  return {
    name,
    status: stringValue(operation.status, "unknown"),
    requestArtifactKind: optionalString(operation.request_artifact_kind),
    responseArtifactKind: optionalString(operation.response_artifact_kind),
    reportRef: optionalString(operation.report_ref),
    diagnosticCount: numberValue(operation.diagnostic_count),
  };
}

function parseGitServiceExecution(raw: unknown): IdeaToSpecGitServiceExecution {
  const execution = recordValue(raw);
  return {
    available: execution.available === true,
    ok: execution.ok === true,
    dryRun: execution.dry_run === true,
    openReviewDryRun: execution.open_review_dry_run === true,
    candidateId: optionalString(execution.candidate_id),
    candidateRef: optionalString(execution.candidate_ref),
    workspaceDir: optionalString(execution.workspace_dir),
    operationCount: numberValue(execution.operation_count),
    completedOperationCount: numberValue(execution.completed_operation_count),
    errorCount: numberValue(execution.error_count),
    copiedFileCount: numberValue(execution.copied_file_count),
    operations: records(execution.operations).flatMap((item) => {
      const parsed = parseGitServiceOperation(item);
      return parsed ? [parsed] : [];
    }),
    reportRefs: recordValue(execution.report_refs),
  };
}

function parseWorkflowItem(raw: unknown): IdeaToSpecWorkflowItem | null {
  const item = recordValue(raw);
  const id = optionalString(item.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(item.label, id),
    status: stringValue(item.status, "unknown"),
    artifactKey: optionalString(item.artifact_key),
    artifactPath: optionalString(item.artifact_path),
    detail: optionalString(item.detail),
  };
}

function parseNextHandoff(raw: unknown): IdeaToSpecNextHandoff {
  const handoff = recordValue(raw);
  return {
    kind: stringValue(handoff.kind, "none"),
    label: stringValue(handoff.label, "No operator handoff"),
    status: stringValue(handoff.status, "idle"),
    artifactKey: optionalString(handoff.artifact_key),
    artifactPath: optionalString(handoff.artifact_path),
    commandTemplate: optionalString(handoff.command_template),
    authorityBoundary: stringValue(handoff.authority_boundary, "read_only"),
  };
}

function parseWorkflow(raw: unknown): IdeaToSpecWorkflow {
  const workflow = recordValue(raw);
  return {
    stage: stringValue(workflow.stage, "unknown"),
    status: stringValue(workflow.status, "unknown"),
    items: records(workflow.items).flatMap((item) => {
      const parsed = parseWorkflowItem(item);
      return parsed ? [parsed] : [];
    }),
    nextHandoff: parseNextHandoff(workflow.next_handoff),
  };
}

function parseWorkspaceIdentity(raw: unknown): IdeaToSpecWorkspaceIdentity {
  const workspace = recordValue(raw);
  return {
    available: workspace.available === true,
    id: optionalString(workspace.id),
    displayName: optionalString(workspace.display_name),
    publicRoute: optionalString(workspace.public_route),
    workflowLane: optionalString(workspace.workflow_lane),
    targetRepositoryRole: optionalString(workspace.target_repository_role),
    governanceProfile: optionalString(workspace.governance_profile),
    authorityProfile: optionalString(workspace.authority_profile),
    sourceMode: optionalString(workspace.source_mode),
    ready: workspace.ready === true,
    reviewState: optionalString(workspace.review_state),
    blockedBy: strings(workspace.blocked_by),
    nextArtifact: optionalString(workspace.next_artifact),
  };
}

export function parseIdeaToSpecWorkspace(
  raw: unknown,
): UseIdeaToSpecWorkspaceState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", reason: "response root is not an object", raw };
  }
  if (
    raw.api_version !== "v1" ||
    raw.artifact_kind !== "specspace_idea_to_spec_workspace"
  ) {
    return { kind: "parse-error", reason: "unexpected idea-to-spec artifact", raw };
  }
  if (
    raw.read_only !== true ||
    raw.canonical_mutations_allowed !== false ||
    raw.tracked_artifacts_written !== false
  ) {
    return { kind: "parse-error", reason: "idea-to-spec workspace must be read-only", raw };
  }
  const boundary = recordValue(raw.authority_boundary);
  const falseFlags = [
    "idea_to_spec_workspace_is_authority",
    "may_execute_prompt_agent",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_create_branch_or_commit",
    "may_execute_git_service_operation",
    "may_mark_candidate_accepted",
  ];
  for (const flag of falseFlags) {
    if (boundary[flag] !== false) {
      return { kind: "parse-error", reason: `authority boundary expanded: ${flag}`, raw };
    }
  }
  const summary = recordValue(raw.summary);
  const intake = recordValue(raw.intake);
  const intakeSummary = recordValue(intake.summary);
  const candidateGraph = recordValue(raw.candidate_graph);
  const candidateSummary = recordValue(candidateGraph.summary);
  const preSib = recordValue(raw.pre_sib);
  const repairLoop = recordValue(raw.repair_loop);
  const materialization = recordValue(raw.materialization);
  const promotionGate = recordValue(raw.promotion_gate);
  const controlledPromotion = recordValue(raw.controlled_promotion);
  const actionBoundary = recordValue(controlledPromotion.action_boundary);
  const controlledPromotionFalseFlags = [
    "may_execute_git_service",
    "may_create_branch_or_commit",
    "may_merge_review",
    "may_mutate_specs",
  ];
  for (const flag of controlledPromotionFalseFlags) {
    if (actionBoundary[flag] !== false) {
      return { kind: "parse-error", reason: `promotion action boundary expanded: ${flag}`, raw };
    }
  }
  if (
    actionBoundary.inspect_only !== true ||
    actionBoundary.acknowledge_only !== true
  ) {
    return { kind: "parse-error", reason: "promotion action boundary must be inspect-only", raw };
  }
  const artifacts = Object.fromEntries(
    Object.entries(recordValue(raw.artifacts)).map(([key, value]) => [
      key,
      parseArtifactStatus(value),
    ]),
  );
  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_idea_to_spec_workspace",
      schemaVersion: numberValue(raw.schema_version),
      readOnly: true,
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      source: recordValue(raw.source),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      workspace: parseWorkspaceIdentity(raw.workspace),
      summary: {
        status: stringValue(summary.status, "unknown"),
        availableArtifactCount: numberValue(summary.available_artifact_count),
        missingArtifactCount: numberValue(summary.missing_artifact_count),
        candidateNodeCount: numberValue(summary.candidate_node_count),
        candidateEdgeCount: numberValue(summary.candidate_edge_count),
        preSibFindingCount: numberValue(summary.pre_sib_finding_count),
        repairActionCount: numberValue(summary.repair_action_count),
        repairContextRequiredCount: numberValue(
          summary.repair_context_required_count,
        ),
        materializedFileCount: numberValue(summary.materialized_file_count),
        promotionPathCount: numberValue(summary.promotion_path_count),
        promotionGateBlockerCount: numberValue(
          summary.promotion_gate_blocker_count,
        ),
        platformMissingArtifactCount: numberValue(
          summary.platform_missing_artifact_count,
        ),
        gitServiceOperationCount: numberValue(
          summary.git_service_operation_count,
        ),
        gitServiceErrorCount: numberValue(summary.git_service_error_count),
        nextArtifact: optionalString(summary.next_artifact),
      },
      workflow: parseWorkflow(raw.workflow),
      intake: {
        available: intake.available === true,
        activeFrame: parseActiveFrame(intake.active_frame),
        summary: {
          actorCount: numberValue(intakeSummary.actor_count),
          domainEventCount: numberValue(intakeSummary.domain_event_count),
          commandCount: numberValue(intakeSummary.command_count),
          policyCount: numberValue(intakeSummary.policy_count),
          externalSystemCount: numberValue(intakeSummary.external_system_count),
          constraintCount: numberValue(intakeSummary.constraint_count),
          vocabularyQuestionCount: numberValue(
            intakeSummary.vocabulary_question_count,
          ),
          contextCompletionQuestionCount: numberValue(
            intakeSummary.context_completion_question_count,
          ),
        },
      },
      candidateGraph: {
        available: candidateGraph.available === true,
        activeFrame: parseActiveFrame(candidateGraph.active_frame),
        summary: {
          nodeCount: numberValue(candidateSummary.node_count),
          edgeCount: numberValue(candidateSummary.edge_count),
          requirementCount: numberValue(candidateSummary.requirement_count),
          acceptanceCriteriaCount: numberValue(
            candidateSummary.acceptance_criteria_count,
          ),
          claimCount: numberValue(candidateSummary.claim_count),
          gapCount: numberValue(candidateSummary.gap_count),
        },
        preSibReadiness: recordValue(candidateGraph.pre_sib_readiness),
        nodes: records(candidateGraph.nodes).flatMap((item) => {
          const parsed = parseCandidateNode(item);
          return parsed ? [parsed] : [];
        }),
      },
      preSib: {
        available: preSib.available === true,
        readiness: parseReadiness(preSib.readiness),
        metrics: recordValue(preSib.metrics),
        findings: records(preSib.findings).flatMap((item) => {
          const parsed = parseFinding(item);
          return parsed ? [parsed] : [];
        }),
      },
      repairLoop: {
        available: repairLoop.available === true,
        readiness: parseReadiness(repairLoop.readiness),
        summary: recordValue(repairLoop.summary),
        metricDeltaProjection: recordValue(repairLoop.metric_delta_projection),
        actions: records(repairLoop.actions).flatMap((item) => {
          const parsed = parseRepairAction(item);
          return parsed ? [parsed] : [];
        }),
      },
      materialization: {
        available: materialization.available === true,
        readiness: parseReadiness(materialization.readiness),
        summary: recordValue(materialization.summary),
        materializationSource: optionalString(
          materialization.materialization_source,
        ),
        files: records(materialization.files).flatMap((item) => {
          const parsed = parseMaterializedFile(item);
          return parsed ? [parsed] : [];
        }),
        promotionRequest: parsePromotionRequest(
          materialization.promotion_request,
        ),
      },
      promotionGate: {
        available: promotionGate.available === true,
        readiness: parseReadiness(promotionGate.readiness),
        summary: recordValue(promotionGate.summary),
        metricSnapshot: recordValue(promotionGate.metric_snapshot),
        findings: records(promotionGate.findings).flatMap((item) => {
          const parsed = parseFinding(item);
          return parsed ? [parsed] : [];
        }),
        promotionRequest: parsePromotionRequest(
          promotionGate.promotion_request,
        ),
      },
      controlledPromotion: {
        available: controlledPromotion.available === true,
        platformRequest: parsePlatformPromotionRequest(
          controlledPromotion.platform_request,
        ),
        gitServiceExecution: parseGitServiceExecution(
          controlledPromotion.git_service_execution,
        ),
        actionBoundary: {
          inspectOnly: true,
          acknowledgeOnly: true,
          mayExecuteGitService: false,
          mayCreateBranchOrCommit: false,
          mayMergeReview: false,
          mayMutateSpecs: false,
        },
      },
      artifacts,
      authorityBoundary: {
        ideaToSpecWorkspaceIsAuthority: false,
        mayExecutePromptAgent: false,
        mayMutateCandidateSourceArtifacts: false,
        mayMutateCanonicalSpecs: false,
        mayWriteOntologyPackage: false,
        mayCreateBranchOrCommit: false,
        mayExecuteGitServiceOperation: false,
        mayMarkCandidateAccepted: false,
      },
    },
  };
}

export function useIdeaToSpecWorkspace(
  options: Options = {},
): UseIdeaToSpecWorkspaceState {
  const {
    url = "/api/v1/idea-to-spec-workspace",
    fetcher = fetch,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecWorkspaceState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON proxy failures are possible in production deploys.
          }
          if (!cancelled) {
            setState({
              kind: "http-error",
              status: response.status,
              statusText: response.statusText,
              body,
            });
          }
          return;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (!cancelled) {
            setState({
              kind: "response-error",
              reason: "response was not valid JSON",
              raw: error,
            });
          }
          return;
        }

        if (!cancelled) setState(parseIdeaToSpecWorkspace(payload));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, fetcher, refreshKey]);

  return state;
}
