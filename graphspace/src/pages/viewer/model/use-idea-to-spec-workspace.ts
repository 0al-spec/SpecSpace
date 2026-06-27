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

export type IdeaToSpecOntologySeedBinding = {
  term: string;
  ontologyRef: string | null;
  bindingKind: string | null;
  authority: string | null;
  reason: string | null;
};

export type IdeaToSpecOntologySeedGap = {
  id: string;
  kind: string;
  term: string | null;
  sourceRef: string | null;
  sourceKind: string | null;
  suggestedAction: string | null;
  blocksCandidateGraph: boolean;
  statement: string | null;
};

export type IdeaToSpecRepairAction = {
  id: string;
  kind: string;
  status: string;
  targetRef: string | null;
  rationale: string | null;
  sourceFindings: readonly string[];
};

export type IdeaToSpecClarificationRequest = {
  id: string;
  kind: string;
  severity: string;
  status: string;
  targetRef: string | null;
  question: string | null;
  suggestedActions: readonly string[];
};

export type IdeaToSpecOntologyDecision = {
  id: string;
  decisionType: string;
  status: string;
  term: string | null;
  ontologyRef: string | null;
  aliasOf: string | null;
  targetRef: string | null;
  requestId: string | null;
  materializationIntent: string | null;
};

export type IdeaToSpecResolvedOntologyGap = {
  gapId: string;
  nodeId: string | null;
  term: string | null;
  sourceRef: string | null;
  decision: string | null;
  targetRef: string | null;
};

export type IdeaToSpecAcceptedAnswer = {
  requestId: string;
  answerKind: string;
  status: string;
  requestKind: string | null;
  targetArtifact: string | null;
  targetRef: string | null;
  terms: readonly string[];
  termScope: string | null;
};

export type IdeaToSpecRepairSessionStage = {
  stage: string;
  index: number | null;
  artifactKind: string | null;
  sourceRef: string | null;
  ready: boolean;
  reviewState: string | null;
  status: string | null;
  blockedBy: readonly string[];
  nextArtifact: string | null;
};

export type IdeaToSpecRepairSessionBlocker = {
  kind: string;
  id: string;
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

export type IdeaToSpecCandidateApprovalDecision = {
  available: boolean;
  ready: boolean;
  decisionState: string | null;
  requestedState: string | null;
  reviewState: string | null;
  operatorRef: string | null;
  reason: string | null;
  candidateId: string | null;
  promotionPaths: readonly string[];
  blockedBy: readonly string[];
};

export type IdeaToSpecCandidateApprovalExecution = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  status: string | null;
  candidateId: string | null;
  workspaceId: string | null;
  gateReportRef: string | null;
  candidateApprovalDecisionRef: string | null;
  approvalIntentRef: string | null;
  approvedPathCount: number;
  decisionWritten: boolean;
  gateReady: boolean;
  errorCount: number;
  diagnosticCount: number;
  operations: readonly IdeaToSpecProductRepairRerunOperation[];
  outputArtifacts: readonly IdeaToSpecProductRepairRerunOutputArtifact[];
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

export type IdeaToSpecReviewStatus = {
  available: boolean;
  ok: boolean;
  reviewState: string | null;
  reviewDecision: string | null;
  reviewUrl: string | null;
  reviewMerged: boolean;
  errorCount: number;
};

export type IdeaToSpecReadModelPublication = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  reviewState: string | null;
  manifest: string | null;
  published: boolean;
  fileCount: number;
  errorCount: number;
};

export type IdeaToSpecPromotionFinalization = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  reviewState: string | null;
  readModelPublished: boolean;
  operationCount: number;
  completedOperationCount: number;
  errorCount: number;
  operations: readonly IdeaToSpecGitServiceOperation[];
  reportRefs: Record<string, unknown>;
};

export type IdeaToSpecProductRepairRerunOperation = {
  name: string;
  status: string;
  reason: string | null;
  evidence: readonly string[];
};

export type IdeaToSpecProductRepairRerunOutputArtifact = {
  key: string;
  path: string | null;
  present: boolean;
  artifactKind: string | null;
  contractRef: string | null;
  status: string | null;
  ready: boolean;
  sha256: string | null;
};

export type IdeaToSpecProductRepairRerunExecution = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  status: string | null;
  errorCount: number;
  outputArtifactCount: number;
  rerunReportDigest: string | null;
  repairSessionDigest: string | null;
  diagnosticCount: number;
  operations: readonly IdeaToSpecProductRepairRerunOperation[];
  outputArtifacts: readonly IdeaToSpecProductRepairRerunOutputArtifact[];
};

export type IdeaToSpecProductRepairRerunPublication = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  status: string | null;
  errorCount: number;
  publishedArtifactCount: number;
  missingArtifactCount: number;
  manifestPath: string | null;
  manifestPresent: boolean;
  publishedArtifacts: readonly string[];
  missingArtifacts: readonly string[];
  diagnosticCount: number;
};

export type IdeaToSpecProductRepairRerunPlatformExecution = {
  available: boolean;
  execution: IdeaToSpecProductRepairRerunExecution;
  publication: IdeaToSpecProductRepairRerunPublication;
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayExecutePlatformAdapter: false;
    mayRunSpecgraphMakeTarget: false;
    mayPublishBundle: false;
    mayCreateBranchOrCommit: false;
    mayOpenPullRequest: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayMutateCanonicalSpecs: false;
  };
};

