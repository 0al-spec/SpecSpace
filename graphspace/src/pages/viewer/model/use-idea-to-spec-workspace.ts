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
  targetRef: string | null;
  nextAction: string | null;
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

export type IdeaToSpecRealIdeaAnswerTarget = {
  targetId: string;
  targetType: string;
  requestId: string;
  requestKind: string | null;
  severity: string;
  status: string;
  question: string | null;
  targetArtifact: string | null;
  targetRef: string | null;
  acceptedActions: readonly string[];
  suggestedAnswerShape: string | null;
  valueTemplatesByAction: Record<string, unknown>;
  requiredFieldsByAction: Record<string, readonly string[]>;
  evidenceRefs: readonly string[];
};

export type IdeaToSpecRealIdeaAnswerAuthoring = {
  available: boolean;
  template: {
    available: boolean;
    clarificationOutcome: string;
    workspaceId: string | null;
    candidateId: string | null;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    stage: string | null;
    runDir: string | null;
    contractRef: string | null;
    summary: Record<string, unknown>;
    targetCount: number;
    blockingTargetCount: number;
    answerableTargetCount: number;
    unsupportedTargetCount: number;
    targets: readonly IdeaToSpecRealIdeaAnswerTarget[];
    findings: readonly IdeaToSpecFinding[];
  };
  report: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    operation: string | null;
    stage: string | null;
    summary: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
    findingCount: number;
  };
  answerSet: {
    available: boolean;
    artifactKind: string | null;
    contractRef: string | null;
    answerCount: number;
  };
  validation: {
    status: string;
    ready: boolean;
    findingCount: number;
  };
  recommendedActions: readonly {
    id: string;
    label: string;
    nextAction: string;
  }[];
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayExecuteSpecgraph: false;
    mayExecutePlatform: false;
    mayApplyAnswers: false;
    mayMutateCandidateSourceArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayCreateBranchOrCommit: false;
  };
};

export type IdeaToSpecRealIdeaAnswerContinuation = {
  available: boolean;
  ready: boolean;
  importPreview: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    acceptedAnswerCount: number | null;
    answerCount: number;
    findings: readonly IdeaToSpecFinding[];
    sourceArtifacts: Record<string, unknown>;
  };
  continuationReport: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    outputs: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
  };
  recommendedActions: readonly {
    id: string;
    label: string;
    nextAction: string;
    commandHint: string | null;
  }[];
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayExecuteSpecgraph: false;
    mayExecutePlatform: false;
    mayApplyAnswers: false;
    mayMutateCandidateSourceArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayCreateBranchOrCommit: false;
  };
};

export type IdeaToSpecRealIdeaIntake = {
  available: boolean;
  status: string;
  workspaceId: string | null;
  sessionRef: string | null;
  clarifiedSessionRef: string | null;
  candidateSourceRef: string | null;
  activeCandidateRef: string | null;
  nextAction: string;
  blockers: readonly string[];
  clarificationProgress: {
    questionCount: number;
    answeredCount: number;
    missingCount: number;
    invalidAnswerCount: number;
    staleAnswerCount: number;
    requiredFieldFindings: readonly IdeaToSpecFinding[];
  };
  answerTemplate: {
    clarificationOutcome: string;
    status: string;
    templateRef: string | null;
    targetCount: number;
    blockingTargetCount: number;
    answerableTargetCount: number;
    unsupportedTargetCount: number;
    requiredFields: readonly string[];
    validationStatus: string;
    validationReady: boolean;
  };
  continuationHandoff: {
    importPreviewStatus: string;
    materializationStatus: string;
    safeToContinue: boolean;
    outputRefs: readonly string[];
    commandHint: string | null;
  };
  entryExecution: {
    available: boolean;
    ok: boolean;
    dryRun: boolean;
    status: string;
    runDir: string | null;
    target: string | null;
    entryRequestsHandoffRef: string | null;
    outputRefs: readonly string[];
    outputArtifactCount: number;
    diagnosticCount: number;
    operations: readonly IdeaToSpecProductRepairRerunOperation[];
    outputArtifacts: readonly IdeaToSpecProductRepairRerunOutputArtifact[];
  };
  sourceRefs: readonly string[];
  authorityBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayExecuteSpecgraph: false;
    mayExecutePlatform: false;
    mayExecutePromptAgent: false;
    mayApplyAnswers: false;
    mayMutateCandidateSourceArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayCreateBranchOrCommit: false;
  };
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

export type IdeaToSpecProjectLocalOntologyTerm = {
  id: string;
  term: string | null;
  termKey: string;
  status: string;
  selectedDecisionId: string | null;
  sourceRefs: readonly string[];
  suggestedActions: readonly string[];
  evidenceRefs: readonly string[];
  gapRefs: readonly {
    gapId: string | null;
    nodeId: string | null;
    targetRef: string | null;
    sourceRef: string | null;
    sourceKind: string | null;
    statement: string | null;
    suggestedAction: string | null;
  }[];
  resolvedGapRefs: readonly {
    gapId: string | null;
    nodeId: string | null;
    targetRef: string | null;
    decision: string | null;
    matchKind: string | null;
  }[];
  decisions: readonly {
    id: string | null;
    decisionType: string | null;
    reviewStatus: string | null;
    term: string | null;
    termScope: string | null;
    ontologyRef: string | null;
    aliasOf: string | null;
    targetRef: string | null;
    reason: string | null;
  }[];
  effect: {
    candidateReadinessEffect: string | null;
    nextAction: string | null;
    resolvedGapCount: number;
  };
};

export type IdeaToSpecProjectLocalOntologyImportDecision = {
  id: string;
  sourceDecisionId: string | null;
  sourceArtifact: string | null;
  decisionType: string | null;
  reviewAction: string | null;
  status: string | null;
  materializationIntent: string | null;
  term: string | null;
  termKey: string | null;
  targetRef: string | null;
  gapRefs: readonly {
    gapId: string | null;
    nodeId: string | null;
    targetRef: string | null;
    sourceRef: string | null;
  }[];
  decisionValue: Record<string, unknown>;
  writesOntologyPackage: boolean;
  acceptsOntologyTerms: boolean;
  appliesToSpecgraph: boolean;
};

