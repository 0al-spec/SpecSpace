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
  targetArtifact: string | null;
  question: string | null;
  suggestedActions: readonly string[];
};

export type IdeaToSpecRepairTarget = {
  requestId: string;
  kind: string;
  label: string;
  targetRef: string | null;
  sourceRef: string | null;
  statement: string | null;
  recommendedAction: string | null;
  acceptedActions: readonly string[];
  expectedEffect: string;
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

export type IdeaToSpecWorkspaceStateHygieneItem = {
  kind: string;
  artifactType: string | null;
  status: string;
  reason: string | null;
  path: string | null;
  storedWorkspaceId: string | null;
  storedCandidateId: string | null;
  storedRepairSessionId: string | null;
  storedRepairSessionRef: string | null;
  currentWorkspaceId: string | null;
  currentCandidateId: string | null;
  currentRepairSessionId: string | null;
  currentRepairSessionRef: string | null;
  recordCount: number;
  currentRecordCount: number;
  staleRecordCount: number;
  blocks: readonly string[];
  nextAction: string | null;
};

export type IdeaToSpecWorkspaceStateRecommendedAction = {
  id: string;
  label: string;
  reason: string | null;
  targetState: string | null;
  targetSection: string | null;
  requiresCurrentRepairSession: boolean;
  workspaceId: string | null;
  candidateId: string | null;
  repairSessionId: string | null;
  repairSessionRef: string | null;
  enabled: boolean;
  blockers: readonly string[];
  uiIntent: string | null;
  commandHint: string | null;
  evidenceRefs: readonly string[];
  authorityBoundary: Record<string, unknown>;
};

export type IdeaToSpecWorkspaceStateHygiene = {
  available: boolean;
  status: string;
  workspaceId: string | null;
  candidateId: string | null;
  repairSessionId: string | null;
  repairSessionRef: string | null;
  usableStateCount: number;
  missingStateCount: number;
  staleStateCount: number;
  invalidStateCount: number;
  blockingStateCount: number;
  recommendedActionCount: number;
  enabledRecommendedActionCount: number;
  nextAction: string | null;
  states: readonly IdeaToSpecWorkspaceStateHygieneItem[];
  recommendedActions: readonly IdeaToSpecWorkspaceStateRecommendedAction[];
  authorityBoundary: Record<string, unknown>;
  actionBoundary: Record<string, unknown>;
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

export type IdeaToSpecProductPromotionExecution = {
  available: boolean;
  ok: boolean;
  dryRun: boolean;
  openReviewDryRun: boolean;
  status: string | null;
  candidateId: string | null;
  candidateBranch: string | null;
  workspaceDir: string | null;
  repositoryDir: string | null;
  materializedSourceDir: string | null;
  promotionRequestRef: string | null;
  approvalDecisionRef: string | null;
  gitServiceExecutionReportRef: string | null;
  commitSha: string | null;
  reviewUrl: string | null;
  reviewNumber: number;
  reviewOpened: boolean;
  worktreePrepared: boolean;
  commitCreated: boolean;
  copiedFileCount: number;
  childOperationCount: number;
  completedOperationCount: number;
  errorCount: number;
  diagnosticCount: number;
  operations: readonly IdeaToSpecProductRepairRerunOperation[];
  gitServiceOperations: readonly IdeaToSpecGitServiceOperation[];
  childReportRefs: Record<string, unknown>;
};

export type IdeaToSpecReviewStatus = {
  available: boolean;
  ok: boolean;
  sourceMode: string | null;
  status: string | null;
  candidateId: string | null;
  candidateBranch: string | null;
  reviewState: string | null;
  reviewDecision: string | null;
  reviewUrl: string | null;
  reviewNumber: number;
  baseBranch: string | null;
  headBranch: string | null;
  mergedAt: string | null;
  mergeCommit: string | null;
  reviewMerged: boolean;
  promotionExecutionReportRef: string | null;
  graphRepositoryReviewStatusReportRef: string | null;
  operationCount: number;
  operations: readonly IdeaToSpecProductRepairRerunOperation[];
  errorCount: number;
  nextAction: string | null;
};

export type IdeaToSpecReadModelPublication = {
  available: boolean;
  ok: boolean;
  sourceMode: string | null;
  status: string | null;
  dryRun: boolean;
  candidateId: string | null;
  candidateBranch: string | null;
  reviewState: string | null;
  manifest: string | null;
  manifestName: string | null;
  bundleDir: string | null;
  outputDir: string | null;
  published: boolean;
  readModelPublished: boolean;
  fileCount: number;
  productReviewStatusReportRef: string | null;
  graphRepositoryReviewStatusReportRef: string | null;
  graphRepositoryPublishReadModelReportRef: string | null;
  operationCount: number;
  operations: readonly IdeaToSpecProductRepairRerunOperation[];
  errorCount: number;
  nextAction: string | null;
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

export type IdeaToSpecIdeaMaturityMetrics = {
  candidateNodeCount: number;
  clarificationQuestionCount: number;
  reviewRequiredQuestionCount: number;
  blockingQuestionCount: number;
  answeredQuestionCount: number;
  acceptedAnswerCount: number;
  deferredAnswerCount: number;
  invalidAnswerCount: number;
  materializedAnswerCount: number;
  unmaterializedAnswerCount: number;
  answerMaterializationRate: number | null;
  ontologyGapCountInitial: number;
  ontologyGapResolvedCount: number;
  ontologyGapUnresolvedCount: number;
  ontologyGapResolutionRate: number | null;
  candidateGapCountInitial: number;
  candidateGapResolvedCount: number;
  candidateGapUnresolvedCount: number;
  candidateGapClosureRate: number | null;
  remainingBlockerCount: number;
  staleRefCount: number;
  failedGateCount: number;
  dryRunCount: number;
  rerunCount: number;
  rerunRequestCount: number;
  manualHandoffCount: number;
  operatorCommandCount: number;
  promotionPathCount: number;
  publishedFileCount: number;
  timeToFirstCandidateSeconds: number | null;
  timeToApprovalReadySeconds: number | null;
  timeToFirstMaterializationSeconds: number | null;
  lastProgressAt: string | null;
  stalledPhase: string | null;
};

export type IdeaToSpecIdeaMaturityFinding = {
  findingId: string;
  severity: string;
  message: string;
  source: string | null;
  nextAction: string | null;
};

export type IdeaToSpecIdeaMaturityReadinessExplainer = {
  id: string;
  proposalId: string | null;
  kind: string;
  source: string | null;
  severity: string;
  blocks: readonly string[];
  message: string;
  nextAction: string | null;
  evidenceRefs: readonly string[];
};

export type IdeaToSpecIdeaMaturityValidationReport = {
  path: string | null;
  status: string;
  diagnosticCount: number;
};

export type IdeaToSpecIdeaMaturityContract = {
  schemaVersion: number | null;
  schemaRef: string | null;
  validationReportSchemaRef: string | null;
  validatorId: string | null;
  validatorVersion: string | null;
  compatibilityPolicy: string | null;
  compatibilityPolicyRef: string | null;
  metricsRfcRef: string | null;
  proposalId: string | null;
};

export type IdeaToSpecIdeaMaturity = {
  available: boolean;
  status: string;
  trusted: boolean;
  sourceRefs: readonly string[];
  report: {
    available: boolean;
    artifactKind: string | null;
    generatedAt: string | null;
    status: string | null;
    proposalId: string | null;
    contractRef: string | null;
    contract: IdeaToSpecIdeaMaturityContract;
    metricPackId: string | null;
    metricPackRef: string | null;
    metricsRfcRef: string | null;
    authorityState: string | null;
    candidate: {
      candidateId: string | null;
      workspaceRoute: string | null;
      workflowLane: string | null;
      targetRepositoryRole: string | null;
      governanceProfile: string | null;
    };
    derivedState: {
      lifecycleState: string | null;
      candidateApprovalState: string | null;
      platformPromotionState: string | null;
      reviewStatus: string | null;
      readModelPublicationState: string | null;
      blockers: readonly string[];
    };
    metrics: IdeaToSpecIdeaMaturityMetrics;
    findings: readonly IdeaToSpecIdeaMaturityFinding[];
    readinessExplainers: readonly IdeaToSpecIdeaMaturityReadinessExplainer[];
    sourceArtifacts: readonly string[];
  };
  validation: {
    available: boolean;
    artifactKind: string | null;
    generatedAt: string | null;
    metricPackId: string | null;
    summary: Record<string, unknown>;
    validator: {
      id: string | null;
      version: string | null;
      rfcRef: string | null;
      schemaRef: string | null;
      validationReportSchemaRef: string | null;
      scriptRef: string | null;
      compatibilityPolicyRef: string | null;
    };
    reports: readonly IdeaToSpecIdeaMaturityValidationReport[];
  };
  reportError: Record<string, unknown>;
  validationError: Record<string, unknown>;
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayRecalculateMetrics: false;
    mayExecuteMetricsValidator: false;
    mayMutateCandidateArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayExecuteGitService: false;
    mayCreateBranchOrCommit: false;
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

export type IdeaToSpecGuidedFlowBoundary = {
  inspectOnly: true;
  acknowledgeOnly: true;
  mayExecuteSpecgraph: false;
  mayExecutePlatform: false;
  mayExecuteGitService: false;
  mayMutateCandidateArtifacts: false;
  mayMutateCanonicalSpecs: false;
  mayWriteOntologyPackage: false;
  mayAcceptOntologyTerms: false;
  mayCreateBranchOrCommit: false;
  mayOpenPullRequest: false;
  mayMergeReview: false;
};

export type IdeaToSpecGuidedFlowStage = {
  id: string;
  label: string;
  status: string;
  primaryNextAction: string;
  blockers: readonly string[];
  evidenceRefs: readonly string[];
  targetSection: string | null;
  commandTemplate: string | null;
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecGuidedFlowNextAction = {
  id: string;
  label: string;
  status: string;
  targetSection: string | null;
  commandTemplate: string | null;
  evidenceRefs: readonly string[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecGuidedFlow = {
  currentStage: string;
  currentStageLabel: string;
  overallStatus: string;
  workflowStage: string;
  workflowStatus: string;
  nextHandoff: IdeaToSpecNextHandoff;
  nextActions: readonly IdeaToSpecGuidedFlowNextAction[];
  stages: readonly IdeaToSpecGuidedFlowStage[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
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
  guidedFlow: IdeaToSpecGuidedFlow;
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
      repairTargets: readonly IdeaToSpecRepairTarget[];
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
  workspaceStateHygiene: IdeaToSpecWorkspaceStateHygiene;
  ideaMaturity: IdeaToSpecIdeaMaturity;
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
    productPromotionExecution: IdeaToSpecProductPromotionExecution;
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

function optionalNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
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
    targetArtifact: optionalString(request.target_artifact),
    question: optionalString(request.question),
    suggestedActions: strings(request.suggested_actions),
  };
}

function parseRepairTarget(raw: unknown): IdeaToSpecRepairTarget | null {
  const target = recordValue(raw);
  const requestId = optionalString(target.request_id);
  if (!requestId) return null;
  return {
    requestId,
    kind: stringValue(target.kind, "unknown"),
    label: stringValue(target.label, "Product/spec gap"),
    targetRef: optionalString(target.target_ref),
    sourceRef: optionalString(target.source_ref),
    statement: optionalString(target.statement),
    recommendedAction: optionalString(target.recommended_action),
    acceptedActions: strings(target.accepted_actions),
    expectedEffect: stringValue(target.expected_effect, "candidate_context_added"),
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
      repairTargets: records(clarificationRequests.repair_targets).flatMap((item) => {
        const parsed = parseRepairTarget(item);
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

function parseProductPromotionExecution(
  raw: unknown,
): IdeaToSpecProductPromotionExecution {
  const execution = recordValue(raw);
  return {
    available: execution.available === true,
    ok: execution.ok === true,
    dryRun: execution.dry_run === true,
    openReviewDryRun: execution.open_review_dry_run === true,
    status: optionalString(execution.status),
    candidateId: optionalString(execution.candidate_id),
    candidateBranch: optionalString(execution.candidate_branch),
    workspaceDir: optionalString(execution.workspace_dir),
    repositoryDir: optionalString(execution.repository_dir),
    materializedSourceDir: optionalString(execution.materialized_source_dir),
    promotionRequestRef: optionalString(execution.promotion_request_ref),
    approvalDecisionRef: optionalString(execution.approval_decision_ref),
    gitServiceExecutionReportRef: optionalString(
      execution.git_service_execution_report_ref,
    ),
    commitSha: optionalString(execution.commit_sha),
    reviewUrl: optionalString(execution.review_url),
    reviewNumber: numberValue(execution.review_number),
    reviewOpened: execution.review_opened === true,
    worktreePrepared: execution.worktree_prepared === true,
    commitCreated: execution.commit_created === true,
    copiedFileCount: numberValue(execution.copied_file_count),
    childOperationCount: numberValue(execution.child_operation_count),
    completedOperationCount: numberValue(execution.completed_operation_count),
    errorCount: numberValue(execution.error_count),
    diagnosticCount: numberValue(execution.diagnostic_count),
    operations: records(execution.operations).flatMap((item) => {
      const parsed = parseProductRepairRerunOperation(item);
      return parsed ? [parsed] : [];
    }),
    gitServiceOperations: records(execution.git_service_operations).flatMap(
      (item) => {
        const parsed = parseGitServiceOperation(item);
        return parsed ? [parsed] : [];
      },
    ),
    childReportRefs: recordValue(execution.child_report_refs),
  };
}

function parseReviewStatus(raw: unknown): IdeaToSpecReviewStatus {
  const status = recordValue(raw);
  return {
    available: status.available === true,
    ok: status.ok === true,
    sourceMode: optionalString(status.source_mode),
    status: optionalString(status.status),
    candidateId: optionalString(status.candidate_id),
    candidateBranch: optionalString(status.candidate_branch),
    reviewState: optionalString(status.review_state),
    reviewDecision: optionalString(status.review_decision),
    reviewUrl: optionalString(status.review_url),
    reviewNumber: numberValue(status.review_number),
    baseBranch: optionalString(status.base_branch),
    headBranch: optionalString(status.head_branch),
    mergedAt: optionalString(status.merged_at),
    mergeCommit: optionalString(status.merge_commit),
    reviewMerged: status.review_merged === true,
    promotionExecutionReportRef: optionalString(
      status.promotion_execution_report_ref,
    ),
    graphRepositoryReviewStatusReportRef: optionalString(
      status.graph_repository_review_status_report_ref,
    ),
    operationCount: numberValue(status.operation_count),
    operations: records(status.operations).flatMap((item) => {
      const parsed = parseProductRepairRerunOperation(item);
      return parsed ? [parsed] : [];
    }),
    errorCount: numberValue(status.error_count),
    nextAction: optionalString(status.next_action),
  };
}

function parseReadModelPublication(raw: unknown): IdeaToSpecReadModelPublication {
  const publication = recordValue(raw);
  return {
    available: publication.available === true,
    ok: publication.ok === true,
    sourceMode: optionalString(publication.source_mode),
    status: optionalString(publication.status),
    dryRun: publication.dry_run === true,
    candidateId: optionalString(publication.candidate_id),
    candidateBranch: optionalString(publication.candidate_branch),
    reviewState: optionalString(publication.review_state),
    manifest: optionalString(publication.manifest),
    manifestName: optionalString(publication.manifest_name),
    bundleDir: optionalString(publication.bundle_dir),
    outputDir: optionalString(publication.output_dir),
    published: publication.published === true,
    readModelPublished: publication.read_model_published === true,
    fileCount: numberValue(publication.file_count),
    productReviewStatusReportRef: optionalString(
      publication.product_review_status_report_ref,
    ),
    graphRepositoryReviewStatusReportRef: optionalString(
      publication.graph_repository_review_status_report_ref,
    ),
    graphRepositoryPublishReadModelReportRef: optionalString(
      publication.graph_repository_publish_read_model_report_ref,
    ),
    operationCount: numberValue(publication.operation_count),
    operations: records(publication.operations).flatMap((item) => {
      const parsed = parseProductRepairRerunOperation(item);
      return parsed ? [parsed] : [];
    }),
    errorCount: numberValue(publication.error_count),
    nextAction: optionalString(publication.next_action),
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

function parseIdeaMaturityMetrics(raw: unknown): IdeaToSpecIdeaMaturityMetrics {
  const metrics = recordValue(raw);
  return {
    candidateNodeCount: numberValue(metrics.candidate_node_count),
    clarificationQuestionCount: numberValue(
      metrics.clarification_question_count,
    ),
    reviewRequiredQuestionCount: numberValue(
      metrics.review_required_question_count,
    ),
    blockingQuestionCount: numberValue(metrics.blocking_question_count),
    answeredQuestionCount: numberValue(metrics.answered_question_count),
    acceptedAnswerCount: numberValue(metrics.accepted_answer_count),
    deferredAnswerCount: numberValue(metrics.deferred_answer_count),
    invalidAnswerCount: numberValue(metrics.invalid_answer_count),
    materializedAnswerCount: numberValue(metrics.materialized_answer_count),
    unmaterializedAnswerCount: numberValue(metrics.unmaterialized_answer_count),
    answerMaterializationRate: optionalNumberValue(
      metrics.answer_materialization_rate,
    ),
    ontologyGapCountInitial: numberValue(metrics.ontology_gap_count_initial),
    ontologyGapResolvedCount: numberValue(metrics.ontology_gap_resolved_count),
    ontologyGapUnresolvedCount: numberValue(
      metrics.ontology_gap_unresolved_count,
    ),
    ontologyGapResolutionRate: optionalNumberValue(
      metrics.ontology_gap_resolution_rate,
    ),
    candidateGapCountInitial: numberValue(metrics.candidate_gap_count_initial),
    candidateGapResolvedCount: numberValue(metrics.candidate_gap_resolved_count),
    candidateGapUnresolvedCount: numberValue(
      metrics.candidate_gap_unresolved_count,
    ),
    candidateGapClosureRate: optionalNumberValue(
      metrics.candidate_gap_closure_rate,
    ),
    remainingBlockerCount: numberValue(metrics.remaining_blocker_count),
    staleRefCount: numberValue(metrics.stale_ref_count),
    failedGateCount: numberValue(metrics.failed_gate_count),
    dryRunCount: numberValue(metrics.dry_run_count),
    rerunCount: numberValue(metrics.rerun_count),
    rerunRequestCount: numberValue(metrics.rerun_request_count),
    manualHandoffCount: numberValue(metrics.manual_handoff_count),
    operatorCommandCount: numberValue(metrics.operator_command_count),
    promotionPathCount: numberValue(metrics.promotion_path_count),
    publishedFileCount: numberValue(metrics.published_file_count),
    timeToFirstCandidateSeconds: optionalNumberValue(
      metrics.time_to_first_candidate_seconds,
    ),
    timeToApprovalReadySeconds: optionalNumberValue(
      metrics.time_to_approval_ready_seconds,
    ),
    timeToFirstMaterializationSeconds: optionalNumberValue(
      metrics.time_to_first_materialization_seconds,
    ),
    lastProgressAt: optionalString(metrics.last_progress_at),
    stalledPhase: optionalString(metrics.stalled_phase),
  };
}

function parseIdeaMaturityFinding(
  raw: unknown,
): IdeaToSpecIdeaMaturityFinding | null {
  const finding = recordValue(raw);
  const findingId = optionalString(finding.finding_id);
  if (!findingId) return null;
  return {
    findingId,
    severity: stringValue(finding.severity, "unknown"),
    message: stringValue(finding.message, "No message supplied."),
    source: optionalString(finding.source),
    nextAction: optionalString(finding.next_action),
  };
}

function parseIdeaMaturityReadinessExplainer(
  raw: unknown,
): IdeaToSpecIdeaMaturityReadinessExplainer | null {
  const explainer = recordValue(raw);
  const id = optionalString(explainer.id);
  if (!id) return null;
  return {
    id,
    proposalId: optionalString(explainer.proposal_id),
    kind: stringValue(explainer.kind, "unknown"),
    source: optionalString(explainer.source),
    severity: stringValue(explainer.severity, "unknown"),
    blocks: strings(explainer.blocks),
    message: stringValue(explainer.message, "No message supplied."),
    nextAction: optionalString(explainer.next_action),
    evidenceRefs: strings(explainer.evidence_refs),
  };
}

function parseIdeaMaturityValidationReport(
  raw: unknown,
): IdeaToSpecIdeaMaturityValidationReport | null {
  const report = recordValue(raw);
  const status = optionalString(report.status);
  if (!status) return null;
  return {
    path: optionalString(report.path),
    status,
    diagnosticCount: numberValue(report.diagnostic_count),
  };
}

function parseIdeaMaturity(raw: unknown): IdeaToSpecIdeaMaturity {
  const maturity = recordValue(raw);
  const report = recordValue(maturity.report);
  const validation = recordValue(maturity.validation);
  const candidate = recordValue(report.candidate);
  const contract = recordValue(report.contract);
  const derivedState = recordValue(report.derived_state);
  const validator = recordValue(validation.validator);
  return {
    available: maturity.available === true,
    status: stringValue(maturity.status, "missing"),
    trusted: maturity.trusted === true,
    sourceRefs: strings(maturity.source_refs),
    report: {
      available: report.available === true,
      artifactKind: optionalString(report.artifact_kind),
      generatedAt: optionalString(report.generated_at),
      status: optionalString(report.status),
      proposalId: optionalString(report.proposal_id),
      contractRef: optionalString(report.contract_ref),
      contract: {
        schemaVersion: optionalNumberValue(contract.schema_version),
        schemaRef: optionalString(contract.schema_ref),
        validationReportSchemaRef: optionalString(
          contract.validation_report_schema_ref,
        ),
        validatorId: optionalString(contract.validator_id),
        validatorVersion: optionalString(contract.validator_version),
        compatibilityPolicy: optionalString(contract.compatibility_policy),
        compatibilityPolicyRef: optionalString(contract.compatibility_policy_ref),
        metricsRfcRef: optionalString(contract.metrics_rfc_ref),
        proposalId: optionalString(contract.proposal_id),
      },
      metricPackId: optionalString(report.metric_pack_id),
      metricPackRef: optionalString(report.metric_pack_ref),
      metricsRfcRef: optionalString(report.metrics_rfc_ref),
      authorityState: optionalString(report.authority_state),
      candidate: {
        candidateId: optionalString(candidate.candidate_id),
        workspaceRoute: optionalString(candidate.workspace_route),
        workflowLane: optionalString(candidate.workflow_lane),
        targetRepositoryRole: optionalString(candidate.target_repository_role),
        governanceProfile: optionalString(candidate.governance_profile),
      },
      derivedState: {
        lifecycleState: optionalString(derivedState.lifecycle_state),
        candidateApprovalState: optionalString(
          derivedState.candidate_approval_state,
        ),
        platformPromotionState: optionalString(
          derivedState.platform_promotion_state,
        ),
        reviewStatus: optionalString(derivedState.review_status),
        readModelPublicationState: optionalString(
          derivedState.read_model_publication_state,
        ),
        blockers: strings(derivedState.blockers),
      },
      metrics: parseIdeaMaturityMetrics(report.metrics),
      findings: records(report.findings).flatMap((item) => {
        const parsed = parseIdeaMaturityFinding(item);
        return parsed ? [parsed] : [];
      }),
      readinessExplainers: records(report.readiness_explainers).flatMap((item) => {
        const parsed = parseIdeaMaturityReadinessExplainer(item);
        return parsed ? [parsed] : [];
      }),
      sourceArtifacts: strings(report.source_artifacts),
    },
    validation: {
      available: validation.available === true,
      artifactKind: optionalString(validation.artifact_kind),
      generatedAt: optionalString(validation.generated_at),
      metricPackId: optionalString(validation.metric_pack_id),
      summary: recordValue(validation.summary),
      validator: {
        id: optionalString(validator.id),
        version: optionalString(validator.version),
        rfcRef: optionalString(validator.rfc_ref),
        schemaRef: optionalString(validator.schema_ref),
        validationReportSchemaRef: optionalString(
          validator.validation_report_schema_ref,
        ),
        scriptRef: optionalString(validator.script_ref),
        compatibilityPolicyRef: optionalString(
          validator.compatibility_policy_ref,
        ),
      },
      reports: records(validation.reports).flatMap((item) => {
        const parsed = parseIdeaMaturityValidationReport(item);
        return parsed ? [parsed] : [];
      }),
    },
    reportError: recordValue(maturity.report_error),
    validationError: recordValue(maturity.validation_error),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayRecalculateMetrics: false,
      mayExecuteMetricsValidator: false,
      mayMutateCandidateArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayExecuteGitService: false,
      mayCreateBranchOrCommit: false,
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

function parseGuidedFlowBoundary(): IdeaToSpecGuidedFlowBoundary {
  return {
    inspectOnly: true,
    acknowledgeOnly: true,
    mayExecuteSpecgraph: false,
    mayExecutePlatform: false,
    mayExecuteGitService: false,
    mayMutateCandidateArtifacts: false,
    mayMutateCanonicalSpecs: false,
    mayWriteOntologyPackage: false,
    mayAcceptOntologyTerms: false,
    mayCreateBranchOrCommit: false,
    mayOpenPullRequest: false,
    mayMergeReview: false,
  };
}

function parseGuidedFlowStage(
  raw: unknown,
): IdeaToSpecGuidedFlowStage | null {
  const stage = recordValue(raw);
  const id = optionalString(stage.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(stage.label, id),
    status: stringValue(stage.status, "unknown"),
    primaryNextAction: stringValue(
      stage.primary_next_action,
      "Inspect this lifecycle stage.",
    ),
    blockers: strings(stage.blockers),
    evidenceRefs: strings(stage.evidence_refs),
    targetSection: optionalString(stage.target_section),
    commandTemplate: optionalString(stage.command_template),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseGuidedFlowNextAction(
  raw: unknown,
): IdeaToSpecGuidedFlowNextAction | null {
  const action = recordValue(raw);
  const id = optionalString(action.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(action.label, "Inspect current stage."),
    status: stringValue(action.status, "unknown"),
    targetSection: optionalString(action.target_section),
    commandTemplate: optionalString(action.command_template),
    evidenceRefs: strings(action.evidence_refs),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseGuidedFlow(raw: unknown): IdeaToSpecGuidedFlow {
  const flow = recordValue(raw);
  return {
    currentStage: stringValue(flow.current_stage, "unknown"),
    currentStageLabel: stringValue(flow.current_stage_label, "Current stage"),
    overallStatus: stringValue(flow.overall_status, "unknown"),
    workflowStage: stringValue(flow.workflow_stage, "unknown"),
    workflowStatus: stringValue(flow.workflow_status, "unknown"),
    nextHandoff: parseNextHandoff(flow.next_handoff),
    nextActions: records(flow.next_actions).flatMap((item) => {
      const parsed = parseGuidedFlowNextAction(item);
      return parsed ? [parsed] : [];
    }),
    stages: records(flow.stages).flatMap((item) => {
      const parsed = parseGuidedFlowStage(item);
      return parsed ? [parsed] : [];
    }),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function guidedFlowBoundaryIsSafe(raw: unknown): boolean {
  const boundary = recordValue(raw);
  const falseFlags = [
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_git_service",
    "may_mutate_candidate_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_merge_review",
  ];
  return (
    boundary.inspect_only === true &&
    boundary.acknowledge_only === true &&
    falseFlags.every((flag) => boundary[flag] === false)
  );
}

function guidedFlowBoundariesAreSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  if (!guidedFlowBoundaryIsSafe(raw.authority_boundary)) return false;
  for (const stage of records(raw.stages)) {
    if (!guidedFlowBoundaryIsSafe(stage.authority_boundary)) return false;
  }
  for (const action of records(raw.next_actions)) {
    if (!guidedFlowBoundaryIsSafe(action.authority_boundary)) return false;
  }
  return true;
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

function parseWorkspaceStateHygieneItem(
  raw: unknown,
): IdeaToSpecWorkspaceStateHygieneItem | null {
  const item = recordValue(raw);
  const kind = optionalString(item.kind);
  if (!kind) return null;
  return {
    kind,
    artifactType: optionalString(item.artifact_type),
    status: stringValue(item.status, "unknown"),
    reason: optionalString(item.reason),
    path: optionalString(item.path),
    storedWorkspaceId: optionalString(item.stored_workspace_id),
    storedCandidateId: optionalString(item.stored_candidate_id),
    storedRepairSessionId: optionalString(item.stored_repair_session_id),
    storedRepairSessionRef: optionalString(item.stored_repair_session_ref),
    currentWorkspaceId: optionalString(item.current_workspace_id),
    currentCandidateId: optionalString(item.current_candidate_id),
    currentRepairSessionId: optionalString(item.current_repair_session_id),
    currentRepairSessionRef: optionalString(item.current_repair_session_ref),
    recordCount: numberValue(item.record_count),
    currentRecordCount: numberValue(item.current_record_count),
    staleRecordCount: numberValue(item.stale_record_count),
    blocks: strings(item.blocks),
    nextAction: optionalString(item.next_action),
  };
}

function parseWorkspaceStateRecommendedAction(
  raw: unknown,
): IdeaToSpecWorkspaceStateRecommendedAction | null {
  const action = recordValue(raw);
  const id = optionalString(action.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(action.label, id),
    reason: optionalString(action.reason),
    targetState: optionalString(action.target_state),
    targetSection: optionalString(action.target_section),
    requiresCurrentRepairSession: action.requires_current_repair_session === true,
    workspaceId: optionalString(action.workspace_id),
    candidateId: optionalString(action.candidate_id),
    repairSessionId: optionalString(action.repair_session_id),
    repairSessionRef: optionalString(action.repair_session_ref),
    enabled: action.enabled === true,
    blockers: strings(action.blockers),
    uiIntent: optionalString(action.ui_intent),
    commandHint: optionalString(action.command_hint),
    evidenceRefs: strings(action.evidence_refs),
    authorityBoundary: recordValue(action.authority_boundary),
  };
}

function parseWorkspaceStateHygiene(
  raw: unknown,
): IdeaToSpecWorkspaceStateHygiene {
  const hygiene = recordValue(raw);
  const summary = recordValue(hygiene.summary);
  return {
    available: hygiene.artifact_kind === "specspace_idea_to_spec_workspace_state_hygiene",
    status: stringValue(summary.status, "missing"),
    workspaceId: optionalString(hygiene.workspace_id),
    candidateId: optionalString(hygiene.candidate_id),
    repairSessionId: optionalString(hygiene.repair_session_id),
    repairSessionRef: optionalString(hygiene.repair_session_ref),
    usableStateCount: numberValue(summary.usable_state_count),
    missingStateCount: numberValue(summary.missing_state_count),
    staleStateCount: numberValue(summary.stale_state_count),
    invalidStateCount: numberValue(summary.invalid_state_count),
    blockingStateCount: numberValue(summary.blocking_state_count),
    recommendedActionCount: numberValue(summary.recommended_action_count),
    enabledRecommendedActionCount: numberValue(
      summary.enabled_recommended_action_count,
    ),
    nextAction: optionalString(summary.next_action),
    states: records(hygiene.states).flatMap((item) => {
      const parsed = parseWorkspaceStateHygieneItem(item);
      return parsed ? [parsed] : [];
    }),
    recommendedActions: records(hygiene.recommended_actions).flatMap((item) => {
      const parsed = parseWorkspaceStateRecommendedAction(item);
      return parsed ? [parsed] : [];
    }),
    authorityBoundary: recordValue(hygiene.authority_boundary),
    actionBoundary: recordValue(hygiene.action_boundary),
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
  if (
    isRecord(raw.guided_flow) &&
    !guidedFlowBoundariesAreSafe(raw.guided_flow)
  ) {
    return { kind: "parse-error", reason: "guided flow boundary expanded", raw };
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
  const hasWorkspaceStateHygiene = isRecord(raw.workspace_state_hygiene);
  const workspaceStateHygiene = recordValue(raw.workspace_state_hygiene);
  if (hasWorkspaceStateHygiene) {
    const hygieneAuthority = recordValue(workspaceStateHygiene.authority_boundary);
    const hygieneAction = recordValue(workspaceStateHygiene.action_boundary);
    const hygieneAuthorityFalseFlags = [
      "workspace_state_hygiene_is_authority",
      "may_execute_specgraph",
      "may_execute_platform",
      "may_execute_git_service",
      "may_apply_answers",
      "may_apply_decisions",
      "may_mutate_candidate_artifacts",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_create_branch_or_commit",
      "may_open_pull_request",
    ];
    const hygieneActionFalseFlags = [
      "may_clear_state",
      "may_apply_state",
      "may_delete_state",
    ];
    for (const flag of hygieneAuthorityFalseFlags) {
      if (hygieneAuthority[flag] !== false) {
        return { kind: "parse-error", reason: `workspace state hygiene boundary must explicitly disable: ${flag}`, raw };
      }
    }
    for (const flag of hygieneActionFalseFlags) {
      if (hygieneAction[flag] !== false) {
        return { kind: "parse-error", reason: `workspace state hygiene boundary expanded: ${flag}`, raw };
      }
    }
    if (
      hygieneAction.inspect_only !== true ||
      hygieneAction.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "workspace state hygiene boundary must be inspect-only", raw };
    }
    for (const action of records(workspaceStateHygiene.recommended_actions)) {
      const actionBoundary = recordValue(action.authority_boundary);
      const actionFalseFlags = [
        "may_execute_specgraph",
        "may_execute_platform",
        "may_execute_git_service",
        "may_apply_answers",
        "may_apply_decisions",
        "may_mutate_candidate_artifacts",
        "may_mutate_canonical_specs",
        "may_write_ontology_package",
        "may_accept_ontology_terms",
        "may_clear_state",
        "may_delete_state",
        "may_create_branch_or_commit",
        "may_open_pull_request",
      ];
      if (
        actionBoundary.inspect_only !== true ||
        actionBoundary.operator_intent_only !== true
      ) {
        return { kind: "parse-error", reason: "workspace state hygiene recommended action must be inspect-only", raw };
      }
      for (const flag of actionFalseFlags) {
        if (actionBoundary[flag] !== false) {
          return { kind: "parse-error", reason: `workspace state hygiene recommended action boundary expanded: ${flag}`, raw };
        }
      }
    }
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
  const hasIdeaMaturity = isRecord(raw.idea_maturity);
  const ideaMaturity = recordValue(raw.idea_maturity);
  if (hasIdeaMaturity) {
    const ideaMaturityBoundary = recordValue(ideaMaturity.action_boundary);
    const ideaMaturityFalseFlags = [
      "may_recalculate_metrics",
      "may_execute_metrics_validator",
      "may_mutate_candidate_artifacts",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_execute_git_service",
      "may_create_branch_or_commit",
    ];
    for (const flag of ideaMaturityFalseFlags) {
      if (ideaMaturityBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `idea maturity boundary expanded: ${flag}`, raw };
      }
    }
    if (
      ideaMaturityBoundary.inspect_only !== true ||
      ideaMaturityBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "idea maturity boundary must be inspect-only", raw };
    }
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
      guidedFlow: parseGuidedFlow(raw.guided_flow),
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
      workspaceStateHygiene: parseWorkspaceStateHygiene(workspaceStateHygiene),
      ideaMaturity: parseIdeaMaturity(ideaMaturity),
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
        productPromotionExecution: parseProductPromotionExecution(
          controlledPromotion.product_promotion_execution,
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