export type IdeaToSpecApprovalReadiness = {
  available: boolean;
  sourceMode: string;
  status: string;
  candidateRepaired: boolean;
  readyForCandidateApproval: boolean;
  readyForPlatformPromotion: boolean;
  promotionReviewCanBeRequested: boolean;
  platformApprovalGateCanMaterializeDecision: boolean;
  candidateApprovalDecisionReady: boolean;
  platformRerunExecuted: boolean;
  platformRerunPublished: boolean;
  repairedArtifactsPublished: boolean;
  resolvedOntologyGapCount: number;
  resolvedCandidateGapCount: number;
  unresolvedOntologyGapCount: number;
  unresolvedCandidateGapCount: number;
  removedGapCount: number;
  remainingBlockerCount: number;
  promotionPathCount: number;
  blockers: readonly string[];
  sourceRefs: {
    handoff: string | null;
    activeCandidate: string | null;
    repairSession: string | null;
    promotionGate: string | null;
  };
  reviewStates: {
    handoff: string | null;
    activeCandidate: string | null;
    repairSession: string | null;
    promotionGate: string | null;
    execution: string | null;
    publication: string | null;
  };
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayMaterializeCandidateApprovalDecision: false;
    mayExecutePlatformGate: false;
    mayExecuteGitService: false;
    mayCreateBranchOrCommit: false;
    mayMutateSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
  };
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
    ontologySeedGapCount: number;
    ontologySeedBindingCount: number;
    preSibFindingCount: number;
    repairActionCount: number;
    clarificationRequestCount: number;
    ontologyDecisionCount: number;
    resolvedOntologyGapCount: number;
    unresolvedOntologyGapCount: number;
    rerunRemovedGapCount: number;
    repairContextRequiredCount: number;
    materializedFileCount: number;
    promotionPathCount: number;
    promotionGateBlockerCount: number;
    platformMissingArtifactCount: number;
    gitServiceOperationCount: number;
    gitServiceErrorCount: number;
    approvalReady: boolean;
    repairSessionReadyForCandidateApproval: boolean;
    repairSessionReadyForPlatformPromotion: boolean;
    reviewMerged: boolean;
    readModelPublished: boolean;
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
  ontologySeed: {
    available: boolean;
    sourceRef: string | null;
    contractRef: string | null;
    generationContractRef: string | null;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: {
      status: string | null;
      nodeCount: number;
      edgeCount: number;
      ontologyBindingCount: number;
      ontologyGapCount: number;
      findingCount: number;
    };
    ontology: {
      id: string | null;
      namespace: string | null;
      version: string | null;
      sourceRef: string | null;
      sourceDigest: string | null;
      classCount: number;
      relationCount: number;
    };
    bindings: readonly IdeaToSpecOntologySeedBinding[];
    gaps: readonly IdeaToSpecOntologySeedGap[];
    findings: readonly IdeaToSpecFinding[];
    privacyBoundary: Record<string, unknown>;
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
  repairSession: {
    available: boolean;
    sourceMode: string;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    session: {
      sessionId: string | null;
      candidateId: string | null;
      workflowLane: string | null;
      workspaceRoute: string | null;
      targetRepositoryRole: string | null;
      governanceProfile: string | null;
      operatorRef: string | null;
    };
    readinessImpact: {
      readyForCandidateApproval: boolean;
      readyForPlatformPromotion: boolean;
      intermediateArtifactsReady: boolean;
      candidateQualityReviewState: string | null;
      promotionGateReviewState: string | null;
      activeCandidateReviewState: string | null;
      resolvedOntologyGapCount: number;
      unresolvedOntologyGapCount: number;
      rerunRemovedGapCount: number;
      clarificationRequestCount: number;
      acceptedAnswerCount: number;
      ontologyDecisionCount: number;
      promotionPathCount: number;
      blockedBy: readonly string[];
      platformPromotionBlockedBy: readonly string[];
    };
    stages: readonly IdeaToSpecRepairSessionStage[];
    openBlockers: readonly IdeaToSpecRepairSessionBlocker[];
    acceptedAnswers: readonly IdeaToSpecAcceptedAnswer[];
    ontologyDecisions: readonly IdeaToSpecOntologyDecision[];
    rerunOverlay: {
      sourceRef: string | null;
      summary: Record<string, unknown>;
    };
    previewRefs: {
      rerunPreview: Record<string, unknown>;
      rerunMaterialization: Record<string, unknown>;
    };
    findings: readonly IdeaToSpecFinding[];
    authorityBoundary: Record<string, unknown>;
    privacyBoundary: Record<string, unknown>;
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
      mayApplyAnswers: false;
      mayApplyDecisions: false;
      mayMutateCandidateArtifacts: false;
      mayAcceptOntologyTerms: false;
      mayWriteOntologyPackage: false;
      mayCreateBranchOrCommit: false;
    };
  };
  repairReview: {
    available: boolean;
    clarificationRequests: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      requests: readonly IdeaToSpecClarificationRequest[];
      requestCount: number;
      ontologyGapRequestCount: number;
    };
    clarificationAnswers: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      acceptedAnswers: readonly IdeaToSpecAcceptedAnswer[];
      answerCount: number;
      unresolvedBlockingCount: number;
    };
    ontologyDecisions: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      decisions: readonly IdeaToSpecOntologyDecision[];
      decisionCount: number;
    };
    rerunInput: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      ontologyHintCounts: Record<string, number>;
    };
    rerunPreview: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      candidateQualityPreview: {
        reviewState: string | null;
        ontologyGapState: string | null;
        resolvedOntologyGapCount: number;
        unresolvedOntologyGapCount: number;
      };
      resolvedGaps: readonly IdeaToSpecResolvedOntologyGap[];
      unresolvedOntologyGapCount: number;
    };
    rerunMaterialization: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      delta: {
        removedGapIds: readonly string[];
        unresolvedOntologyGapIds: readonly string[];
        resolvedOntologyGapCount: number;
        unresolvedOntologyGapCount: number;
      };
    };
    platformExecution: IdeaToSpecProductRepairRerunPlatformExecution;
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
      mayApplyAnswers: false;
      mayApplyDecisions: false;
      mayMutateCandidateArtifacts: false;
      mayAcceptOntologyTerms: false;
      mayWriteOntologyPackage: false;
      mayCreateBranchOrCommit: false;
    };
  };
  approvalReadiness: IdeaToSpecApprovalReadiness;
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
    candidateApprovalExecution: IdeaToSpecCandidateApprovalExecution;
    candidateApproval: IdeaToSpecCandidateApprovalDecision;
    platformRequest: IdeaToSpecPlatformPromotionRequest;
    gitServiceExecution: IdeaToSpecGitServiceExecution;
    reviewStatus: IdeaToSpecReviewStatus;
    readModelPublication: IdeaToSpecReadModelPublication;
    promotionFinalization: IdeaToSpecPromotionFinalization;
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