export type IdeaToSpecProjectLocalOntologyImportIssue = {
  id: string;
  decisionId: string | null;
  termKey: string | null;
  term: string | null;
  action: string | null;
  reason: string | null;
  field: string | null;
  expected: string | null;
  actual: string | null;
  status: string | null;
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

export type IdeaToSpecIntakeAnswer = {
  requestId: string;
  answerKind: string;
  status: string;
  authority: string | null;
  targetArtifact: string | null;
  targetRef: string | null;
  refs: readonly string[];
  entries: readonly string[];
  relations: readonly IdeaToSpecWorkflowRelation[];
  text: string | null;
};

export type IdeaToSpecWorkflowRelation = {
  relation: string;
  sourceRef: string;
  targetRef: string;
  rationale: string | null;
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
  reviewProbeOnly: boolean;
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

export type IdeaToSpecStructuralDepthDelta = {
  available: boolean;
  proposalId: string | null;
  status: string | null;
  before: Record<string, number>;
  after: Record<string, number>;
  delta: Record<string, number>;
  addedEventStormingEntryRefs: Record<string, readonly string[]>;
  addedEventStormingEntryCount: number;
  addedWorkflowRelationCount: number;
  addedWorkflowRelations: readonly {
    relation: string | null;
    sourceRef: string | null;
    targetRef: string | null;
    reviewOnly: boolean;
    materializationDependency: boolean;
  }[];
  remainingShallowDimensions: readonly string[];
  reviewOnly: boolean;
  canonicalMutationsAllowed: boolean;
  materializationDependency: boolean;
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
  candidateStructureDepth: {
    available: boolean;
    actorCount: number;
    commandCount: number;
    domainEventCount: number;
    policyCount: number;
    constraintCount: number;
    topologyEdgeCount: number;
    workflowEdgeCount: number;
    requirementCount: number;
    acceptanceCriteriaCount: number;
  };
  clarificationQuestionCount: number;
  reviewRequiredQuestionCount: number;
  blockingQuestionCount: number;
  answeredQuestionCount: number;
  acceptedAnswerCount: number;
  deferredAnswerCount: number;
  invalidAnswerCount: number;
  materializedAnswerCount: number;
  unmaterializedAnswerCount: number;
  perGapMaterializedAnswerCount: number | null;
  consumedAnswerCount: number;
  aggregateAnswerCount: number;
  dismissedAnswerCount: number;
  closureEvidenceAnswerCount: number | null;
  ordinaryUnmaterializedAnswerCount: number | null;
  answerMaterializationRate: number | null;
  ontologyGapCountInitial: number;
  ontologyGapResolvedCount: number;
  ontologyGapUnresolvedCount: number;
  ontologyGapResolutionRate: number | null;
  projectLocalOntologyReview: {
    status: string | null;
    acceptedDecisionCount: number;
    maturityEvidenceDecisionCount: number;
    keepProjectLocalCount: number;
    bindExistingCount: number;
    aliasCount: number;
    requestPromotionCount: number;
    rejectCount: number;
    deferredCount: number;
    nonResolvingDecisionCount: number;
    invalidDecisionCount: number;
    missingDecisionCount: number;
    blockingDecisionCount: number;
    followUpDecisionCount: number;
    effectCount: number;
    readyForMaturity: boolean;
    evidenceRefs: readonly string[];
  };
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

export type IdeaToSpecGuidedApprovalBoundary = IdeaToSpecGuidedFlowBoundary & {
  mayMaterializeCandidateApprovalDecision: false;
  mayCreatePromotionRequest: false;
  mayPublishReadModel: false;
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

export type IdeaToSpecProductWorkspaceOverviewPhase = {
  id: string;
  label: string;
  state: string;
  targetSection: string | null;
  blockers: readonly string[];
  evidenceRefs: readonly string[];
};

export type IdeaToSpecQualityGuidedAction = {
  id: string;
  rank: number;
  category: string;
  disposition: string;
  label: string;
  reason: string;
  owner: string;
  status: string;
  targetSection: string | null;
  blockers: readonly string[];
  evidenceRefs: readonly string[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecQualityGuidedActionRanking = {
  available: boolean;
  policyId: string | null;
  candidateCount: number;
  omittedCount: number;
  primaryAction: IdeaToSpecQualityGuidedAction;
  secondaryActions: readonly IdeaToSpecQualityGuidedAction[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecProductWorkspaceOverview = {
  available: boolean;
  status: string;
  currentPhase: string;
  currentPhaseLabel: string;
  nextSafeAction: string;
  primaryTargetSection: string | null;
  actionRanking: IdeaToSpecQualityGuidedActionRanking;
  readiness: {
    status: string;
    ready: boolean;
    blockerCount: number;
    blockers: readonly string[];
  };
  completedPhaseCount: number;
  totalPhaseCount: number;
  lastSuccessfulHandoff: {
    stageId: string | null;
    label: string | null;
    targetSection: string | null;
    evidenceRefs: readonly string[];
  };
  confidence: {
    level: string;
    reason: string | null;
    sourceRefs: readonly string[];
    maturityLifecycleState: string | null;
  };
  phases: readonly IdeaToSpecProductWorkspaceOverviewPhase[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecManagedOperationRef = {
  ref: string;
  kind: string;
  artifactKey: string | null;
  available: boolean;
  status: string | null;
  reason: string | null;
  artifactKind: string | null;
  contractRef: string | null;
  dynamic: boolean;
};

export type IdeaToSpecManagedOperation = {
  operationId: string;
  category: string;
  lifecycleStage: string;
  uiStage: string;
  endpoint: string;
  platformCommand: readonly string[];
  status: string;
  targetSection: string | null;
  nextSafeAction: string;
  inputRefs: readonly IdeaToSpecManagedOperationRef[];
  outputReports: readonly IdeaToSpecManagedOperationRef[];
  missingInputRefs: readonly string[];
  availableOutputRefs: readonly string[];
  hostedTransport: {
    available: boolean;
    status: string | null;
    requestId: string | null;
    attempt: number | null;
    outputReports: readonly { logicalRef: string; sha256: string }[];
    transportStatusIsLifecycleEvidence: false;
  };
  idempotencyKey: string | null;
  overwritePolicy: string | null;
  timeoutPolicy: string | null;
  replayPolicy: string | null;
  dryRunOnly: boolean;
  irreversible: boolean;
  requiresExplicitConfirmation: boolean;
  notes: string | null;
};

export type IdeaToSpecManagedOperationsGroup = {
  phase: string;
  label: string;
  operationIds: readonly string[];
};

export type IdeaToSpecManagedOperationsObservability = {
  available: boolean;
  surfaceId: string | null;
  surfaceKind: string | null;
  summary: {
    operationCount: number;
    completedCount: number;
    failedCount: number;
    staleCount: number;
    requestNeededCount: number;
    readyToExecuteCount: number;
    executionRequestedCount: number;
    newRequestRequiredCount: number;
    gateNeededCount: number;
  };
  statusCounts: Record<string, number>;
  groups: readonly IdeaToSpecManagedOperationsGroup[];
  operations: readonly IdeaToSpecManagedOperation[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecManagedModeReadiness = {
  available: boolean;
  surfaceId: string | null;
  surfaceKind: string | null;
  status: string;
  mode: string;
  nextSafeAction: string;
  disabledReasons: readonly string[];
  executor: {
    enabled: boolean;
    configured: boolean;
    transport: string;
    platformDirConfigured: boolean;
    platformCliPresent: boolean;
    timeoutSeconds: number | null;
    hostedEnabled: boolean;
    hostedServiceConfigured: boolean;
    hostedServiceReachable: boolean;
    hostedEnabledOperationIds: readonly string[];
    hostedServiceOperationIds: readonly string[];
    hostedClientOperationIds: readonly string[];
  };
  operations: {
    registeredCount: number;
    enabledCount: number;
    disabledCount: number;
  };
  state: {
    durability: string | null;
    restartPersistent: boolean | null;
    providerKind: string;
    providerStatus: string;
    providerReady: boolean;
    providerContractRef: string | null;
    providerAdapter: string | null;
    externalRequired: boolean;
    specspaceStateDirConfigured: boolean;
    specspaceStateDirReady: boolean;
    specspaceStateDirWritable: boolean;
    runsDirConfigured: boolean;
    runsDirReady: boolean;
    runsDirWritable: boolean;
  };
  provider: {
    status: string;
    kind: string;
    readOnly: boolean;
    reason: string | null;
  };
  workspace: {
    workspaceId: string | null;
    productWorkspace: boolean;
    productWorkspaceArtifactBaseConfigured: boolean | null;
    artifactBaseStatus: string;
    bindingStatus: string;
    bindingId: string | null;
  };
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecGuidedRepairCheckpoint = {
  id: string;
  label: string;
  status: string;
  count: number | null;
  targetSection: string | null;
  evidenceRefs: readonly string[];
};

export type IdeaToSpecGuidedApprovalCheckpoint = {
  id: string;
  label: string;
  status: string;
  targetSection: string | null;
  evidenceRefs: readonly string[];
  detail: string | null;
};

export type IdeaToSpecGuidedRepairPath = {
  available: boolean;
  stage: string;
  nextAction: string;
  targetSection: string | null;
  blockers: readonly string[];
  counts: {
    repairRequestCount: number;
    productSpecTargetCount: number;
    acceptedAnswerCount: number;
    unresolvedBlockingAnswerCount: number;
    ontologyGapRequestCount: number;
    ontologyDecisionCount: number;
    projectLocalTermCount: number;
    projectLocalMissingDecisionCount: number;
    projectLocalInvalidDecisionCount: number;
    projectLocalNonResolvingDecisionCount: number;
    unresolvedOntologyGapCount: number;
    unresolvedCandidateGapCount: number;
  };
  state: {
    repairDraftsStatus: string | null;
    rerunRequestStatus: string | null;
    requestGateStatus: string | null;
    rerunExecutionStatus: string | null;
    rerunPublicationStatus: string | null;
  };
  checkpoints: readonly IdeaToSpecGuidedRepairCheckpoint[];
  evidenceRefs: readonly string[];
  authorityBoundary: IdeaToSpecGuidedFlowBoundary;
};

export type IdeaToSpecGuidedApprovalPath = {
  available: boolean;
  stage: string;
  status: string;
  nextAction: string;
  targetSection: string | null;
  blockers: readonly string[];
  counts: {
    promotionPathCount: number;
    remainingBlockerCount: number;
    approvedPathCount: number;
    promotionCommitPathCount: number;
    promotionOperationCount: number;
  };
  state: {
    approvalReadinessStatus: string | null;
    approvalIntentStatus: string | null;
    approvalExecutionStatus: string | null;
    candidateApprovalState: string | null;
    promotionRequestOk: boolean;
    promotionExecutionStatus: string | null;
    reviewState: string | null;
    readModelPublished: boolean;
  };
  checkpoints: readonly IdeaToSpecGuidedApprovalCheckpoint[];
  evidenceRefs: readonly string[];
  authorityBoundary: IdeaToSpecGuidedApprovalBoundary;
};

export type IdeaToSpecOverviewItem = {
  id: string;
  displayAlias: string | null;
  title: string | null;
  label: string | null;
  kind: string | null;
  detail: string | null;
};

export type IdeaToSpecOverviewEdge = {
  id: string;
  relation: string | null;
  from: string | null;
  fromDisplayAlias: string | null;
  to: string | null;
  toDisplayAlias: string | null;
  label: string | null;
};

export type IdeaToSpecOntologyApplicabilityRecord = {
  id: string;
  layer: string | null;
  text: string | null;
};

export type IdeaToSpecOntologyApplicabilityScope = {
  domains: readonly string[];
  lifecyclePhases: readonly string[];
  agentTypes: readonly string[];
  subsystems: readonly string[];
  runtimes: readonly string[];
  platforms: readonly string[];
  contexts: readonly string[];
};

export type IdeaToSpecOntologyApplicabilityChange = {
  kind: string;
  ref: string;
  targetKind: string | null;
  before: string | null;
  after: string | null;
  compatibility: string | null;
};

export type IdeaToSpecOntologyApplicabilityProfile = {
  packageId: string | null;
  packageRef: string | null;
  status: string | null;
  appliesTo: IdeaToSpecOntologyApplicabilityScope;
  excludes: IdeaToSpecOntologyApplicabilityScope;
  assumptions: readonly IdeaToSpecOntologyApplicabilityRecord[];
  invalidationTriggers: readonly IdeaToSpecOntologyApplicabilityRecord[];
};

export type IdeaToSpecCandidateOverview = {
  available: boolean;
  readiness: {
    ready: boolean;
    reviewState: string | null;
    blockedBy: readonly string[];
    nextArtifact: string | null;
  };
  summary: {
    candidateId: string | null;
    displayName: string | null;
    graphSource: string | null;
    nodeCount: number;
    edgeCount: number;
    workflowEdgeCount: number;
    remainingBlockerCount: number;
    findingCount: number;
    readyForCandidateApproval: boolean;
    readyForPlatformPromotion: boolean;
    projectLocalOntologyReviewStatus: string | null;
  };
  candidate: {
    candidateId: string | null;
    displayName: string | null;
    workspaceRoute: string | null;
    workflowLane: string | null;
  };
  narrative: {
    productIntent: string | null;
    understoodScope: string | null;
    readiness: string | null;
    nextAction: string | null;
  };
  eventStorming: {
    actorCount: number;
    commandCount: number;
    domainEventCount: number;
    policyCount: number;
    constraintCount: number;
    actors: readonly IdeaToSpecOverviewItem[];
    commands: readonly IdeaToSpecOverviewItem[];
    domainEvents: readonly IdeaToSpecOverviewItem[];
    policies: readonly IdeaToSpecOverviewItem[];
    constraints: readonly IdeaToSpecOverviewItem[];
  };
  candidateNodes: {
    aliasCount: number;
    aliasByNodeId: Readonly<Record<string, string>>;
    nodes: readonly IdeaToSpecOverviewItem[];
  };
  topology: {
    edgeCount: number;
    workflowEdgeCount: number;
    relationCounts: Record<string, number>;
    edges: readonly IdeaToSpecOverviewEdge[];
  };
  repair: {
    remainingBlockerCount: number;
    resolvedOntologyGapCount: number;
    resolvedCandidateGapCount: number;
    removedGapCount: number;
  };
  ideaMaturity: {
    status: string | null;
    lifecycleState: string | null;
    trusted: boolean;
  };
  projectLocalOntology: {
    status: string | null;
    termCount: number;
    acceptedDecisionCount: number;
    blockingDecisionCount: number;
  };
  ontologyApplicability: {
    status: string | null;
    reviewOnly: boolean;
    profileCount: number;
    assumptionCount: number;
    invalidationTriggerCount: number;
    profiles: readonly IdeaToSpecOntologyApplicabilityProfile[];
    changeClassification: {
      status: string | null;
      diffPackageRefs: readonly string[];
      matchedPackageRefs: readonly string[];
      structuralChanges: readonly IdeaToSpecOntologyApplicabilityChange[];
      annotationChanges: readonly IdeaToSpecOntologyApplicabilityChange[];
      applicabilityChanges: readonly IdeaToSpecOntologyApplicabilityChange[];
      classifiedChangeCount: number;
    };
    sourceRefs: readonly string[];
    authorityBoundary: {
      mayInferApplicability: false;
      mayEnforceRuntimePolicy: false;
      mayMutateCandidateArtifacts: false;
      mayWriteOntologyPackage: false;
      mayAcceptOntologyTerms: false;
      mayApproveCandidate: false;
      mayPromoteCandidate: false;
    };
  };
  nextAction: {
    actionId: string | null;
    label: string | null;
    source: string | null;
    evidenceRefs: readonly string[];
  };
  actionBoundary: {
    inspectOnly: true;
    acknowledgeOnly: true;
    mayExecuteSpecgraph: false;
    mayExecutePlatform: false;
    mayMutateCandidateArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayAcceptOntologyTerms: false;
    mayCreateBranchOrCommit: false;
  };
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

export type IdeaToSpecWorkspaceCreation = {
  artifactKind: "specspace_product_workspace_creation_request_state" | null;
  selectedWorkspaceId: string | null;
  status: string;
  requestCount: number;
  activeRequestedCount: number;
  invalidRequestCount: number;
  nextGap: string | null;
  activeRequest: {
    requestId: string;
    workspaceId: string;
    displayName: string;
    route: string;
    rootIntentSummary: string | null;
    rootIntentSummaryPresent: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  initialization: {
    available: boolean;
    trusted: boolean;
    initialized: boolean;
    requestStatus: string | null;
    requestReadyForManagedExecution: boolean;
    requestedOperation: string | null;
    idempotencyKey: string | null;
    executionStatus: string | null;
    catalogWritten: boolean;
    workspaceFilesCreated: boolean;
  };
};

export type IdeaToSpecWorkspaceInitializationPath = {
  available: boolean;
  status: string;
  workspaceId: string | null;
  displayName: string | null;
  initialIdeaPresent: boolean;
  creationRequestRef: string | null;
  initializationRequestRef: string | null;
  initializationReportRef: string | null;
  nextSafeAction: string | null;
  blockers: readonly string[];
  managedExecutionAvailable: boolean;
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
  workspaceCreation: IdeaToSpecWorkspaceCreation;
  workspaceInitializationPath: IdeaToSpecWorkspaceInitializationPath;
  productWorkspaceOverview: IdeaToSpecProductWorkspaceOverview;
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
    projectLocalOntologyTermCount: number;
    projectLocalOntologyImportAcceptedCount: number;
    projectLocalOntologyImportMissingCount: number;
    projectLocalOntologyImportInvalidCount: number;
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
  guidedRepairPath: IdeaToSpecGuidedRepairPath;
  guidedApprovalPath: IdeaToSpecGuidedApprovalPath;
  managedOperations: IdeaToSpecManagedOperationsObservability;
  managedModeReadiness: IdeaToSpecManagedModeReadiness;
  realIdeaIntake: IdeaToSpecRealIdeaIntake;
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
  intakeClarification: {
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
      blockingRequestCount: number;
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
      answers: readonly IdeaToSpecIntakeAnswer[];
      answerCount: number;
      acceptedAnswerCount: number;
      unresolvedBlockingCount: number;
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
      acceptedTargetCount: number;
    };
    clarifiedSession: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
    };
    clarifiedSource: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
    };
    rerunReport: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      acceptedTargetCount: number;
    };
    answerAuthoring: IdeaToSpecRealIdeaAnswerAuthoring;
    answerContinuation: IdeaToSpecRealIdeaAnswerContinuation;
    sourceRefs: readonly string[];
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
      mayExecuteSpecgraph: false;
      mayExecutePromptAgent: false;
      mayApplyAnswers: false;
      mayMutateCandidateSourceArtifacts: false;
      mayMutateCanonicalSpecs: false;
      mayWriteOntologyPackage: false;
      mayAcceptOntologyTerms: false;
      mayCreateBranchOrCommit: false;
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
  candidateOverview: IdeaToSpecCandidateOverview;
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
        structuralDepthDelta: IdeaToSpecStructuralDepthDelta;
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
  projectLocalOntologyReview: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    effectiveReview: {
      available: boolean;
      readiness: {
        ready: boolean;
        reviewState: string | null;
        blockedBy: readonly string[];
        nextArtifact: string | null;
      };
      summary: Record<string, unknown>;
      status: string | null;
      acceptedDecisionCount: number;
      maturityEvidenceDecisionCount: number;
      keepProjectLocalCount: number;
      bindExistingCount: number;
      aliasCount: number;
      requestPromotionCount: number;
      rejectCount: number;
      deferredCount: number;
      nonResolvingDecisionCount: number;
      invalidDecisionCount: number;
      missingDecisionCount: number;
      blockingDecisionCount: number;
      followUpDecisionCount: number;
      effectCount: number;
      readyForMaturity: boolean;
      sourceRef: string | null;
      actionBoundary: {
        inspectOnly: true;
        acknowledgeOnly: true;
        mayApplyDecisions: false;
        mayMutateCandidateArtifacts: false;
        mayAcceptOntologyTerms: false;
        mayWriteOntologyPackage: false;
        mayCreateBranchOrCommit: false;
      };
    };
    context: {
      workspaceId: string | null;
      candidateId: string | null;
      repairSessionId: string | null;
      workflowLane: string | null;
      domainRefs: readonly string[];
      contextRefs: readonly string[];
      ontologyRefs: readonly string[];
    };
    sourceArtifacts: Record<string, unknown>;
    supportedActions: readonly string[];
    authority: string | null;
    requestWorkspacePromotionEffect: string | null;
    terms: readonly IdeaToSpecProjectLocalOntologyTerm[];
    termCount: number;
    reviewedTermCount: number;
    blockingTermCount: number;
    unreviewedTermCount: number;
    deferredTermCount: number;
    statusCounts: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
    warnings: readonly Record<string, unknown>[];
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
      mayApplyDecisions: false;
      mayMutateCandidateArtifacts: false;
      mayAcceptOntologyTerms: false;
      mayWriteOntologyPackage: false;
      mayCreateBranchOrCommit: false;
    };
  };
  projectLocalOntologyDecisionImportPreview: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    context: {
      workspaceId: string | null;
      candidateId: string | null;
      repairSessionId: string | null;
      workflowLane: string | null;
      domainRefs: readonly string[];
      contextRefs: readonly string[];
      ontologyRefs: readonly string[];
    };
    sourceArtifacts: Record<string, unknown>;
    acceptedDecisions: readonly IdeaToSpecProjectLocalOntologyImportDecision[];
    nonResolvingDecisions: readonly IdeaToSpecProjectLocalOntologyImportDecision[];
    invalidDecisions: readonly IdeaToSpecProjectLocalOntologyImportIssue[];
    missingDecisions: readonly IdeaToSpecProjectLocalOntologyImportIssue[];
    decisionCandidates: readonly IdeaToSpecProjectLocalOntologyImportDecision[];
    decisionCount: number;
    acceptedDecisionCount: number;
    nonResolvingDecisionCount: number;
    invalidDecisionCount: number;
    missingDecisionCount: number;
    findingCount: number;
    findings: readonly IdeaToSpecFinding[];
    actionBoundary: {
      inspectOnly: true;
      acknowledgeOnly: true;
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
  refreshKey?: number | string;
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

function displayRef(value: unknown): string | null {
  const text = optionalString(value);
  if (!text) return null;
  let normalized = text.replace(/\\/g, "/");
  const markerPairs: readonly [string, string][] = [
    ["/runs/", "runs/"],
    ["/dist/specgraph-public/", "dist/specgraph-public/"],
    ["/.platform/", ".platform/"],
  ];
  for (const [marker, prefix] of markerPairs) {
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) {
      return `${prefix}${normalized.slice(index + marker.length)}`;
    }
  }
  if (normalized.startsWith("file://")) {
    normalized = normalized.slice("file://".length);
  }
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("~") ||
    normalized.startsWith("../")
  ) {
    const localName = normalized.replace(/\/+$/g, "").split("/").pop();
    return localName ? `local:${localName}` : "local:path";
  }
  return normalized;
}

function displayRefs(value: unknown): string[] {
  return strings(value).flatMap((item) => {
    const ref = displayRef(item);
    return ref ? [ref] : [];
  });
}

function displayValue(value: unknown): unknown {
  if (typeof value === "string") return displayRef(value);
  if (Array.isArray(value)) return value.map(displayValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, displayValue(item)]),
    );
  }
  return value;
}

function displayRecord(value: unknown): Record<string, unknown> {
  return recordValue(displayValue(recordValue(value)));
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function signedNumberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    targetRef: optionalString(finding.target_ref),
    nextAction: optionalString(finding.next_action),
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

function parseRealIdeaAnswerTarget(
  raw: unknown,
): IdeaToSpecRealIdeaAnswerTarget | null {
  const target = recordValue(raw);
  const targetId = optionalString(target.target_id);
  const requestId = optionalString(target.request_id);
  if (!targetId || !requestId) return null;
  const requiredFieldsRaw = recordValue(target.required_fields_by_action);
  const requiredFieldsByAction: Record<string, readonly string[]> = {};
  for (const [action, fields] of Object.entries(requiredFieldsRaw)) {
    requiredFieldsByAction[action] = strings(fields);
  }
  return {
    targetId,
    targetType: stringValue(target.target_type, "clarification"),
    requestId,
    requestKind: optionalString(target.request_kind),
    severity: stringValue(target.severity, "review_required"),
    status: stringValue(target.status, "open"),
    question: optionalString(target.question),
    targetArtifact: optionalString(target.target_artifact),
    targetRef: optionalString(target.target_ref),
    acceptedActions: strings(target.accepted_actions),
    suggestedAnswerShape: optionalString(target.suggested_answer_shape),
    valueTemplatesByAction: recordValue(target.value_templates_by_action),
    requiredFieldsByAction,
    evidenceRefs: strings(target.evidence_refs),
  };
}

function parseRealIdeaAnswerAuthoring(
  raw: unknown,
): IdeaToSpecRealIdeaAnswerAuthoring {
  const lane = recordValue(raw);
  const template = recordValue(lane.template);
  const report = recordValue(lane.report);
  const answerSet = recordValue(lane.answer_set);
  const validation = recordValue(lane.validation);
  return {
    available: lane.available === true,
    template: {
      available: template.available === true,
      clarificationOutcome: stringValue(template.clarification_outcome, "missing"),
      workspaceId: optionalString(template.workspace_id),
      candidateId: optionalString(template.candidate_id),
      readiness: parseReadiness(template.readiness),
      stage: optionalString(template.stage),
      runDir: optionalString(template.run_dir),
      contractRef: optionalString(template.contract_ref),
      summary: recordValue(template.summary),
      targetCount: numberValue(template.target_count),
      blockingTargetCount: numberValue(template.blocking_target_count),
      answerableTargetCount: numberValue(template.answerable_target_count),
      unsupportedTargetCount: numberValue(template.unsupported_target_count),
      targets: records(template.targets).flatMap((item) => {
        const parsed = parseRealIdeaAnswerTarget(item);
        return parsed ? [parsed] : [];
      }),
      findings: records(template.findings).flatMap((item) => {
        const parsed = parseFinding(item);
        return parsed ? [parsed] : [];
      }),
    },
    report: {
      available: report.available === true,
      readiness: parseReadiness(report.readiness),
      operation: optionalString(report.operation),
      stage: optionalString(report.stage),
      summary: recordValue(report.summary),
      findings: records(report.findings).flatMap((item) => {
        const parsed = parseFinding(item);
        return parsed ? [parsed] : [];
      }),
      findingCount: numberValue(report.finding_count),
    },
    answerSet: {
      available: answerSet.available === true,
      artifactKind: optionalString(answerSet.artifact_kind),
      contractRef: optionalString(answerSet.contract_ref),
      answerCount: numberValue(answerSet.answer_count),
    },
    validation: {
      status: stringValue(validation.status, "unknown"),
      ready: validation.ready === true,
      findingCount: numberValue(validation.finding_count),
    },
    recommendedActions: records(lane.recommended_actions).map((action) => ({
      id: stringValue(action.id, "real-idea-answer-action"),
      label: stringValue(action.label, "Next action"),
      nextAction: stringValue(action.next_action, "Inspect answer authoring state."),
    })),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecuteSpecgraph: false,
      mayExecutePlatform: false,
      mayApplyAnswers: false,
      mayMutateCandidateSourceArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayCreateBranchOrCommit: false,
    },
  };
}

function parseRealIdeaAnswerContinuation(
  raw: unknown,
): IdeaToSpecRealIdeaAnswerContinuation {
  const lane = recordValue(raw);
  const importPreview = recordValue(lane.import_preview);
  const continuationReport = recordValue(lane.continuation_report);
  return {
    available: lane.available === true,
    ready: lane.ready === true,
    importPreview: {
      available: importPreview.available === true,
      readiness: parseReadiness(importPreview.readiness),
      summary: recordValue(importPreview.summary),
      acceptedAnswerCount: optionalNumberValue(importPreview.accepted_answer_count),
      answerCount: numberValue(importPreview.answer_count),
      findings: records(importPreview.findings).flatMap((item) => {
        const parsed = parseFinding(item);
        return parsed ? [parsed] : [];
      }),
      sourceArtifacts: recordValue(importPreview.source_artifacts),
    },
    continuationReport: {
      available: continuationReport.available === true,
      readiness: parseReadiness(continuationReport.readiness),
      summary: recordValue(continuationReport.summary),
      outputs: recordValue(continuationReport.outputs),
      findings: records(continuationReport.findings).flatMap((item) => {
        const parsed = parseFinding(item);
        return parsed ? [parsed] : [];
      }),
    },
    recommendedActions: records(lane.recommended_actions).flatMap((action) => {
      const id = optionalString(action.id);
      if (!id) return [];
      return [
        {
          id,
          label: stringValue(action.label, "Next action"),
          nextAction: stringValue(
            action.next_action,
            "Inspect answer continuation state.",
          ),
          commandHint: optionalString(action.command_hint),
        },
      ];
    }),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecuteSpecgraph: false,
      mayExecutePlatform: false,
      mayApplyAnswers: false,
      mayMutateCandidateSourceArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayCreateBranchOrCommit: false,
    },
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

function parseIntakeAnswer(raw: unknown): IdeaToSpecIntakeAnswer | null {
  const answer = recordValue(raw);
  const requestId = optionalString(answer.request_id);
  if (!requestId) return null;
  return {
    requestId,
    answerKind: stringValue(answer.answer_kind, "answer"),
    status: stringValue(answer.status, "proposed"),
    authority: optionalString(answer.authority),
    targetArtifact: optionalString(answer.target_artifact),
    targetRef: optionalString(answer.target_ref),
    refs: strings(answer.refs),
    entries: strings(answer.entries),
    relations: parseWorkflowRelations(answer.relations),
    text: optionalString(answer.text),
  };
}

function parseWorkflowRelations(raw: unknown): IdeaToSpecWorkflowRelation[] {
  return records(raw).flatMap((item) => {
    const relation = optionalString(item.relation);
    const sourceRef = optionalString(item.source_ref);
    const targetRef = optionalString(item.target_ref);
    if (!relation || !sourceRef || !targetRef) return [];
    return [
      {
        relation,
        sourceRef,
        targetRef,
        rationale: optionalString(item.rationale),
      },
    ];
  });
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

function parseProjectLocalOntologyTerm(
  raw: unknown,
): IdeaToSpecProjectLocalOntologyTerm | null {
  const term = recordValue(raw);
  const termKey = optionalString(term.term_key);
  if (!termKey) return null;
  const effect = recordValue(term.effect);
  return {
    id: stringValue(term.id, `project-local-ontology-term.${termKey}`),
    term: optionalString(term.term),
    termKey,
    status: stringValue(term.status, "unreviewed"),
    selectedDecisionId: optionalString(term.selected_decision_id),
    sourceRefs: strings(term.source_refs),
    suggestedActions: strings(term.suggested_actions),
    evidenceRefs: strings(term.evidence_refs),
    gapRefs: records(term.gap_refs).map((gap) => ({
      gapId: optionalString(gap.gap_id),
      nodeId: optionalString(gap.node_id),
      targetRef: optionalString(gap.target_ref),
      sourceRef: optionalString(gap.source_ref),
      sourceKind: optionalString(gap.source_kind),
      statement: optionalString(gap.statement),
      suggestedAction: optionalString(gap.suggested_action),
    })),
    resolvedGapRefs: records(term.resolved_gap_refs).map((gap) => ({
      gapId: optionalString(gap.gap_id),
      nodeId: optionalString(gap.node_id),
      targetRef: optionalString(gap.target_ref),
      decision: optionalString(gap.decision),
      matchKind: optionalString(gap.match_kind),
    })),
    decisions: records(term.decisions).map((decision) => ({
      id: optionalString(decision.id),
      decisionType: optionalString(decision.decision_type),
      reviewStatus: optionalString(decision.review_status),
      term: optionalString(decision.term),
      termScope: optionalString(decision.term_scope),
      ontologyRef: optionalString(decision.ontology_ref),
      aliasOf: optionalString(decision.alias_of),
      targetRef: optionalString(decision.target_ref),
      reason: optionalString(decision.reason),
    })),
    effect: {
      candidateReadinessEffect: optionalString(effect.candidate_readiness_effect),
      nextAction: optionalString(effect.next_action),
      resolvedGapCount: numberValue(effect.resolved_gap_count),
    },
  };
}

function parseProjectLocalOntologyReview(
  raw: unknown,
): IdeaToSpecWorkspace["projectLocalOntologyReview"] {
  const lane = recordValue(raw);
  const context = recordValue(lane.context);
  const effectiveReview = recordValue(lane.effective_review);
  return {
    available: lane.available === true,
    readiness: parseReadiness(lane.readiness),
    summary: recordValue(lane.summary),
    effectiveReview: {
      available: effectiveReview.available === true,
      readiness: parseReadiness(effectiveReview.readiness),
      summary: recordValue(effectiveReview.summary),
      status: optionalString(effectiveReview.status),
      acceptedDecisionCount: numberValue(effectiveReview.accepted_decision_count),
      maturityEvidenceDecisionCount: numberValue(
        effectiveReview.maturity_evidence_decision_count,
      ),
      keepProjectLocalCount: numberValue(effectiveReview.keep_project_local_count),
      bindExistingCount: numberValue(effectiveReview.bind_existing_count),
      aliasCount: numberValue(effectiveReview.alias_count),
      requestPromotionCount: numberValue(effectiveReview.request_promotion_count),
      rejectCount: numberValue(effectiveReview.reject_count),
      deferredCount: numberValue(effectiveReview.deferred_count),
      nonResolvingDecisionCount: numberValue(
        effectiveReview.non_resolving_decision_count,
      ),
      invalidDecisionCount: numberValue(effectiveReview.invalid_decision_count),
      missingDecisionCount: numberValue(effectiveReview.missing_decision_count),
      blockingDecisionCount: numberValue(effectiveReview.blocking_decision_count),
      followUpDecisionCount: numberValue(effectiveReview.follow_up_decision_count),
      effectCount: numberValue(effectiveReview.effect_count),
      readyForMaturity: effectiveReview.ready_for_maturity === true,
      sourceRef: optionalString(effectiveReview.source_ref),
      actionBoundary: {
        inspectOnly: true,
        acknowledgeOnly: true,
        mayApplyDecisions: false,
        mayMutateCandidateArtifacts: false,
        mayAcceptOntologyTerms: false,
        mayWriteOntologyPackage: false,
        mayCreateBranchOrCommit: false,
      },
    },
    context: {
      workspaceId: optionalString(context.workspace_id),
      candidateId: optionalString(context.candidate_id),
      repairSessionId: optionalString(context.repair_session_id),
      workflowLane: optionalString(context.workflow_lane),
      domainRefs: strings(context.domain_refs),
      contextRefs: strings(context.context_refs),
      ontologyRefs: strings(context.ontology_refs),
    },
    sourceArtifacts: recordValue(lane.source_artifacts),
    supportedActions: strings(lane.supported_actions),
    authority: optionalString(lane.authority),
    requestWorkspacePromotionEffect: optionalString(
      lane.request_workspace_promotion_effect,
    ),
    terms: records(lane.terms).flatMap((item) => {
      const parsed = parseProjectLocalOntologyTerm(item);
      return parsed ? [parsed] : [];
    }),
    termCount: numberValue(lane.term_count),
    reviewedTermCount: numberValue(lane.reviewed_term_count),
    blockingTermCount: numberValue(lane.blocking_term_count),
    unreviewedTermCount: numberValue(lane.unreviewed_term_count),
    deferredTermCount: numberValue(lane.deferred_term_count),
    statusCounts: recordValue(lane.status_counts),
    findings: records(lane.findings).flatMap((item) => {
      const parsed = parseFinding(item);
      return parsed ? [parsed] : [];
    }),
    warnings: records(lane.warnings),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayApplyDecisions: false,
      mayMutateCandidateArtifacts: false,
      mayAcceptOntologyTerms: false,
      mayWriteOntologyPackage: false,
      mayCreateBranchOrCommit: false,
    },
  };
}

function parseProjectLocalOntologyImportDecision(
  raw: unknown,
): IdeaToSpecProjectLocalOntologyImportDecision | null {
  const item = recordValue(raw);
  const id = optionalString(item.id);
  if (!id) return null;
  return {
    id,
    sourceDecisionId: optionalString(item.source_decision_id),
    sourceArtifact: optionalString(item.source_artifact),
    decisionType: optionalString(item.decision_type),
    reviewAction: optionalString(item.review_action),
    status: optionalString(item.status),
    materializationIntent: optionalString(item.materialization_intent),
    term: optionalString(item.term),
    termKey: optionalString(item.term_key),
    targetRef: optionalString(item.target_ref),
    gapRefs: records(item.gap_refs).map((gap) => ({
      gapId: optionalString(gap.gap_id),
      nodeId: optionalString(gap.node_id),
      targetRef: optionalString(gap.target_ref),
      sourceRef: optionalString(gap.source_ref),
    })),
    decisionValue: recordValue(item.decision_value),
    writesOntologyPackage: item.writes_ontology_package === true,
    acceptsOntologyTerms: item.accepts_ontology_terms === true,
    appliesToSpecgraph: item.applies_to_specgraph === true,
  };
}

function parseProjectLocalOntologyImportIssue(
  raw: unknown,
): IdeaToSpecProjectLocalOntologyImportIssue | null {
  const item = recordValue(raw);
  const id = optionalString(item.id);
  if (!id) return null;
  return {
    id,
    decisionId: optionalString(item.decision_id),
    termKey: optionalString(item.term_key),
    term: optionalString(item.term),
    action: optionalString(item.action),
    reason: optionalString(item.reason),
    field: optionalString(item.field),
    expected: optionalString(item.expected),
    actual: optionalString(item.actual),
    status: optionalString(item.status),
  };
}

function parseProjectLocalOntologyDecisionImportPreview(
  raw: unknown,
): IdeaToSpecWorkspace["projectLocalOntologyDecisionImportPreview"] {
  const preview = recordValue(raw);
  const context = recordValue(preview.context);
  return {
    available: preview.available === true,
    readiness: parseReadiness(preview.readiness),
    summary: recordValue(preview.summary),
    context: {
      workspaceId: optionalString(context.workspace_id),
      candidateId: optionalString(context.candidate_id),
      repairSessionId: optionalString(context.repair_session_id),
      workflowLane: optionalString(context.workflow_lane),
      domainRefs: strings(context.domain_refs),
      contextRefs: strings(context.context_refs),
      ontologyRefs: strings(context.ontology_refs),
    },
    sourceArtifacts: recordValue(preview.source_artifacts),
    acceptedDecisions: records(preview.accepted_decisions).flatMap((item) => {
      const parsed = parseProjectLocalOntologyImportDecision(item);
      return parsed ? [parsed] : [];
    }),
    nonResolvingDecisions: records(preview.non_resolving_decisions).flatMap(
      (item) => {
        const parsed = parseProjectLocalOntologyImportDecision(item);
        return parsed ? [parsed] : [];
      },
    ),
    invalidDecisions: records(preview.invalid_decisions).flatMap((item) => {
      const parsed = parseProjectLocalOntologyImportIssue(item);
      return parsed ? [parsed] : [];
    }),
    missingDecisions: records(preview.missing_decisions).flatMap((item) => {
      const parsed = parseProjectLocalOntologyImportIssue(item);
      return parsed ? [parsed] : [];
    }),
    decisionCandidates: records(preview.decision_candidates).flatMap((item) => {
      const parsed = parseProjectLocalOntologyImportDecision(item);
      return parsed ? [parsed] : [];
    }),
    decisionCount: numberValue(preview.decision_count),
    acceptedDecisionCount: numberValue(preview.accepted_decision_count),
    nonResolvingDecisionCount: numberValue(preview.non_resolving_decision_count),
    invalidDecisionCount: numberValue(preview.invalid_decision_count),
    missingDecisionCount: numberValue(preview.missing_decision_count),
    findingCount: numberValue(preview.finding_count),
    findings: records(preview.findings).flatMap((item) => {
      const parsed = parseFinding(item);
      return parsed ? [parsed] : [];
    }),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayApplyDecisions: false,
      mayMutateCandidateArtifacts: false,
      mayAcceptOntologyTerms: false,
      mayWriteOntologyPackage: false,
      mayCreateBranchOrCommit: false,
    },
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

function parseRealIdeaIntake(raw: unknown): IdeaToSpecRealIdeaIntake {
  const intake = recordValue(raw);
  const progress = recordValue(intake.clarification_progress);
  const answerTemplate = recordValue(intake.answer_template);
  const continuationHandoff = recordValue(intake.continuation_handoff);
  const entryExecution = recordValue(intake.entry_execution);
  return {
    available: intake.available === true,
    status: stringValue(intake.status, "missing"),
    workspaceId: optionalString(intake.workspace_id),
    sessionRef: optionalString(intake.session_ref),
    clarifiedSessionRef: optionalString(intake.clarified_session_ref),
    candidateSourceRef: optionalString(intake.candidate_source_ref),
    activeCandidateRef: optionalString(intake.active_candidate_ref),
    nextAction: stringValue(
      intake.next_action,
      "Create or continue the real idea intake session.",
    ),
    blockers: strings(intake.blockers),
    clarificationProgress: {
      questionCount: numberValue(progress.question_count),
      answeredCount: numberValue(progress.answered_count),
      missingCount: numberValue(progress.missing_count),
      invalidAnswerCount: numberValue(progress.invalid_answer_count),
      staleAnswerCount: numberValue(progress.stale_answer_count),
      requiredFieldFindings: records(progress.required_field_findings).flatMap(
        (item) => {
          const parsed = parseFinding(item);
          return parsed ? [parsed] : [];
        },
      ),
    },
    answerTemplate: {
      clarificationOutcome: stringValue(
        answerTemplate.clarification_outcome,
        "missing",
      ),
      status: stringValue(answerTemplate.status, "missing"),
      templateRef: optionalString(answerTemplate.template_ref),
      targetCount: numberValue(answerTemplate.target_count),
      blockingTargetCount: numberValue(answerTemplate.blocking_target_count),
      answerableTargetCount: numberValue(answerTemplate.answerable_target_count),
      unsupportedTargetCount: numberValue(answerTemplate.unsupported_target_count),
      requiredFields: strings(answerTemplate.required_fields),
      validationStatus: stringValue(answerTemplate.validation_status, "unknown"),
      validationReady: answerTemplate.validation_ready === true,
    },
    continuationHandoff: {
      importPreviewStatus: stringValue(
        continuationHandoff.import_preview_status,
        "missing",
      ),
      materializationStatus: stringValue(
        continuationHandoff.materialization_status,
        "missing",
      ),
      safeToContinue: continuationHandoff.safe_to_continue === true,
      outputRefs: strings(continuationHandoff.output_refs),
      commandHint: optionalString(continuationHandoff.command_hint),
    },
    entryExecution: {
      available: entryExecution.available === true,
      ok: entryExecution.ok === true,
      dryRun: entryExecution.dry_run === true,
      status: stringValue(entryExecution.status, "missing"),
      runDir: optionalString(entryExecution.run_dir),
      target: optionalString(entryExecution.target),
      entryRequestsHandoffRef: optionalString(
        entryExecution.entry_requests_handoff_ref,
      ),
      outputRefs: strings(entryExecution.output_refs),
      outputArtifactCount: numberValue(entryExecution.output_artifact_count),
      diagnosticCount: numberValue(entryExecution.diagnostic_count),
      operations: records(entryExecution.operations).flatMap((item) => {
        const parsed = parseProductRepairRerunOperation(item);
        return parsed ? [parsed] : [];
      }),
      outputArtifacts: records(entryExecution.output_artifacts).flatMap((item) => {
        const parsed = parseProductRepairRerunOutputArtifact(item);
        return parsed ? [parsed] : [];
      }),
    },
    sourceRefs: strings(intake.source_refs),
    authorityBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecuteSpecgraph: false,
      mayExecutePlatform: false,
      mayExecutePromptAgent: false,
      mayApplyAnswers: false,
      mayMutateCandidateSourceArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
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

function parseSignedNumberRecord(raw: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(recordValue(raw)).map(([key, value]) => [
      key,
      signedNumberValue(value),
    ]),
  );
}

function parseStringListRecord(raw: unknown): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(recordValue(raw)).map(([key, value]) => [key, strings(value)]),
  );
}

function parseStructuralDepthDelta(raw: unknown): IdeaToSpecStructuralDepthDelta {
  const delta = recordValue(raw);
  const before = parseNumberRecord(delta.before);
  const after = parseNumberRecord(delta.after);
  const signedDelta = parseSignedNumberRecord(delta.delta);
  const hasDepthContent =
    Object.keys(before).length > 0 ||
    Object.keys(after).length > 0 ||
    Object.keys(signedDelta).length > 0;
  return {
    available:
      delta.available === false
        ? false
        : delta.available === true || hasDepthContent,
    proposalId: optionalString(delta.proposal_id),
    status: optionalString(delta.status),
    before,
    after,
    delta: signedDelta,
    addedEventStormingEntryRefs: parseStringListRecord(
      delta.added_event_storming_entry_refs,
    ),
    addedEventStormingEntryCount: numberValue(
      delta.added_event_storming_entry_count,
    ),
    addedWorkflowRelationCount: numberValue(
      delta.added_workflow_relation_count,
    ),
    addedWorkflowRelations: records(delta.added_workflow_relations).map(
      (relation) => ({
        relation: optionalString(relation.relation),
        sourceRef: optionalString(relation.source_ref),
        targetRef: optionalString(relation.target_ref),
        reviewOnly: relation.review_only === true,
        materializationDependency: relation.materialization_dependency === true,
      }),
    ),
    remainingShallowDimensions: strings(delta.remaining_shallow_dimensions),
    reviewOnly: delta.review_only === true,
    canonicalMutationsAllowed: delta.canonical_mutations_allowed === true,
    materializationDependency: delta.materialization_dependency === true,
  };
}

function parseIntakeClarification(
  raw: unknown,
): IdeaToSpecWorkspace["intakeClarification"] {
  const lane = recordValue(raw);
  const clarificationRequests = recordValue(lane.clarification_requests);
  const clarificationAnswers = recordValue(lane.clarification_answers);
  const rerunInput = recordValue(lane.rerun_input);
  const clarifiedSession = recordValue(lane.clarified_session);
  const clarifiedSource = recordValue(lane.clarified_source);
  const rerunReport = recordValue(lane.rerun_report);
  const answerAuthoring = recordValue(lane.answer_authoring);
  const answerContinuation = recordValue(lane.answer_continuation);
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
      blockingRequestCount: numberValue(
        clarificationRequests.blocking_request_count,
      ),
    },
    clarificationAnswers: {
      available: clarificationAnswers.available === true,
      readiness: parseReadiness(clarificationAnswers.readiness),
      summary: recordValue(clarificationAnswers.summary),
      answers: records(clarificationAnswers.answers).flatMap((item) => {
        const parsed = parseIntakeAnswer(item);
        return parsed ? [parsed] : [];
      }),
      answerCount: numberValue(clarificationAnswers.answer_count),
      acceptedAnswerCount: numberValue(
        clarificationAnswers.accepted_answer_count,
      ),
      unresolvedBlockingCount: numberValue(
        clarificationAnswers.unresolved_blocking_count,
      ),
    },
    rerunInput: {
      available: rerunInput.available === true,
      readiness: parseReadiness(rerunInput.readiness),
      summary: recordValue(rerunInput.summary),
      acceptedTargetCount: numberValue(rerunInput.accepted_target_count),
    },
    clarifiedSession: {
      available: clarifiedSession.available === true,
      readiness: parseReadiness(clarifiedSession.readiness),
      summary: recordValue(clarifiedSession.summary),
    },
    clarifiedSource: {
      available: clarifiedSource.available === true,
      readiness: parseReadiness(clarifiedSource.readiness),
      summary: recordValue(clarifiedSource.summary),
    },
    rerunReport: {
      available: rerunReport.available === true,
      readiness: parseReadiness(rerunReport.readiness),
      summary: recordValue(rerunReport.summary),
      acceptedTargetCount: numberValue(rerunReport.accepted_target_count),
    },
    answerAuthoring: parseRealIdeaAnswerAuthoring(answerAuthoring),
    answerContinuation: parseRealIdeaAnswerContinuation(answerContinuation),
    sourceRefs: strings(lane.source_refs),
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecuteSpecgraph: false,
      mayExecutePromptAgent: false,
      mayApplyAnswers: false,
      mayMutateCandidateSourceArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayCreateBranchOrCommit: false,
    },
  };
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
        structuralDepthDelta: parseStructuralDepthDelta(
          delta.structural_depth_delta,
        ),
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
    commitPaths: displayRefs(request.commit_paths),
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
    promotionPaths: displayRefs(approval.promotion_paths),
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
    gateReportRef: displayRef(execution.gate_report_ref),
    candidateApprovalDecisionRef: displayRef(
      execution.candidate_approval_decision_ref,
    ),
    approvalIntentRef: displayRef(execution.approval_intent_ref),
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
    reportRef: displayRef(operation.report_ref),
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
    workspaceDir: displayRef(execution.workspace_dir),
    operationCount: numberValue(execution.operation_count),
    completedOperationCount: numberValue(execution.completed_operation_count),
    errorCount: numberValue(execution.error_count),
    copiedFileCount: numberValue(execution.copied_file_count),
    operations: records(execution.operations).flatMap((item) => {
      const parsed = parseGitServiceOperation(item);
      return parsed ? [parsed] : [];
    }),
    reportRefs: displayRecord(execution.report_refs),
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
    workspaceDir: displayRef(execution.workspace_dir),
    repositoryDir: displayRef(execution.repository_dir),
    materializedSourceDir: displayRef(execution.materialized_source_dir),
    promotionRequestRef: displayRef(execution.promotion_request_ref),
    approvalDecisionRef: displayRef(execution.approval_decision_ref),
    gitServiceExecutionReportRef: displayRef(
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
    childReportRefs: displayRecord(execution.child_report_refs),
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
    reviewProbeOnly: status.review_probe_only === true,
    promotionExecutionReportRef: displayRef(
      status.promotion_execution_report_ref,
    ),
    graphRepositoryReviewStatusReportRef: displayRef(
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
    manifest: displayRef(publication.manifest),
    manifestName: optionalString(publication.manifest_name),
    bundleDir: displayRef(publication.bundle_dir),
    outputDir: displayRef(publication.output_dir),
    published: publication.published === true,
    readModelPublished: publication.read_model_published === true,
    fileCount: numberValue(publication.file_count),
    productReviewStatusReportRef: displayRef(
      publication.product_review_status_report_ref,
    ),
    graphRepositoryReviewStatusReportRef: displayRef(
      publication.graph_repository_review_status_report_ref,
    ),
    graphRepositoryPublishReadModelReportRef: displayRef(
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
    reportRefs: displayRecord(finalization.report_refs),
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
    evidence: displayRefs(operation.evidence),
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
    path: displayRef(artifact.path),
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
  const hasCandidateStructureDepth = isRecord(metrics.candidate_structure_depth);
  const candidateStructureDepth = recordValue(metrics.candidate_structure_depth);
  const nestedProjectLocalReview = recordValue(
    metrics.project_local_ontology_review,
  );
  return {
    candidateNodeCount: numberValue(metrics.candidate_node_count),
    candidateStructureDepth: {
      available:
        hasCandidateStructureDepth && candidateStructureDepth.available !== false,
      actorCount: numberValue(candidateStructureDepth.actor_count),
      commandCount: numberValue(candidateStructureDepth.command_count),
      domainEventCount: numberValue(
        candidateStructureDepth.domain_event_count,
      ),
      policyCount: numberValue(candidateStructureDepth.policy_count),
      constraintCount: numberValue(candidateStructureDepth.constraint_count),
      topologyEdgeCount: numberValue(
        candidateStructureDepth.topology_edge_count,
      ),
      workflowEdgeCount: numberValue(
        candidateStructureDepth.workflow_edge_count,
      ),
      requirementCount: numberValue(candidateStructureDepth.requirement_count),
      acceptanceCriteriaCount: numberValue(
        candidateStructureDepth.acceptance_criteria_count,
      ),
    },
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
    perGapMaterializedAnswerCount: optionalNumberValue(
      metrics.per_gap_materialized_answer_count,
    ),
    consumedAnswerCount: numberValue(metrics.consumed_answer_count),
    aggregateAnswerCount: numberValue(metrics.aggregate_answer_count),
    dismissedAnswerCount: numberValue(metrics.dismissed_answer_count),
    closureEvidenceAnswerCount: optionalNumberValue(
      metrics.closure_evidence_answer_count,
    ),
    ordinaryUnmaterializedAnswerCount: optionalNumberValue(
      metrics.ordinary_unmaterialized_answer_count,
    ),
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
    projectLocalOntologyReview: {
      status: optionalString(
        nestedProjectLocalReview.status ??
          metrics.project_local_ontology_review_status,
      ),
      acceptedDecisionCount: numberValue(
        nestedProjectLocalReview.accepted_decision_count ??
          metrics.project_local_ontology_accepted_decision_count,
      ),
      maturityEvidenceDecisionCount: numberValue(
        nestedProjectLocalReview.maturity_evidence_decision_count,
      ),
      keepProjectLocalCount: numberValue(
        nestedProjectLocalReview.keep_project_local_count ??
          metrics.project_local_ontology_keep_local_count,
      ),
      bindExistingCount: numberValue(
        nestedProjectLocalReview.bind_existing_count ??
          metrics.project_local_ontology_bind_existing_count,
      ),
      aliasCount: numberValue(
        nestedProjectLocalReview.alias_count ??
          metrics.project_local_ontology_alias_count,
      ),
      requestPromotionCount: numberValue(
        nestedProjectLocalReview.request_promotion_count ??
          metrics.project_local_ontology_request_promotion_count,
      ),
      rejectCount: numberValue(
        nestedProjectLocalReview.reject_count ??
          metrics.project_local_ontology_reject_count,
      ),
      deferredCount: numberValue(
        nestedProjectLocalReview.deferred_count ??
          metrics.project_local_ontology_deferred_decision_count,
      ),
      nonResolvingDecisionCount: numberValue(
        nestedProjectLocalReview.non_resolving_decision_count,
      ),
      invalidDecisionCount: numberValue(
        nestedProjectLocalReview.invalid_decision_count ??
          metrics.project_local_ontology_invalid_decision_count,
      ),
      missingDecisionCount: numberValue(
        nestedProjectLocalReview.missing_decision_count ??
          metrics.project_local_ontology_missing_decision_count,
      ),
      blockingDecisionCount: numberValue(
        nestedProjectLocalReview.blocking_decision_count ??
          metrics.project_local_ontology_blocking_decision_count,
      ),
      followUpDecisionCount: numberValue(
        nestedProjectLocalReview.follow_up_decision_count,
      ),
      effectCount: numberValue(nestedProjectLocalReview.effect_count),
      readyForMaturity: nestedProjectLocalReview.ready_for_maturity === true,
      evidenceRefs: strings(nestedProjectLocalReview.evidence_refs),
    },
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

function parseGuidedApprovalBoundary(): IdeaToSpecGuidedApprovalBoundary {
  return {
    ...parseGuidedFlowBoundary(),
    mayMaterializeCandidateApprovalDecision: false,
    mayCreatePromotionRequest: false,
    mayPublishReadModel: false,
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

function parseProductWorkspaceOverviewPhase(
  raw: unknown,
): IdeaToSpecProductWorkspaceOverviewPhase | null {
  const phase = recordValue(raw);
  const id = optionalString(phase.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(phase.label, id),
    state: stringValue(phase.state, "pending"),
    targetSection: optionalString(phase.target_section),
    blockers: strings(phase.blockers),
    evidenceRefs: strings(phase.evidence_refs),
  };
}

function legacyQualityGuidedAction(
  label: string,
  targetSection: string | null,
  status: string,
  blockers: readonly string[],
  evidenceRefs: readonly string[],
): IdeaToSpecQualityGuidedAction {
  return {
    id: "quality.legacy_overview",
    rank: 1,
    category: "lifecycle",
    disposition: "required",
    label,
    reason: "Derived from legacy Product Workspace overview fields.",
    owner: "Product workspace",
    status,
    targetSection,
    blockers,
    evidenceRefs,
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseQualityGuidedAction(
  raw: unknown,
): IdeaToSpecQualityGuidedAction | null {
  const action = recordValue(raw);
  const id = optionalString(action.id);
  const label = optionalString(action.label);
  if (!id || !label) return null;
  return {
    id,
    rank: numberValue(action.rank),
    category: stringValue(action.category, "lifecycle"),
    disposition: stringValue(action.disposition, "required"),
    label,
    reason: stringValue(action.reason, "Inspect the selected lifecycle evidence."),
    owner: stringValue(action.owner, "Product workspace"),
    status: stringValue(action.status, "unknown"),
    targetSection: optionalString(action.target_section),
    blockers: strings(action.blockers),
    evidenceRefs: strings(action.evidence_refs),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseProductWorkspaceOverview(
  raw: unknown,
  guidedFlow: IdeaToSpecGuidedFlow,
): IdeaToSpecProductWorkspaceOverview {
  if (!isRecord(raw)) {
    const current = guidedFlow.nextActions[0] ?? null;
    const phaseDefinitions = [
      ["workspace", "Workspace", ["workspace_initialization"]],
      ["intake", "Intake", ["idea_intake"]],
      ["clarification", "Clarification", ["intake_clarification"]],
      ["candidate", "Candidate", ["candidate_graph"]],
      [
        "repair",
        "Repair",
        [
          "repair_review",
          "ontology_decisions",
          "project_local_ontology_review",
          "rerun_request",
          "repaired_handoff",
        ],
      ],
      [
        "approval",
        "Approval",
        [
          "candidate_approval_intent",
          "platform_approval_decision",
          "promotion_request",
        ],
      ],
      ["publication", "Publication", ["git_dry_run", "review_publication"]],
    ] as const;
    const currentPhase =
      phaseDefinitions.find(([, , stageIds]) =>
        (stageIds as readonly string[]).includes(guidedFlow.currentStage),
      ) ?? null;
    const nextSafeAction =
      current?.label ?? "Inspect the current product workspace lifecycle stage.";
    const primaryTargetSection = current?.targetSection ?? null;
    const legacyAction = legacyQualityGuidedAction(
      nextSafeAction,
      primaryTargetSection,
      guidedFlow.overallStatus,
      guidedFlow.stages.flatMap((stage) => stage.blockers),
      current?.evidenceRefs ?? [],
    );
    return {
      available: false,
      status: guidedFlow.overallStatus,
      currentPhase: currentPhase?.[0] ?? "missing",
      currentPhaseLabel: currentPhase?.[1] ?? guidedFlow.currentStageLabel,
      nextSafeAction,
      primaryTargetSection,
      actionRanking: {
        available: false,
        policyId: null,
        candidateCount: 1,
        omittedCount: 0,
        primaryAction: legacyAction,
        secondaryActions: [],
        authorityBoundary: parseGuidedFlowBoundary(),
      },
      readiness: {
        status: guidedFlow.overallStatus,
        ready: false,
        blockerCount: guidedFlow.stages.reduce(
          (total, stage) => total + stage.blockers.length,
          0,
        ),
        blockers: guidedFlow.stages.flatMap((stage) => stage.blockers),
      },
      completedPhaseCount: guidedFlow.stages.filter((stage) =>
        ["completed", "ready"].includes(stage.status),
      ).length,
      totalPhaseCount: guidedFlow.stages.length,
      lastSuccessfulHandoff: {
        stageId: null,
        label: null,
        targetSection: null,
        evidenceRefs: [],
      },
      confidence: {
        level: "compatibility",
        reason: "Overview was derived from legacy guided_flow payload.",
        sourceRefs: current?.evidenceRefs ?? [],
        maturityLifecycleState: null,
      },
      phases: phaseDefinitions.map(([id, label, stageIds]) => ({
        id,
        label,
        state: (stageIds as readonly string[]).includes(guidedFlow.currentStage)
          ? "current"
          : "pending",
        targetSection: current?.targetSection ?? null,
        blockers: [],
        evidenceRefs: [],
      })),
      authorityBoundary: parseGuidedFlowBoundary(),
    };
  }
  const overview = recordValue(raw);
  const readiness = recordValue(overview.readiness);
  const lastSuccessfulHandoff = recordValue(overview.last_successful_handoff);
  const confidence = recordValue(overview.confidence);
  const nextSafeAction = stringValue(
    overview.next_safe_action,
    "Inspect the current product workspace lifecycle stage.",
  );
  const primaryTargetSection = optionalString(overview.primary_target_section);
  const legacyAction = legacyQualityGuidedAction(
    nextSafeAction,
    primaryTargetSection,
    stringValue(overview.status, "missing"),
    strings(readiness.blockers),
    strings(confidence.source_refs),
  );
  const ranking = recordValue(overview.action_ranking);
  const parsedPrimaryAction = parseQualityGuidedAction(ranking.primary_action);
  const primaryAction = parsedPrimaryAction ?? legacyAction;
  return {
    available: overview.available === true,
    status: stringValue(overview.status, "missing"),
    currentPhase: stringValue(overview.current_phase, "unknown"),
    currentPhaseLabel: stringValue(overview.current_phase_label, "Current phase"),
    nextSafeAction,
    primaryTargetSection,
    actionRanking: {
      available: ranking.available === true && parsedPrimaryAction !== null,
      policyId: optionalString(ranking.policy_id),
      candidateCount: numberValue(ranking.candidate_count),
      omittedCount: numberValue(ranking.omitted_count),
      primaryAction,
      secondaryActions: records(ranking.secondary_actions).flatMap((item) => {
        const parsed = parseQualityGuidedAction(item);
        return parsed ? [parsed] : [];
      }),
      authorityBoundary: parseGuidedFlowBoundary(),
    },
    readiness: {
      status: stringValue(readiness.status, "unknown"),
      ready: readiness.ready === true,
      blockerCount: numberValue(readiness.blocker_count),
      blockers: strings(readiness.blockers),
    },
    completedPhaseCount: numberValue(overview.completed_phase_count),
    totalPhaseCount: numberValue(overview.total_phase_count),
    lastSuccessfulHandoff: {
      stageId: optionalString(lastSuccessfulHandoff.stage_id),
      label: optionalString(lastSuccessfulHandoff.label),
      targetSection: optionalString(lastSuccessfulHandoff.target_section),
      evidenceRefs: strings(lastSuccessfulHandoff.evidence_refs),
    },
    confidence: {
      level: stringValue(confidence.level, "unknown"),
      reason: optionalString(confidence.reason),
      sourceRefs: strings(confidence.source_refs),
      maturityLifecycleState: optionalString(confidence.maturity_lifecycle_state),
    },
    phases: records(overview.phases).flatMap((item) => {
      const parsed = parseProductWorkspaceOverviewPhase(item);
      return parsed ? [parsed] : [];
    }),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseManagedOperationRef(raw: unknown): IdeaToSpecManagedOperationRef | null {
  const ref = recordValue(raw);
  const value = optionalString(ref.ref);
  if (!value) return null;
  return {
    ref: value,
    kind: stringValue(ref.kind, "unknown"),
    artifactKey: optionalString(ref.artifact_key),
    available: ref.available === true,
    status: optionalString(ref.status),
    reason: optionalString(ref.reason),
    artifactKind: optionalString(ref.artifact_kind),
    contractRef: optionalString(ref.contract_ref),
    dynamic: ref.dynamic === true,
  };
}

function parseManagedOperation(raw: unknown): IdeaToSpecManagedOperation | null {
  const operation = recordValue(raw);
  const operationId = optionalString(operation.operation_id);
  const hostedTransport = recordValue(operation.hosted_transport);
  if (!operationId) return null;
  return {
    operationId,
    category: stringValue(operation.category, "unknown"),
    lifecycleStage: stringValue(operation.lifecycle_stage, "unknown"),
    uiStage: stringValue(operation.ui_stage, operationId),
    endpoint: stringValue(operation.endpoint, ""),
    platformCommand: strings(operation.platform_command),
    status: stringValue(operation.status, "unknown"),
    targetSection: optionalString(operation.target_section),
    nextSafeAction: stringValue(
      operation.next_safe_action,
      "Inspect managed operation evidence.",
    ),
    inputRefs: records(operation.input_refs).flatMap((item) => {
      const parsed = parseManagedOperationRef(item);
      return parsed ? [parsed] : [];
    }),
    outputReports: records(operation.output_reports).flatMap((item) => {
      const parsed = parseManagedOperationRef(item);
      return parsed ? [parsed] : [];
    }),
    missingInputRefs: strings(operation.missing_input_refs),
    availableOutputRefs: strings(operation.available_output_refs),
    hostedTransport: {
      available: hostedTransport.available === true,
      status: optionalString(hostedTransport.status),
      requestId: optionalString(hostedTransport.request_id),
      attempt: optionalNumberValue(hostedTransport.attempt),
      outputReports: records(hostedTransport.output_reports).flatMap((item) => {
        const logicalRef = optionalString(item.logical_ref);
        const sha256 = optionalString(item.sha256);
        return logicalRef && sha256 ? [{ logicalRef, sha256 }] : [];
      }),
      transportStatusIsLifecycleEvidence: false,
    },
    idempotencyKey: optionalString(operation.idempotency_key),
    overwritePolicy: optionalString(operation.overwrite_policy),
    timeoutPolicy: optionalString(operation.timeout_policy),
    replayPolicy: optionalString(operation.replay_policy),
    dryRunOnly: operation.dry_run_only === true,
    irreversible: operation.irreversible === true,
    requiresExplicitConfirmation: operation.requires_explicit_confirmation === true,
    notes: optionalString(operation.notes),
  };
}

function parseManagedOperationsGroup(
  raw: unknown,
): IdeaToSpecManagedOperationsGroup | null {
  const group = recordValue(raw);
  const phase = optionalString(group.phase);
  if (!phase) return null;
  return {
    phase,
    label: stringValue(group.label, phase),
    operationIds: strings(group.operation_ids),
  };
}

function parseStatusCounts(raw: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(recordValue(raw))
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => [key, numberValue(value)]),
  );
}

function parseManagedOperationsObservability(
  raw: unknown,
): IdeaToSpecManagedOperationsObservability {
  const surface = recordValue(raw);
  const summary = recordValue(surface.summary);
  if (!isRecord(raw)) {
    return {
      available: false,
      surfaceId: null,
      surfaceKind: null,
      summary: {
        operationCount: 0,
        completedCount: 0,
        failedCount: 0,
        staleCount: 0,
        requestNeededCount: 0,
        readyToExecuteCount: 0,
        executionRequestedCount: 0,
        newRequestRequiredCount: 0,
        gateNeededCount: 0,
      },
      statusCounts: {},
      groups: [],
      operations: [],
      authorityBoundary: parseGuidedFlowBoundary(),
    };
  }
  return {
    available: surface.available === true,
    surfaceId: optionalString(surface.surface_id),
    surfaceKind: optionalString(surface.surface_kind),
    summary: {
      operationCount: numberValue(summary.operation_count),
      completedCount: numberValue(summary.completed_count),
      failedCount: numberValue(summary.failed_count),
      staleCount: numberValue(summary.stale_count),
      requestNeededCount: numberValue(summary.request_needed_count),
      readyToExecuteCount: numberValue(summary.ready_to_execute_count),
      executionRequestedCount: numberValue(summary.execution_requested_count),
      newRequestRequiredCount: numberValue(summary.new_request_required_count),
      gateNeededCount: numberValue(summary.gate_needed_count),
    },
    statusCounts: parseStatusCounts(surface.status_counts),
    groups: records(surface.groups).flatMap((item) => {
      const parsed = parseManagedOperationsGroup(item);
      return parsed ? [parsed] : [];
    }),
    operations: records(surface.operations).flatMap((item) => {
      const parsed = parseManagedOperation(item);
      return parsed ? [parsed] : [];
    }),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseManagedModeReadiness(raw: unknown): IdeaToSpecManagedModeReadiness {
  const surface = recordValue(raw);
  const executor = recordValue(surface.executor);
  const operations = recordValue(surface.operations);
  const state = recordValue(surface.state);
  const provider = recordValue(surface.provider);
  const workspace = recordValue(surface.workspace);
  if (!isRecord(raw)) {
    return {
      available: false,
      surfaceId: null,
      surfaceKind: null,
      status: "missing",
      mode: "unknown",
      nextSafeAction: "Managed-mode readiness is not available in this workspace payload.",
      disabledReasons: [],
      executor: {
        enabled: false,
        configured: false,
        transport: "none",
        platformDirConfigured: false,
        platformCliPresent: false,
        timeoutSeconds: null,
        hostedEnabled: false,
        hostedServiceConfigured: false,
        hostedServiceReachable: false,
        hostedEnabledOperationIds: [],
        hostedServiceOperationIds: [],
        hostedClientOperationIds: [],
      },
      operations: {
        registeredCount: 0,
        enabledCount: 0,
        disabledCount: 0,
      },
      state: {
        durability: null,
        restartPersistent: null,
        providerKind: "unknown",
        providerStatus: "unknown",
        providerReady: false,
        providerContractRef: null,
        providerAdapter: null,
        externalRequired: false,
        specspaceStateDirConfigured: false,
        specspaceStateDirReady: false,
        specspaceStateDirWritable: false,
        runsDirConfigured: false,
        runsDirReady: false,
        runsDirWritable: false,
      },
      provider: {
        status: "unknown",
        kind: "unknown",
        readOnly: true,
        reason: null,
      },
      workspace: {
        workspaceId: null,
        productWorkspace: false,
        productWorkspaceArtifactBaseConfigured: null,
        artifactBaseStatus: "unknown",
        bindingStatus: "missing",
        bindingId: null,
      },
      authorityBoundary: parseGuidedFlowBoundary(),
    };
  }
  return {
    available: surface.available === true,
    surfaceId: optionalString(surface.surface_id),
    surfaceKind: optionalString(surface.surface_kind),
    status: stringValue(surface.status, "unknown"),
    mode: stringValue(surface.mode, "unknown"),
    nextSafeAction: stringValue(
      surface.next_safe_action,
      "Inspect workspace state before running managed operations.",
    ),
    disabledReasons: strings(surface.disabled_reasons),
    executor: {
      enabled: executor.enabled === true,
      configured: executor.configured === true,
      transport: stringValue(executor.transport, "none"),
      platformDirConfigured: executor.platform_dir_configured === true,
      platformCliPresent: executor.platform_cli_present === true,
      timeoutSeconds: optionalNumberValue(executor.timeout_seconds),
      hostedEnabled: executor.hosted_enabled === true,
      hostedServiceConfigured: executor.hosted_service_configured === true,
      hostedServiceReachable: executor.hosted_service_reachable === true,
      hostedEnabledOperationIds: strings(executor.hosted_enabled_operation_ids),
      hostedServiceOperationIds: strings(executor.hosted_service_operation_ids),
      hostedClientOperationIds: strings(executor.hosted_client_operation_ids),
    },
    operations: {
      registeredCount: numberValue(operations.registered_count),
      enabledCount: numberValue(operations.enabled_count),
      disabledCount: numberValue(operations.disabled_count),
    },
    state: {
      durability: optionalString(state.durability),
      restartPersistent:
        typeof state.restart_persistent === "boolean"
          ? state.restart_persistent
          : null,
      providerKind: stringValue(state.provider_kind, "unknown"),
      providerStatus: stringValue(state.provider_status, "unknown"),
      providerReady: state.provider_ready === true,
      providerContractRef: optionalString(state.provider_contract_ref),
      providerAdapter: optionalString(state.provider_adapter),
      externalRequired: state.external_required === true,
      specspaceStateDirConfigured: state.specspace_state_dir_configured === true,
      specspaceStateDirReady: state.specspace_state_dir_ready === true,
      specspaceStateDirWritable: state.specspace_state_dir_writable === true,
      runsDirConfigured: state.runs_dir_configured === true,
      runsDirReady: state.runs_dir_ready === true,
      runsDirWritable: state.runs_dir_writable === true,
    },
    provider: {
      status: stringValue(provider.status, "unknown"),
      kind: stringValue(provider.kind, "unknown"),
      readOnly: provider.read_only !== false,
      reason: optionalString(provider.reason),
    },
    workspace: {
      workspaceId: optionalString(workspace.workspace_id),
      productWorkspace: workspace.product_workspace === true,
      productWorkspaceArtifactBaseConfigured:
        typeof workspace.product_workspace_artifact_base_configured === "boolean"
          ? workspace.product_workspace_artifact_base_configured
          : null,
      artifactBaseStatus: stringValue(workspace.artifact_base_status, "unknown"),
      bindingStatus: stringValue(workspace.binding_status, "missing"),
      bindingId: optionalString(workspace.binding_id),
    },
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseGuidedRepairCheckpoint(
  raw: unknown,
): IdeaToSpecGuidedRepairCheckpoint | null {
  const checkpoint = recordValue(raw);
  const id = optionalString(checkpoint.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(checkpoint.label, id),
    status: stringValue(checkpoint.status, "unknown"),
    count: optionalNumberValue(checkpoint.count),
    targetSection: optionalString(checkpoint.target_section),
    evidenceRefs: strings(checkpoint.evidence_refs),
  };
}

function parseGuidedRepairPath(raw: unknown): IdeaToSpecGuidedRepairPath {
  const path = recordValue(raw);
  const counts = recordValue(path.counts);
  const state = recordValue(path.state);
  return {
    available: path.available === true,
    stage: stringValue(path.stage, "missing"),
    nextAction: stringValue(
      path.next_action,
      "Inspect product repair review state.",
    ),
    targetSection: optionalString(path.target_section),
    blockers: strings(path.blockers),
    counts: {
      repairRequestCount: numberValue(counts.repair_request_count),
      productSpecTargetCount: numberValue(counts.product_spec_target_count),
      acceptedAnswerCount: numberValue(counts.accepted_answer_count),
      unresolvedBlockingAnswerCount: numberValue(
        counts.unresolved_blocking_answer_count,
      ),
      ontologyGapRequestCount: numberValue(counts.ontology_gap_request_count),
      ontologyDecisionCount: numberValue(counts.ontology_decision_count),
      projectLocalTermCount: numberValue(counts.project_local_term_count),
      projectLocalMissingDecisionCount: numberValue(
        counts.project_local_missing_decision_count,
      ),
      projectLocalInvalidDecisionCount: numberValue(
        counts.project_local_invalid_decision_count,
      ),
      projectLocalNonResolvingDecisionCount: numberValue(
        counts.project_local_non_resolving_decision_count,
      ),
      unresolvedOntologyGapCount: numberValue(
        counts.unresolved_ontology_gap_count,
      ),
      unresolvedCandidateGapCount: numberValue(
        counts.unresolved_candidate_gap_count,
      ),
    },
    state: {
      repairDraftsStatus: optionalString(state.repair_drafts_status),
      rerunRequestStatus: optionalString(state.rerun_request_status),
      requestGateStatus: optionalString(state.request_gate_status),
      rerunExecutionStatus: optionalString(state.rerun_execution_status),
      rerunPublicationStatus: optionalString(state.rerun_publication_status),
    },
    checkpoints: records(path.checkpoints).flatMap((item) => {
      const parsed = parseGuidedRepairCheckpoint(item);
      return parsed ? [parsed] : [];
    }),
    evidenceRefs: strings(path.evidence_refs),
    authorityBoundary: parseGuidedFlowBoundary(),
  };
}

function parseGuidedApprovalCheckpoint(
  raw: unknown,
): IdeaToSpecGuidedApprovalCheckpoint | null {
  const checkpoint = recordValue(raw);
  const id = optionalString(checkpoint.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(checkpoint.label, id),
    status: stringValue(checkpoint.status, "unknown"),
    targetSection: optionalString(checkpoint.target_section),
    evidenceRefs: strings(checkpoint.evidence_refs),
    detail: optionalString(checkpoint.detail),
  };
}

function parseGuidedApprovalPath(raw: unknown): IdeaToSpecGuidedApprovalPath {
  const path = recordValue(raw);
  const counts = recordValue(path.counts);
  const state = recordValue(path.state);
  return {
    available: path.available === true,
    stage: stringValue(path.stage, "missing"),
    status: stringValue(path.status, "unknown"),
    nextAction: stringValue(
      path.next_action,
      "Inspect candidate approval and promotion state.",
    ),
    targetSection: optionalString(path.target_section),
    blockers: strings(path.blockers),
    counts: {
      promotionPathCount: numberValue(counts.promotion_path_count),
      remainingBlockerCount: numberValue(counts.remaining_blocker_count),
      approvedPathCount: numberValue(counts.approved_path_count),
      promotionCommitPathCount: numberValue(counts.promotion_commit_path_count),
      promotionOperationCount: numberValue(counts.promotion_operation_count),
    },
    state: {
      approvalReadinessStatus: optionalString(
        state.approval_readiness_status,
      ),
      approvalIntentStatus: optionalString(state.approval_intent_status),
      approvalExecutionStatus: optionalString(
        state.approval_execution_status,
      ),
      candidateApprovalState: optionalString(state.candidate_approval_state),
      promotionRequestOk: state.promotion_request_ok === true,
      promotionExecutionStatus: optionalString(
        state.promotion_execution_status,
      ),
      reviewState: optionalString(state.review_state),
      readModelPublished: state.read_model_published === true,
    },
    checkpoints: records(path.checkpoints).flatMap((item) => {
      const parsed = parseGuidedApprovalCheckpoint(item);
      return parsed ? [parsed] : [];
    }),
    evidenceRefs: strings(path.evidence_refs),
    authorityBoundary: parseGuidedApprovalBoundary(),
  };
}

function parseOverviewItem(raw: unknown): IdeaToSpecOverviewItem | null {
  const item = recordValue(raw);
  const id = optionalString(item.id);
  if (!id) return null;
  return {
    id,
    displayAlias: optionalString(item.display_alias),
    title: optionalString(item.title),
    label: optionalString(item.display_alias) ?? optionalString(item.label),
    kind: optionalString(item.kind),
    detail: optionalString(item.detail),
  };
}

function parseOverviewEdge(raw: unknown): IdeaToSpecOverviewEdge | null {
  const edge = recordValue(raw);
  const id = optionalString(edge.id);
  if (!id) return null;
  return {
    id,
    relation: optionalString(edge.relation),
    from: optionalString(edge.from),
    fromDisplayAlias: optionalString(edge.from_display_alias),
    to: optionalString(edge.to),
    toDisplayAlias: optionalString(edge.to_display_alias),
    label: optionalString(edge.label),
  };
}

function parseOntologyApplicabilityScope(
  raw: unknown,
): IdeaToSpecOntologyApplicabilityScope {
  const scope = recordValue(raw);
  return {
    domains: strings(scope.domains),
    lifecyclePhases: strings(scope.lifecycle_phases),
    agentTypes: strings(scope.agent_types),
    subsystems: strings(scope.subsystems),
    runtimes: strings(scope.runtimes),
    platforms: strings(scope.platforms),
    contexts: strings(scope.contexts),
  };
}

function parseOntologyApplicabilityRecord(
  raw: unknown,
): IdeaToSpecOntologyApplicabilityRecord | null {
  const record = recordValue(raw);
  const id = optionalString(record.id);
  if (!id) return null;
  return {
    id,
    layer: optionalString(record.layer),
    text: optionalString(record.text),
  };
}

function parseOntologyApplicabilityProfile(
  raw: unknown,
): IdeaToSpecOntologyApplicabilityProfile | null {
  const profile = recordValue(raw);
  const packageId = optionalString(profile.package_id);
  const packageRef = optionalString(profile.package_ref);
  if (!packageId && !packageRef) return null;
  return {
    packageId,
    packageRef,
    status: optionalString(profile.status),
    appliesTo: parseOntologyApplicabilityScope(profile.applies_to),
    excludes: parseOntologyApplicabilityScope(profile.excludes),
    assumptions: records(profile.assumptions).flatMap((item) => {
      const parsed = parseOntologyApplicabilityRecord(item);
      return parsed ? [parsed] : [];
    }),
    invalidationTriggers: records(profile.invalidation_triggers).flatMap(
      (item) => {
        const parsed = parseOntologyApplicabilityRecord(item);
        return parsed ? [parsed] : [];
      },
    ),
  };
}

function parseOntologyApplicabilityChange(
  raw: unknown,
): IdeaToSpecOntologyApplicabilityChange | null {
  const change = recordValue(raw);
  const kind = optionalString(change.kind);
  const ref = optionalString(change.ref);
  return kind && ref
    ? {
        kind,
        ref,
        targetKind: optionalString(change.target_kind),
        before: optionalString(change.before),
        after: optionalString(change.after),
        compatibility: optionalString(change.compatibility),
      }
    : null;
}

function parseCandidateOverview(
  raw: unknown,
): IdeaToSpecCandidateOverview {
  const overview = recordValue(raw);
  const summary = recordValue(overview.summary);
  const sections = recordValue(overview.sections);
  const candidate = recordValue(overview.candidate);
  const narrative = recordValue(overview.narrative);
  const eventStorming = recordValue(overview.event_storming ?? sections.event_storming);
  const candidateNodes = recordValue(overview.candidate_nodes ?? sections.candidate_nodes);
  const topology = recordValue(overview.topology ?? sections.topology);
  const repair = recordValue(overview.repair ?? sections.repair);
  const ideaMaturity = recordValue(overview.idea_maturity ?? sections.idea_maturity);
  const projectLocalOntology = recordValue(
    overview.project_local_ontology ?? sections.project_local_ontology,
  );
  const ontologyApplicability = recordValue(
    overview.ontology_applicability ?? sections.ontology_applicability,
  );
  const changeClassification = recordValue(
    ontologyApplicability.change_classification,
  );
  const nextAction = recordValue(overview.next_action);
  return {
    available: overview.available === true,
    readiness: parseReadiness(overview.readiness),
    summary: {
      candidateId: optionalString(summary.candidate_id),
      displayName: optionalString(summary.display_name),
      graphSource: optionalString(summary.graph_source),
      nodeCount: numberValue(summary.node_count),
      edgeCount: numberValue(summary.edge_count),
      workflowEdgeCount: numberValue(summary.workflow_edge_count),
      remainingBlockerCount: numberValue(summary.remaining_blocker_count),
      findingCount: numberValue(summary.finding_count),
      readyForCandidateApproval:
        summary.ready_for_candidate_approval === true,
      readyForPlatformPromotion:
        summary.ready_for_platform_promotion === true,
      projectLocalOntologyReviewStatus: optionalString(
        summary.project_local_ontology_review_status,
      ),
    },
    candidate: {
      candidateId: optionalString(candidate.candidate_id),
      displayName: optionalString(candidate.display_name),
      workspaceRoute: optionalString(candidate.workspace_route),
      workflowLane: optionalString(candidate.workflow_lane),
    },
    narrative: {
      productIntent: optionalString(narrative.product_intent),
      understoodScope: optionalString(narrative.understood_scope),
      readiness: optionalString(narrative.readiness),
      nextAction: optionalString(narrative.next_action),
    },
    eventStorming: {
      actorCount: numberValue(eventStorming.actor_count),
      commandCount: numberValue(eventStorming.command_count),
      domainEventCount: numberValue(eventStorming.domain_event_count),
      policyCount: numberValue(eventStorming.policy_count),
      constraintCount: numberValue(eventStorming.constraint_count),
      actors: records(eventStorming.actors).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
      commands: records(eventStorming.commands).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
      domainEvents: records(eventStorming.domain_events).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
      policies: records(eventStorming.policies).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
      constraints: records(eventStorming.constraints).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
    },
    candidateNodes: {
      aliasCount: numberValue(candidateNodes.alias_count),
      aliasByNodeId: Object.fromEntries(
        Object.entries(recordValue(candidateNodes.alias_by_node_id)).flatMap(
          ([nodeId, alias]) => {
            const value = optionalString(alias);
            return value ? [[nodeId, value]] : [];
          },
        ),
      ),
      nodes: records(candidateNodes.nodes).flatMap((item) => {
        const parsed = parseOverviewItem(item);
        return parsed ? [parsed] : [];
      }),
    },
    topology: {
      edgeCount: numberValue(topology.edge_count),
      workflowEdgeCount: numberValue(topology.workflow_edge_count),
      relationCounts: parseNumberRecord(topology.relation_counts),
      edges: records(topology.edges).flatMap((item) => {
        const parsed = parseOverviewEdge(item);
        return parsed ? [parsed] : [];
      }),
    },
    repair: {
      remainingBlockerCount: numberValue(repair.remaining_blocker_count),
      resolvedOntologyGapCount: numberValue(
        repair.resolved_ontology_gap_count,
      ),
      resolvedCandidateGapCount: numberValue(
        repair.resolved_candidate_gap_count,
      ),
      removedGapCount: numberValue(repair.removed_gap_count),
    },
    ideaMaturity: {
      status: optionalString(ideaMaturity.status),
      lifecycleState: optionalString(ideaMaturity.lifecycle_state),
      trusted: ideaMaturity.trusted === true,
    },
    projectLocalOntology: {
      status: optionalString(projectLocalOntology.status),
      termCount: numberValue(projectLocalOntology.term_count),
      acceptedDecisionCount: numberValue(
        projectLocalOntology.accepted_decision_count,
      ),
      blockingDecisionCount: numberValue(
        projectLocalOntology.blocking_decision_count,
      ),
    },
    ontologyApplicability: {
      status: optionalString(ontologyApplicability.status),
      reviewOnly: ontologyApplicability.review_only === true,
      profileCount: numberValue(ontologyApplicability.profile_count),
      assumptionCount: numberValue(ontologyApplicability.assumption_count),
      invalidationTriggerCount: numberValue(
        ontologyApplicability.invalidation_trigger_count,
      ),
      profiles: records(ontologyApplicability.profiles).flatMap((item) => {
        const parsed = parseOntologyApplicabilityProfile(item);
        return parsed ? [parsed] : [];
      }),
      changeClassification: {
        status: optionalString(changeClassification.status),
        diffPackageRefs: strings(changeClassification.diff_package_refs),
        matchedPackageRefs: strings(changeClassification.matched_package_refs),
        structuralChanges: records(
          changeClassification.structural_changes,
        ).flatMap((item) => {
          const parsed = parseOntologyApplicabilityChange(item);
          return parsed ? [parsed] : [];
        }),
        annotationChanges: records(
          changeClassification.annotation_changes,
        ).flatMap((item) => {
          const parsed = parseOntologyApplicabilityChange(item);
          return parsed ? [parsed] : [];
        }),
        applicabilityChanges: records(
          changeClassification.applicability_changes,
        ).flatMap((item) => {
          const parsed = parseOntologyApplicabilityChange(item);
          return parsed ? [parsed] : [];
        }),
        classifiedChangeCount: numberValue(
          changeClassification.classified_change_count,
        ),
      },
      sourceRefs: strings(ontologyApplicability.source_refs),
      authorityBoundary: {
        mayInferApplicability: false,
        mayEnforceRuntimePolicy: false,
        mayMutateCandidateArtifacts: false,
        mayWriteOntologyPackage: false,
        mayAcceptOntologyTerms: false,
        mayApproveCandidate: false,
        mayPromoteCandidate: false,
      },
    },
    nextAction: {
      actionId: optionalString(nextAction.action_id),
      label: optionalString(nextAction.label),
      source: optionalString(nextAction.source),
      evidenceRefs: strings(nextAction.evidence_refs),
    },
    actionBoundary: {
      inspectOnly: true,
      acknowledgeOnly: true,
      mayExecuteSpecgraph: false,
      mayExecutePlatform: false,
      mayMutateCandidateArtifacts: false,
      mayMutateCanonicalSpecs: false,
      mayWriteOntologyPackage: false,
      mayAcceptOntologyTerms: false,
      mayCreateBranchOrCommit: false,
    },
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

function productWorkspaceOverviewBoundaryIsSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  const boundary = recordValue(raw.authority_boundary);
  const allowedMayFlags = new Set([
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
  ]);
  for (const key of Object.keys(boundary)) {
    if (key.startsWith("may_") && !allowedMayFlags.has(key)) return false;
  }
  if (!guidedFlowBoundaryIsSafe(boundary)) return false;
  const ranking = recordValue(raw.action_ranking);
  if (Object.keys(ranking).length === 0) return true;
  if (!qualityGuidedActionBoundaryIsSafe(ranking.authority_boundary)) return false;
  const actions = [
    ...records(ranking.secondary_actions),
    ...(isRecord(ranking.primary_action) ? [ranking.primary_action] : []),
  ];
  return actions.every((action) =>
    qualityGuidedActionBoundaryIsSafe(action.authority_boundary),
  );
}

function qualityGuidedActionBoundaryIsSafe(raw: unknown): boolean {
  const boundary = recordValue(raw);
  const allowedMayFlags = new Set([
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
  ]);
  for (const key of Object.keys(boundary)) {
    if (key.startsWith("may_") && !allowedMayFlags.has(key)) return false;
  }
  return guidedFlowBoundaryIsSafe(boundary);
}

function managedOperationsBoundaryIsSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  const boundary = recordValue(raw.authority_boundary);
  const falseFlags = [
    "managed_operations_observability_is_authority",
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_git_service",
    "may_run_shell",
    "may_mutate_candidate_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_merge_review",
    "may_publish_read_model",
  ];
  const allowedMayFlags = new Set(
    falseFlags.filter((flag) => flag.startsWith("may_")),
  );
  if (boundary.inspect_only !== true || boundary.acknowledge_only !== true) {
    return false;
  }
  for (const [flag, value] of Object.entries(boundary)) {
    if (flag.startsWith("may_") && !allowedMayFlags.has(flag) && value !== false) {
      return false;
    }
  }
  for (const flag of falseFlags) {
    if (boundary[flag] !== false) return false;
  }
  for (const operation of records(raw.operations)) {
    const operationBoundary = recordValue(operation.authority_boundary);
    if (
      operationBoundary.inspect_only !== true ||
      operationBoundary.acknowledge_only !== true
    ) {
      return false;
    }
    for (const [flag, value] of Object.entries(operationBoundary)) {
      if (
        flag.startsWith("may_") &&
        !allowedMayFlags.has(flag) &&
        value !== false
      ) {
        return false;
      }
    }
    for (const flag of falseFlags) {
      if (operationBoundary[flag] !== false) return false;
    }
  }
  return true;
}

function managedModeReadinessBoundaryIsSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  const boundary = recordValue(raw.authority_boundary);
  const falseFlags = [
    "managed_mode_readiness_is_authority",
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_git_service",
    "may_run_shell",
    "may_mutate_candidate_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_merge_review",
    "may_publish_read_model",
  ];
  const allowedMayFlags = new Set(
    falseFlags.filter((flag) => flag.startsWith("may_")),
  );
  if (boundary.inspect_only !== true || boundary.acknowledge_only !== true) {
    return false;
  }
  for (const [flag, value] of Object.entries(boundary)) {
    if (flag.startsWith("may_") && !allowedMayFlags.has(flag) && value !== false) {
      return false;
    }
  }
  for (const flag of falseFlags) {
    if (boundary[flag] !== false) return false;
  }
  return true;
}

function guidedRepairPathBoundaryIsSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  const boundary = recordValue(raw.authority_boundary);
  const repairFalseFlags = [
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
    "may_merge_review",
  ];
  return (
    boundary.inspect_only === true &&
    boundary.acknowledge_only === true &&
    repairFalseFlags.every((flag) => boundary[flag] === false)
  );
}

function guidedApprovalPathBoundaryIsSafe(raw: unknown): boolean {
  if (!isRecord(raw)) return true;
  const boundary = recordValue(raw.authority_boundary);
  const approvalFalseFlags = [
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
    "may_materialize_candidate_approval_decision",
    "may_create_promotion_request",
    "may_publish_read_model",
  ];
  const knownApprovalFlags = new Set(approvalFalseFlags);
  for (const [flag, value] of Object.entries(boundary)) {
    if (flag.startsWith("may_") && !knownApprovalFlags.has(flag) && value !== false) {
      return false;
    }
  }
  return (
    boundary.inspect_only === true &&
    boundary.acknowledge_only === true &&
    approvalFalseFlags.every((flag) => boundary[flag] === false)
  );
}

function candidateOverviewBoundaryIsSafe(raw: unknown): boolean {
  const overview = recordValue(raw);
  if (!isRecord(raw)) return true;
  const boundary = recordValue(overview.action_boundary);
  const falseFlags = [
    "may_execute_specgraph",
    "may_execute_platform",
    "may_mutate_candidate_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
  ];
  const applicability = recordValue(
    recordValue(overview.sections).ontology_applicability ??
      overview.ontology_applicability,
  );
  const applicabilityBoundary = recordValue(applicability.authority_boundary);
  const applicabilityFalseFlags = [
    "may_infer_applicability",
    "may_enforce_runtime_policy",
    "may_mutate_candidate_artifacts",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_approve_candidate",
    "may_promote_candidate",
  ];
  const knownApplicabilityFlags = new Set(applicabilityFalseFlags);
  const applicabilityStatus = optionalString(applicability.status);
  const applicabilityIsNotPublished =
    applicabilityStatus === null || applicabilityStatus === "not_published";
  const applicabilityIsSafe =
    Object.keys(applicability).length === 0 ||
    ((applicabilityIsNotPublished || applicability.review_only === true) &&
      applicabilityFalseFlags.every(
        (flag) => applicabilityBoundary[flag] === false,
      ) &&
      Object.entries(applicabilityBoundary).every(
        ([flag, value]) =>
          !flag.startsWith("may_") ||
          knownApplicabilityFlags.has(flag) ||
          value === false,
      ));
  return (
    boundary.inspect_only === true &&
    boundary.acknowledge_only === true &&
    falseFlags.every((flag) => boundary[flag] === false) &&
    applicabilityIsSafe
  );
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

function parseWorkspaceCreation(raw: unknown): IdeaToSpecWorkspaceCreation {
  const creation = recordValue(raw);
  const summary = recordValue(creation.summary);
  const active = recordValue(creation.active_request);
  const initialization = recordValue(creation.initialization);
  const initializationRequest = recordValue(initialization.execution_request);
  const initializationExecution = recordValue(initialization.execution);
  const requestId = optionalString(active.request_id);
  const workspaceId = optionalString(active.workspace_id);
  const displayName = optionalString(active.display_name);
  const route = optionalString(active.route);
  return {
    artifactKind:
      creation.artifact_kind === "specspace_product_workspace_creation_request_state"
        ? "specspace_product_workspace_creation_request_state"
        : null,
    selectedWorkspaceId: optionalString(creation.selected_workspace_id),
    status: stringValue(summary.status, "route_only_workspace"),
    requestCount: numberValue(summary.request_count),
    activeRequestedCount: numberValue(summary.active_requested_count),
    invalidRequestCount: numberValue(summary.invalid_request_count),
    nextGap: optionalString(summary.next_gap),
    activeRequest:
      requestId && workspaceId && displayName && route
        ? {
            requestId,
            workspaceId,
            displayName,
            route,
            rootIntentSummary: optionalString(active.root_intent_summary),
            rootIntentSummaryPresent:
              active.root_intent_summary_present === true ||
              optionalString(active.root_intent_summary) !== null,
            status: stringValue(active.status, "requested"),
            createdAt: stringValue(active.created_at, "unknown"),
            updatedAt: stringValue(active.updated_at, "unknown"),
          }
        : null,
    initialization: {
      available: initialization.available === true,
      trusted: initialization.trusted !== false,
      initialized: initialization.initialized === true,
      requestStatus: optionalString(initializationRequest.status),
      requestReadyForManagedExecution:
        initializationRequest.ready_for_managed_execution === true,
      requestedOperation: optionalString(initializationRequest.requested_operation),
      idempotencyKey: optionalString(initializationRequest.idempotency_key),
      executionStatus: optionalString(initializationExecution.status),
      catalogWritten: initializationExecution.catalog_written === true,
      workspaceFilesCreated: initializationExecution.workspace_files_created === true,
    },
  };
}

function parseWorkspaceInitializationPath(
  raw: unknown,
): IdeaToSpecWorkspaceInitializationPath {
  const path = recordValue(raw);
  return {
    available: path.available === true,
    status: stringValue(path.status, "route_only"),
    workspaceId: optionalString(path.workspace_id),
    displayName: optionalString(path.display_name),
    initialIdeaPresent: path.initial_idea_present === true,
    creationRequestRef: optionalString(path.creation_request_ref),
    initializationRequestRef: optionalString(path.initialization_request_ref),
    initializationReportRef: optionalString(path.initialization_report_ref),
    nextSafeAction: optionalString(path.next_safe_action),
    blockers: strings(path.blockers),
    managedExecutionAvailable: path.managed_execution_available === true,
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
  if (
    isRecord(raw.guided_repair_path) &&
    !guidedRepairPathBoundaryIsSafe(raw.guided_repair_path)
  ) {
    return { kind: "parse-error", reason: "guided repair path boundary expanded", raw };
  }
  if (
    isRecord(raw.product_workspace_overview) &&
    !productWorkspaceOverviewBoundaryIsSafe(raw.product_workspace_overview)
  ) {
    return { kind: "parse-error", reason: "product workspace overview boundary expanded", raw };
  }
  if (
    isRecord(raw.managed_operations_observability) &&
    !managedOperationsBoundaryIsSafe(raw.managed_operations_observability)
  ) {
    return { kind: "parse-error", reason: "managed operations observability boundary expanded", raw };
  }
  if (
    isRecord(raw.managed_mode_readiness) &&
    !managedModeReadinessBoundaryIsSafe(raw.managed_mode_readiness)
  ) {
    return { kind: "parse-error", reason: "managed mode readiness boundary expanded", raw };
  }
  if (
    isRecord(raw.guided_approval_path) &&
    !guidedApprovalPathBoundaryIsSafe(raw.guided_approval_path)
  ) {
    return { kind: "parse-error", reason: "guided approval path boundary expanded", raw };
  }
  if (
    isRecord(raw.candidate_overview) &&
    !candidateOverviewBoundaryIsSafe(raw.candidate_overview)
  ) {
    return { kind: "parse-error", reason: "candidate overview boundary expanded", raw };
  }
  const realIdeaIntake = recordValue(raw.real_idea_intake);
  if (isRecord(raw.real_idea_intake)) {
    const realIdeaIntakeBoundary = recordValue(realIdeaIntake.authority_boundary);
    const realIdeaIntakeFalseFlags = [
      "may_execute_specgraph",
      "may_execute_platform",
      "may_execute_prompt_agent",
      "may_apply_answers",
      "may_mutate_candidate_source_artifacts",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_create_branch_or_commit",
    ];
    for (const flag of realIdeaIntakeFalseFlags) {
      if (realIdeaIntakeBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `real idea intake boundary expanded: ${flag}`, raw };
      }
    }
    if (
      realIdeaIntakeBoundary.inspect_only !== true ||
      realIdeaIntakeBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "real idea intake boundary must be inspect-only", raw };
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
  const intakeClarification = recordValue(raw.intake_clarification);
  const intakeClarificationBoundary = recordValue(
    intakeClarification.action_boundary,
  );
  const answerContinuation = recordValue(
    intakeClarification.answer_continuation,
  );
  const answerContinuationBoundary = recordValue(
    answerContinuation.action_boundary,
  );
  const intakeClarificationFalseFlags = [
    "may_execute_specgraph",
    "may_execute_prompt_agent",
    "may_apply_answers",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
  ];
  if (isRecord(raw.intake_clarification)) {
    for (const flag of intakeClarificationFalseFlags) {
      if (intakeClarificationBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `intake clarification boundary expanded: ${flag}`, raw };
      }
    }
    if (
      intakeClarificationBoundary.inspect_only !== true ||
      intakeClarificationBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "intake clarification boundary must be inspect-only", raw };
    }
  }
  if (isRecord(intakeClarification.answer_continuation)) {
    const answerContinuationFalseFlags = [
      "may_execute_specgraph",
      "may_execute_platform",
      "may_apply_answers",
      "may_mutate_candidate_source_artifacts",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_create_branch_or_commit",
    ];
    for (const flag of answerContinuationFalseFlags) {
      if (answerContinuationBoundary[flag] !== false) {
        return {
          kind: "parse-error",
          reason: `answer continuation boundary expanded: ${flag}`,
          raw,
        };
      }
    }
    if (
      answerContinuationBoundary.inspect_only !== true ||
      answerContinuationBoundary.acknowledge_only !== true
    ) {
      return {
        kind: "parse-error",
        reason: "answer continuation boundary must be inspect-only",
        raw,
      };
    }
  }
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
  const projectLocalOntologyReview = recordValue(raw.project_local_ontology_review);
  const projectLocalOntologyBoundary = recordValue(
    projectLocalOntologyReview.action_boundary,
  );
  const projectLocalOntologyFalseFlags = [
    "may_apply_decisions",
    "may_mutate_candidate_artifacts",
    "may_accept_ontology_terms",
    "may_write_ontology_package",
    "may_create_branch_or_commit",
  ];
  if (isRecord(raw.project_local_ontology_review)) {
    for (const flag of projectLocalOntologyFalseFlags) {
      if (projectLocalOntologyBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `project-local ontology review boundary expanded: ${flag}`, raw };
      }
    }
    if (
      projectLocalOntologyBoundary.inspect_only !== true ||
      projectLocalOntologyBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "project-local ontology review boundary must be inspect-only", raw };
    }
    const effectiveReview = recordValue(projectLocalOntologyReview.effective_review);
    const effectiveReviewBoundary = recordValue(effectiveReview.action_boundary);
    if (isRecord(projectLocalOntologyReview.effective_review)) {
      for (const flag of projectLocalOntologyFalseFlags) {
        if (effectiveReviewBoundary[flag] !== false) {
          return { kind: "parse-error", reason: `project-local ontology effective review boundary expanded: ${flag}`, raw };
        }
      }
      if (
        effectiveReviewBoundary.inspect_only !== true ||
        effectiveReviewBoundary.acknowledge_only !== true
      ) {
        return { kind: "parse-error", reason: "project-local ontology effective review boundary must be inspect-only", raw };
      }
    }
  }
  const projectLocalOntologyImportPreview = recordValue(
    raw.project_local_ontology_decision_import_preview,
  );
  const projectLocalOntologyImportBoundary = recordValue(
    projectLocalOntologyImportPreview.action_boundary,
  );
  if (isRecord(raw.project_local_ontology_decision_import_preview)) {
    for (const flag of projectLocalOntologyFalseFlags) {
      if (projectLocalOntologyImportBoundary[flag] !== false) {
        return { kind: "parse-error", reason: `project-local ontology import boundary expanded: ${flag}`, raw };
      }
    }
    if (
      projectLocalOntologyImportBoundary.inspect_only !== true ||
      projectLocalOntologyImportBoundary.acknowledge_only !== true
    ) {
      return { kind: "parse-error", reason: "project-local ontology import boundary must be inspect-only", raw };
    }
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
  const guidedFlow = parseGuidedFlow(raw.guided_flow);
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
      workspaceCreation: parseWorkspaceCreation(raw.workspace_creation),
      workspaceInitializationPath: parseWorkspaceInitializationPath(
        raw.workspace_initialization_path,
      ),
      productWorkspaceOverview: parseProductWorkspaceOverview(
        raw.product_workspace_overview,
        guidedFlow,
      ),
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
        projectLocalOntologyTermCount: numberValue(
          summary.project_local_ontology_term_count,
        ),
        projectLocalOntologyImportAcceptedCount: numberValue(
          summary.project_local_ontology_import_accepted_count,
        ),
        projectLocalOntologyImportMissingCount: numberValue(
          summary.project_local_ontology_import_missing_count,
        ),
        projectLocalOntologyImportInvalidCount: numberValue(
          summary.project_local_ontology_import_invalid_count,
        ),
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
      guidedFlow,
      guidedRepairPath: parseGuidedRepairPath(raw.guided_repair_path),
      guidedApprovalPath: parseGuidedApprovalPath(raw.guided_approval_path),
      managedOperations: parseManagedOperationsObservability(
        raw.managed_operations_observability,
      ),
      managedModeReadiness: parseManagedModeReadiness(raw.managed_mode_readiness),
      realIdeaIntake: parseRealIdeaIntake(raw.real_idea_intake),
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
      intakeClarification: parseIntakeClarification(intakeClarification),
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
      candidateOverview: parseCandidateOverview(raw.candidate_overview),
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
      projectLocalOntologyReview: parseProjectLocalOntologyReview(
        projectLocalOntologyReview,
      ),
      projectLocalOntologyDecisionImportPreview:
        parseProjectLocalOntologyDecisionImportPreview(
          projectLocalOntologyImportPreview,
        ),
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