function parseOntologySeedBinding(
  raw: unknown,
): IdeaToSpecOntologySeedBinding | null {
  const binding = recordValue(raw);
  const term = optionalString(binding.term);
  const ontologyRef = optionalString(binding.ontology_ref);
  if (!term && !ontologyRef) return null;
  return {
    term: stringValue(term, "ontology term"),
    ontologyRef,
    bindingKind: optionalString(binding.binding_kind),
    authority: optionalString(binding.authority),
    reason: optionalString(binding.reason),
  };
}

function parseOntologySeedGap(raw: unknown): IdeaToSpecOntologySeedGap | null {
  const gap = recordValue(raw);
  const id = optionalString(gap.id);
  if (!id) return null;
  return {
    id,
    kind: stringValue(gap.kind, "ontology_gap"),
    term: optionalString(gap.term),
    sourceRef: optionalString(gap.source_ref),
    sourceKind: optionalString(gap.source_kind),
    suggestedAction: optionalString(gap.suggested_action),
    blocksCandidateGraph: gap.blocks_candidate_graph === true,
    statement: optionalString(gap.statement),
  };
}

function parseOntologySeed(raw: unknown): IdeaToSpecWorkspace["ontologySeed"] {
  const seed = recordValue(raw);
  const summary = recordValue(seed.summary);
  const ontology = recordValue(seed.ontology);
  return {
    available: seed.available === true,
    sourceRef: optionalString(seed.source_ref),
    contractRef: optionalString(seed.contract_ref),
    generationContractRef: optionalString(seed.generation_contract_ref),
    readiness: parseReadiness(seed.readiness),
    summary: {
      status: optionalString(summary.status),
      nodeCount: numberValue(summary.node_count),
      edgeCount: numberValue(summary.edge_count),
      ontologyBindingCount: numberValue(summary.ontology_binding_count),
      ontologyGapCount: numberValue(summary.ontology_gap_count),
      findingCount: numberValue(summary.finding_count),
    },
    ontology: {
      id: optionalString(ontology.id),
      namespace: optionalString(ontology.namespace),
      version: optionalString(ontology.version),
      sourceRef: optionalString(ontology.source_ref),
      sourceDigest: optionalString(ontology.source_digest),
      classCount: numberValue(ontology.class_count),
      relationCount: numberValue(ontology.relation_count),
    },
    bindings: records(seed.bindings).flatMap((item) => {
      const parsed = parseOntologySeedBinding(item);
      return parsed ? [parsed] : [];
    }),
    gaps: records(seed.gaps).flatMap((item) => {
      const parsed = parseOntologySeedGap(item);
      return parsed ? [parsed] : [];
    }),
    findings: records(seed.findings).flatMap((item) => {
      const parsed = parseFinding(item);
      return parsed ? [parsed] : [];
    }),
    privacyBoundary: recordValue(seed.privacy_boundary),
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

function parseClarificationRequest(
  raw: unknown,
): IdeaToSpecClarificationRequest | null {
  const request = recordValue(raw);
  const id = optionalString(request.id);
  if (!id) return null;
  return {
    id,
    kind: stringValue(request.kind, "clarification"),
    severity: stringValue(request.severity, "review_required"),
    status: stringValue(request.status, "open"),
    targetRef: optionalString(request.target_ref),
    question: optionalString(request.question),
    suggestedActions: strings(request.suggested_actions),
  };
}

function parseAcceptedAnswer(raw: unknown): IdeaToSpecAcceptedAnswer | null {
  const answer = recordValue(raw);
  const requestId = optionalString(answer.request_id);
  if (!requestId) return null;
  return {
    requestId,
    answerKind: stringValue(answer.answer_kind, "answer"),
    status: stringValue(answer.status, "accepted_for_candidate"),
    requestKind: optionalString(answer.request_kind),
    targetArtifact: optionalString(answer.target_artifact),
    targetRef: optionalString(answer.target_ref),
    terms: strings(answer.terms),
    termScope: optionalString(answer.term_scope),
  };
}

function parseOntologyDecision(raw: unknown): IdeaToSpecOntologyDecision | null {
  const decision = recordValue(raw);
  const id = optionalString(decision.id);
  if (!id) return null;
  return {
    id,
    decisionType: stringValue(decision.decision_type, "unknown"),
    status: stringValue(decision.status, "unknown"),
    term: optionalString(decision.term),
    ontologyRef: optionalString(decision.ontology_ref),
    aliasOf: optionalString(decision.alias_of),
    targetRef: optionalString(decision.target_ref),
    requestId: optionalString(decision.request_id),
    materializationIntent: optionalString(decision.materialization_intent),
  };
}

function parseRepairSessionStage(
  raw: unknown,
): IdeaToSpecRepairSessionStage | null {
  const stage = recordValue(raw);
  const stageId = optionalString(stage.stage);
  if (!stageId) return null;
  return {
    stage: stageId,
    index: typeof stage.index === "number" && Number.isFinite(stage.index)
      ? stage.index
      : null,
    artifactKind: optionalString(stage.artifact_kind),
    sourceRef: optionalString(stage.source_ref),
    ready: stage.ready === true,
    reviewState: optionalString(stage.review_state),
    status: optionalString(stage.status),
    blockedBy: strings(stage.blocked_by),
    nextArtifact: optionalString(stage.next_artifact),
  };
}

function parseRepairSessionBlocker(
  raw: unknown,
): IdeaToSpecRepairSessionBlocker | null {
  const blocker = recordValue(raw);
  const id = optionalString(blocker.id);
  if (!id) return null;
  return {
    kind: stringValue(blocker.kind, "repair_session"),
    id,
  };
}

function parseRepairSession(
  raw: unknown,
): IdeaToSpecWorkspace["repairSession"] {
  const sessionRoot = recordValue(raw);
  const session = recordValue(sessionRoot.session);
  const readinessImpact = recordValue(sessionRoot.readiness_impact);
  return {
    available: sessionRoot.available === true,
    sourceMode: stringValue(sessionRoot.source_mode, "legacy_artifacts"),
    readiness: parseReadiness(sessionRoot.readiness),
    summary: recordValue(sessionRoot.summary),
    session: {
      sessionId: optionalString(session.session_id),
      candidateId: optionalString(session.candidate_id),
      workflowLane: optionalString(session.workflow_lane),
      workspaceRoute: optionalString(session.workspace_route),
      targetRepositoryRole: optionalString(session.target_repository_role),
      governanceProfile: optionalString(session.governance_profile),
      operatorRef: optionalString(session.operator_ref),
    },
    readinessImpact: {
      readyForCandidateApproval:
        readinessImpact.ready_for_candidate_approval === true,
      readyForPlatformPromotion:
        readinessImpact.ready_for_platform_promotion === true,
      intermediateArtifactsReady:
        readinessImpact.intermediate_artifacts_ready === true,
      candidateQualityReviewState: optionalString(
        readinessImpact.candidate_quality_review_state,
      ),
      promotionGateReviewState: optionalString(
        readinessImpact.promotion_gate_review_state,
      ),
      activeCandidateReviewState: optionalString(
        readinessImpact.active_candidate_review_state,
      ),
      resolvedOntologyGapCount: numberValue(
        readinessImpact.resolved_ontology_gap_count,
      ),
      unresolvedOntologyGapCount: numberValue(
        readinessImpact.unresolved_ontology_gap_count,
      ),
      rerunRemovedGapCount: numberValue(
        readinessImpact.rerun_removed_gap_count,
      ),
      clarificationRequestCount: numberValue(
        readinessImpact.clarification_request_count,
      ),
      acceptedAnswerCount: numberValue(readinessImpact.accepted_answer_count),
      ontologyDecisionCount: numberValue(
        readinessImpact.ontology_decision_count,
      ),
      promotionPathCount: numberValue(readinessImpact.promotion_path_count),
      blockedBy: strings(readinessImpact.blocked_by),
      platformPromotionBlockedBy: strings(
        readinessImpact.platform_promotion_blocked_by,
      ),
    },
    stages: records(sessionRoot.stages).flatMap((item) => {
      const parsed = parseRepairSessionStage(item);
      return parsed ? [parsed] : [];
    }),
    openBlockers: records(sessionRoot.open_blockers).flatMap((item) => {
      const parsed = parseRepairSessionBlocker(item);
      return parsed ? [parsed] : [];
    }),
    acceptedAnswers: records(sessionRoot.accepted_answers).flatMap((item) => {
      const parsed = parseAcceptedAnswer(item);
      return parsed ? [parsed] : [];
    }),
    ontologyDecisions: records(sessionRoot.ontology_decisions).flatMap((item) => {
      const parsed = parseOntologyDecision(item);
      return parsed ? [parsed] : [];
    }),
    rerunOverlay: {
      sourceRef: optionalString(recordValue(sessionRoot.rerun_overlay).source_ref),
      summary: recordValue(recordValue(sessionRoot.rerun_overlay).summary),
    },
    previewRefs: {
      rerunPreview: recordValue(recordValue(sessionRoot.preview_refs).rerun_preview),
      rerunMaterialization: recordValue(
        recordValue(sessionRoot.preview_refs).rerun_materialization,
      ),
    },
    findings: records(sessionRoot.findings).flatMap((item) => {
      const parsed = parseFinding(item);
      return parsed ? [parsed] : [];
    }),
    authorityBoundary: recordValue(sessionRoot.authority_boundary),
    privacyBoundary: recordValue(sessionRoot.privacy_boundary),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayApplyAnswers: false,
      mayApplyDecisions: false,
      mayMutateCandidateArtifacts: false,
      mayAcceptOntologyTerms: false,
      mayWriteOntologyPackage: false,
      mayCreateBranchOrCommit: false,
    },
  };
}

function parseResolvedOntologyGap(
  raw: unknown,
): IdeaToSpecResolvedOntologyGap | null {
  const gap = recordValue(raw);
  const gapId = optionalString(gap.gap_id);
  if (!gapId) return null;
  return {
    gapId,
    nodeId: optionalString(gap.node_id),
    term: optionalString(gap.term),
    sourceRef: optionalString(gap.source_ref),
    decision: optionalString(gap.decision),
    targetRef: optionalString(gap.target_ref),
  };
}

function parseNumberRecord(raw: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(recordValue(raw)).map(([key, value]) => [
      key,
      numberValue(value),
    ]),
  );
}

function parseRepairReview(
  raw: unknown,
): IdeaToSpecWorkspace["repairReview"] {
  const lane = recordValue(raw);
  const clarificationRequests = recordValue(lane.clarification_requests);
  const clarificationAnswers = recordValue(lane.clarification_answers);
  const ontologyDecisions = recordValue(lane.ontology_decisions);
  const rerunInput = recordValue(lane.rerun_input);
  const rerunPreview = recordValue(lane.rerun_preview);
  const candidateQualityPreview = recordValue(
    rerunPreview.candidate_quality_preview,
  );
  const rerunMaterialization = recordValue(lane.rerun_materialization);
  const delta = recordValue(rerunMaterialization.delta);
  const platformExecution = recordValue(lane.platform_execution);
  return {
    available: lane.available === true,
    clarificationRequests: {
      available: clarificationRequests.available === true,
      readiness: parseReadiness(clarificationRequests.readiness),
      summary: recordValue(clarificationRequests.summary),
      requests: records(clarificationRequests.requests).flatMap((item) => {
        const parsed = parseClarificationRequest(item);
        return parsed ? [parsed] : [];
      }),
      requestCount: numberValue(clarificationRequests.request_count),
      ontologyGapRequestCount: numberValue(
        clarificationRequests.ontology_gap_request_count,
      ),
    },
    clarificationAnswers: {
      available: clarificationAnswers.available === true,
      readiness: parseReadiness(clarificationAnswers.readiness),
      summary: recordValue(clarificationAnswers.summary),
      acceptedAnswers: records(clarificationAnswers.accepted_answers).flatMap(
        (item) => {
          const parsed = parseAcceptedAnswer(item);
          return parsed ? [parsed] : [];
        },
      ),
      answerCount: numberValue(clarificationAnswers.answer_count),
      unresolvedBlockingCount: numberValue(
        clarificationAnswers.unresolved_blocking_count,
      ),
    },
    ontologyDecisions: {
      available: ontologyDecisions.available === true,
      readiness: parseReadiness(ontologyDecisions.readiness),
      summary: recordValue(ontologyDecisions.summary),
      decisions: records(ontologyDecisions.decisions).flatMap((item) => {
        const parsed = parseOntologyDecision(item);
        return parsed ? [parsed] : [];
      }),
      decisionCount: numberValue(ontologyDecisions.decision_count),
    },
    rerunInput: {
      available: rerunInput.available === true,
      readiness: parseReadiness(rerunInput.readiness),
      summary: recordValue(rerunInput.summary),
      ontologyHintCounts: parseNumberRecord(rerunInput.ontology_hint_counts),
    },
    rerunPreview: {
      available: rerunPreview.available === true,
      readiness: parseReadiness(rerunPreview.readiness),
      summary: recordValue(rerunPreview.summary),
      candidateQualityPreview: {
        reviewState: optionalString(candidateQualityPreview.review_state),
        ontologyGapState: optionalString(
          candidateQualityPreview.ontology_gap_state,
        ),
        resolvedOntologyGapCount: numberValue(
          candidateQualityPreview.resolved_ontology_gap_count,
        ),
        unresolvedOntologyGapCount: numberValue(
          candidateQualityPreview.unresolved_ontology_gap_count,
        ),
      },
      resolvedGaps: records(rerunPreview.resolved_gaps).flatMap((item) => {
        const parsed = parseResolvedOntologyGap(item);
        return parsed ? [parsed] : [];
      }),
      unresolvedOntologyGapCount: numberValue(
        rerunPreview.unresolved_ontology_gap_count,
      ),
    },
    rerunMaterialization: {
      available: rerunMaterialization.available === true,
      readiness: parseReadiness(rerunMaterialization.readiness),
      summary: recordValue(rerunMaterialization.summary),
      delta: {
        removedGapIds: strings(delta.removed_gap_ids),
        unresolvedOntologyGapIds: strings(delta.unresolved_ontology_gap_ids),
        resolvedOntologyGapCount: numberValue(
          delta.resolved_ontology_gap_count,
        ),
        unresolvedOntologyGapCount: numberValue(
          delta.unresolved_ontology_gap_count,
        ),
      },
    },
    platformExecution: parseProductRepairRerunPlatformExecution(platformExecution),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayApplyAnswers: false,
      mayApplyDecisions: false,
      mayMutateCandidateArtifacts: false,
      mayAcceptOntologyTerms: false,
      mayWriteOntologyPackage: false,
      mayCreateBranchOrCommit: false,
    },
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

function parseCandidateApprovalDecision(
  raw: unknown,
): IdeaToSpecCandidateApprovalDecision {
  const approval = recordValue(raw);
  return {
    available: approval.available === true,
    ready: approval.ready === true,
    decisionState: optionalString(approval.decision_state),
    requestedState: optionalString(approval.requested_state),
    reviewState: optionalString(approval.review_state),
    operatorRef: optionalString(approval.operator_ref),
    reason: optionalString(approval.reason),
    candidateId: optionalString(approval.candidate_id),
    promotionPaths: strings(approval.promotion_paths),
    blockedBy: strings(approval.blocked_by),
  };
}

function parseCandidateApprovalExecution(
  raw: unknown,
): IdeaToSpecCandidateApprovalExecution {
  const execution = recordValue(raw);
  return {
    available: execution.available === true,
    ok: execution.ok === true,
    dryRun: execution.dry_run === true,
    status: optionalString(execution.status),
    candidateId: optionalString(execution.candidate_id),
    workspaceId: optionalString(execution.workspace_id),
    gateReportRef: optionalString(execution.gate_report_ref),
    candidateApprovalDecisionRef: optionalString(
      execution.candidate_approval_decision_ref,
    ),
    approvalIntentRef: optionalString(execution.approval_intent_ref),
    approvedPathCount: numberValue(execution.approved_path_count),
    decisionWritten: execution.decision_written === true,
    gateReady: execution.gate_ready === true,
    errorCount: numberValue(execution.error_count),
    diagnosticCount: numberValue(execution.diagnostic_count),
    operations: records(execution.operations).flatMap((item) => {
      const parsed = parseProductRepairRerunOperation(item);
      return parsed ? [parsed] : [];
    }),
    outputArtifacts: records(execution.output_artifacts).flatMap((item) => {
      const parsed = parseProductRepairRerunOutputArtifact(item);
      return parsed ? [parsed] : [];
    }),
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

function parseReviewStatus(raw: unknown): IdeaToSpecReviewStatus {
  const status = recordValue(raw);
  return {
    available: status.available === true,
    ok: status.ok === true,
    reviewState: optionalString(status.review_state),
    reviewDecision: optionalString(status.review_decision),
    reviewUrl: optionalString(status.review_url),
    reviewMerged: status.review_merged === true,
    errorCount: numberValue(status.error_count),
  };
}

function parseReadModelPublication(raw: unknown): IdeaToSpecReadModelPublication {
  const publication = recordValue(raw);
  return {
    available: publication.available === true,
    ok: publication.ok === true,
    dryRun: publication.dry_run === true,
    reviewState: optionalString(publication.review_state),
    manifest: optionalString(publication.manifest),
    published: publication.published === true,
    fileCount: numberValue(publication.file_count),
    errorCount: numberValue(publication.error_count),
  };
}

function parsePromotionFinalization(raw: unknown): IdeaToSpecPromotionFinalization {
  const finalization = recordValue(raw);
  return {
    available: finalization.available === true,
    ok: finalization.ok === true,
    dryRun: finalization.dry_run === true,
    reviewState: optionalString(finalization.review_state),
    readModelPublished: finalization.read_model_published === true,
    operationCount: numberValue(finalization.operation_count),
    completedOperationCount: numberValue(
      finalization.completed_operation_count,
    ),
    errorCount: numberValue(finalization.error_count),
    operations: records(finalization.operations).flatMap((item) => {
      const parsed = parseGitServiceOperation(item);
      return parsed ? [parsed] : [];
    }),
    reportRefs: recordValue(finalization.report_refs),
  };
}

function parseProductRepairRerunOperation(
  raw: unknown,
): IdeaToSpecProductRepairRerunOperation | null {
  const operation = recordValue(raw);
  const name = optionalString(operation.name);
  if (!name) return null;
  return {
    name,
    status: stringValue(operation.status, "unknown"),
    reason: optionalString(operation.reason),
    evidence: strings(operation.evidence),
  };
}

function parseProductRepairRerunOutputArtifact(
  raw: unknown,
): IdeaToSpecProductRepairRerunOutputArtifact | null {
  const artifact = recordValue(raw);
  const key = optionalString(artifact.key);
  if (!key) return null;
  return {
    key,
    path: optionalString(artifact.path),
    present: artifact.present === true,
    artifactKind: optionalString(artifact.artifact_kind),
    contractRef: optionalString(artifact.contract_ref),
    status: optionalString(artifact.status),
    ready: artifact.ready === true,
    sha256: optionalString(artifact.sha256),
  };
}

function parseProductRepairRerunExecution(
  raw: unknown,
): IdeaToSpecProductRepairRerunExecution {
  const execution = recordValue(raw);
  return {
    available: execution.available === true,
    ok: execution.ok === true,
    dryRun: execution.dry_run === true,
    status: optionalString(execution.status),
    errorCount: numberValue(execution.error_count),
    outputArtifactCount: numberValue(execution.output_artifact_count),
    rerunReportDigest: optionalString(execution.rerun_report_digest),
    repairSessionDigest: optionalString(execution.repair_session_digest),
    diagnosticCount: numberValue(execution.diagnostic_count),
    operations: records(execution.operations).flatMap((item) => {
      const parsed = parseProductRepairRerunOperation(item);
      return parsed ? [parsed] : [];
    }),
    outputArtifacts: records(execution.output_artifacts).flatMap((item) => {
      const parsed = parseProductRepairRerunOutputArtifact(item);
      return parsed ? [parsed] : [];
    }),
  };
}

function parseProductRepairRerunPublication(
  raw: unknown,
): IdeaToSpecProductRepairRerunPublication {
  const publication = recordValue(raw);
  return {
    available: publication.available === true,
    ok: publication.ok === true,
    dryRun: publication.dry_run === true,
    status: optionalString(publication.status),
    errorCount: numberValue(publication.error_count),
    publishedArtifactCount: numberValue(publication.published_artifact_count),
    missingArtifactCount: numberValue(publication.missing_artifact_count),
    manifestPath: optionalString(publication.manifest_path),
    manifestPresent: publication.manifest_present === true,
    publishedArtifacts: strings(publication.published_artifacts),
    missingArtifacts: strings(publication.missing_artifacts),
    diagnosticCount: numberValue(publication.diagnostic_count),
  };
}

function parseProductRepairRerunPlatformExecution(
  raw: unknown,
): IdeaToSpecProductRepairRerunPlatformExecution {
  const platformExecution = recordValue(raw);
  return {
    available: platformExecution.available === true,
    execution: parseProductRepairRerunExecution(platformExecution.execution),
    publication: parseProductRepairRerunPublication(platformExecution.publication),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecutePlatformAdapter: false,
      mayRunSpecgraphMakeTarget: false,
      mayPublishBundle: false,
      mayCreateBranchOrCommit: false,
      mayOpenPullRequest: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayMutateCanonicalSpecs: false,
    },
  };
}

function parseApprovalReadiness(raw: unknown): IdeaToSpecApprovalReadiness {
  const readiness = recordValue(raw);
  const sourceRefs = recordValue(readiness.source_refs);
  const reviewStates = recordValue(readiness.review_states);
  return {
    available: readiness.available === true,
    sourceMode: stringValue(readiness.source_mode, "standard"),
    status: stringValue(readiness.status, "unknown"),
    candidateRepaired: readiness.candidate_repaired === true,
    readyForCandidateApproval:
      readiness.ready_for_candidate_approval === true,
    readyForPlatformPromotion:
      readiness.ready_for_platform_promotion === true,
    promotionReviewCanBeRequested:
      readiness.promotion_review_can_be_requested === true,
    platformApprovalGateCanMaterializeDecision:
      readiness.platform_approval_gate_can_materialize_decision === true,
    candidateApprovalDecisionReady:
      readiness.candidate_approval_decision_ready === true,
    platformRerunExecuted: readiness.platform_rerun_executed === true,
    platformRerunPublished: readiness.platform_rerun_published === true,
    repairedArtifactsPublished:
      readiness.repaired_artifacts_published === true,
    resolvedOntologyGapCount: numberValue(
      readiness.resolved_ontology_gap_count,
    ),
    resolvedCandidateGapCount: numberValue(
      readiness.resolved_candidate_gap_count,
    ),
    unresolvedOntologyGapCount: numberValue(
      readiness.unresolved_ontology_gap_count,
    ),
    unresolvedCandidateGapCount: numberValue(
      readiness.unresolved_candidate_gap_count,
    ),
    removedGapCount: numberValue(readiness.removed_gap_count),
    remainingBlockerCount: numberValue(readiness.remaining_blocker_count),
    promotionPathCount: numberValue(readiness.promotion_path_count),
    blockers: strings(readiness.blockers),
    sourceRefs: {
      handoff: optionalString(sourceRefs.handoff),
      activeCandidate: optionalString(sourceRefs.active_candidate),
      repairSession: optionalString(sourceRefs.repair_session),
      promotionGate: optionalString(sourceRefs.promotion_gate),
    },
    reviewStates: {
      handoff: optionalString(reviewStates.handoff),
      activeCandidate: optionalString(reviewStates.active_candidate),
      repairSession: optionalString(reviewStates.repair_session),
      promotionGate: optionalString(reviewStates.promotion_gate),
      execution: optionalString(reviewStates.execution),
      publication: optionalString(reviewStates.publication),
    },
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayMaterializeCandidateApprovalDecision: false,
      mayExecutePlatformGate: false,
      mayExecuteGitService: false,
      mayCreateBranchOrCommit: false,
      mayMutateSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
    },
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
  const ontologySeed = recordValue(raw.ontology_seed);
  const preSib = recordValue(raw.pre_sib);
  const repairLoop = recordValue(raw.repair_loop);
  const hasRepairSession = isRecord(raw.repair_session);
  const repairSession = recordValue(raw.repair_session);
  if (hasRepairSession) {
    const repairSessionBoundary = recordValue(repairSession.action_boundary);
    const repairSessionFalseFlags = [
      "may_apply_answers",
      "may_apply_decisions",
      "may_mutate_candidate_artifacts",
      "may_accept_ontology_terms",
      "may_write_ontology_package",
      "may_create_branch_or_commit",
    ];
    for (const flag of repairSessionFalseFlags) {
      if (repairSessionBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `repair session boundary expanded: ${flag}`, raw };
      }
    }
    if (
      repairSessionBoundary.inspect_only !== true ||
      repairSessionBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "repair session boundary must be inspect-only", raw };
    }
  }
  const repairReview = recordValue(raw.repair_review);
  const repairReviewBoundary = recordValue(repairReview.action_boundary);
  const repairReviewFalseFlags = [
    "may_apply_answers",
    "may_apply_decisions",
    "may_mutate_candidate_artifacts",
    "may_accept_ontology_terms",
    "may_write_ontology_package",
    "may_create_branch_or_commit",
  ];
  for (const flag of repairReviewFalseFlags) {
    if (repairReviewBoundary[flag] !== false) {
      return { kind: "parse-error", reason: `repair review boundary expanded: ${flag}`, raw };
    }
  }
  if (
    repairReviewBoundary.inspect_only !== true ||
    repairReviewBoundary.acknowledge_only !== true
  ) {
    return { kind: "parse-error", reason: "repair review boundary must be inspect-only", raw };
  }
  const platformExecution = recordValue(repairReview.platform_execution);
  const platformExecutionBoundary = recordValue(platformExecution.action_boundary);
  const platformExecutionFalseFlags = [
    "may_execute_platform_adapter",
    "may_run_specgraph_make_target",
    "may_publish_bundle",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_mutate_canonical_specs",
  ];
  for (const flag of platformExecutionFalseFlags) {
    if (platformExecutionBoundary[flag] !== false) {
      return { kind: "parse-error", reason: `repair rerun execution boundary expanded: ${flag}`, raw };
    }
  }
  if (
    platformExecutionBoundary.inspect_only !== true ||
    platformExecutionBoundary.acknowledge_only !== true
  ) {
    return { kind: "parse-error", reason: "repair rerun execution boundary must be inspect-only", raw };
  }
  const hasApprovalReadiness = isRecord(raw.approval_readiness);
  const approvalReadiness = recordValue(raw.approval_readiness);
  if (hasApprovalReadiness) {
    const approvalReadinessBoundary = recordValue(approvalReadiness.action_boundary);
    const approvalReadinessFalseFlags = [
      "may_materialize_candidate_approval_decision",
      "may_execute_platform_gate",
      "may_execute_git_service",
      "may_create_branch_or_commit",
      "may_mutate_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
    ];
    for (const flag of approvalReadinessFalseFlags) {
      if (approvalReadinessBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `approval readiness boundary expanded: ${flag}`, raw };
      }
    }
    if (
      approvalReadinessBoundary.inspect_only !== true ||
      approvalReadinessBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "approval readiness boundary must be inspect-only", raw };
    }
  }
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
        ontologySeedGapCount: numberValue(summary.ontology_seed_gap_count),
        ontologySeedBindingCount: numberValue(
          summary.ontology_seed_binding_count,
        ),
        preSibFindingCount: numberValue(summary.pre_sib_finding_count),
        repairActionCount: numberValue(summary.repair_action_count),
        clarificationRequestCount: numberValue(
          summary.clarification_request_count,
        ),
        ontologyDecisionCount: numberValue(summary.ontology_decision_count),
        resolvedOntologyGapCount: numberValue(
          summary.resolved_ontology_gap_count,
        ),
        unresolvedOntologyGapCount: numberValue(
          summary.unresolved_ontology_gap_count,
        ),
        rerunRemovedGapCount: numberValue(summary.rerun_removed_gap_count),
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
        approvalReady: summary.approval_ready === true,
        repairSessionReadyForCandidateApproval:
          summary.repair_session_ready_for_candidate_approval === true,
        repairSessionReadyForPlatformPromotion:
          summary.repair_session_ready_for_platform_promotion === true,
        reviewMerged: summary.review_merged === true,
        readModelPublished: summary.read_model_published === true,
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
      ontologySeed: parseOntologySeed(ontologySeed),
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
      repairSession: parseRepairSession(repairSession),
      repairReview: parseRepairReview(repairReview),
      approvalReadiness: parseApprovalReadiness(approvalReadiness),
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
        candidateApprovalExecution: parseCandidateApprovalExecution(
          controlledPromotion.candidate_approval_execution,
        ),
        candidateApproval: parseCandidateApprovalDecision(
          controlledPromotion.candidate_approval,
        ),
        platformRequest: parsePlatformPromotionRequest(
          controlledPromotion.platform_request,
        ),
        gitServiceExecution: parseGitServiceExecution(
          controlledPromotion.git_service_execution,
        ),
        reviewStatus: parseReviewStatus(controlledPromotion.review_status),
        readModelPublication: parseReadModelPublication(
          controlledPromotion.read_model_publication,
        ),
        promotionFinalization: parsePromotionFinalization(
          controlledPromotion.promotion_finalization,
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
