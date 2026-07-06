import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  buildCandidateWorkflowTopology,
  type CandidateWorkflowTopologyView,
} from "../model/candidate-workflow-topology";
import { buildIdeaToSpecIntakeDraft } from "../model/idea-to-spec-intake-draft";
import type {
  IdeaToSpecActiveFrame,
  IdeaToSpecAcceptedAnswer,
  IdeaToSpecApprovalReadiness,
  IdeaToSpecCandidateNode,
  IdeaToSpecCandidateOverview,
  IdeaToSpecClarificationRequest,
  IdeaToSpecFinding,
  IdeaToSpecGitServiceOperation,
  IdeaToSpecGuidedFlow,
  IdeaToSpecIdeaMaturity,
  IdeaToSpecIdeaMaturityFinding,
  IdeaToSpecIdeaMaturityReadinessExplainer,
  IdeaToSpecIntakeAnswer,
  IdeaToSpecMaterializedFile,
  IdeaToSpecOntologyDecision,
  IdeaToSpecProjectLocalOntologyTerm,
  IdeaToSpecProductRepairRerunPlatformExecution,
  IdeaToSpecRealIdeaAnswerTarget,
  IdeaToSpecRepairAction,
  IdeaToSpecRepairSessionBlocker,
  IdeaToSpecRepairSessionStage,
  IdeaToSpecRepairTarget,
  IdeaToSpecResolvedOntologyGap,
  IdeaToSpecWorkspaceStateHygiene,
  IdeaToSpecWorkflow,
  IdeaToSpecWorkspace,
  UseIdeaToSpecWorkspaceState,
} from "../model/use-idea-to-spec-workspace";
import {
  useIdeaToSpecRepairDrafts,
  type IdeaToSpecRepairDraft,
  type IdeaToSpecRepairDraftInput,
  type IdeaToSpecRepairDraftSaveError,
  type UseIdeaToSpecRepairDraftsState,
} from "../model/use-idea-to-spec-repair-drafts";
import {
  useIdeaToSpecRepairRerunRequests,
  type IdeaToSpecRepairRerunRequestError,
  type UseIdeaToSpecRepairRerunRequestsState,
} from "../model/use-idea-to-spec-repair-rerun-requests";
import {
  useIdeaToSpecIntakeClarificationAnswers,
  type IdeaToSpecIntakeClarificationAnswer,
  type IdeaToSpecIntakeClarificationAnswerSaveError,
  type UseIdeaToSpecIntakeClarificationAnswersState,
} from "../model/use-idea-to-spec-intake-clarification-answers";
import { useRealIdeaEntryRequests } from "../model/use-real-idea-entry-requests";
import { useRealIdeaAnswerContinuationExecutionRequests } from "../model/use-real-idea-answer-continuation-execution-requests";
import { useRealIdeaIntakeExecutionRequests } from "../model/use-real-idea-intake-execution-requests";
import {
  useIdeaToSpecCandidateApprovalIntents,
  type IdeaToSpecCandidateApprovalIntentError,
  type UseIdeaToSpecCandidateApprovalIntentsState,
} from "../model/use-idea-to-spec-candidate-approval-intents";
import {
  useProjectLocalOntologyReviewDecisions,
  type ProjectLocalOntologyReviewDecision,
  type ProjectLocalOntologyReviewDecisionSaveError,
  type UseProjectLocalOntologyReviewDecisionState,
} from "../model/use-project-local-ontology-review-decisions";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseIdeaToSpecWorkspaceState;
  repairDraftsUrl?: string;
  intakeClarificationAnswersUrl?: string;
  realIdeaEntryRequestsUrl?: string;
  realIdeaIntakeExecutionRequestsUrl?: string;
  realIdeaAnswerContinuationExecutionRequestsUrl?: string;
  repairRerunRequestsUrl?: string;
  candidateApprovalIntentsUrl?: string;
  projectLocalOntologyReviewDecisionsUrl?: string;
  productWorkspaceInitializationExecuteUrl?: string;
  repairRerunRequestsRefreshKey?: number | string;
  onWorkspaceRefreshRequest?: () => void;
  auxiliaryDataEnabled?: boolean;
  readOnly?: boolean;
};

const FRESH_WORKSPACE_FOCUS_STATUSES = new Set([
  "route_only",
  "creation_requested",
  "initialized",
  "intake",
  "clarification",
]);
const FRESH_WORKSPACE_FOCUS_BLOCKED_PHASES = new Set([
  "workspace",
  "intake",
  "clarification",
]);
const FRESH_WORKSPACE_FOCUS_TARGET_SECTIONS = new Set([
  "idea-to-spec-workspace-creation",
  "idea-to-spec-workspace-initialization-path",
  "idea-to-spec-idea-intake",
  "idea-to-spec-intake-clarification",
]);

function usesFreshWorkspaceFocus(overview: IdeaToSpecWorkspace["productWorkspaceOverview"]) {
  if (FRESH_WORKSPACE_FOCUS_STATUSES.has(overview.status)) return true;
  if (overview.status !== "blocked") return false;
  return (
    FRESH_WORKSPACE_FOCUS_BLOCKED_PHASES.has(overview.currentPhase) ||
    FRESH_WORKSPACE_FOCUS_TARGET_SECTIONS.has(overview.primaryTargetSection ?? "")
  );
}

function targetIdFromHash(hash: string): string | null {
  if (!hash.startsWith("#") || hash.length <= 1) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

function diagnosticsBodyContainsHashTarget(
  body: HTMLDivElement | null,
  hash: string,
): boolean {
  const targetId = targetIdFromHash(hash);
  if (!body || !targetId) return false;
  return Array.from(body.querySelectorAll<HTMLElement>("[id]")).some(
    (element) => element.id === targetId,
  );
}

function errorDetail(
  state: Exclude<UseIdeaToSpecWorkspaceState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Idea-to-spec workspace endpoint is unreachable from the browser.";
    case "response-error":
    case "parse-error":
      return state.reason;
  }
}

function realIdeaEntryRequestErrorText(
  error: NonNullable<ReturnType<typeof useRealIdeaEntryRequests>["saveError"]>,
): string {
  if (error.kind === "network-error") return "network error";
  return describeHttpErrorDetail({
    status: error.status,
    statusText: error.statusText,
    body: error.body,
  });
}

function realIdeaIntakeExecutionRequestErrorText(
  error: NonNullable<
    ReturnType<typeof useRealIdeaIntakeExecutionRequests>["saveError"]
  >,
): string {
  if (error.kind === "network-error") return "network error";
  return describeHttpErrorDetail({
    status: error.status,
    statusText: error.statusText,
    body: error.body,
  });
}

function realIdeaAnswerContinuationExecutionRequestErrorText(
  error: NonNullable<
    ReturnType<typeof useRealIdeaAnswerContinuationExecutionRequests>["saveError"]
  >,
): string {
  if (error.kind === "network-error") return "network error";
  return describeHttpErrorDetail({
    status: error.status,
    statusText: error.statusText,
    body: error.body,
  });
}

function compact(
  value: string | null | undefined,
  fallback: string | null | undefined = "unknown",
): string {
  if (value && value.length > 0) return value;
  return fallback && fallback.length > 0 ? fallback : "unknown";
}

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function joined(values: readonly string[], fallback = "none"): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function sourceArtifactRefs(sourceArtifacts: Record<string, unknown>): string[] {
  return Object.entries(sourceArtifacts).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const sourceRef = (value as Record<string, unknown>).source_ref;
    return typeof sourceRef === "string" && sourceRef.length > 0
      ? [`${key}: ${sourceRef}`]
      : [];
  });
}

function metricValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return boolText(value);
  return "n/a";
}

function recordText(
  record: Record<string, unknown>,
  key: string,
  fallback = "unknown",
): string {
  return metricValue(record[key]) === "n/a" ? fallback : metricValue(record[key]);
}

type MetaValueKind = "plain" | "path" | "list" | "prose";

function metaValueKind(label: string, value: string): MetaValueKind {
  const lowerLabel = label.toLowerCase();
  if (
    lowerLabel.includes("next action") ||
    lowerLabel.includes("reason") ||
    lowerLabel.includes("statement") ||
    lowerLabel.includes("detail")
  ) {
    return "prose";
  }
  if (
    lowerLabel.includes("path") ||
    lowerLabel.includes("artifact") ||
    lowerLabel.includes("evidence") ||
    lowerLabel.includes("source ref") ||
    lowerLabel === "source" ||
    lowerLabel.includes("report") ||
    lowerLabel.includes("manifest") ||
    lowerLabel.includes("handoff")
  ) {
    return value.includes(", ") ? "list" : "path";
  }
  return value.includes(", ") && value.length > 40 ? "list" : "plain";
}

function metaValueClassName(kind: MetaValueKind): string {
  switch (kind) {
    case "path":
      return `${styles.metaValue} ${styles.metaValuePath}`;
    case "list":
      return `${styles.metaValue} ${styles.metaValueList}`;
    case "prose":
      return `${styles.metaValue} ${styles.metaValueProse}`;
    case "plain":
      return styles.metaValue;
  }
}

function metaShouldSpan(kind: MetaValueKind, value: string): boolean {
  return kind !== "plain" && value.length > 72;
}

function rateText(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function durationText(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (value < 1) return `${value.toFixed(3)}s`;
  if (value < 60) return `${value.toFixed(1)}s`;
  return `${Math.round(value / 60)}m`;
}

const MATURITY_NAV_ITEMS = [
  {
    label: "Clarification",
    href: "#idea-to-spec-repair-review",
    detail: "Open repair questions and saved answers.",
  },
  {
    label: "Ontology grounding",
    href: "#idea-to-spec-repair-review",
    detail: "Inspect gap decisions and resolved ontology terms.",
  },
  {
    label: "Pre-SIB",
    href: "#idea-to-spec-pre-sib",
    detail: "Review coherence and policy findings.",
  },
  {
    label: "Candidate repair",
    href: "#idea-to-spec-repair-session",
    detail: "Inspect blockers, stages, and accepted answers.",
  },
  {
    label: "Promotion preview",
    href: "#idea-to-spec-materialization",
    detail: "Inspect materialized review-only candidate files.",
  },
  {
    label: "Approval readiness",
    href: "#idea-to-spec-approval-readiness",
    detail: "Check whether promotion review can be requested.",
  },
  {
    label: "Controlled promotion",
    href: "#idea-to-spec-controlled-promotion",
    detail: "Inspect Platform and Git Service handoffs.",
  },
] as const;

function maturityFindingNextAction(
  finding: IdeaToSpecIdeaMaturityFinding,
): string {
  if (finding.nextAction) return finding.nextAction;
  const source = `${finding.source ?? ""} ${finding.findingId}`.toLowerCase();
  if (source.includes("ontology")) {
    return "Review ontology grounding decisions.";
  }
  if (source.includes("pre_sib") || source.includes("pre-sib")) {
    return "Inspect Pre-SIB coherence findings.";
  }
  if (source.includes("approval")) {
    return "Inspect approval readiness.";
  }
  if (source.includes("promotion") || source.includes("gate")) {
    return "Inspect promotion gates and controlled promotion reports.";
  }
  if (source.includes("rerun") || source.includes("repair")) {
    return "Review repair rerun state and rerun metrics after changes.";
  }
  return "Inspect the source artifact and rerun metrics after repair.";
}

function maturityExplainerHref(
  explainer: IdeaToSpecIdeaMaturityReadinessExplainer,
): string {
  const source = `${explainer.source ?? ""} ${explainer.kind} ${explainer.blocks.join(
    " ",
  )}`.toLowerCase();
  if (source.includes("pre_sib") || source.includes("pre-sib")) {
    return "#idea-to-spec-pre-sib";
  }
  if (source.includes("repair_session") || source.includes("repair-session")) {
    return "#idea-to-spec-repair-session";
  }
  if (source.includes("candidate_approval")) {
    return "#idea-to-spec-approval-readiness";
  }
  if (source.includes("promotion")) {
    return "#idea-to-spec-controlled-promotion";
  }
  if (source.includes("repair")) {
    return "#idea-to-spec-repair-review";
  }
  return "#idea-to-spec-idea-maturity";
}

function maturityExplainerNextAction(
  explainer: IdeaToSpecIdeaMaturityReadinessExplainer,
): string {
  return (
    explainer.nextAction ??
    "Inspect the linked lifecycle section and source evidence for this blocker."
  );
}

function findingKey(finding: { findingId: string }, index: number): string {
  return `${finding.findingId}-${index}`;
}

export function IdeaToSpecWorkspacePanel({
  state,
  repairDraftsUrl,
  intakeClarificationAnswersUrl,
  realIdeaEntryRequestsUrl,
  realIdeaIntakeExecutionRequestsUrl,
  realIdeaAnswerContinuationExecutionRequestsUrl,
  repairRerunRequestsUrl,
  candidateApprovalIntentsUrl,
  projectLocalOntologyReviewDecisionsUrl,
  productWorkspaceInitializationExecuteUrl,
  repairRerunRequestsRefreshKey = 0,
  onWorkspaceRefreshRequest,
  auxiliaryDataEnabled = true,
  readOnly = false,
}: Props) {
  const repairDrafts = useIdeaToSpecRepairDrafts({
    url: repairDraftsUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
  });
  const intakeClarificationAnswers = useIdeaToSpecIntakeClarificationAnswers({
    url: intakeClarificationAnswersUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
  });
  const realIdeaEntryRequests = useRealIdeaEntryRequests({
    url: realIdeaEntryRequestsUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
  });
  const realIdeaIntakeExecutionRequests = useRealIdeaIntakeExecutionRequests({
    url: realIdeaIntakeExecutionRequestsUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
    refreshKey: repairRerunRequestsRefreshKey,
  });
  const realIdeaAnswerContinuationExecutionRequests =
    useRealIdeaAnswerContinuationExecutionRequests({
      url: realIdeaAnswerContinuationExecutionRequestsUrl,
      enabled: auxiliaryDataEnabled && state.kind === "ok",
      refreshKey: repairRerunRequestsRefreshKey,
    });
  const repairDraftRefreshKey = useMemo(() => {
    if (repairDrafts.state.kind !== "ok") return "repair-drafts-unavailable";
    return repairDrafts.state.data.drafts
      .map((draft) => `${draft.draftId}:${draft.updatedAt}:${draft.allowedAction}`)
      .join("|");
  }, [repairDrafts.state]);
  const repairRerunRequests = useIdeaToSpecRepairRerunRequests({
    url: repairRerunRequestsUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
    refreshKey: `${repairDraftRefreshKey}:${repairRerunRequestsRefreshKey}`,
  });
  const candidateApprovalIntents = useIdeaToSpecCandidateApprovalIntents({
    url: candidateApprovalIntentsUrl,
    enabled: auxiliaryDataEnabled && state.kind === "ok",
    refreshKey: `${repairDraftRefreshKey}:${repairRerunRequestsRefreshKey}`,
  });
  const projectLocalOntologyReviewDecisions =
    useProjectLocalOntologyReviewDecisions({
      url: projectLocalOntologyReviewDecisionsUrl,
      enabled: auxiliaryDataEnabled && state.kind === "ok",
      refreshKey: repairDraftRefreshKey,
    });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [workspaceInitializationExecutionState, setWorkspaceInitializationExecutionState] =
    useState<{
      pending: boolean;
      status: string | null;
      error: string | null;
    }>({ pending: false, status: null, error: null });
  const diagnosticsBodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const openDiagnosticsForHash = () => {
      if (diagnosticsBodyContainsHashTarget(diagnosticsBodyRef.current, window.location.hash)) {
        setDiagnosticsOpen(true);
      }
    };
    openDiagnosticsForHash();
    window.addEventListener("hashchange", openDiagnosticsForHash);
    return () => window.removeEventListener("hashchange", openDiagnosticsForHash);
  }, [state.kind]);

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status
          label="Loading idea-to-spec workspace"
          detail="Reading /api/v1/idea-to-spec-workspace"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status label="Idea-to-spec workspace unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;
  const frame = data.candidateGraph.activeFrame.project
    ? data.candidateGraph.activeFrame
    : data.intake.activeFrame;
  const requestCandidateApprovalIntent = () => {
    if (readOnly) return;
    candidateApprovalIntents.requestApprovalIntent({
      workspaceId: data.selectedWorkspaceId ?? data.workspace.id,
      operatorRef: "operator://specspace-local",
      reason: "Approve candidate for promotion review.",
    });
  };
  const freshWorkspaceFocus = usesFreshWorkspaceFocus(data.productWorkspaceOverview);
  const focusStatus = data.productWorkspaceOverview.status;
  const focusPhase = data.productWorkspaceOverview.currentPhase;
  const focusTarget = data.productWorkspaceOverview.primaryTargetSection;
  const focusShowsWorkspaceCreation =
    ["route_only", "creation_requested"].includes(focusStatus) ||
    focusPhase === "workspace" ||
    focusTarget === "idea-to-spec-workspace-creation";
  const focusShowsWorkspaceInitialization =
    ["route_only", "creation_requested", "initialized", "intake"].includes(
      focusStatus,
    ) ||
    ["workspace", "intake"].includes(focusPhase) ||
    focusTarget === "idea-to-spec-workspace-initialization-path";
  const focusShowsIdeaIntake =
    ["initialized", "intake", "clarification"].includes(focusStatus) ||
    ["intake", "clarification"].includes(focusPhase) ||
    focusTarget === "idea-to-spec-idea-intake";
  const focusShowsIntakeClarification =
    focusStatus === "clarification" ||
    focusPhase === "clarification" ||
    focusTarget === "idea-to-spec-intake-clarification";
  const openDiagnosticsForHash = (hash: string): boolean => {
    if (!diagnosticsBodyContainsHashTarget(diagnosticsBodyRef.current, hash)) {
      return false;
    }
    setDiagnosticsOpen(true);
    return true;
  };
  const handleWorkspaceAnchorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target =
      event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
    const hash = target?.getAttribute("href");
    if (hash) openDiagnosticsForHash(hash);
  };
  const executeWorkspaceInitialization = async () => {
    const executionRequestRef = data.workspaceInitializationPath.initializationRequestRef;
    const workspaceId = data.selectedWorkspaceId ?? data.workspace.id;
    if (
      readOnly ||
      !productWorkspaceInitializationExecuteUrl ||
      !executionRequestRef ||
      !workspaceId
    ) {
      return;
    }
    setWorkspaceInitializationExecutionState({
      pending: true,
      status: null,
      error: null,
    });
    try {
      const response = await fetch(productWorkspaceInitializationExecuteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          execution_request_ref: executionRequestRef,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        summary?: { status?: unknown };
        status?: unknown;
        error?: unknown;
      };
      if (!response.ok) {
        const detail =
          typeof body.error === "string"
            ? body.error
            : `Managed initialization failed with HTTP ${response.status}.`;
        setWorkspaceInitializationExecutionState({
          pending: false,
          status: typeof body.status === "string" ? body.status : null,
          error: detail,
        });
        return;
      }
      setWorkspaceInitializationExecutionState({
        pending: false,
        status:
          typeof body.summary?.status === "string"
            ? body.summary.status
            : typeof body.status === "string"
              ? body.status
              : "managed_initialization_executed",
        error: null,
      });
      onWorkspaceRefreshRequest?.();
    } catch (error) {
      setWorkspaceInitializationExecutionState({
        pending: false,
        status: null,
        error: error instanceof Error ? error.message : "Managed initialization failed.",
      });
    }
  };

  const productWorkspaceOverviewSection = (
    <ProductWorkspaceOverviewSection
      overview={data.productWorkspaceOverview}
      workspace={data.workspace}
    />
  );
  const ideaIntakeDraftSection = (
    <IdeaIntakeDraftSection
      activeFrame={frame}
      realIdeaIntake={data.realIdeaIntake}
      entryRequests={realIdeaEntryRequests}
      executionRequests={realIdeaIntakeExecutionRequests}
      workspace={data.workspace}
      workspaceCreation={data.workspaceCreation}
      workspaceId={data.selectedWorkspaceId ?? data.workspace.id}
      onWorkspaceRefreshRequest={onWorkspaceRefreshRequest}
      readOnly={readOnly}
    />
  );
  const guidedWorkspaceInitializationPathSection = (
    <GuidedWorkspaceInitializationPathSection
      path={data.workspaceInitializationPath}
      executeUrl={productWorkspaceInitializationExecuteUrl}
      executionState={workspaceInitializationExecutionState}
      onExecute={executeWorkspaceInitialization}
      readOnly={readOnly}
    />
  );
  const workspaceCreationSection = (
    <WorkspaceCreationSection creation={data.workspaceCreation} />
  );
  const guidedFlowSection = <GuidedFlowSection flow={data.guidedFlow} />;
  const guidedRepairPathSection = (
    <GuidedRepairPathSection path={data.guidedRepairPath} />
  );
  const guidedApprovalPathSection = (
    <GuidedApprovalPathSection path={data.guidedApprovalPath} />
  );
  const intakeClarificationSection = (
    <IntakeClarificationSection
      state={state}
      answers={intakeClarificationAnswers}
      continuationExecutionRequests={realIdeaAnswerContinuationExecutionRequests}
      workspaceId={data.selectedWorkspaceId ?? data.workspace.id}
      workspaceInitialized={
        data.workspaceCreation.initialization.initialized === true ||
        data.workspace.available === true ||
        data.workspace.ready === true
      }
      onWorkspaceRefreshRequest={onWorkspaceRefreshRequest}
      readOnly={readOnly}
    />
  );
  const renderDiagnosticSections = (includeIntakeClarification = true) => (
    <>
      <CandidateOverviewSection overview={data.candidateOverview} />
      <WorkflowSection workflow={data.workflow} />
      <WorkspaceSection workspace={data.workspace} />
      <FrameSection
        project={frame.project}
        domains={frame.domainRefs}
        contexts={frame.contextRefs}
      />
      <ArtifactSection artifacts={data.artifacts} />
      <IntakeSection state={state} />
      {includeIntakeClarification ? intakeClarificationSection : null}
      <OntologySeedSection seed={data.ontologySeed} />
      <ProjectLocalOntologyReviewSection
        lane={data.projectLocalOntologyReview}
        importPreview={data.projectLocalOntologyDecisionImportPreview}
        decisions={projectLocalOntologyReviewDecisions}
        workspaceId={data.selectedWorkspaceId ?? data.workspace.id}
        readOnly={readOnly}
      />
      <CandidateGraphSection nodes={data.candidateGraph.nodes} />
      <PreSibSection state={state} />
      <RepairSection actions={data.repairLoop.actions} />
      <RepairSessionSection state={state} />
      <IdeaMaturitySection maturity={data.ideaMaturity} />
      <WorkspaceStateHygieneSection hygiene={data.workspaceStateHygiene} />
      <ProductRepairReviewSection
        state={state}
        repairDrafts={repairDrafts}
        repairRerunRequests={repairRerunRequests}
        workspaceId={data.selectedWorkspaceId ?? data.workspace.id}
        onWorkspaceRefreshRequest={onWorkspaceRefreshRequest}
        readOnly={readOnly}
      />
      <MaterializationSection state={state} />
      <PromotionGateSection state={state} />
      <ApprovalReadinessSection
        readiness={data.approvalReadiness}
        intentRequestReady={
          candidateApprovalIntents.state.kind === "ok" &&
          candidateApprovalIntents.state.data.workflowStatus.requestReady
        }
        pending={candidateApprovalIntents.pending}
        requestError={candidateApprovalIntents.requestError}
        onRequest={requestCandidateApprovalIntent}
        readOnly={readOnly}
      />
      <CandidateApprovalIntentSection
        state={candidateApprovalIntents.state}
        pending={candidateApprovalIntents.pending}
        requestError={candidateApprovalIntents.requestError}
        onRequest={requestCandidateApprovalIntent}
        showRequestButton={false}
      />
      <ControlledPromotionSection state={state} />
    </>
  );

  return (
    <section className={styles.panel} aria-label="Idea-to-spec workspace">
      <div className={styles.summary}>
        <Metric label="Artifacts" value={data.summary.availableArtifactCount} />
        <Metric label="Nodes" value={data.summary.candidateNodeCount} />
        <Metric label="Edges" value={data.summary.candidateEdgeCount} />
        <Metric label="Seed gaps" value={data.summary.ontologySeedGapCount} />
        <Metric label="Bindings" value={data.summary.ontologySeedBindingCount} />
        <Metric label="Findings" value={data.summary.preSibFindingCount} />
        <Metric label="Repairs" value={data.summary.repairActionCount} />
        <Metric label="Requests" value={data.summary.clarificationRequestCount} />
        <Metric label="Decisions" value={data.summary.ontologyDecisionCount} />
        <Metric label="Resolved" value={data.summary.resolvedOntologyGapCount} />
        <Metric label="Context" value={data.summary.repairContextRequiredCount} />
        <Metric label="Specs" value={data.summary.materializedFileCount} />
        <Metric label="Promote" value={data.summary.promotionPathCount} />
        <Metric label="Gate" value={data.summary.promotionGateBlockerCount} />
        <Metric label="Git ops" value={data.summary.gitServiceOperationCount} />
        <Metric label="Missing" value={data.summary.missingArtifactCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>Idea-to-Spec Workspace</span>
          <span className={styles.surfaceTitle}>
            {compact(frame.project, "no project")} · pre-SIB · readonly
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={compact(data.workspace.reviewState, "no active candidate")} />
          <Pill value={data.summary.status} />
          <Pill value={compact(data.preSib.readiness.reviewState, "no pre-SIB")} />
          <Pill value={compact(data.repairLoop.readiness.reviewState, "no repair")} />
          <Pill
            value={compact(
              data.materialization.readiness.reviewState,
              "no materialization",
            )}
          />
          <Pill
            value={compact(
              data.promotionGate.readiness.reviewState,
              "no promotion gate",
            )}
          />
        </div>
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.ideaToSpecWorkspaceIsAuthority)}
        />
        <PostureItem
          label="Spec mutations"
          value={boolText(data.authorityBoundary.mayMutateCanonicalSpecs)}
        />
        <PostureItem
          label="Git writes"
          value={boolText(data.authorityBoundary.mayCreateBranchOrCommit)}
        />
        <PostureItem
          label="Git service"
          value={boolText(data.authorityBoundary.mayExecuteGitServiceOperation)}
        />
      </div>

      <div className={styles.entries} onClickCapture={handleWorkspaceAnchorClick}>
        {productWorkspaceOverviewSection}
        {freshWorkspaceFocus ? (
          <>
            <FreshWorkspaceFocusSection
              overview={data.productWorkspaceOverview}
              workspace={data.workspace}
            />
            {focusShowsWorkspaceInitialization
              ? guidedWorkspaceInitializationPathSection
              : null}
            {focusShowsWorkspaceCreation ? workspaceCreationSection : null}
            {focusShowsIdeaIntake ? ideaIntakeDraftSection : null}
            {focusShowsIntakeClarification ? intakeClarificationSection : null}
            <details
              className={styles.diagnosticsDisclosure}
              data-testid="fresh-workspace-diagnostics"
              open={diagnosticsOpen}
              onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
            >
              <summary className={styles.diagnosticsSummary}>
                Diagnostics / advanced artifacts
              </summary>
              <div className={styles.diagnosticsBody} ref={diagnosticsBodyRef}>
                {guidedFlowSection}
                {!focusShowsWorkspaceInitialization
                  ? guidedWorkspaceInitializationPathSection
                  : null}
                {!focusShowsWorkspaceCreation ? workspaceCreationSection : null}
                {!focusShowsIdeaIntake ? ideaIntakeDraftSection : null}
                {guidedRepairPathSection}
                {guidedApprovalPathSection}
                {renderDiagnosticSections(!focusShowsIntakeClarification)}
              </div>
            </details>
          </>
        ) : (
          <>
            {ideaIntakeDraftSection}
            {guidedWorkspaceInitializationPathSection}
            {workspaceCreationSection}
            {guidedFlowSection}
            {guidedRepairPathSection}
            {guidedApprovalPathSection}
            {renderDiagnosticSections()}
          </>
        )}
      </div>
    </section>
  );
}

function FreshWorkspaceFocusSection({
  overview,
  workspace,
}: {
  overview: IdeaToSpecWorkspace["productWorkspaceOverview"];
  workspace: IdeaToSpecWorkspace["workspace"];
}) {
  return (
    <section className={styles.reviewSection} data-testid="fresh-workspace-focus">
      <SectionHeader title="Fresh workspace focus" count={overview.readiness.blockerCount} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {workspace.displayName ?? workspace.id ?? "Product workspace"}
          </span>
          <Pill value={overview.status.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title}>
          {overview.nextSafeAction}
        </h3>
        <p className={styles.statusDetail}>
          Early workspace mode is focused on the current product step. Candidate,
          repair, approval, and publication diagnostics stay available below as
          advanced artifacts, but they are not the primary path until this
          workspace publishes the matching evidence.
        </p>
        <div className={styles.postureStrip}>
          <PostureItem label="Current phase" value={overview.currentPhaseLabel} />
          <PostureItem label="Route" value={workspace.publicRoute ?? "route"} />
          <PostureItem label="Readiness" value={overview.readiness.status} />
          <PostureItem label="Confidence" value={overview.confidence.level} />
        </div>
      </div>
    </section>
  );
}

function ProductWorkspaceOverviewSection({
  overview,
  workspace,
}: {
  overview: IdeaToSpecWorkspace["productWorkspaceOverview"];
  workspace: IdeaToSpecWorkspace["workspace"];
}) {
  const primaryHref = overview.primaryTargetSection
    ? `#${overview.primaryTargetSection}`
    : null;
  const lastHandoffHref = overview.lastSuccessfulHandoff.targetSection
    ? `#${overview.lastSuccessfulHandoff.targetSection}`
    : null;
  return (
    <section
      id="idea-to-spec-product-workspace-overview"
      className={styles.reviewSection}
    >
      <SectionHeader
        title="Product workspace overview"
        count={overview.readiness.blockerCount}
      />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {workspace.displayName ?? workspace.id ?? "Product workspace"}
          </span>
          <Pill value={overview.status.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title} data-testid="product-workspace-overview-next-action">
          {overview.nextSafeAction}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem label="Current phase" value={overview.currentPhaseLabel} />
          <PostureItem
            label="Progress"
            value={`${overview.completedPhaseCount}/${overview.totalPhaseCount}`}
          />
          <PostureItem
            label="Blockers"
            value={String(overview.readiness.blockerCount)}
          />
          <PostureItem label="Readiness" value={overview.readiness.status} />
          <PostureItem label="Confidence" value={overview.confidence.level} />
          <PostureItem
            label="Last handoff"
            value={overview.lastSuccessfulHandoff.label ?? "None"}
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Workspace id" value={workspace.id} />
          <Meta label="Route" value={workspace.publicRoute} />
          <Meta label="Target section" value={overview.primaryTargetSection} />
          <Meta
            label="Confidence reason"
            value={overview.confidence.reason}
          />
          <Meta
            label="Maturity"
            value={overview.confidence.maturityLifecycleState}
          />
          <Meta
            label="Evidence"
            value={joined(overview.confidence.sourceRefs)}
          />
        </div>
        {primaryHref ? (
          <a className={styles.guidedStage} href={primaryHref}>
            <span className={styles.navLabel}>Next safe action</span>
            <span className={styles.navHint}>{overview.nextSafeAction}</span>
            <span className={styles.guidedStageMeta}>
              {overview.currentPhaseLabel}
            </span>
          </a>
        ) : null}
        {lastHandoffHref ? (
          <a className={styles.guidedStage} href={lastHandoffHref}>
            <span className={styles.navLabel}>Last successful handoff</span>
            <span className={styles.navHint}>
              {overview.lastSuccessfulHandoff.label ?? "No completed handoff yet"}
            </span>
            <span className={styles.guidedStageMeta}>
              {joined(overview.lastSuccessfulHandoff.evidenceRefs)}
            </span>
          </a>
        ) : null}
      </div>
      <div className={styles.guidedRail} data-testid="product-workspace-phase-timeline">
        {overview.phases.map((phase) => {
          const href = phase.targetSection ? `#${phase.targetSection}` : undefined;
          const content = (
            <>
              <span className={styles.navLabel}>{phase.label}</span>
              <span className={styles.navHint}>
                {phase.blockers.length > 0
                  ? joined(phase.blockers)
                  : joined(phase.evidenceRefs)}
              </span>
              <span className={styles.guidedStageMeta}>
                {phase.state.replace(/_/g, " ")}
              </span>
            </>
          );
          return href ? (
            <a key={phase.id} className={styles.guidedStage} href={href}>
              {content}
            </a>
          ) : (
            <div key={phase.id} className={styles.guidedStage}>
              {content}
            </div>
          );
        })}
      </div>
      {overview.readiness.blockers.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Overview blockers</span>
            <span className={styles.sectionCount}>
              {overview.readiness.blockers.length}
            </span>
          </div>
          <p className={styles.statusDetail}>
            {joined(overview.readiness.blockers)}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceCreationSection({
  creation,
}: {
  creation: IdeaToSpecWorkspace["workspaceCreation"];
}) {
  const activeRequest = creation.activeRequest;
  return (
    <section id="idea-to-spec-workspace-creation" className={styles.reviewSection}>
      <SectionHeader title="Workspace creation" count={creation.requestCount} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Product workspace</span>
          <Pill value={creation.status.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title} data-testid="workspace-creation-status">
          {creation.status === "route_only_workspace"
            ? "Route opened; backend workspace creation has not been requested yet."
            : creation.status === "workspace_creation_requested"
              ? "Workspace creation requested; waiting for controlled Platform initialization."
              : creation.status === "workspace_initialized"
                ? "Workspace initialized through backend-owned state."
                : creation.status === "product_workspace_creation_state_invalid"
                  ? "Workspace creation state is invalid."
                  : "Workspace creation state is not available yet."}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem label="Requests" value={String(creation.requestCount)} />
          <PostureItem
            label="Active"
            value={String(creation.activeRequestedCount)}
          />
          <PostureItem label="Invalid" value={String(creation.invalidRequestCount)} />
          <PostureItem
            label="Initialized"
            value={creation.initialization.initialized ? "yes" : "no"}
          />
          <PostureItem label="Next" value={compact(creation.nextGap)} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Selected workspace" value={creation.selectedWorkspaceId} />
          <Meta label="Request" value={activeRequest?.requestId} />
          <Meta label="Workspace id" value={activeRequest?.workspaceId} />
          <Meta label="Display name" value={activeRequest?.displayName} />
          <Meta label="Route" value={activeRequest?.route} />
          <Meta label="Request status" value={activeRequest?.status} />
          <Meta
            label="Initialization"
            value={creation.initialization.executionStatus}
          />
          <Meta
            label="Execution request"
            value={creation.initialization.requestStatus}
          />
          <Meta
            label="Managed ready"
            value={
              creation.initialization.requestReadyForManagedExecution ? "yes" : null
            }
          />
          <Meta
            label="Requested operation"
            value={creation.initialization.requestedOperation}
          />
          <Meta
            label="Idempotency"
            value={creation.initialization.idempotencyKey}
          />
          <Meta
            label="Catalog binding"
            value={creation.initialization.catalogWritten ? "written" : null}
          />
        </div>
      </div>
    </section>
  );
}

function GuidedWorkspaceInitializationPathSection({
  path,
  executeUrl,
  executionState,
  onExecute,
  readOnly,
}: {
  path: IdeaToSpecWorkspace["workspaceInitializationPath"];
  executeUrl?: string;
  executionState: {
    pending: boolean;
    status: string | null;
    error: string | null;
  };
  onExecute: () => void;
  readOnly: boolean;
}) {
  const canRequestManagedExecution =
    Boolean(path.initializationRequestRef) &&
    path.status !== "initialized" &&
    path.status !== "blocked" &&
    !readOnly;
  return (
    <section
      id="idea-to-spec-workspace-initialization-path"
      className={styles.reviewSection}
    >
      <SectionHeader
        title="Guided workspace initialization"
        count={path.blockers.length}
      />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Workspace initialization path</span>
          <Pill value={path.status.replace(/_/g, " ")} />
        </div>
        <h3
          className={styles.title}
          data-testid="workspace-initialization-path-next-action"
        >
          {path.nextSafeAction ?? "Create and initialize this workspace before intake."}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem label="Workspace" value={path.workspaceId ?? "route"} />
          <PostureItem
            label="Initial idea"
            value={path.initialIdeaPresent ? "present" : "missing"}
          />
          <PostureItem label="Blockers" value={String(path.blockers.length)} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Display name" value={path.displayName} />
          <Meta label="Creation request" value={path.creationRequestRef} />
          <Meta
            label="Initialization request"
            value={path.initializationRequestRef}
          />
          <Meta
            label="Initialization report"
            value={path.initializationReportRef}
          />
        </div>
        {path.blockers.length > 0 ? (
          <p className={styles.statusDetail}>
            Blockers: {joined(path.blockers)}
          </p>
        ) : null}
        {path.initializationRequestRef && path.status !== "initialized" ? (
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={
                !executeUrl ||
                !canRequestManagedExecution ||
                executionState.pending
              }
              onClick={onExecute}
            >
              {executionState.pending
                ? "Running initialization..."
                : "Run controlled initialization"}
            </button>
            <span className={styles.statusDetail}>
              {executeUrl
                ? "SpecSpace backend will call the allowlisted Platform operation."
                : "Managed backend execution is not configured; use the Platform command hint."}
            </span>
          </div>
        ) : null}
        {executionState.status ? (
          <p className={styles.statusDetail}>Execution: {executionState.status}</p>
        ) : null}
        {executionState.error ? (
          <p className={styles.statusDetail}>{executionState.error}</p>
        ) : null}
      </div>
    </section>
  );
}

function IdeaIntakeDraftSection({
  activeFrame,
  realIdeaIntake,
  entryRequests,
  executionRequests,
  workspace,
  workspaceCreation,
  workspaceId,
  onWorkspaceRefreshRequest,
  readOnly,
}: {
  activeFrame: IdeaToSpecActiveFrame;
  realIdeaIntake: IdeaToSpecWorkspace["realIdeaIntake"];
  entryRequests: ReturnType<typeof useRealIdeaEntryRequests>;
  executionRequests: ReturnType<typeof useRealIdeaIntakeExecutionRequests>;
  workspace: IdeaToSpecWorkspace["workspace"];
  workspaceCreation: IdeaToSpecWorkspace["workspaceCreation"];
  workspaceId: string | null;
  onWorkspaceRefreshRequest?: () => void;
  readOnly: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [publicSummary, setPublicSummary] = useState("");
  const [prefilledCreationRequestId, setPrefilledCreationRequestId] =
    useState<string | null>(null);
  const draft = useMemo(
    () => buildIdeaToSpecIntakeDraft({ idea, activeFrame }),
    [idea, activeFrame],
  );
  const activeEntry = entryRequests.activeSubmittedRequest;
  const activeWorkspaceCreationRequest = workspaceCreation.activeRequest;
  useEffect(() => {
    if (activeEntry !== null || activeWorkspaceCreationRequest === null) return;
    if (prefilledCreationRequestId === activeWorkspaceCreationRequest.requestId) {
      return;
    }
    if (!idea.trim() && activeWorkspaceCreationRequest.rootIntentSummary) {
      setIdea(activeWorkspaceCreationRequest.rootIntentSummary);
    }
    if (!publicSummary.trim()) {
      setPublicSummary(activeWorkspaceCreationRequest.displayName);
    }
    setPrefilledCreationRequestId(activeWorkspaceCreationRequest.requestId);
  }, [
    activeEntry,
    activeWorkspaceCreationRequest,
    idea,
    prefilledCreationRequestId,
    publicSummary,
  ]);
  const activeExecutionRequest = executionRequests.activeRequest;
  const executionRequestTargetsCurrentEntry =
    activeExecutionRequest !== null &&
    activeEntry !== null &&
    activeExecutionRequest.entryRequestId === activeEntry.requestId;
  const executionRequestTargetsStaleEntry =
    activeExecutionRequest !== null &&
    activeEntry !== null &&
    activeExecutionRequest.entryRequestId !== activeEntry.requestId;
  const workspaceInitialized = workspaceCreation.initialization.initialized === true;
  const workspaceMatchesRoute = !workspaceId || workspace.id === workspaceId;
  const publishedWorkspaceReady =
    workspaceMatchesRoute && (workspace.available === true || workspace.ready === true);
  const workspaceNamespaceReady =
    publishedWorkspaceReady ||
    workspaceInitialized;
  const workspaceCreationBlocksIntake =
    !workspaceNamespaceReady &&
    [
      "route_only_workspace",
      "workspace_creation_requested",
      "workspace_creation_blocked",
      "product_workspace_creation_state_invalid",
    ].includes(workspaceCreation.status);
  let workspaceCreationGateLabel = "route only";
  let workspaceCreationGateMessage =
    "Request and initialize this workspace before submitting a raw idea.";
  if (workspaceInitialized) {
    workspaceCreationGateLabel = "workspace initialized";
    workspaceCreationGateMessage = "Raw idea intake will use this workspace namespace.";
  } else if (publishedWorkspaceReady) {
    workspaceCreationGateLabel = "published workspace";
    workspaceCreationGateMessage = "Raw idea intake will use this workspace namespace.";
  } else {
    switch (workspaceCreation.status) {
      case "workspace_creation_requested":
        workspaceCreationGateLabel = "workspace creation requested";
        workspaceCreationGateMessage =
          "Run the controlled Platform workspace initialization before submitting a raw idea.";
        break;
      case "workspace_creation_blocked":
        workspaceCreationGateLabel = "workspace creation blocked";
        workspaceCreationGateMessage =
          "Repair workspace creation state before submitting a raw idea.";
        break;
      case "product_workspace_creation_state_invalid":
        workspaceCreationGateLabel = "workspace creation invalid";
        workspaceCreationGateMessage =
          "Repair workspace creation state before submitting a raw idea.";
        break;
      default:
        break;
    }
  }
  const entryHandoffCommand = activeEntry
    ? [
        "scripts/platform.py product-real-idea-intake execute-requested \\",
        "  --specgraph-dir <specgraph-repository> \\",
        "  --execution-request <SpecSpace state dir>/real_idea_intake_execution_requests.json \\",
        `  --workspace-id ${workspaceId ?? activeEntry.workspaceId} \\`,
        `  --request-id ${activeEntry.requestId}`,
      ].join("\n")
    : null;
  const workspaceInitializationRef =
    "runs/platform_product_workspace_initialization_execution_report.json";
  const canRequestIntakeExecution =
    !readOnly &&
    activeEntry !== null &&
    workspaceInitialized &&
    !realIdeaIntake.entryExecution.available &&
    !executionRequests.pending &&
    !executionRequestTargetsCurrentEntry;
  const canSubmit =
    !readOnly &&
    entryRequests.configured &&
    idea.trim().length > 0 &&
    publicSummary.trim().length > 0 &&
    !workspaceCreationBlocksIntake &&
    !entryRequests.pending;
  return (
    <section id="idea-to-spec-idea-intake" className={styles.reviewSection}>
      <SectionHeader title="Idea intake" count={realIdeaIntake.clarificationProgress.questionCount} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Real idea intake</span>
          <Pill value={realIdeaIntake.status.replace(/_/g, " ")} />
        </div>
        <h3
          className={styles.title}
          data-testid="real-idea-intake-next-action"
        >
          {realIdeaIntake.nextAction}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem label="Workspace gate" value={workspaceCreationGateLabel} />
          <PostureItem
            label="Questions"
            value={String(realIdeaIntake.clarificationProgress.questionCount)}
          />
          <PostureItem
            label="Answered"
            value={String(realIdeaIntake.clarificationProgress.answeredCount)}
          />
          <PostureItem
            label="Missing"
            value={String(realIdeaIntake.clarificationProgress.missingCount)}
          />
          <PostureItem
            label="Invalid"
            value={String(realIdeaIntake.clarificationProgress.invalidAnswerCount)}
          />
          <PostureItem
            label="Continuation"
            value={realIdeaIntake.continuationHandoff.safeToContinue ? "ready" : "pending"}
          />
          <PostureItem
            label="Entry"
            value={realIdeaIntake.entryExecution.status}
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Workspace" value={realIdeaIntake.workspaceId} />
          <Meta label="Session" value={realIdeaIntake.sessionRef} />
          <Meta label="Clarified session" value={realIdeaIntake.clarifiedSessionRef} />
          <Meta label="Candidate source" value={realIdeaIntake.candidateSourceRef} />
          <Meta label="Active candidate" value={realIdeaIntake.activeCandidateRef} />
          <Meta label="Template" value={realIdeaIntake.answerTemplate.status} />
          <Meta label="Template ref" value={realIdeaIntake.answerTemplate.templateRef} />
          <Meta
            label="Required fields"
            value={joined(realIdeaIntake.answerTemplate.requiredFields)}
          />
          <Meta
            label="Import preview"
            value={realIdeaIntake.continuationHandoff.importPreviewStatus}
          />
          <Meta
            label="Materialization"
            value={realIdeaIntake.continuationHandoff.materializationStatus}
          />
          <Meta
            label="Entry execution"
            value={
              realIdeaIntake.entryExecution.available
                ? realIdeaIntake.entryExecution.status
                : "missing"
            }
          />
          <Meta label="Entry target" value={realIdeaIntake.entryExecution.target} />
          <Meta
            label="Entry handoff"
            value={realIdeaIntake.entryExecution.entryRequestsHandoffRef}
          />
          <Meta
            label="Entry outputs"
            value={joined(realIdeaIntake.entryExecution.outputRefs)}
          />
          <Meta label="Evidence" value={joined(realIdeaIntake.sourceRefs)} />
        </div>
        {realIdeaIntake.continuationHandoff.commandHint ? (
          <pre className={styles.codeBlock}>
            {realIdeaIntake.continuationHandoff.commandHint}
          </pre>
        ) : null}
        {realIdeaIntake.entryExecution.available ? (
          <div className={styles.row}>
            <div className={styles.rowHeader}>
              <span className={styles.rowId}>Platform intake execution</span>
              <Pill
                value={
                  realIdeaIntake.entryExecution.dryRun
                    ? "dry run"
                    : realIdeaIntake.entryExecution.ok
                      ? "completed"
                      : realIdeaIntake.entryExecution.status
                }
              />
            </div>
            <div className={styles.metaGrid}>
              <Meta label="Status" value={realIdeaIntake.entryExecution.status} />
              <Meta label="Dry run" value={boolText(realIdeaIntake.entryExecution.dryRun)} />
              <Meta label="Run dir" value={realIdeaIntake.entryExecution.runDir} />
              <Meta label="Target" value={realIdeaIntake.entryExecution.target} />
              <Meta
                label="Outputs"
                value={String(realIdeaIntake.entryExecution.outputArtifactCount)}
              />
              <Meta
                label="Diagnostics"
                value={String(realIdeaIntake.entryExecution.diagnosticCount)}
              />
            </div>
            {realIdeaIntake.entryExecution.operations.map((operation, index) => (
              <div key={`${operation.name}-${index}`} className={styles.subRow}>
                <span>{operation.name}</span>
                <Pill value={operation.status} />
                <span className={styles.statusDetail}>
                  {compact(operation.reason, joined(operation.evidence))}
                </span>
              </div>
            ))}
            {realIdeaIntake.entryExecution.outputArtifacts.map((artifact) => (
              <div key={artifact.key} className={styles.subRow}>
                <span>{artifact.key}</span>
                <Pill
                  value={
                    artifact.ready
                      ? "ready"
                      : artifact.present
                        ? "present"
                        : "missing"
                  }
                />
                <span className={styles.statusDetail}>
                  {artifact.path ?? compact(artifact.artifactKind)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {realIdeaIntake.blockers.length > 0 ? (
          <p className={styles.statusDetail}>
            Blockers: {joined(realIdeaIntake.blockers)}
          </p>
        ) : null}
        {realIdeaIntake.clarificationProgress.requiredFieldFindings
          .slice(0, 3)
          .map((finding, index) => (
            <p key={findingKey(finding, index)} className={styles.statusDetail}>
              {finding.severity}: {finding.message}
            </p>
          ))}
      </div>
      <div id="idea-to-spec-start-raw-idea" className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Start here: raw product idea</span>
          <Pill value={activeEntry ? "submitted" : "operator draft"} />
        </div>
        <p className={styles.statusDetail}>
          Enter the user's product idea here. SpecSpace stores only
          operator-owned local state; Platform performs the controlled intake
          handoff later.
        </p>
        <p
          className={styles.statusDetail}
          data-testid="real-idea-entry-workspace-gate"
        >
          Workspace gate: {workspaceCreationGateMessage}
        </p>
        <textarea
          data-testid="real-idea-entry-text"
          className={styles.ideaInput}
          value={idea}
          onChange={(event) => setIdea(event.currentTarget.value)}
          placeholder="Product idea, actors, events, constraints"
          rows={5}
          aria-label="Product idea intake"
          disabled={readOnly || entryRequests.pending || workspaceCreationBlocksIntake}
        />
        <input
          data-testid="real-idea-entry-summary"
          className={styles.textInput}
          value={publicSummary}
          onChange={(event) => setPublicSummary(event.currentTarget.value)}
          placeholder="Public-safe idea summary"
          aria-label="Public-safe idea summary"
          disabled={readOnly || entryRequests.pending || workspaceCreationBlocksIntake}
        />
        <div className={styles.postureStrip}>
          <PostureItem label="Source" value={draft?.sourceMode ?? "local_browser_draft"} />
          <PostureItem
            label="Spec mutations"
            value={boolText(draft?.canonicalMutationsAllowed ?? false)}
          />
          <PostureItem
            label="Tracked writes"
            value={boolText(draft?.trackedArtifactsWritten ?? false)}
          />
        </div>
        <button
          data-testid="real-idea-entry-submit"
          className={styles.ackButton}
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void entryRequests
              .saveRequest({
                workspaceId,
                ideaText: idea,
                ideaSummaryHint: publicSummary,
                workspaceDisplayName: null,
                publicRouteHint: workspaceId ? `/${workspaceId}` : null,
                operatorRef: "operator://specspace-local",
                status: "submitted",
              })
              .then((saved) => {
                if (saved) onWorkspaceRefreshRequest?.();
              });
          }}
        >
          {entryRequests.pending ? "Saving request" : "Submit raw idea request"}
        </button>
        {activeEntry ? (
          <p
            className={styles.statusDetail}
            data-testid="real-idea-entry-submitted-status"
          >
            Submitted request · {activeEntry.requestId} · {activeEntry.updatedAt}
          </p>
        ) : null}
        {entryHandoffCommand ? (
          <div className={styles.row}>
            <div className={styles.rowHeader}>
              <span className={styles.rowId}>Next safe handoff</span>
              <Pill
                value={
                  executionRequestTargetsCurrentEntry
                    ? "requested"
                    : executionRequestTargetsStaleEntry
                      ? "replace request"
                      : "operator request"
                }
              />
            </div>
            <p className={styles.statusDetail}>
              Request controlled Platform intake execution. SpecSpace stores a
              request intent only; a backend/Platform worker performs the
              allowlisted execution.
            </p>
            <button
              data-testid="real-idea-intake-execution-request"
              className={styles.ackButton}
              type="button"
              disabled={!canRequestIntakeExecution}
              onClick={() => {
                if (!activeEntry) return;
                void executionRequests
                  .requestExecution({
                    workspaceId,
                    entryRequestId: activeEntry.requestId,
                    entryRequestsRef: "specspace-state://real_idea_entry_requests.json",
                    workspaceInitializationRef,
                    operatorRef: "operator://specspace-local",
                  })
                  .then((saved) => {
                    if (saved) onWorkspaceRefreshRequest?.();
                  });
              }}
            >
              {executionRequests.pending
                ? "Requesting intake execution"
                : executionRequestTargetsStaleEntry
                  ? "Replace intake execution request"
                  : "Request intake execution"}
            </button>
            {activeExecutionRequest ? (
              <p
                className={styles.statusDetail}
                data-testid="real-idea-intake-execution-request-status"
              >
                {executionRequestTargetsStaleEntry
                  ? "Requested execution targets previous entry"
                  : "Requested execution"}{" "}
                · {activeExecutionRequest.requestId} · entry{" "}
                {activeExecutionRequest.entryRequestId}
              </p>
            ) : null}
            <pre
              className={styles.codeBlock}
              data-testid="real-idea-entry-handoff-command"
            >
              {entryHandoffCommand}
            </pre>
          </div>
        ) : null}
        {executionRequests.saveError ? (
          <p className={styles.statusDetail}>
            Execution request failed ·{" "}
            {realIdeaIntakeExecutionRequestErrorText(executionRequests.saveError)}
          </p>
        ) : null}
        {entryRequests.saveError ? (
          <p className={styles.statusDetail}>
            Request save failed · {realIdeaEntryRequestErrorText(entryRequests.saveError)}
          </p>
        ) : null}
        {entryRequests.state.kind === "ok" ? (
          <div className={styles.metaGrid}>
            <Meta label="Request state" value={entryRequests.state.data.summary.status} />
            <Meta
              label="Submitted"
              value={String(entryRequests.state.data.summary.activeSubmittedCount)}
            />
            <Meta label="Next gap" value={entryRequests.state.data.summary.nextGap} />
          </div>
        ) : null}
      </div>
      {draft ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{draft.artifactKind}</span>
            <Pill value={draft.sourceMode} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Project" value={draft.project} />
            <Meta label="Actors" value={joined(draft.actors)} />
            <Meta label="Events" value={joined(draft.domainEvents)} />
            <Meta label="Commands" value={joined(draft.commands)} />
            <Meta label="Policies" value={joined(draft.policies)} />
            <Meta label="Constraints" value={joined(draft.constraints)} />
            <Meta
              label="Vocabulary"
              value={joined(draft.vocabularyQuestions)}
            />
            <Meta
              label="Context"
              value={joined(draft.contextCompletionQuestions)}
            />
          </div>
        </div>
      ) : (
        <Status
          label="No local idea draft"
          detail="Enter a product idea to preview event-storming intake candidates."
        />
      )}
    </section>
  );
}

function WorkflowSection({ workflow }: { workflow: IdeaToSpecWorkflow }) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Workflow lane" count={workflow.items.length} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>{workflow.stage.replace(/_/g, " ")}</span>
          <Pill value={workflow.status} />
        </div>
        <div className={styles.workflowGrid}>
          {workflow.items.map((item) => (
            <div key={item.id} className={styles.workflowItem}>
              <div className={styles.workflowItemHeader}>
                <span className={styles.metaLabel}>{item.label}</span>
                <Pill value={item.status} />
              </div>
              <span className={styles.metaValue}>
                {compact(item.detail ?? item.artifactPath, "no detail")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Next handoff</span>
          <Pill value={workflow.nextHandoff.status} />
        </div>
        <h3 className={styles.title}>{workflow.nextHandoff.label}</h3>
        <div className={styles.metaGrid}>
          <Meta label="Kind" value={workflow.nextHandoff.kind} />
          <Meta label="Authority" value={workflow.nextHandoff.authorityBoundary} />
          <Meta label="Artifact" value={workflow.nextHandoff.artifactPath} />
          <Meta label="Command" value={workflow.nextHandoff.commandTemplate} />
        </div>
      </div>
    </section>
  );
}

function GuidedFlowSection({ flow }: { flow: IdeaToSpecGuidedFlow }) {
  const nextAction = flow.nextActions[0] ?? null;
  const commandStages = flow.stages.filter((stage) => stage.commandTemplate);
  return (
    <section id="idea-to-spec-guided-flow" className={styles.reviewSection}>
      <SectionHeader title="Guided product flow" count={flow.stages.length} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>{flow.currentStageLabel}</span>
          <Pill value={flow.overallStatus.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title} data-testid="guided-flow-next-action">
          {nextAction?.label ?? "Inspect the current idea-to-spec lifecycle stage."}
        </h3>
        <div className={styles.metaGrid}>
          <Meta label="Current stage" value={flow.currentStage} />
          <Meta label="Workflow stage" value={flow.workflowStage} />
          <Meta label="Workflow status" value={flow.workflowStatus} />
          <Meta label="Next handoff" value={flow.nextHandoff.label} />
          <Meta label="Target section" value={nextAction?.targetSection} />
          <Meta label="Evidence" value={joined(nextAction?.evidenceRefs ?? [])} />
        </div>
        {nextAction?.commandTemplate ? (
          <pre className={styles.codeBlock}>{nextAction.commandTemplate}</pre>
        ) : null}
      </div>
      <div className={styles.guidedRail}>
        {flow.stages.map((stage, index) => {
          const href = stage.targetSection ? `#${stage.targetSection}` : undefined;
          const label = `${index + 1}. ${stage.label}`;
          const content = (
            <>
              <span className={styles.navLabel}>{label}</span>
              <span className={styles.navHint}>{stage.primaryNextAction}</span>
              <span className={styles.guidedStageMeta}>
                {stage.status.replace(/_/g, " ")}
                {stage.blockers.length > 0
                  ? ` · blockers ${stage.blockers.length}`
                  : ""}
              </span>
            </>
          );
          return href ? (
            <a key={stage.id} className={styles.guidedStage} href={href}>
              {content}
            </a>
          ) : (
            <div key={stage.id} className={styles.guidedStage}>
              {content}
            </div>
          );
        })}
      </div>
      {commandStages.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Command hints</span>
            <span className={styles.sectionCount}>{commandStages.length}</span>
          </div>
          {commandStages.slice(0, 3).map((stage) => (
            <div key={`${stage.id}:command`}>
              <span className={styles.metaLabel}>{stage.label}</span>
              <pre className={styles.codeBlock}>{stage.commandTemplate}</pre>
            </div>
          ))}
        </div>
      ) : null}
      {flow.stages
        .filter((stage) => stage.blockers.length > 0)
        .slice(0, 6)
        .map((stage) => (
          <div key={`${stage.id}:blockers`} className={styles.subRow}>
            <span>{stage.label}</span>
            <Pill value={stage.status} />
            <span className={styles.statusDetail}>{joined(stage.blockers)}</span>
          </div>
        ))}
    </section>
  );
}

function GuidedRepairPathSection({
  path,
}: {
  path: IdeaToSpecWorkspace["guidedRepairPath"];
}) {
  const primaryHref = path.targetSection ? `#${path.targetSection}` : null;
  const stateItems = [
    ["Drafts", path.state.repairDraftsStatus],
    ["Request", path.state.rerunRequestStatus],
    ["Gate", path.state.requestGateStatus],
    ["Execution", path.state.rerunExecutionStatus],
    ["Publication", path.state.rerunPublicationStatus],
  ] as const;
  return (
    <section id="idea-to-spec-guided-repair-path" className={styles.reviewSection}>
      <SectionHeader
        title="Guided repair path"
        count={path.available ? path.checkpoints.length : 0}
      />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Candidate repair route</span>
          <Pill value={path.stage.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title} data-testid="guided-repair-next-action">
          {path.nextAction}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem
            label="Answers"
            value={`${path.counts.acceptedAnswerCount}/${path.counts.productSpecTargetCount}`}
          />
          <PostureItem
            label="Open answers"
            value={String(path.counts.unresolvedBlockingAnswerCount)}
          />
          <PostureItem
            label="Ontology decisions"
            value={`${path.counts.ontologyDecisionCount}/${path.counts.ontologyGapRequestCount}`}
          />
          <PostureItem
            label="Local terms"
            value={String(path.counts.projectLocalTermCount)}
          />
          <PostureItem
            label="Open ontology"
            value={String(path.counts.unresolvedOntologyGapCount)}
          />
          <PostureItem
            label="Open candidate"
            value={String(path.counts.unresolvedCandidateGapCount)}
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Available" value={path.available ? "yes" : "no"} />
          <Meta label="Target section" value={path.targetSection} />
          <Meta label="Evidence" value={joined(path.evidenceRefs)} />
          <Meta label="Blockers" value={joined(path.blockers)} />
          {stateItems.map(([label, value]) => (
            <Meta key={label} label={label} value={value} />
          ))}
        </div>
        {primaryHref ? (
          <a className={styles.ackButton} href={primaryHref}>
            Open target section
          </a>
        ) : null}
      </div>
      {path.available && path.checkpoints.length > 0 ? (
        <div className={styles.guidedRail}>
          {path.checkpoints.map((checkpoint, index) => {
            const href = checkpoint.targetSection
              ? `#${checkpoint.targetSection}`
              : undefined;
            const content = (
              <>
                <span className={styles.navLabel}>
                  {index + 1}. {checkpoint.label}
                </span>
                <span className={styles.navHint}>
                  {checkpoint.count === null
                    ? "Evidence pending"
                    : `${checkpoint.count} tracked item${
                        checkpoint.count === 1 ? "" : "s"
                      }`}
                </span>
                <span className={styles.guidedStageMeta}>
                  {checkpoint.status.replace(/_/g, " ")}
                  {checkpoint.evidenceRefs.length > 0
                    ? ` · refs ${checkpoint.evidenceRefs.length}`
                    : ""}
                </span>
              </>
            );
            return href ? (
              <a key={checkpoint.id} className={styles.guidedStage} href={href}>
                {content}
              </a>
            ) : (
              <div key={checkpoint.id} className={styles.guidedStage}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <Status
          label="Repair path unavailable"
          detail="Repair session and repair review artifacts are not published for this workspace yet."
        />
      )}
      {path.blockers.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Repair path blockers</span>
            <span className={styles.sectionCount}>{path.blockers.length}</span>
          </div>
          <div className={styles.tagList}>
            {path.blockers.map((blocker) => (
              <Pill key={blocker} value={blocker} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GuidedApprovalPathSection({
  path,
}: {
  path: IdeaToSpecWorkspace["guidedApprovalPath"];
}) {
  const primaryHref = path.targetSection ? `#${path.targetSection}` : null;
  const stateItems = [
    ["Readiness", path.state.approvalReadinessStatus],
    ["Intent", path.state.approvalIntentStatus],
    ["Execution", path.state.approvalExecutionStatus],
    ["Decision", path.state.candidateApprovalState],
    ["Promotion", path.state.promotionExecutionStatus],
    ["Review", path.state.reviewState],
  ] as const;
  return (
    <section id="idea-to-spec-guided-approval-path" className={styles.reviewSection}>
      <SectionHeader
        title="Guided approval path"
        count={path.available ? path.checkpoints.length : 0}
      />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Approval and promotion route</span>
          <Pill value={path.stage.replace(/_/g, " ")} />
        </div>
        <h3 className={styles.title} data-testid="guided-approval-next-action">
          {path.nextAction}
        </h3>
        <div className={styles.postureStrip}>
          <PostureItem
            label="Promotion paths"
            value={String(path.counts.promotionPathCount)}
          />
          <PostureItem
            label="Blockers"
            value={String(path.blockers.length)}
          />
          <PostureItem
            label="Approved paths"
            value={String(path.counts.approvedPathCount)}
          />
          <PostureItem
            label="Commit paths"
            value={String(path.counts.promotionCommitPathCount)}
          />
          <PostureItem
            label="Promotion ops"
            value={String(path.counts.promotionOperationCount)}
          />
          <PostureItem
            label="Read model"
            value={path.state.readModelPublished ? "published" : "pending"}
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Status" value={path.status.replace(/_/g, " ")} />
          <Meta label="Available" value={path.available ? "yes" : "no"} />
          <Meta label="Target section" value={path.targetSection} />
          <Meta
            label="Promotion request"
            value={path.state.promotionRequestOk ? "ready" : "pending"}
          />
          <Meta label="Evidence" value={joined(path.evidenceRefs)} />
          <Meta label="Blockers" value={joined(path.blockers)} />
          {stateItems.map(([label, value]) => (
            <Meta key={label} label={label} value={value} />
          ))}
        </div>
        {primaryHref ? (
          <a className={styles.ackButton} href={primaryHref}>
            Open target section
          </a>
        ) : null}
      </div>
      {path.available && path.checkpoints.length > 0 ? (
        <div className={styles.guidedRail}>
          {path.checkpoints.map((checkpoint, index) => {
            const href = checkpoint.targetSection
              ? `#${checkpoint.targetSection}`
              : undefined;
            const content = (
              <>
                <span className={styles.navLabel}>
                  {index + 1}. {checkpoint.label}
                </span>
                <span className={styles.navHint}>
                  {checkpoint.detail ?? "Evidence pending"}
                </span>
                <span className={styles.guidedStageMeta}>
                  {checkpoint.status.replace(/_/g, " ")}
                  {checkpoint.evidenceRefs.length > 0
                    ? ` · refs ${checkpoint.evidenceRefs.length}`
                    : ""}
                </span>
              </>
            );
            return href ? (
              <a key={checkpoint.id} className={styles.guidedStage} href={href}>
                {content}
              </a>
            ) : (
              <div key={checkpoint.id} className={styles.guidedStage}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <Status
          label="Approval path unavailable"
          detail="Approval readiness and promotion artifacts are not published for this workspace yet."
        />
      )}
      {path.blockers.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Approval path blockers</span>
            <span className={styles.sectionCount}>{path.blockers.length}</span>
          </div>
          <div className={styles.tagList}>
            {path.blockers.map((blocker) => (
              <Pill key={blocker} value={blocker} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CandidateOverviewSection({
  overview,
}: {
  overview: IdeaToSpecCandidateOverview;
}) {
  const topology = buildCandidateWorkflowTopology(overview);
  const relationEntries = topology.relationEntries.slice(0, 6);
  const primaryItems = [
    ...overview.eventStorming.commands
      .slice(0, 2)
      .map((item) => ({ collection: "command", item })),
    ...overview.eventStorming.domainEvents
      .slice(0, 2)
      .map((item) => ({ collection: "domain-event", item })),
  ];
  return (
    <section id="idea-to-spec-candidate-overview" className={styles.reviewSection}>
      <SectionHeader
        title="Candidate overview"
        count={
          overview.eventStorming.commandCount +
          overview.eventStorming.domainEventCount +
          overview.summary.nodeCount
        }
      />
      {!overview.available ? (
        <Status
          label="Candidate overview unavailable"
          detail="Run `make candidate-overview` in SpecGraph to publish the narrative candidate summary."
        />
      ) : null}
      <div className={styles.postureStrip}>
        <PostureItem label="Source" value={compact(overview.summary.graphSource, "missing")} />
        <PostureItem label="Nodes" value={String(overview.summary.nodeCount)} />
        <PostureItem label="Workflow edges" value={String(overview.summary.workflowEdgeCount)} />
        <PostureItem label="Blockers" value={String(overview.summary.remainingBlockerCount)} />
        <PostureItem label="Candidate approval" value={boolText(overview.summary.readyForCandidateApproval)} />
        <PostureItem label="Maturity" value={compact(overview.ideaMaturity.lifecycleState, overview.ideaMaturity.status)} />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {compact(
              overview.candidate.displayName,
              overview.summary.displayName ?? overview.summary.candidateId,
            )}
          </span>
          <Pill value={compact(overview.readiness.reviewState, "overview")} />
        </div>
        <h3 className={styles.title}>
          {compact(overview.narrative.productIntent, "Candidate narrative is not available.")}
        </h3>
        <div className={styles.metaGrid}>
          <Meta label="Scope" value={overview.narrative.understoodScope} />
          <Meta label="Readiness" value={overview.narrative.readiness} />
          <Meta
            label="Next action"
            value={compact(overview.nextAction.label, overview.narrative.nextAction)}
          />
          <Meta label="Evidence" value={joined(overview.nextAction.evidenceRefs)} />
          <Meta label="Route" value={overview.candidate.workspaceRoute} />
          <Meta label="Lane" value={overview.candidate.workflowLane} />
          <Meta
            label="Project-local ontology"
            value={compact(
              overview.projectLocalOntology.status,
              overview.summary.projectLocalOntologyReviewStatus,
            )}
          />
          <Meta
            label="Ontology decisions"
            value={`${overview.projectLocalOntology.acceptedDecisionCount} accepted / ${overview.projectLocalOntology.blockingDecisionCount} blocking`}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Event-storming frame</span>
          <Pill value={`${overview.eventStorming.commandCount} commands`} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Actors" value={String(overview.eventStorming.actorCount)} />
          <Meta label="Commands" value={String(overview.eventStorming.commandCount)} />
          <Meta label="Domain events" value={String(overview.eventStorming.domainEventCount)} />
          <Meta label="Policies" value={String(overview.eventStorming.policyCount)} />
          <Meta label="Constraints" value={String(overview.eventStorming.constraintCount)} />
          <Meta label="Candidate nodes" value={String(overview.candidateNodes.nodes.length)} />
        </div>
        {primaryItems.map(({ collection, item }) => (
          <div
            key={`overview:${collection}:${item.kind}:${item.id}`}
            className={styles.subRow}
          >
            <span>{compact(item.label, item.id)}</span>
            <Pill value={compact(item.kind, "item")} />
            <span className={styles.statusDetail}>{compact(item.detail, item.id)}</span>
          </div>
        ))}
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Workflow topology</span>
          <Pill value={`${overview.topology.workflowEdgeCount} workflow edges`} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="All edges" value={String(overview.topology.edgeCount)} />
          {relationEntries.map(([relation, count]) => (
            <Meta key={relation} label={relation.replace(/_/g, " ")} value={String(count)} />
          ))}
        </div>
        <CandidateWorkflowTopologyMap topology={topology} />
      </div>
    </section>
  );
}

function CandidateWorkflowTopologyMap({
  topology,
}: {
  topology: CandidateWorkflowTopologyView;
}) {
  const visibleEdges = topology.edges.slice(0, 8);
  const totalWorkflowEdges = Math.max(topology.workflowEdgeCount, topology.edges.length);
  const hiddenWorkflowEdgeCount = Math.max(
    0,
    totalWorkflowEdges - visibleEdges.length,
  );
  const additionalSampledEdgeCount = Math.max(
    0,
    topology.edges.length - visibleEdges.length,
  );
  const hasSampledNodes = topology.columns.some(
    (column) => column.totalCount > column.nodes.length,
  );
  return (
    <div className={styles.topologySurface}>
      <div className={styles.topologyLegend} aria-label="Workflow topology relation legend">
        {topology.relationEntries.slice(0, 8).map(([relation, count]) => (
          <span key={`legend:${relation}`} className={styles.topologyLegendItem}>
            {relation.replace(/_/g, " ")} · {count}
          </span>
        ))}
        <span className={styles.topologyLegendItem}>review-only topology</span>
      </div>
      <div className={styles.topologyMap} aria-label="Workflow topology map">
        {topology.columns.map((column) => (
          <div key={column.id} className={styles.topologyColumn}>
            <div className={styles.topologyColumnHeader}>
              <span>{column.label}</span>
              <span>{column.totalCount}</span>
            </div>
            <div className={styles.topologyNodeList}>
              {column.nodes.slice(0, 5).map((node) => (
                <div key={`${column.id}:${node.id}`} className={styles.topologyNode}>
                  <span className={styles.topologyNodeLabel}>
                    {compact(node.label, node.id)}
                  </span>
                  <span className={styles.topologyNodeMeta}>
                    {compact(node.kind, node.id)}
                  </span>
                </div>
              ))}
              {column.totalCount > column.nodes.slice(0, 5).length ? (
                <div className={styles.topologyMore}>
                  +{column.totalCount - column.nodes.slice(0, 5).length} more
                </div>
              ) : null}
              {column.nodes.length === 0 ? (
                <div className={styles.topologyEmpty}>No published items</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {visibleEdges.length > 0 ? (
        <div className={styles.topologyEdgeList} aria-label="Workflow topology edges">
          {visibleEdges.map((edge) => (
            <div
              key={`workflow-topology-edge:${edge.id}`}
              className={styles.topologyEdge}
            >
              <span className={styles.topologyEndpoint}>
                {compact(edge.fromNode?.label, edge.from)}
              </span>
              <span className={styles.topologyRelation}>
                {edge.relationLabel}
              </span>
              <span className={styles.topologyEndpoint}>
                {compact(edge.toNode?.label, edge.to)}
              </span>
            </div>
          ))}
          {hiddenWorkflowEdgeCount > 0 ? (
            <div className={styles.topologyMore}>
              +{hiddenWorkflowEdgeCount} more workflow edges
              {additionalSampledEdgeCount > 0
                ? ` · ${additionalSampledEdgeCount} additional sampled rows`
                : ""}
            </div>
          ) : null}
        </div>
      ) : (
        <Status
          label="No workflow topology edges"
          detail="Candidate overview did not publish workflow topology edges for this lifecycle stage."
        />
      )}
      {topology.unresolvedEdges.length > 0 ? (
        <div className={styles.topologyWarning}>
          <span className={styles.metaLabel}>
            {hasSampledNodes
              ? "Topology refs outside displayed sample"
              : "Unresolved topology refs"}
          </span>
          {topology.unresolvedEdges.slice(0, 3).map((edge) => (
            <span key={`unresolved:${edge.id}`} className={styles.metaValue}>
              {edge.id}: {joined(edge.unresolvedRefs)}
            </span>
          ))}
          {hasSampledNodes ? (
            <span className={styles.metaValue}>
              Some endpoints may be valid source items hidden by the workspace API
              sample limit.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceSection({
  workspace,
}: {
  workspace: IdeaToSpecWorkspace["workspace"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Active workspace" count={workspace.available ? 1 : 0} />
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={workspace.displayName ?? workspace.id} />
          <Meta label="Route" value={workspace.publicRoute} />
          <Meta label="Lane" value={workspace.workflowLane} />
          <Meta label="Role" value={workspace.targetRepositoryRole} />
          <Meta label="Source" value={workspace.sourceMode} />
          <Meta label="Ready" value={boolText(workspace.ready)} />
        </div>
      </div>
    </section>
  );
}

function FrameSection({
  project,
  domains,
  contexts,
}: {
  project: string | null;
  domains: readonly string[];
  contexts: readonly string[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Active frame" count={domains.length + contexts.length} />
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          <Meta label="Project" value={project} />
          <Meta label="Domains" value={joined(domains)} />
          <Meta label="Contexts" value={joined(contexts)} />
        </div>
      </div>
    </section>
  );
}

function ArtifactSection({
  artifacts,
}: {
  artifacts: IdeaToSpecWorkspace["artifacts"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Source artifacts" count={Object.keys(artifacts).length} />
      {Object.entries(artifacts).map(([name, artifact]) => (
        <div key={name} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{name.replace(/_/g, " ")}</span>
            <Pill value={artifact.available ? "available" : compact(artifact.reason, "missing")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Path" value={artifact.path} />
            <Meta label="Status" value={artifact.status} />
            <Meta label="Proposal" value={artifact.proposalId} />
            <Meta label="Kind" value={artifact.artifactKind} />
          </div>
        </div>
      ))}
    </section>
  );
}

function IntakeSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const summary = state.data.intake.summary;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Event-storming intake" count={summary.domainEventCount} />
      <div className={styles.postureStrip}>
        <PostureItem label="Actors" value={String(summary.actorCount)} />
        <PostureItem label="Events" value={String(summary.domainEventCount)} />
        <PostureItem label="Commands" value={String(summary.commandCount)} />
        <PostureItem label="Policies" value={String(summary.policyCount)} />
        <PostureItem label="Constraints" value={String(summary.constraintCount)} />
        <PostureItem
          label="Vocabulary"
          value={String(summary.vocabularyQuestionCount)}
        />
      </div>
    </section>
  );
}

function IntakeClarificationSection({
  state,
  answers,
  continuationExecutionRequests,
  workspaceId,
  workspaceInitialized,
  onWorkspaceRefreshRequest,
  readOnly,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
  answers: ReturnType<typeof useIdeaToSpecIntakeClarificationAnswers>;
  continuationExecutionRequests: ReturnType<
    typeof useRealIdeaAnswerContinuationExecutionRequests
  >;
  workspaceId: string | null;
  workspaceInitialized: boolean;
  onWorkspaceRefreshRequest?: () => void;
  readOnly: boolean;
}) {
  const lane = state.data.intakeClarification;
  const draftCount = answers.state.kind === "ok" ? answers.state.data.summary.answerCount : 0;
  const acceptedAnswerCount =
    answers.state.kind === "ok" ? answers.state.data.summary.acceptedAnswerCount : 0;
  const blockingRequestCount = lane.clarificationRequests.blockingRequestCount;
  const answerTargetsByRequestId = useMemo(
    () =>
      new Map(
        lane.answerAuthoring.template.targets.map((target) => [
          target.requestId,
          target,
        ]),
      ),
    [lane.answerAuthoring.template.targets],
  );
  const activeContinuationRequest = continuationExecutionRequests.activeRequest;
  const laneSourceRefs = lane.sourceRefs ?? [];
  const intakeExecutionRef =
    laneSourceRefs.find((ref) =>
      ref.endsWith("platform_real_idea_entry_intake_execution_report.json"),
    ) ?? "runs/platform_real_idea_entry_intake_execution_report.json";
  const answerTemplateRef =
    laneSourceRefs.find((ref) =>
      ref.endsWith("real_idea_smoke/real_idea_answer_template.json"),
    ) ?? "runs/real_idea_smoke/real_idea_answer_template.json";
  const continuationRequestReady =
    !readOnly &&
    workspaceInitialized &&
    lane.available &&
    lane.answerAuthoring.template.available &&
    blockingRequestCount > 0 &&
    acceptedAnswerCount >= blockingRequestCount &&
    !lane.answerContinuation.available &&
    !continuationExecutionRequests.pending &&
    activeContinuationRequest === null;
  const requestAnswerContinuationExecution = () => {
    void continuationExecutionRequests
      .requestExecution({
        workspaceId,
        answerStateRef:
          "specspace-state://idea_to_spec_intake_clarification_answers.json",
        answerTemplateRef,
        intakeExecutionRef,
        workspaceInitializationRef:
          "runs/platform_product_workspace_initialization_execution_report.json",
        operatorRef: "operator://specspace-local",
      })
      .then((saved) => {
        if (saved) onWorkspaceRefreshRequest?.();
      });
  };
  return (
    <section id="idea-to-spec-intake-clarification" className={styles.reviewSection}>
      <SectionHeader
        title="Intake clarification"
        count={lane.clarificationRequests.requestCount + draftCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Requests"
          value={String(lane.clarificationRequests.requestCount)}
        />
        <PostureItem
          label="Blocking"
          value={String(lane.clarificationRequests.blockingRequestCount)}
        />
        <PostureItem
          label="Saved"
          value={String(draftCount)}
        />
        <PostureItem
          label="Validated"
          value={String(lane.clarificationAnswers.acceptedAnswerCount)}
        />
        <PostureItem
          label="Targets"
          value={String(
            lane.answerAuthoring.template.targetCount ||
              lane.rerunInput.acceptedTargetCount,
          )}
        />
        <PostureItem
          label="Session"
          value={lane.clarifiedSession.available ? "clarified" : "pending"}
        />
      </div>
      {!lane.available ? (
        <Status
          label="No intake clarification loop"
          detail="SpecGraph has not published idea_intake_clarification_requests.json for this workspace."
        />
      ) : null}
      <ClarificationContinuationGuide
        lane={lane}
        answers={answers}
        continuationExecutionRequests={continuationExecutionRequests}
        realIdeaIntake={state.data.realIdeaIntake}
        canRequestExecution={continuationRequestReady}
        workspaceId={workspaceId}
        onRequestExecution={requestAnswerContinuationExecution}
      />
      <IntakeAnswerAuthoringStatus authoring={lane.answerAuthoring} />
      <IntakeAnswerContinuationStatus
        continuation={lane.answerContinuation}
        executionRequests={continuationExecutionRequests}
        canRequestExecution={continuationRequestReady}
        workspaceId={workspaceId}
        onRequestExecution={requestAnswerContinuationExecution}
        showRequestAction={false}
      />
      <IntakeClarificationAnswerStatus state={answers.state} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecGraph intake rerun</span>
          <Pill value={compact(lane.rerunReport.readiness.reviewState, "not ready")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Answers artifact" value={compact(lane.clarificationAnswers.readiness.reviewState, "missing")} />
          <Meta label="Rerun input" value={compact(lane.rerunInput.readiness.reviewState, "missing")} />
          <Meta label="Clarified source" value={lane.clarifiedSource.available ? "available" : "missing"} />
          <Meta
            label="Exec authority"
            value={boolText(lane.actionBoundary.mayExecuteSpecgraph)}
          />
        </div>
        <pre className={styles.codeBlock}>make real-idea-intake-clarification-rerun</pre>
      </div>
      {lane.clarificationRequests.requests.map((request) => (
        <IntakeClarificationRequestRow
          key={request.id}
          request={request}
          answerTarget={answerTargetsByRequestId.get(request.id)}
          draft={answers.answersByRequestId.get(request.id)}
          publishedAnswer={lane.clarificationAnswers.answers.find(
            (answer) => answer.requestId === request.id,
          )}
          pending={answers.pendingRequestId === request.id}
          saveError={
            answers.saveError?.requestId === request.id ? answers.saveError : null
          }
          onSave={(input) =>
            answers.saveAnswer({
              ...input,
              workspaceId,
              operatorRef: "operator://specspace-local",
            })
          }
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}

function ClarificationContinuationGuide({
  lane,
  answers,
  continuationExecutionRequests,
  realIdeaIntake,
  canRequestExecution,
  workspaceId,
  onRequestExecution,
}: {
  lane: IdeaToSpecWorkspace["intakeClarification"];
  answers: ReturnType<typeof useIdeaToSpecIntakeClarificationAnswers>;
  continuationExecutionRequests: ReturnType<
    typeof useRealIdeaAnswerContinuationExecutionRequests
  >;
  realIdeaIntake: IdeaToSpecWorkspace["realIdeaIntake"];
  canRequestExecution: boolean;
  workspaceId: string | null;
  onRequestExecution: () => void;
}) {
  const savedAnswerCount =
    answers.state.kind === "ok" ? answers.state.data.summary.answerCount : 0;
  const acceptedAnswerCount =
    answers.state.kind === "ok" ? answers.state.data.summary.acceptedAnswerCount : 0;
  const blockingRequestCount = lane.clarificationRequests.blockingRequestCount;
  const allBlockingAnswersAccepted =
    blockingRequestCount > 0 && acceptedAnswerCount >= blockingRequestCount;
  const activeRequest = continuationExecutionRequests.activeRequest;
  const candidateReady =
    realIdeaIntake.status === "active_candidate_ready" &&
    Boolean(realIdeaIntake.activeCandidateRef);
  const stage = candidateReady
    ? {
        status: "candidate_ready",
        label: "Candidate ready",
        nextAction: "Continue with repair, ontology review, and promotion readiness.",
      }
    : lane.answerContinuation.ready
      ? {
          status: "continuation_ready",
          label: "Continuation complete",
          nextAction: "Review the generated active candidate and downstream repair stage.",
        }
      : lane.answerContinuation.available
        ? {
            status: "continuation_needs_review",
            label: "Continuation needs review",
            nextAction:
              "Review the answer continuation import preview and report findings before editing answers.",
          }
      : activeRequest
        ? {
            status: "execution_requested",
            label: "Waiting for Platform",
            nextAction:
              "Run the requested Platform continuation execution and publish its report.",
          }
        : canRequestExecution
          ? {
              status: "request_continuation",
              label: "Ready to continue",
              nextAction: "Request controlled Platform answer continuation execution.",
            }
          : lane.clarificationRequests.requestCount > 0
            ? {
                status: "answer_questions",
                label: "Answer questions",
                nextAction:
                  allBlockingAnswersAccepted
                    ? "Review workspace, template, or request prerequisites before requesting continuation."
                    : acceptedAnswerCount > 0
                    ? "Complete required answers before requesting continuation."
                    : "Answer the clarification questions in this section.",
              }
            : {
                status: "clarification_missing",
                label: "No clarification requests",
                nextAction: "Wait for SpecGraph to publish clarification requests.",
              };
  const requestState =
    continuationExecutionRequests.state.kind === "ok"
      ? continuationExecutionRequests.state.data.summary.status
      : continuationExecutionRequests.state.kind;

  return (
    <div className={styles.row} data-testid="guided-clarification-continuation">
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Guided clarification path</span>
        <Pill value={stage.status} />
      </div>
      <p className={styles.statusDetail}>
        {stage.label}: {stage.nextAction}
      </p>
      <div className={styles.postureStrip}>
        <PostureItem
          label="Questions"
          value={String(lane.clarificationRequests.requestCount)}
        />
        <PostureItem label="Blocking" value={String(blockingRequestCount)} />
        <PostureItem label="Saved" value={String(savedAnswerCount)} />
        <PostureItem label="Validated" value={String(acceptedAnswerCount)} />
        <PostureItem
          label="Request"
          value={activeRequest ? activeRequest.status : requestState}
        />
        <PostureItem
          label="Continuation"
          value={lane.answerContinuation.ready ? "ready" : "pending"}
        />
        <PostureItem label="Candidate" value={candidateReady ? "ready" : "pending"} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Workspace" value={workspaceId} />
        <Meta
          label="Template"
          value={lane.answerAuthoring.template.available ? "available" : "missing"}
        />
        <Meta
          label="Import preview"
          value={lane.answerContinuation.importPreview.readiness.reviewState}
        />
        <Meta
          label="Continuation report"
          value={lane.answerContinuation.continuationReport.readiness.reviewState}
        />
        <Meta label="Active candidate" value={realIdeaIntake.activeCandidateRef} />
      </div>
      {canRequestExecution ? (
        <button
          data-testid="guided-clarification-continuation-request"
          className={styles.ackButton}
          type="button"
          disabled={continuationExecutionRequests.pending}
          onClick={onRequestExecution}
        >
          {continuationExecutionRequests.pending
            ? "Requesting continuation"
            : "Request continuation"}
        </button>
      ) : null}
      {activeRequest ? (
        <p
          className={styles.statusDetail}
          data-testid="guided-clarification-continuation-request-status"
        >
          Requested execution · {activeRequest.requestId} · answers{" "}
          {activeRequest.answerStateRef}
        </p>
      ) : null}
      {continuationExecutionRequests.saveError ? (
        <p className={styles.statusDetail}>
          Continuation request failed ·{" "}
          {realIdeaAnswerContinuationExecutionRequestErrorText(
            continuationExecutionRequests.saveError,
          )}
        </p>
      ) : null}
    </div>
  );
}

function IntakeAnswerAuthoringStatus({
  authoring,
}: {
  authoring: IdeaToSpecWorkspace["intakeClarification"]["answerAuthoring"];
}) {
  if (!authoring.available) {
    return (
      <Status
        label="Answer template missing"
        detail="Run `make real-idea-smoke-answer-template` in SpecGraph to publish typed answer targets."
      />
    );
  }
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Real idea answer authoring</span>
        <Pill value={authoring.validation.status} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Template" value={authoring.template.available ? "available" : "missing"} />
        <Meta label="Template status" value={authoring.template.readiness.reviewState} />
        <Meta label="Stage" value={authoring.template.stage} />
        <Meta label="Targets" value={String(authoring.template.targetCount)} />
        <Meta label="Saved answer set" value={String(authoring.answerSet.answerCount)} />
        <Meta label="Validation ready" value={boolText(authoring.validation.ready)} />
        <Meta label="Findings" value={String(authoring.validation.findingCount)} />
      </div>
      {authoring.recommendedActions.map((action) => (
        <p key={action.id} className={styles.statusDetail}>
          {action.label}: {action.nextAction}
        </p>
      ))}
      <IntakeAnswerFindingDiagnostics findings={authoring.report.findings} />
    </div>
  );
}

function IntakeAnswerContinuationStatus({
  continuation,
  executionRequests,
  canRequestExecution,
  workspaceId,
  onRequestExecution,
  showRequestAction = true,
}: {
  continuation: IdeaToSpecWorkspace["intakeClarification"]["answerContinuation"];
  executionRequests: ReturnType<typeof useRealIdeaAnswerContinuationExecutionRequests>;
  canRequestExecution: boolean;
  workspaceId: string | null;
  onRequestExecution: () => void;
  showRequestAction?: boolean;
}) {
  const activeRequest = executionRequests.activeRequest;
  if (!continuation.available) {
    return (
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Answer continuation pending</span>
          <Pill
            value={
              executionRequests.pending
                ? "requesting"
                : activeRequest
                ? "execution requested"
                : canRequestExecution
                  ? "ready to request"
                  : "not ready"
            }
          />
        </div>
        <p className={styles.statusDetail}>
          Request controlled Platform answer continuation execution. SpecSpace
          stores a request intent only; a backend/Platform worker performs the
          allowlisted execution.
        </p>
        <div className={styles.metaGrid}>
          <Meta label="Workspace" value={workspaceId} />
          <Meta
            label="Request state"
            value={
              executionRequests.state.kind === "ok"
                ? executionRequests.state.data.summary.status
                : executionRequests.state.kind
            }
          />
          <Meta
            label="Active requests"
            value={
              executionRequests.state.kind === "ok"
                ? String(executionRequests.state.data.summary.activeRequestedCount)
                : "unknown"
            }
          />
        </div>
        {showRequestAction ? (
          <button
            data-testid="real-idea-answer-continuation-execution-request"
            className={styles.ackButton}
            type="button"
            disabled={!canRequestExecution}
            onClick={onRequestExecution}
          >
            {executionRequests.pending
              ? "Requesting answer continuation"
              : activeRequest
                ? "Answer continuation requested"
                : "Request answer continuation"}
          </button>
        ) : null}
        {showRequestAction && activeRequest ? (
          <p
            className={styles.statusDetail}
            data-testid="real-idea-answer-continuation-execution-request-status"
          >
            Requested execution · {activeRequest.requestId} · answers{" "}
            {activeRequest.answerStateRef}
          </p>
        ) : null}
        {executionRequests.saveError ? (
          <p className={styles.statusDetail}>
            Execution request failed ·{" "}
            {realIdeaAnswerContinuationExecutionRequestErrorText(
              executionRequests.saveError,
            )}
          </p>
        ) : null}
        <pre
          className={styles.codeBlock}
          data-testid="real-idea-answer-continuation-handoff-command"
        >
          scripts/platform.py product-real-idea-continuation execute-requested{"\n"}
          {"  --specgraph-dir <specgraph-repository> \\\n"}
          {"  --execution-request <SpecSpace state dir>/real_idea_answer_continuation_execution_requests.json"}
        </pre>
      </div>
    );
  }
  const outputEntries = Object.entries(continuation.continuationReport.outputs)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .slice(0, 4);
  const sourceRefs = sourceArtifactRefs(continuation.importPreview.sourceArtifacts);
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Real idea answer continuation</span>
        <Pill
          value={compact(
            continuation.continuationReport.readiness.reviewState ||
              continuation.importPreview.readiness.reviewState,
            "not ready",
          )}
        />
      </div>
      <div className={styles.metaGrid}>
        <Meta
          label="Import preview"
          value={continuation.importPreview.available ? "available" : "missing"}
        />
        <Meta
          label="Preview ready"
          value={boolText(continuation.importPreview.readiness.ready)}
        />
        <Meta
          label="Continuation"
          value={continuation.continuationReport.available ? "available" : "missing"}
        />
        <Meta label="Ready" value={boolText(continuation.ready)} />
        <Meta
          label="Accepted answers"
          value={
            continuation.importPreview.acceptedAnswerCount === null
              ? "unknown"
              : String(continuation.importPreview.acceptedAnswerCount)
          }
        />
        <Meta
          label="Exec authority"
          value={boolText(continuation.actionBoundary.mayExecuteSpecgraph)}
        />
        <Meta label="Source refs" value={joined(sourceRefs)} />
      </div>
      {continuation.recommendedActions.map((action) => (
        <div key={action.id} className={styles.subRow}>
          <span>{action.label}</span>
          <span className={styles.statusDetail}>{action.nextAction}</span>
          {action.commandHint ? (
            <pre className={styles.codeBlock}>{action.commandHint}</pre>
          ) : null}
        </div>
      ))}
      {outputEntries.length ? (
        <div className={styles.metaGrid}>
          {outputEntries.map(([key, value]) => (
            <Meta key={key} label={compact(key, "Output")} value={String(value)} />
          ))}
        </div>
      ) : null}
      {[
        ...continuation.importPreview.findings,
        ...continuation.continuationReport.findings,
      ].length ? (
        <IntakeAnswerFindingDiagnostics
          findings={[
            ...continuation.importPreview.findings,
            ...continuation.continuationReport.findings,
          ]}
        />
      ) : null}
    </div>
  );
}

function IntakeAnswerFindingDiagnostics({
  findings,
}: {
  findings: readonly IdeaToSpecFinding[];
}) {
  if (!findings.length) return null;
  return (
    <div className={styles.subList}>
      {findings.slice(0, 5).map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.subRow}>
          <span>
            {finding.severity}: {finding.findingId}
          </span>
          <span className={styles.statusDetail}>{finding.message}</span>
          {finding.targetRef ? (
            <span className={styles.statusDetail}>Target: {finding.targetRef}</span>
          ) : null}
          {finding.sourceRef ? (
            <span className={styles.statusDetail}>Source: {finding.sourceRef}</span>
          ) : null}
          {finding.nextAction ? (
            <span className={styles.statusDetail}>Next action: {finding.nextAction}</span>
          ) : null}
        </div>
      ))}
      {findings.length > 5 ? (
        <p className={styles.statusDetail}>
          {findings.length - 5} additional answer finding(s) hidden.
        </p>
      ) : null}
    </div>
  );
}

function IntakeClarificationAnswerStatus({
  state,
}: {
  state: UseIdeaToSpecIntakeClarificationAnswersState;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Intake answers loading"
        detail="Reading SpecSpace-owned intake clarification answer state."
      />
    );
  }
  if (state.kind === "ok") {
    return (
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecSpace intake answers</span>
          <Pill value={state.data.summary.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Answers" value={String(state.data.summary.answerCount)} />
          <Meta label="Accepted" value={String(state.data.summary.acceptedAnswerCount)} />
          <Meta label="State owner" value={state.data.stateOwner} />
          <Meta
            label="SpecGraph authority"
            value={boolText(state.data.authorityBoundary.specgraphArtifactAuthority)}
          />
          <Meta
            label="Apply authority"
            value={boolText(state.data.consumerBoundary.mayApplyAnswers)}
          />
        </div>
      </div>
    );
  }
  return (
    <Status
      label="Intake answers unavailable"
      detail={intakeClarificationAnswerStateDetail(state)}
    />
  );
}

function IntakeClarificationRequestRow({
  request,
  answerTarget,
  draft,
  publishedAnswer,
  pending,
  saveError,
  onSave,
  readOnly,
}: {
  request: IdeaToSpecClarificationRequest;
  answerTarget: IdeaToSpecRealIdeaAnswerTarget | undefined;
  draft: IdeaToSpecIntakeClarificationAnswer | undefined;
  publishedAnswer: IdeaToSpecIntakeAnswer | undefined;
  pending: boolean;
  saveError: IdeaToSpecIntakeClarificationAnswerSaveError | null;
  onSave: (input: {
    requestId: string;
    answerKind: string;
    value: Record<string, unknown>;
  }) => void;
  readOnly: boolean;
}) {
  const availableActions =
    answerTarget?.acceptedActions.length
      ? answerTarget.acceptedActions
      : request.suggestedActions;
  const defaultAction = availableActions[0] ?? "answer_question";
  const [selectedAction, setSelectedAction] = useState(
    () => draft?.answerKind ?? defaultAction,
  );
  const [answerText, setAnswerText] = useState(
    () => intakeAnswerText(draft, publishedAnswer) ?? "",
  );
  useEffect(() => {
    setSelectedAction(draft?.answerKind ?? defaultAction);
    setAnswerText(intakeAnswerText(draft, publishedAnswer) ?? "");
  }, [defaultAction, draft, publishedAnswer]);
  const requiredFields = answerTarget
    ? intakeClarificationRequiredFields(answerTarget, selectedAction)
    : [];
  const value = answerTarget
    ? intakeClarificationValueForTemplate(answerTarget, selectedAction, answerText)
    : intakeClarificationValueForRequest(request, selectedAction, answerText);
  const canSave =
    selectedAction.length > 0 &&
    intakeClarificationTemplateValueIsComplete(requiredFields, value) &&
    !readOnly &&
    !pending;
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{request.id}</span>
        <Pill value={request.status} />
      </div>
      <h3 className={styles.title}>{compact(request.question, request.kind)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Severity" value={request.severity} />
        <Meta label="Template target" value={answerTarget?.targetType} />
        <Meta label="Target" value={request.targetRef} />
        <Meta label="Target artifact" value={request.targetArtifact} />
        <Meta label="Actions" value={joined(availableActions)} />
        <Meta label="Required fields" value={joined(requiredFields)} />
      </div>
      <form
        className={styles.draftForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave({
            requestId: request.id,
            answerKind: selectedAction,
            value,
          });
        }}
      >
        <div className={styles.draftControls}>
          <select
            className={styles.draftSelect}
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.currentTarget.value)}
            aria-label="Intake clarification answer kind"
            disabled={readOnly}
          >
            {(availableActions.length ? availableActions : [defaultAction]).map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            data-testid={`intake-clarification-answer-save-${request.id}`}
            className={styles.ackButton}
            type="submit"
            disabled={!canSave}
          >
            {pending ? "Saving" : draft ? "Update answer" : "Save answer"}
          </button>
        </div>
        <textarea
          data-testid={`intake-clarification-answer-${request.id}`}
          className={styles.draftTextarea}
          value={answerText}
          onChange={(event) => setAnswerText(event.currentTarget.value)}
          placeholder={intakeClarificationPlaceholder(request)}
          rows={3}
          aria-label="Intake clarification answer"
          readOnly={readOnly}
        />
        {answerTarget ? (
          <span className={styles.statusDetail}>
            Template-backed answer · {answerTarget.suggestedAnswerShape ?? "typed value"} · emits {Object.keys(value).join(", ") || "value"}
          </span>
        ) : null}
        {draft ? (
          <span
            className={styles.statusDetail}
            data-testid={`intake-clarification-answer-saved-${request.id}`}
          >
            Answer saved · {draft.answerKind.replace(/_/g, " ")} · {draft.updatedAt}
          </span>
        ) : publishedAnswer ? (
          <span className={styles.statusDetail}>
            Published answer · {publishedAnswer.answerKind.replace(/_/g, " ")} · {publishedAnswer.status}
          </span>
        ) : null}
        {saveError ? (
          <span className={styles.statusDetail}>
            Answer save failed · {intakeClarificationAnswerSaveErrorText(saveError)}
          </span>
        ) : null}
      </form>
    </div>
  );
}

function OntologySeedSection({
  seed,
}: {
  seed: IdeaToSpecWorkspace["ontologySeed"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Ontology-bound seed"
        count={seed.summary.ontologyGapCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(seed.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(seed.readiness.reviewState)}
        />
        <PostureItem
          label="Bindings"
          value={String(seed.summary.ontologyBindingCount)}
        />
        <PostureItem label="Gaps" value={String(seed.summary.ontologyGapCount)} />
        <PostureItem
          label="Findings"
          value={String(seed.summary.findingCount)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {compact(seed.ontology.id, "ontology package")}
          </span>
          <Pill value={seed.available ? "available" : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Version" value={seed.ontology.version} />
          <Meta label="Source" value={seed.ontology.sourceRef ?? seed.sourceRef} />
          <Meta label="Classes" value={String(seed.ontology.classCount)} />
          <Meta label="Relations" value={String(seed.ontology.relationCount)} />
          <Meta label="Contract" value={seed.generationContractRef ?? seed.contractRef} />
          <Meta label="Blocked by" value={joined(seed.readiness.blockedBy)} />
        </div>
      </div>
      {seed.bindings.length === 0 ? (
        <Status
          label="No ontology bindings"
          detail="Candidate seed has no visible ontology bindings."
        />
      ) : null}
      {seed.bindings.map((binding, index) => (
        <div key={`${index}:${binding.term}:${binding.ontologyRef ?? ""}`} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{binding.term}</span>
            <Pill value={compact(binding.bindingKind, "binding")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Ontology ref" value={binding.ontologyRef} />
            <Meta label="Authority" value={binding.authority} />
            <Meta label="Reason" value={binding.reason} />
          </div>
        </div>
      ))}
      {seed.gaps.length === 0 ? (
        <Status
          label="No ontology gaps"
          detail="Candidate seed did not surface project-local ontology gaps."
        />
      ) : null}
      {seed.gaps.map((gap) => (
        <div key={gap.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{gap.id}</span>
            <Pill value={gap.blocksCandidateGraph ? "blocks" : "review"} />
          </div>
          <h3 className={styles.title}>{compact(gap.term, gap.kind)}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={gap.sourceRef} />
            <Meta label="Kind" value={gap.sourceKind ?? gap.kind} />
            <Meta label="Suggested" value={gap.suggestedAction} />
            <Meta label="Statement" value={gap.statement} />
          </div>
        </div>
      ))}
      {seed.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ProjectLocalOntologyReviewSection({
  lane,
  importPreview,
  decisions,
  workspaceId,
  readOnly,
}: {
  lane: IdeaToSpecWorkspace["projectLocalOntologyReview"];
  importPreview: IdeaToSpecWorkspace["projectLocalOntologyDecisionImportPreview"];
  decisions: ReturnType<typeof useProjectLocalOntologyReviewDecisions>;
  workspaceId: string | null;
  readOnly: boolean;
}) {
  const savedCount =
    decisions.state.kind === "ok" ? decisions.state.data.summary.decisionCount : 0;
  return (
    <section id="idea-to-spec-project-local-ontology-review" className={styles.reviewSection}>
      <SectionHeader
        title="Project-local ontology review"
        count={lane.termCount + savedCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Available" value={boolText(lane.available)} />
        <PostureItem
          label="Review state"
          value={compact(lane.readiness.reviewState, "missing")}
        />
        <PostureItem label="Terms" value={String(lane.termCount)} />
        <PostureItem label="Reviewed" value={String(lane.reviewedTermCount)} />
        <PostureItem label="Blocking" value={String(lane.blockingTermCount)} />
        <PostureItem label="Unreviewed" value={String(lane.unreviewedTermCount)} />
        <PostureItem label="Deferred" value={String(lane.deferredTermCount)} />
        <PostureItem label="Saved" value={String(savedCount)} />
        <PostureItem
          label="Import preview"
          value={importPreview.available ? compact(importPreview.readiness.reviewState, "available") : "missing"}
        />
        <PostureItem
          label="Effective"
          value={
            lane.effectiveReview.available
              ? compact(lane.effectiveReview.status, "available")
              : "missing"
          }
        />
        <PostureItem
          label="Accepted"
          value={String(importPreview.acceptedDecisionCount)}
        />
        <PostureItem
          label="Invalid"
          value={String(importPreview.invalidDecisionCount)}
        />
        <PostureItem
          label="Missing"
          value={String(importPreview.missingDecisionCount)}
        />
      </div>
      {!lane.available ? (
        <Status
          label="Project-local ontology lane missing"
          detail="Run `make project-local-ontology-review-lane` in SpecGraph after candidate graph and ontology decisions are available."
        />
      ) : null}
      <ProjectLocalOntologyDecisionStatus state={decisions.state} />
      <ProjectLocalOntologyImportPreviewStatus preview={importPreview} />
      <ProjectLocalOntologyEffectiveReviewStatus review={lane.effectiveReview} />
      {lane.available ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Review contract</span>
            <Pill value={compact(lane.authority, "operator intent only")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Workspace" value={lane.context.workspaceId} />
            <Meta label="Candidate" value={lane.context.candidateId} />
            <Meta label="Repair session" value={lane.context.repairSessionId} />
            <Meta label="Actions" value={joined(lane.supportedActions)} />
            <Meta
              label="Promotion effect"
              value={lane.requestWorkspacePromotionEffect}
            />
            <Meta
              label="Ontology writes"
              value={boolText(lane.actionBoundary.mayWriteOntologyPackage)}
            />
          </div>
        </div>
      ) : null}
      {lane.terms.map((term) => (
        <ProjectLocalOntologyTermRow
          key={term.termKey}
          term={term}
          savedDecision={decisions.decisionsByTermKey.get(term.termKey)}
          pending={decisions.pendingTermKey === term.termKey}
          saveError={
            decisions.saveError?.termKey === term.termKey
              ? decisions.saveError
              : null
          }
          onSave={(input) =>
            decisions.saveDecision({
              ...input,
              workspaceId,
              operatorRef: "operator://specspace-local",
            })
          }
          readOnly={readOnly}
        />
      ))}
      {lane.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ProjectLocalOntologyEffectiveReviewStatus({
  review,
}: {
  review: IdeaToSpecWorkspace["projectLocalOntologyReview"]["effectiveReview"];
}) {
  if (!review.available) return null;
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Effective project-local review</span>
        <Pill value={compact(review.status, "unknown")} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Ready" value={boolText(review.readiness.ready)} />
        <Meta label="Accepted" value={String(review.acceptedDecisionCount)} />
        <Meta
          label="Maturity evidence"
          value={String(review.maturityEvidenceDecisionCount)}
        />
        <Meta label="Keep local" value={String(review.keepProjectLocalCount)} />
        <Meta label="Bind existing" value={String(review.bindExistingCount)} />
        <Meta label="Alias" value={String(review.aliasCount)} />
        <Meta
          label="Request promotion"
          value={String(review.requestPromotionCount)}
        />
        <Meta label="Blocking" value={String(review.blockingDecisionCount)} />
        <Meta label="Deferred" value={String(review.deferredCount)} />
        <Meta label="Invalid" value={String(review.invalidDecisionCount)} />
        <Meta label="Missing" value={String(review.missingDecisionCount)} />
        <Meta label="Source" value={review.sourceRef} />
      </div>
    </div>
  );
}

function ProjectLocalOntologyImportPreviewStatus({
  preview,
}: {
  preview: IdeaToSpecWorkspace["projectLocalOntologyDecisionImportPreview"];
}) {
  if (!preview.available) {
    return (
      <Status
        label="Project-local import preview missing"
        detail="Run `make specspace-project-local-ontology-decision-import-preview` in SpecGraph after saving project-local ontology decisions."
      />
    );
  }
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>SpecGraph project-local import preview</span>
        <Pill value={compact(preview.readiness.reviewState, "unknown")} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Ready" value={boolText(preview.readiness.ready)} />
        <Meta label="Accepted" value={String(preview.acceptedDecisionCount)} />
        <Meta
          label="Non-resolving"
          value={String(preview.nonResolvingDecisionCount)}
        />
        <Meta label="Invalid" value={String(preview.invalidDecisionCount)} />
        <Meta label="Missing" value={String(preview.missingDecisionCount)} />
        <Meta label="Blocked by" value={joined(preview.readiness.blockedBy)} />
        <Meta label="Workspace" value={preview.context.workspaceId} />
        <Meta label="Candidate" value={preview.context.candidateId} />
      </div>
      {preview.acceptedDecisions.map((decision) => (
        <div key={decision.id} className={styles.subRow}>
          <span>{compact(decision.term, decision.termKey)}</span>
          <Pill value={compact(decision.reviewAction, "accepted")} />
          <span className={styles.statusDetail}>
            {compact(decision.decisionType, decision.status)} · {compact(decision.targetRef, decision.sourceDecisionId)}
          </span>
        </div>
      ))}
      {preview.nonResolvingDecisions.map((decision) => (
        <div key={decision.id} className={styles.subRow}>
          <span>{compact(decision.term, decision.termKey)}</span>
          <Pill value={compact(decision.reviewAction, "non-resolving")} />
          <span className={styles.statusDetail}>
            {compact(decision.materializationIntent, decision.status)}
          </span>
        </div>
      ))}
      {preview.invalidDecisions.map((issue) => (
        <div key={`invalid:${issue.id}`} className={styles.subRow}>
          <span>{compact(issue.term, issue.termKey)}</span>
          <Pill value="invalid" />
          <span className={styles.statusDetail}>
            {compact(issue.reason, issue.field)}
          </span>
        </div>
      ))}
      {preview.missingDecisions.map((issue) => (
        <div key={`missing:${issue.id}`} className={styles.subRow}>
          <span>{compact(issue.term, issue.termKey)}</span>
          <Pill value="missing" />
          <span className={styles.statusDetail}>
            {compact(issue.reason, issue.status)}
          </span>
        </div>
      ))}
      {preview.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.subRow}>
          <span>{finding.findingId}</span>
          <Pill value={finding.severity} />
          <span className={styles.statusDetail}>{finding.message}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectLocalOntologyDecisionStatus({
  state,
}: {
  state: UseProjectLocalOntologyReviewDecisionState;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Project-local ontology decisions loading"
        detail="Reading SpecSpace-owned project-local ontology decision state."
      />
    );
  }
  if (state.kind === "ok") {
    return (
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecSpace project-local decisions</span>
          <Pill value={state.data.summary.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Decisions" value={String(state.data.summary.decisionCount)} />
          <Meta label="State owner" value={state.data.stateOwner} />
          <Meta
            label="SpecGraph authority"
            value={boolText(state.data.authorityBoundary.specgraphArtifactAuthority)}
          />
          <Meta
            label="Ontology authority"
            value={boolText(state.data.authorityBoundary.ontologyAuthority)}
          />
          <Meta
            label="Ontology writes"
            value={boolText(state.data.consumerBoundary.mayWriteOntologyPackage)}
          />
        </div>
      </div>
    );
  }
  return (
    <Status
      label="Project-local ontology decisions unavailable"
      detail={projectLocalOntologyDecisionStateDetail(state)}
    />
  );
}

function ProjectLocalOntologyTermRow({
  term,
  savedDecision,
  pending,
  saveError,
  onSave,
  readOnly,
}: {
  term: IdeaToSpecProjectLocalOntologyTerm;
  savedDecision: ProjectLocalOntologyReviewDecision | undefined;
  pending: boolean;
  saveError: ProjectLocalOntologyReviewDecisionSaveError | null;
  onSave: (input: {
    termKey: string;
    action: string;
    decisionValue: Record<string, unknown>;
  }) => void;
  readOnly: boolean;
}) {
  const availableActions = term.suggestedActions.length
    ? term.suggestedActions
    : [
        "keep_project_local",
        "bind_existing",
        "alias",
        "reject",
        "request_workspace_promotion",
        "defer",
      ];
  const defaultAction = savedDecision?.reviewAction ?? availableActions[0];
  const [selectedAction, setSelectedAction] = useState(defaultAction);
  const [text, setText] = useState(() =>
    projectLocalDecisionText(savedDecision, defaultAction),
  );
  useEffect(() => {
    setSelectedAction(defaultAction);
    setText(projectLocalDecisionText(savedDecision, defaultAction));
  }, [defaultAction, savedDecision]);
  const decisionValue = projectLocalDecisionValue(term, selectedAction, text);
  const canSave =
    selectedAction.length > 0 &&
    projectLocalDecisionValueIsComplete(selectedAction, decisionValue) &&
    !readOnly &&
    !pending;
  const saveButtonLabel = pending
    ? "Saving"
    : savedDecision
      ? "Update decision"
      : "Save decision";
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{term.termKey}</span>
        <Pill value={term.status} />
      </div>
      <h3 className={styles.title}>{compact(term.term, term.id)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Selected decision" value={term.selectedDecisionId} />
        <Meta label="Effect" value={term.effect.candidateReadinessEffect} />
        <Meta label="Next action" value={term.effect.nextAction} />
        <Meta label="Resolved" value={String(term.effect.resolvedGapCount)} />
        <Meta label="Gaps" value={String(term.gapRefs.length)} />
        <Meta label="Resolved refs" value={String(term.resolvedGapRefs.length)} />
        <Meta label="Source refs" value={joined(term.sourceRefs)} />
        <Meta label="Evidence" value={joined(term.evidenceRefs)} />
      </div>
      {term.decisions.map((decision, index) => (
        <div key={`${decision.id ?? "decision"}:${index}`} className={styles.subRow}>
          <span>{compact(decision.id, decision.decisionType)}</span>
          <Pill value={compact(decision.reviewStatus, "review")} />
          <span className={styles.statusDetail}>
            {compact(decision.term, term.term)} · {compact(decision.reason, decision.targetRef)}
          </span>
        </div>
      ))}
      <form
        className={styles.draftForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave({
            termKey: term.termKey,
            action: selectedAction,
            decisionValue,
          });
        }}
      >
        <div className={styles.draftControls}>
          <select
            className={styles.draftSelect}
            value={selectedAction}
            onChange={(event) => {
              const nextAction = event.currentTarget.value;
              setSelectedAction(nextAction);
              setText(projectLocalDecisionText(savedDecision, nextAction));
            }}
            aria-label="Project-local ontology review action"
            disabled={readOnly}
          >
            {availableActions.map((action) => (
              <option key={action} value={action}>
                {projectLocalActionLabel(action)}
              </option>
            ))}
          </select>
          <button className={styles.ackButton} type="submit" disabled={!canSave}>
            {saveButtonLabel}
          </button>
        </div>
        <span className={styles.statusDetail}>
          {projectLocalDecisionFieldLabel(selectedAction)} ·{" "}
          {projectLocalDecisionHint(selectedAction)}
        </span>
        <textarea
          className={styles.draftTextarea}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder={projectLocalDecisionPlaceholder(selectedAction)}
          rows={3}
          aria-label="Project-local ontology review decision"
          readOnly={readOnly}
        />
        <span className={styles.statusDetail}>
          {projectLocalDecisionPreview(term, selectedAction, decisionValue)}
        </span>
        <span className={styles.statusDetail}>
          Operator intent only · does not write Ontology packages or accept terms.
        </span>
        {savedDecision ? (
          <span className={styles.statusDetail}>
            Decision saved · {projectLocalActionLabel(savedDecision.reviewAction)} · {savedDecision.updatedAt}
          </span>
        ) : null}
        {saveError ? (
          <span className={styles.statusDetail}>
            Decision save failed · {projectLocalOntologyDecisionErrorText(saveError)}
          </span>
        ) : null}
      </form>
    </div>
  );
}

function CandidateGraphSection({
  nodes,
}: {
  nodes: readonly IdeaToSpecCandidateNode[];
}) {
  return (
    <section id="idea-to-spec-candidate-graph" className={styles.reviewSection}>
      <SectionHeader title="Candidate graph" count={nodes.length} />
      {nodes.length === 0 ? (
        <Status label="No candidate nodes" detail="Candidate graph artifact is empty." />
      ) : null}
      {nodes.map((node) => (
        <div key={node.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{node.id}</span>
            <Pill value={compact(node.kind, "node")} />
          </div>
          <h3 className={styles.title}>{compact(node.title, "Candidate node")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Requirements" value={String(node.requirementCount)} />
            <Meta label="Acceptance" value={String(node.acceptanceCriteriaCount)} />
            <Meta label="Claims" value={String(node.claimCount)} />
            <Meta label="Gaps" value={String(node.gapCount)} />
            <Meta label="Ontology refs" value={joined(node.ontologyRefs)} />
          </div>
        </div>
      ))}
    </section>
  );
}

function PreSibSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const data = state.data;
  return (
    <section id="idea-to-spec-pre-sib" className={styles.reviewSection}>
      <SectionHeader title="Pre-SIB coherence" count={data.preSib.findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(data.preSib.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(data.preSib.readiness.reviewState)}
        />
        <PostureItem
          label="Blocked by"
          value={joined(data.preSib.readiness.blockedBy)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          {Object.entries(data.preSib.metrics).map(([key, value]) => (
            <Meta key={key} label={key.replace(/_/g, " ")} value={metricValue(value)} />
          ))}
        </div>
      </div>
      {data.preSib.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function RepairSection({
  actions,
}: {
  actions: readonly IdeaToSpecRepairAction[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Repair loop" count={actions.length} />
      {actions.length === 0 ? (
        <Status label="No repair actions" detail="Repair loop artifact is empty." />
      ) : null}
      {actions.map((action) => (
        <div key={action.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{action.id}</span>
            <Pill value={action.status} />
          </div>
          <h3 className={styles.title}>{action.kind.replace(/_/g, " ")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Target" value={action.targetRef} />
            <Meta label="Findings" value={joined(action.sourceFindings)} />
            <Meta label="Rationale" value={action.rationale} />
          </div>
        </div>
      ))}
    </section>
  );
}

function RepairSessionSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const session = state.data.repairSession;
  return (
    <section id="idea-to-spec-repair-session" className={styles.reviewSection}>
      <SectionHeader
        title="Repair session"
        count={
          session.stages.length +
          session.openBlockers.length +
          session.acceptedAnswers.length
        }
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Source" value={session.sourceMode} />
        <PostureItem
          label="Ready"
          value={boolText(session.readiness.ready)}
        />
        <PostureItem
          label="Candidate approval"
          value={boolText(session.readinessImpact.readyForCandidateApproval)}
        />
        <PostureItem
          label="Platform promotion"
          value={boolText(session.readinessImpact.readyForPlatformPromotion)}
        />
        <PostureItem
          label="Unresolved gaps"
          value={String(session.readinessImpact.unresolvedOntologyGapCount)}
        />
        <PostureItem
          label="Promotion paths"
          value={String(session.readinessImpact.promotionPathCount)}
        />
      </div>
      {!session.available ? (
        <Status
          label="No repair session journal"
          detail="Using legacy repair artifacts until runs/idea_to_spec_repair_session.json is published."
        />
      ) : null}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {compact(session.session.sessionId, "repair-session")}
          </span>
          <Pill value={compact(session.readiness.reviewState, "unknown")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={session.session.candidateId} />
          <Meta label="Lane" value={session.session.workflowLane} />
          <Meta label="Route" value={session.session.workspaceRoute} />
          <Meta label="Operator" value={session.session.operatorRef} />
          <Meta
            label="Quality"
            value={session.readinessImpact.candidateQualityReviewState}
          />
          <Meta
            label="Promotion gate"
            value={session.readinessImpact.promotionGateReviewState}
          />
          <Meta
            label="Active candidate"
            value={session.readinessImpact.activeCandidateReviewState}
          />
          <Meta
            label="Blocked by"
            value={joined(session.readinessImpact.blockedBy)}
          />
          <Meta
            label="Platform blocked"
            value={joined(session.readinessImpact.platformPromotionBlockedBy)}
          />
          <Meta label="Rerun overlay" value={session.rerunOverlay.sourceRef} />
        </div>
      </div>
      {session.openBlockers.map((blocker) => (
        <RepairSessionBlockerRow
          key={`${blocker.kind}:${blocker.id}`}
          blocker={blocker}
        />
      ))}
      {session.stages.map((stage) => (
        <RepairSessionStageRow
          key={`${stage.index ?? "stage"}:${stage.stage}:${stage.sourceRef ?? ""}`}
          stage={stage}
        />
      ))}
      {session.acceptedAnswers.map((answer) => (
        <AcceptedAnswerRow
          key={`${answer.requestId}:${answer.answerKind}`}
          answer={answer}
        />
      ))}
    </section>
  );
}

function RepairSessionBlockerRow({
  blocker,
}: {
  blocker: IdeaToSpecRepairSessionBlocker;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{blocker.id}</span>
        <Pill value={blocker.kind} />
      </div>
    </div>
  );
}

function RepairSessionStageRow({
  stage,
}: {
  stage: IdeaToSpecRepairSessionStage;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{stage.stage}</span>
        <Pill value={stage.ready ? "ready" : "blocked"} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Artifact kind" value={stage.artifactKind} />
        <Meta label="Source" value={stage.sourceRef} />
        <Meta label="Review state" value={stage.reviewState} />
        <Meta label="Status" value={stage.status} />
        <Meta label="Blocked by" value={joined(stage.blockedBy)} />
        <Meta label="Next" value={stage.nextArtifact} />
      </div>
    </div>
  );
}

function AcceptedAnswerRow({
  answer,
}: {
  answer: IdeaToSpecAcceptedAnswer;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{answer.requestId}</span>
        <Pill value={answer.answerKind} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Status" value={answer.status} />
        <Meta label="Request kind" value={answer.requestKind} />
        <Meta label="Target artifact" value={answer.targetArtifact} />
        <Meta label="Target" value={answer.targetRef} />
        <Meta label="Terms" value={joined(answer.terms)} />
        <Meta label="Scope" value={answer.termScope} />
      </div>
    </div>
  );
}

function IdeaMaturitySection({
  maturity,
}: {
  maturity: IdeaToSpecIdeaMaturity;
}) {
  if (!maturity.available) {
    return (
      <section id="idea-to-spec-idea-maturity" className={styles.reviewSection}>
        <SectionHeader title="Idea maturity" count={0} />
        <Status
          label="Idea maturity metrics unavailable"
          detail="Run make idea-maturity-metrics in SpecGraph."
        />
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Metrics contract</span>
            <Pill value={maturity.status.replace(/_/g, " ")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta
              label="Report reason"
              value={recordText(maturity.reportError, "reason", maturity.status)}
            />
            <Meta
              label="Report detail"
              value={recordText(
                maturity.reportError,
                "detail",
                "missing report",
              )}
            />
            <Meta label="Source refs" value={joined(maturity.sourceRefs)} />
          </div>
        </div>
      </section>
    );
  }
  const metrics = maturity.report.metrics;
  const perGapMaterializedAnswerCount =
    metrics.perGapMaterializedAnswerCount ?? metrics.materializedAnswerCount;
  const closureEvidenceAnswerCount =
    metrics.closureEvidenceAnswerCount ?? metrics.materializedAnswerCount;
  const ordinaryUnmaterializedAnswerCount =
    metrics.ordinaryUnmaterializedAnswerCount ??
    metrics.unmaterializedAnswerCount;
  const derived = maturity.report.derivedState;
  const contract = maturity.report.contract;
  const validationStatus = maturity.validation.available
    ? recordText(maturity.validation.summary, "status", "unknown")
    : "unavailable";
  const validationTone =
    maturity.status === "available"
      ? "trusted"
      : maturity.status === "validation_unavailable"
        ? "validation unavailable"
        : maturity.status.replace(/_/g, " ");
  return (
    <section id="idea-to-spec-idea-maturity" className={styles.reviewSection}>
      <SectionHeader
        title="Idea maturity"
        count={
          maturity.report.sourceArtifacts.length +
          maturity.report.findings.length +
          maturity.validation.reports.length
        }
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Metrics contract" value={validationStatus} />
        <PostureItem label="Trusted" value={boolText(maturity.trusted)} />
        <PostureItem
          label="Lifecycle"
          value={compact(derived.lifecycleState, maturity.status)}
        />
        <PostureItem
          label="Candidate approval"
          value={compact(derived.candidateApprovalState, "not_available")}
        />
        <PostureItem
          label="Promotion"
          value={compact(derived.platformPromotionState, "not_reached")}
        />
        <PostureItem
          label="Publication"
          value={compact(derived.readModelPublicationState, "not_reached")}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Metrics contract</span>
          <Pill value={validationTone} />
        </div>
        <h3 className={styles.title}>
          {compact(derived.lifecycleState, "lifecycle unavailable").replace(/_/g, " ")}
        </h3>
        <div className={styles.metaGrid}>
          <Meta label="Report status" value={maturity.report.status} />
          <Meta label="SpecGraph contract" value={maturity.report.contractRef} />
          <Meta label="Metrics schema" value={contract.schemaRef} />
          <Meta
            label="Validation schema"
            value={contract.validationReportSchemaRef}
          />
          <Meta
            label="Compatibility"
            value={compact(contract.compatibilityPolicy, "not_declared")}
          />
          <Meta
            label="Validator"
            value={compact(contract.validatorId, maturity.validation.validator.id)}
          />
          <Meta
            label="Validator version"
            value={compact(
              contract.validatorVersion,
              maturity.validation.validator.version,
            )}
          />
          <Meta
            label="Validator schema"
            value={maturity.validation.validator.schemaRef}
          />
          <Meta
            label="Policy ref"
            value={compact(
              contract.compatibilityPolicyRef,
              maturity.validation.validator.compatibilityPolicyRef,
            )}
          />
          <Meta
            label="Metrics RFC"
            value={compact(contract.metricsRfcRef, maturity.report.metricsRfcRef)}
          />
          <Meta label="Contract proposal" value={contract.proposalId} />
          <Meta label="Workspace" value={maturity.report.candidate.workspaceRoute} />
          <Meta label="Candidate" value={maturity.report.candidate.candidateId} />
          <Meta label="Review" value={derived.reviewStatus} />
          <Meta label="Blockers" value={joined(derived.blockers)} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Maturity navigation</span>
          <Pill value="lifecycle links" />
        </div>
        <div className={styles.navGrid}>
          {MATURITY_NAV_ITEMS.map((item) => (
            <a key={item.label} className={styles.navLink} href={item.href}>
              <span className={styles.navLabel}>{item.label}</span>
              <span className={styles.navHint}>{item.detail}</span>
            </a>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Clarification and answers</span>
          <Pill value={maturity.trusted ? "validated" : maturity.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta
            label="Questions"
            value={String(metrics.clarificationQuestionCount)}
          />
          <Meta
            label="Review required"
            value={String(metrics.reviewRequiredQuestionCount)}
          />
          <Meta label="Blocking" value={String(metrics.blockingQuestionCount)} />
          <Meta label="Accepted answers" value={String(metrics.acceptedAnswerCount)} />
          <Meta
            label="Per-gap materialized"
            value={`${perGapMaterializedAnswerCount} / ${metrics.answeredQuestionCount}`}
          />
          <Meta
            label="Aggregate closure"
            value={String(metrics.aggregateAnswerCount)}
          />
          <Meta label="Dismissed" value={String(metrics.dismissedAnswerCount)} />
          <Meta
            label="Closure evidence"
            value={`${closureEvidenceAnswerCount} / ${metrics.acceptedAnswerCount}`}
          />
          <Meta
            label="Ordinary unmaterialized"
            value={String(ordinaryUnmaterializedAnswerCount)}
          />
          <Meta label="Consumed" value={String(metrics.consumedAnswerCount)} />
          <Meta label="Deferred" value={String(metrics.deferredAnswerCount)} />
          <Meta
            label="Materialization rate"
            value={rateText(metrics.answerMaterializationRate)}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Ontology grounding</span>
          <Pill value={rateText(metrics.ontologyGapResolutionRate)} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Initial gaps" value={String(metrics.ontologyGapCountInitial)} />
          <Meta label="Resolved" value={String(metrics.ontologyGapResolvedCount)} />
          <Meta
            label="Unresolved"
            value={String(metrics.ontologyGapUnresolvedCount)}
          />
          <Meta
            label="Resolution rate"
            value={rateText(metrics.ontologyGapResolutionRate)}
          />
          <Meta
            label="Project-local review"
            value={compact(metrics.projectLocalOntologyReview.status, "missing")}
          />
          <Meta
            label="Review evidence"
            value={String(metrics.projectLocalOntologyReview.maturityEvidenceDecisionCount)}
          />
          <Meta
            label="Ready for maturity"
            value={metrics.projectLocalOntologyReview.readyForMaturity ? "yes" : "no"}
          />
          <Meta
            label="Kept local"
            value={String(metrics.projectLocalOntologyReview.keepProjectLocalCount)}
          />
          <Meta
            label="Bound / alias"
            value={`${metrics.projectLocalOntologyReview.bindExistingCount} / ${metrics.projectLocalOntologyReview.aliasCount}`}
          />
          <Meta
            label="Promotion follow-ups"
            value={String(metrics.projectLocalOntologyReview.followUpDecisionCount)}
          />
          <Meta
            label="Blocking decisions"
            value={String(metrics.projectLocalOntologyReview.blockingDecisionCount)}
          />
          <Meta
            label="Missing / invalid"
            value={`${metrics.projectLocalOntologyReview.missingDecisionCount} / ${metrics.projectLocalOntologyReview.invalidDecisionCount}`}
          />
          <Meta
            label="Deferred"
            value={String(metrics.projectLocalOntologyReview.deferredCount)}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Candidate repair</span>
          <Pill value={rateText(metrics.candidateGapClosureRate)} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Initial gaps" value={String(metrics.candidateGapCountInitial)} />
          <Meta label="Resolved" value={String(metrics.candidateGapResolvedCount)} />
          <Meta
            label="Unresolved"
            value={String(metrics.candidateGapUnresolvedCount)}
          />
          <Meta label="Remaining blockers" value={String(metrics.remainingBlockerCount)} />
          <Meta
            label="Closure rate"
            value={rateText(metrics.candidateGapClosureRate)}
          />
          <Meta label="Candidate nodes" value={String(metrics.candidateNodeCount)} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Rerun trend</span>
          <Pill value={metrics.rerunCount > 0 ? "after rerun" : "before rerun"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta
            label="Ontology gaps resolved"
            value={`${metrics.ontologyGapResolvedCount} / ${metrics.ontologyGapCountInitial}`}
          />
          <Meta
            label="Candidate gaps resolved"
            value={`${metrics.candidateGapResolvedCount} / ${metrics.candidateGapCountInitial}`}
          />
          <Meta
            label="Remaining blockers"
            value={String(metrics.remainingBlockerCount)}
          />
          <Meta label="Stale refs" value={String(metrics.staleRefCount)} />
          <Meta label="Failed gates" value={String(metrics.failedGateCount)} />
          <Meta label="Reruns" value={String(metrics.rerunCount)} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Workflow friction and promotion</span>
          <Pill value={compact(derived.platformPromotionState, "not_reached")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Stale refs" value={String(metrics.staleRefCount)} />
          <Meta label="Failed gates" value={String(metrics.failedGateCount)} />
          <Meta label="Dry runs" value={String(metrics.dryRunCount)} />
          <Meta label="Reruns" value={String(metrics.rerunCount)} />
          <Meta label="Rerun requests" value={String(metrics.rerunRequestCount)} />
          <Meta label="Manual handoffs" value={String(metrics.manualHandoffCount)} />
          <Meta
            label="Operator commands"
            value={String(metrics.operatorCommandCount)}
          />
          <Meta label="Promotion paths" value={String(metrics.promotionPathCount)} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Temporal progress</span>
          <Pill value={compact(metrics.stalledPhase, "not_stalled")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Last progress" value={metrics.lastProgressAt} />
          <Meta
            label="First candidate"
            value={durationText(metrics.timeToFirstCandidateSeconds)}
          />
          <Meta
            label="Approval ready"
            value={durationText(metrics.timeToApprovalReadySeconds)}
          />
          <Meta
            label="First materialization"
            value={durationText(metrics.timeToFirstMaterializationSeconds)}
          />
          <Meta
            label="Published files"
            value={String(metrics.publishedFileCount)}
          />
          <Meta
            label="Sources"
            value={String(maturity.report.sourceArtifacts.length)}
          />
        </div>
      </div>

      {maturity.report.readinessExplainers.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Readiness explainers</span>
            <Pill value={`${maturity.report.readinessExplainers.length} reasons`} />
          </div>
          <div className={styles.navGrid}>
            {maturity.report.readinessExplainers.map((explainer) => {
              const explainerHref = maturityExplainerHref(explainer);
              return (
                <div key={explainer.id} className={styles.subRow}>
                  <span className={styles.rowId}>{explainer.id}</span>
                  <Pill value={explainer.severity} />
                  <span className={styles.statusDetail}>
                    {explainer.message} · {explainer.kind}
                  </span>
                  <div className={styles.metaGrid}>
                    <Meta label="Source" value={explainer.source} />
                    <Meta label="Blocks" value={joined(explainer.blocks)} />
                    <Meta
                      label="Next action"
                      value={maturityExplainerNextAction(explainer)}
                    />
                    <Meta label="Evidence" value={joined(explainer.evidenceRefs)} />
                    <a className={styles.navLink} href={explainerHref}>
                      <span className={styles.navLabel}>Linked section</span>
                      <span className={styles.navHint}>{explainerHref}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {maturity.validation.reports.map((report) => (
        <ReportStatusRow
          key={`${report.path ?? "validation"}:${report.status}`}
          title="Validation report"
          status={report.status}
          path={report.path}
          detail={`diagnostics ${report.diagnosticCount}`}
        />
      ))}

      {maturity.report.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.source} />
            <Meta
              label="Next action"
              value={maturityFindingNextAction(finding)}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

function WorkspaceStateHygieneSection({
  hygiene,
}: {
  hygiene: IdeaToSpecWorkspaceStateHygiene;
}) {
  if (!hygiene.available) {
    return (
      <section id="idea-to-spec-workspace-state-hygiene" className={styles.reviewSection}>
        <SectionHeader title="Workspace state preflight" count={0} />
        <Status
          label="Workspace state preflight unavailable"
          detail="SpecSpace did not publish workspace_state_hygiene for this workspace."
        />
      </section>
    );
  }
  return (
    <section id="idea-to-spec-workspace-state-hygiene" className={styles.reviewSection}>
      <SectionHeader
        title="Workspace state preflight"
        count={hygiene.blockingStateCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Status" value={hygiene.status} />
        <PostureItem label="Usable" value={String(hygiene.usableStateCount)} />
        <PostureItem label="Missing" value={String(hygiene.missingStateCount)} />
        <PostureItem label="Stale" value={String(hygiene.staleStateCount)} />
        <PostureItem label="Invalid" value={String(hygiene.invalidStateCount)} />
        <PostureItem label="Blocking" value={String(hygiene.blockingStateCount)} />
        <PostureItem
          label="Actions"
          value={`${hygiene.enabledRecommendedActionCount}/${hygiene.recommendedActionCount}`}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Current workspace state</span>
          <Pill value={hygiene.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Workspace" value={hygiene.workspaceId} />
          <Meta label="Candidate" value={hygiene.candidateId} />
          <Meta label="Repair session" value={hygiene.repairSessionId} />
          <Meta label="Repair session ref" value={hygiene.repairSessionRef} />
          <Meta label="Next action" value={hygiene.nextAction} />
          <Meta
            label="Can clear state"
            value={boolText(hygiene.actionBoundary.may_clear_state === true)}
          />
        </div>
      </div>
      {hygiene.recommendedActions.length > 0 ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>Recommended state actions</span>
            <span className={styles.sectionCount}>
              {hygiene.enabledRecommendedActionCount}/
              {hygiene.recommendedActionCount}
            </span>
          </div>
          {hygiene.recommendedActions.map((action) => (
            <div key={action.id} className={styles.subRow}>
              <div className={styles.rowHeader}>
                <span className={styles.rowId}>{action.label}</span>
                <Pill value={action.enabled ? "enabled" : "blocked"} />
              </div>
              <div className={styles.metaGrid}>
                <Meta label="Reason" value={action.reason} />
                <Meta label="Target state" value={action.targetState} />
                <Meta label="Target section" value={action.targetSection} />
                <Meta
                  label="Requires current session"
                  value={boolText(action.requiresCurrentRepairSession)}
                />
                <Meta label="UI intent" value={action.uiIntent} />
                <Meta label="Blockers" value={joined(action.blockers)} />
                <Meta label="Evidence" value={joined(action.evidenceRefs)} />
              </div>
              {action.commandHint ? (
                <pre className={styles.codeBlock}>{action.commandHint}</pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {hygiene.states.map((item) => (
        <div key={`${item.kind}:${item.path ?? "state"}`} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{item.kind.replace(/_/g, " ")}</span>
            <Pill value={item.status} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Reason" value={item.reason} />
            <Meta label="Records" value={String(item.recordCount)} />
            <Meta label="Current" value={String(item.currentRecordCount)} />
            <Meta label="Stale" value={String(item.staleRecordCount)} />
            <Meta label="Stored workspace" value={item.storedWorkspaceId} />
            <Meta label="Stored candidate" value={item.storedCandidateId} />
            <Meta label="Stored session" value={item.storedRepairSessionId} />
            <Meta label="Stored session ref" value={item.storedRepairSessionRef} />
            <Meta label="Blocks" value={joined(item.blocks)} />
            <Meta label="Next action" value={item.nextAction} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ProductRepairReviewSection({
  state,
  repairDrafts,
  repairRerunRequests,
  workspaceId,
  onWorkspaceRefreshRequest,
  readOnly,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
  repairDrafts: ReturnType<typeof useIdeaToSpecRepairDrafts>;
  repairRerunRequests: ReturnType<typeof useIdeaToSpecRepairRerunRequests>;
  workspaceId: string | null;
  onWorkspaceRefreshRequest?: () => void;
  readOnly: boolean;
}) {
  const lane = state.data.repairReview;
  const quality = lane.rerunPreview.candidateQualityPreview;
  const delta = lane.rerunMaterialization.delta;
  const platformExecution = lane.platformExecution;
  const repairTargetsByRequestId = new Map(
    lane.clarificationRequests.repairTargets.map((target) => [
      target.requestId,
      target,
    ]),
  );
  const draftCount =
    repairDrafts.state.kind === "ok"
      ? repairDrafts.state.data.summary.draftCount
      : 0;
  return (
    <section id="idea-to-spec-repair-review" className={styles.reviewSection}>
      <SectionHeader
        title="Product repair review"
        count={
          lane.clarificationRequests.requestCount +
          lane.ontologyDecisions.decisionCount +
          draftCount
        }
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Requests"
          value={String(lane.clarificationRequests.requestCount)}
        />
        <PostureItem
          label="Answers"
          value={String(lane.clarificationAnswers.answerCount)}
        />
        <PostureItem
          label="Decisions"
          value={String(lane.ontologyDecisions.decisionCount)}
        />
        <PostureItem label="Drafts" value={String(draftCount)} />
        <PostureItem
          label="Quality"
          value={compact(quality.reviewState, "not previewed")}
        />
        <PostureItem
          label="Removed"
          value={String(delta.removedGapIds.length)}
        />
        <PostureItem
          label="Exec"
          value={compact(platformExecution.execution.status, "missing")}
        />
        <PostureItem
          label="Publish"
          value={compact(platformExecution.publication.status, "missing")}
        />
      </div>
      {!lane.available ? (
        <Status
          label="No repair review lane"
          detail="Clarification and rerun preview artifacts are not published for this workspace."
        />
      ) : null}
      <RepairDraftStatus state={repairDrafts.state} />
      <RepairRerunRequestStatus
        state={repairRerunRequests.state}
        pending={repairRerunRequests.pending}
        requestError={repairRerunRequests.requestError}
        onRequest={() => {
          if (readOnly) return;
          repairRerunRequests.requestRerun({
            workspaceId,
            operatorRef: "operator://specspace-local",
          });
        }}
        readOnly={readOnly}
      />
      <ProductRepairRerunExecutionStatus platformExecution={platformExecution} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Ontology gap quality</span>
          <Pill value={compact(quality.ontologyGapState, "unknown")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta
            label="Resolved"
            value={String(quality.resolvedOntologyGapCount)}
          />
          <Meta
            label="Unresolved"
            value={String(quality.unresolvedOntologyGapCount)}
          />
          <Meta label="Removed gaps" value={joined(delta.removedGapIds)} />
          <Meta
            label="Still open"
            value={joined(delta.unresolvedOntologyGapIds)}
          />
        </div>
      </div>
      {lane.clarificationRequests.requests.map((request) => (
        <ClarificationRequestRow
          key={request.id}
          request={request}
          repairTarget={repairTargetsByRequestId.get(request.id)}
          draft={repairDrafts.draftsByRequestId.get(request.id)}
          pending={repairDrafts.pendingRequestId === request.id}
          saveError={
            repairDrafts.saveError?.requestId === request.id
              ? repairDrafts.saveError
              : null
          }
          onSave={(input) =>
            void repairDrafts
              .saveDraft({
                ...input,
                workspaceId,
                operatorRef: "operator://specspace-local",
              })
              .then((saved) => {
                if (saved) onWorkspaceRefreshRequest?.();
              })
          }
          readOnly={readOnly}
        />
      ))}
      {lane.ontologyDecisions.decisions.map((decision) => (
        <OntologyDecisionRow key={decision.id} decision={decision} />
      ))}
      {lane.rerunPreview.resolvedGaps.map((gap) => (
        <ResolvedGapRow key={gap.gapId} gap={gap} />
      ))}
    </section>
  );
}

function RepairDraftStatus({
  state,
}: {
  state: UseIdeaToSpecRepairDraftsState;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Repair drafts loading"
        detail="Reading SpecSpace-owned repair draft state."
      />
    );
  }
  if (state.kind === "ok") {
    return (
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecSpace repair drafts</span>
          <Pill value={state.data.summary.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Drafts" value={String(state.data.summary.draftCount)} />
          <Meta label="State owner" value={state.data.stateOwner} />
          <Meta
            label="SpecGraph authority"
            value={boolText(state.data.authorityBoundary.specgraphArtifactAuthority)}
          />
          <Meta
            label="Ontology writes"
            value={boolText(state.data.consumerBoundary.mayWriteOntologyPackage)}
          />
        </div>
      </div>
    );
  }
  return (
    <Status
      label="Repair drafts unavailable"
      detail={repairDraftStateDetail(state)}
    />
  );
}

function RepairRerunRequestStatus({
  state,
  pending,
  requestError,
  onRequest,
  readOnly,
}: {
  state: UseIdeaToSpecRepairRerunRequestsState;
  pending: boolean;
  requestError: IdeaToSpecRepairRerunRequestError | null;
  onRequest: () => void;
  readOnly: boolean;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Repair rerun request loading"
        detail="Reading SpecSpace-owned rerun request state."
      />
    );
  }
  if (state.kind !== "ok") {
    return (
      <Status
        label="Repair rerun request unavailable"
        detail={repairRerunRequestStateDetail(state)}
      />
    );
  }
  const workflow = state.data.workflowStatus;
  const command = workflow.operatorCommand ?? "make product-workspace-repair-draft-rerun";
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Repair draft rerun</span>
        <Pill value={state.data.summary.status} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Drafts saved" value={boolText(workflow.draftsSaved)} />
        <Meta label="Drafts" value={String(workflow.draftCount)} />
        <Meta label="Import preview" value={workflow.importPreviewStatus} />
        <Meta label="Accepted" value={String(workflow.acceptedForRerunCount)} />
        <Meta label="Rerun" value={workflow.rerunStatus} />
        <Meta label="Journal" value={workflow.latestJournalState} />
        <Meta label="Requests" value={String(state.data.summary.activeRequestCount)} />
        <Meta
          label="Exec authority"
          value={boolText(state.data.consumerBoundary.mayExecuteSpecgraph)}
        />
      </div>
      <pre className={styles.codeBlock}>{command}</pre>
      <div className={styles.draftControls}>
        <button
          className={styles.ackButton}
          type="button"
          disabled={readOnly || !workflow.requestReady || pending}
          onClick={onRequest}
        >
          {pending ? "Requesting" : "Request rerun preview"}
        </button>
        <span className={styles.statusDetail}>
          Request records operator intent only; execute the SpecGraph target in a controlled environment.
        </span>
      </div>
      {requestError ? (
        <span className={styles.statusDetail}>
          Rerun request failed · {repairRerunRequestErrorText(requestError)}
        </span>
      ) : null}
    </div>
  );
}

function ProductRepairRerunExecutionStatus({
  platformExecution,
}: {
  platformExecution: IdeaToSpecProductRepairRerunPlatformExecution;
}) {
  const execution = platformExecution.execution;
  const publication = platformExecution.publication;
  const rerunStatus = productRepairRerunStatus(execution, publication);
  if (!platformExecution.available) {
    return (
      <Status
        label="Platform repair rerun not executed"
        detail="No platform_product_repair_rerun_execution_report.json artifact is published for this workspace."
      />
    );
  }
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>Platform repair rerun</span>
        <Pill value={rerunStatus} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Execution" value={compact(execution.status, "missing")} />
        <Meta label="Execution dry run" value={boolText(execution.dryRun)} />
        <Meta label="Execution errors" value={String(execution.errorCount)} />
        <Meta label="Outputs" value={String(execution.outputArtifactCount)} />
        <Meta label="Rerun digest" value={execution.rerunReportDigest} />
        <Meta label="Session digest" value={execution.repairSessionDigest} />
        <Meta label="Publication" value={compact(publication.status, "missing")} />
        <Meta label="Publication dry run" value={boolText(publication.dryRun)} />
        <Meta label="Published" value={String(publication.publishedArtifactCount)} />
        <Meta label="Missing public" value={String(publication.missingArtifactCount)} />
        <Meta label="Manifest" value={publication.manifestPath} />
        <Meta
          label="Exec authority"
          value={boolText(
            platformExecution.actionBoundary.mayExecutePlatformAdapter,
          )}
        />
      </div>
      {execution.operations.map((operation) => (
        <div key={operation.name} className={styles.subRow}>
          <span>{operation.name}</span>
          <Pill value={operation.status} />
          <span className={styles.statusDetail}>
            {compact(operation.reason, joined(operation.evidence))}
          </span>
        </div>
      ))}
      {execution.outputArtifacts.map((artifact) => (
        <div key={artifact.key} className={styles.subRow}>
          <span>{artifact.key}</span>
          <Pill value={artifact.ready ? "ready" : artifact.present ? "present" : "missing"} />
          <span className={styles.statusDetail}>
            {artifact.path ?? compact(artifact.artifactKind)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ApprovalReadinessSection({
  readiness,
  intentRequestReady,
  pending,
  requestError,
  onRequest,
  readOnly,
}: {
  readiness: IdeaToSpecApprovalReadiness;
  intentRequestReady: boolean;
  pending: boolean;
  requestError: IdeaToSpecCandidateApprovalIntentError | null;
  onRequest: () => void;
  readOnly: boolean;
}) {
  const canRequest =
    readiness.promotionReviewCanBeRequested &&
    readiness.platformApprovalGateCanMaterializeDecision &&
    intentRequestReady &&
    !readOnly &&
    !pending;
  const title = readiness.candidateRepaired
    ? "Candidate repaired"
    : readiness.readyForCandidateApproval
      ? "Candidate approval-ready"
      : "Candidate not approval-ready";
  return (
    <section
      id="idea-to-spec-approval-readiness"
      className={styles.reviewSection}
    >
      <SectionHeader
        title="Approval readiness"
        count={readiness.remainingBlockerCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Candidate repaired"
          value={boolText(readiness.candidateRepaired)}
        />
        <PostureItem
          label="Approval-ready"
          value={boolText(readiness.readyForCandidateApproval)}
        />
        <PostureItem
          label="Promotion review"
          value={boolText(readiness.promotionReviewCanBeRequested)}
        />
        <PostureItem
          label="Platform gate"
          value={boolText(readiness.platformApprovalGateCanMaterializeDecision)}
        />
        <PostureItem
          label="Ontology gaps"
          value={`${readiness.resolvedOntologyGapCount}/${readiness.unresolvedOntologyGapCount}`}
        />
        <PostureItem
          label="Product gaps"
          value={`${readiness.resolvedCandidateGapCount}/${readiness.unresolvedCandidateGapCount}`}
        />
        <PostureItem label="Removed" value={String(readiness.removedGapCount)} />
        <PostureItem label="Paths" value={String(readiness.promotionPathCount)} />
        <PostureItem
          label="Blockers"
          value={String(readiness.remainingBlockerCount)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>{title}</span>
          <Pill value={readiness.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Source" value={readiness.sourceMode} />
          <Meta label="Handoff" value={readiness.sourceRefs.handoff} />
          <Meta label="Active candidate" value={readiness.sourceRefs.activeCandidate} />
          <Meta label="Repair session" value={readiness.sourceRefs.repairSession} />
          <Meta label="Promotion gate" value={readiness.sourceRefs.promotionGate} />
          <Meta
            label="Execution"
            value={compact(readiness.reviewStates.execution, "missing")}
          />
          <Meta
            label="Publication"
            value={compact(readiness.reviewStates.publication, "missing")}
          />
          <Meta
            label="Repaired public"
            value={boolText(readiness.repairedArtifactsPublished)}
          />
          <Meta
            label="Approval decision"
            value={boolText(readiness.candidateApprovalDecisionReady)}
          />
          <Meta label="Intent request" value={boolText(intentRequestReady)} />
          <Meta
            label="Platform promotion"
            value={boolText(readiness.readyForPlatformPromotion)}
          />
        </div>
        {readiness.blockers.map((blocker) => (
          <div key={blocker} className={styles.subRow}>
            <span>{blocker}</span>
            <Pill value="blocked" />
          </div>
        ))}
        <div className={styles.draftControls}>
          <button
            className={styles.ackButton}
            type="button"
            disabled={!canRequest}
            onClick={onRequest}
          >
            {pending ? "Requesting" : "Approve candidate for promotion review"}
          </button>
          <span className={styles.statusDetail}>
            Platform approval gate · {boolText(readiness.platformApprovalGateCanMaterializeDecision)}
          </span>
        </div>
        {requestError ? (
          <span className={styles.statusDetail}>
            Candidate approval intent failed · {candidateApprovalIntentErrorText(requestError)}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function CandidateApprovalIntentSection({
  state,
  pending,
  requestError,
  onRequest,
  showRequestButton = true,
}: {
  state: UseIdeaToSpecCandidateApprovalIntentsState;
  pending: boolean;
  requestError: IdeaToSpecCandidateApprovalIntentError | null;
  onRequest: () => void;
  showRequestButton?: boolean;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Candidate approval intent loading"
        detail="Reading SpecSpace-owned candidate approval intent state."
      />
    );
  }
  if (state.kind !== "ok") {
    return (
      <Status
        label="Candidate approval intent unavailable"
        detail={candidateApprovalIntentStateDetail(state)}
      />
    );
  }
  const workflow = state.data.workflowStatus;
  const activeIntent = [...state.data.intents]
    .reverse()
    .find((intent) => intent.status === "requested");
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Candidate approval intent"
        count={state.data.summary.activeIntentCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Session"
          value={compact(workflow.repairSessionStatus, "missing")}
        />
        <PostureItem
          label="Approval ready"
          value={boolText(workflow.candidateApprovalReady)}
        />
        <PostureItem
          label="Blockers"
          value={String(workflow.openBlockerCount)}
        />
        <PostureItem
          label="Execution"
          value={compact(workflow.platformExecutionStatus, "missing")}
        />
        <PostureItem
          label="Publication"
          value={compact(workflow.platformPublicationStatus, "missing")}
        />
        <PostureItem
          label="Git authority"
          value={boolText(state.data.authorityBoundary.gitServiceAuthority)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecSpace approval intent</span>
          <Pill value={state.data.summary.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Repair session" value={workflow.repairSessionRef} />
          <Meta label="Promotion gate" value={workflow.promotionGateRef} />
          <Meta label="Journal" value={workflow.latestJournalState} />
          <Meta label="Platform promotion" value={boolText(workflow.readyForPlatformPromotion)} />
          <Meta label="Intents" value={String(state.data.summary.activeIntentCount)} />
          <Meta
            label="Candidate authority"
            value={boolText(state.data.authorityBoundary.candidateApprovalAuthority)}
          />
          <Meta
            label="SpecGraph authority"
            value={boolText(state.data.authorityBoundary.specgraphArtifactAuthority)}
          />
          <Meta
            label="Ontology writes"
            value={boolText(state.data.consumerBoundary.mayWriteOntologyPackage)}
          />
        </div>
        {activeIntent ? (
          <div className={styles.subRow}>
            <span>{activeIntent.id}</span>
            <Pill value={activeIntent.status} />
            <span className={styles.statusDetail}>
              {compact(activeIntent.reason, activeIntent.requestedBy)}
            </span>
          </div>
        ) : null}
        {showRequestButton ? (
          <div className={styles.draftControls}>
            <button
              className={styles.ackButton}
              type="button"
              disabled={!workflow.requestReady || pending}
              onClick={onRequest}
            >
              {pending ? "Requesting" : "Approve candidate for promotion review"}
            </button>
            <span className={styles.statusDetail}>
              Intent records operator approval only; Platform still owns promotion decision and Git Service execution.
            </span>
          </div>
        ) : null}
        {requestError ? (
          <span className={styles.statusDetail}>
            Candidate approval intent failed · {candidateApprovalIntentErrorText(requestError)}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function productRepairRerunStatus(
  execution: IdeaToSpecProductRepairRerunPlatformExecution["execution"],
  publication: IdeaToSpecProductRepairRerunPlatformExecution["publication"],
) {
  if (!execution.available) return "missing";
  if (!execution.ok) return "blocked";
  if (execution.dryRun) return "dry_run";
  if (!publication.available) return "publication_required";
  if (!publication.ok) return "publication_blocked";
  if (publication.dryRun) return "publication_dry_run";
  return "published";
}

function ClarificationRequestRow({
  request,
  repairTarget,
  draft,
  pending,
  saveError,
  onSave,
  readOnly,
}: {
  request: IdeaToSpecClarificationRequest;
  repairTarget: IdeaToSpecRepairTarget | undefined;
  draft: IdeaToSpecRepairDraft | undefined;
  pending: boolean;
  saveError: IdeaToSpecRepairDraftSaveError | null;
  onSave: (input: IdeaToSpecRepairDraftInput) => void;
  readOnly: boolean;
}) {
  const defaultAction = request.suggestedActions[0] ?? "";
  const ontologyGapRequest = request.kind === "ontology_gap";
  const productSpecGapRequest = isProductSpecRepairRequest(request);
  const [selectedAction, setSelectedAction] = useState(
    () => draft?.allowedAction ?? defaultAction,
  );
  const [draftText, setDraftText] = useState(() => repairDraftText(draft) ?? "");
  const [ontologyDraft, setOntologyDraft] = useState(() =>
    ontologyDraftFields(draft),
  );
  const [productSpecDraft, setProductSpecDraft] = useState(() =>
    productSpecDraftFields(draft, request, repairTarget),
  );

  useEffect(() => {
    setSelectedAction(draft?.allowedAction ?? defaultAction);
    setDraftText(repairDraftText(draft) ?? "");
    setOntologyDraft(ontologyDraftFields(draft));
    setProductSpecDraft(productSpecDraftFields(draft, request, repairTarget));
  }, [defaultAction, draft, request, repairTarget]);

  const structuredOntologyGapRequest =
    ontologyGapRequest && isStructuredOntologyGapAction(selectedAction);
  const structuredProductSpecRequest =
    productSpecGapRequest && isStructuredProductSpecAction(selectedAction);
  const answerValue = structuredOntologyGapRequest
    ? answerValueForOntologyGapAction(selectedAction, ontologyDraft)
    : structuredProductSpecRequest
      ? answerValueForProductSpecAction(selectedAction, productSpecDraft)
    : answerValueForDraftAction(selectedAction, draftText || ontologyDraft.term);
  const canSave =
    !!selectedAction &&
    (structuredOntologyGapRequest
      ? ontologyGapDraftCanSave(selectedAction, ontologyDraft)
      : structuredProductSpecRequest
        ? productSpecGapDraftCanSave(selectedAction, productSpecDraft)
      : draftText.trim().length > 0) &&
    !readOnly &&
    !pending;
  const productTarget = productSpecGapRequest
    ? productSpecRepairTarget(request, repairTarget)
    : null;
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{request.id}</span>
        <Pill value={request.status} />
      </div>
      <h3 className={styles.title}>{compact(request.question, request.kind)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Severity" value={request.severity} />
        <Meta label="Target" value={request.targetRef} />
        <Meta label="Target artifact" value={request.targetArtifact} />
        <Meta label="Actions" value={joined(request.suggestedActions)} />
        {productTarget ? (
          <>
            <Meta label="Repair target" value={productTarget.label} />
            <Meta label="Expected effect" value={productTarget.expectedEffect} />
          </>
        ) : null}
      </div>
      <form
        className={styles.draftForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave({
            requestId: request.id,
            action: selectedAction,
            answerValue,
            targetRef: request.targetRef,
            targetArtifact: request.targetArtifact,
          });
        }}
      >
        <div className={styles.draftControls}>
          <select
            className={styles.draftSelect}
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.currentTarget.value)}
            aria-label="Repair draft action"
            disabled={readOnly}
          >
            {request.suggestedActions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button className={styles.ackButton} type="submit" disabled={!canSave}>
            {pending ? "Saving" : draft ? "Update draft" : "Save draft"}
          </button>
        </div>
        {structuredOntologyGapRequest ? (
          <OntologyGapDraftFields
            action={selectedAction}
            fields={ontologyDraft}
            onChange={setOntologyDraft}
          />
        ) : structuredProductSpecRequest ? (
          <ProductSpecGapDraftFields
            action={selectedAction}
            fields={productSpecDraft}
            target={productTarget}
            onChange={setProductSpecDraft}
          />
        ) : (
          <textarea
            className={styles.draftTextarea}
            value={draftText}
            onChange={(event) => setDraftText(event.currentTarget.value)}
            placeholder={draftPlaceholder(selectedAction)}
            rows={3}
            aria-label="Repair draft value"
            readOnly={readOnly}
          />
        )}
        {structuredProductSpecRequest && productTarget ? (
          <span className={styles.statusDetail}>
            Expected rerun effect · {productTarget.expectedEffect}
          </span>
        ) : null}
        {draft ? (
          <span className={styles.statusDetail}>
            Draft saved · {draft.allowedAction.replace(/_/g, " ")} · {draft.updatedAt}
          </span>
        ) : null}
        {saveError ? (
          <span className={styles.statusDetail}>
            Draft save failed · {repairDraftSaveErrorText(saveError)}
          </span>
        ) : null}
      </form>
    </div>
  );
}

type OntologyGapDraftFieldState = {
  term: string;
  ontologyRef: string;
  aliasOf: string;
  reason: string;
};

type ProductSpecGapDraftFieldState = {
  resolutionIntent: string;
  answer: string;
  mechanism: string;
  owner: string;
  scope: string;
  riskDecision: string;
  mitigation: string;
  affectedRef: string;
  reason: string;
  followUp: string;
};

type ProductSpecRepairTarget = {
  kind: string;
  label: string;
  expectedEffect: string;
};

const STRUCTURED_ONTOLOGY_GAP_ACTIONS = new Set([
  "bind_existing_term",
  "alias",
  "propose_project_local_term",
  "reject",
  "defer",
]);

function isStructuredOntologyGapAction(action: string): boolean {
  return STRUCTURED_ONTOLOGY_GAP_ACTIONS.has(action);
}

const STRUCTURED_PRODUCT_SPEC_ACTIONS = new Set([
  "answer_question",
  "provide_candidate_context",
  "reject",
  "defer",
]);

function isStructuredProductSpecAction(action: string): boolean {
  return STRUCTURED_PRODUCT_SPEC_ACTIONS.has(action);
}

function isProductSpecRepairRequest(request: IdeaToSpecClarificationRequest): boolean {
  return request.kind !== "ontology_gap" && request.suggestedActions.some(isStructuredProductSpecAction);
}

function OntologyGapDraftFields({
  action,
  fields,
  onChange,
}: {
  action: string;
  fields: OntologyGapDraftFieldState;
  onChange: (fields: OntologyGapDraftFieldState) => void;
}) {
  const update =
    (key: keyof OntologyGapDraftFieldState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...fields, [key]: event.currentTarget.value });
  return (
    <div className={styles.ontologyDraftGrid}>
      {action !== "defer" ? (
        <label className={styles.draftField}>
          <span>Term</span>
          <input
            className={styles.draftInput}
            value={fields.term}
            onChange={update("term")}
            placeholder="Decision Record"
            aria-label="Ontology gap term"
          />
        </label>
      ) : null}
      {action === "bind_existing_term" ? (
        <label className={styles.draftField}>
          <span>Ontology ref</span>
          <input
            className={styles.draftInput}
            value={fields.ontologyRef}
            onChange={update("ontologyRef")}
            placeholder="ontology://specgraph-core/classes/Spec"
            aria-label="Existing ontology reference"
          />
        </label>
      ) : null}
      {action === "alias" ? (
        <label className={styles.draftField}>
          <span>Alias of</span>
          <input
            className={styles.draftInput}
            value={fields.aliasOf}
            onChange={update("aliasOf")}
            placeholder="Accepted Decision"
            aria-label="Accepted ontology term alias target"
          />
        </label>
      ) : null}
      {action === "reject" || action === "defer" ? (
        <label className={styles.draftField}>
          <span>Reason</span>
          <textarea
            className={styles.draftTextarea}
            value={fields.reason}
            onChange={update("reason")}
            placeholder="Reason"
            rows={3}
            aria-label="Ontology gap decision reason"
          />
        </label>
      ) : null}
    </div>
  );
}

function ProductSpecGapDraftFields({
  action,
  fields,
  target,
  onChange,
}: {
  action: string;
  fields: ProductSpecGapDraftFieldState;
  target: ProductSpecRepairTarget | null;
  onChange: (fields: ProductSpecGapDraftFieldState) => void;
}) {
  const update =
    (key: keyof ProductSpecGapDraftFieldState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange({ ...fields, [key]: event.currentTarget.value });
  if (action === "reject" || action === "defer") {
    return (
      <div className={styles.ontologyDraftGrid}>
        <label className={styles.draftField}>
          <span>{action === "reject" ? "Reject reason" : "Deferral reason"}</span>
          <textarea
            className={styles.draftTextarea}
            value={fields.reason}
            onChange={update("reason")}
            placeholder={action === "reject" ? "Why this gap is not valid" : "What must happen before this can be resolved"}
            rows={3}
            aria-label="Product gap decision reason"
          />
        </label>
        {action === "defer" ? (
          <label className={styles.draftField}>
            <span>Required follow-up</span>
            <input
              className={styles.draftInput}
              value={fields.followUp}
              onChange={update("followUp")}
              placeholder="Owner review, evidence, or product decision"
              aria-label="Product gap deferral follow-up"
            />
          </label>
        ) : null}
      </div>
    );
  }
  if (action === "answer_question") {
    return (
      <div className={styles.ontologyDraftGrid}>
        <label className={styles.draftField}>
          <span>Answer</span>
          <textarea
            className={styles.draftTextarea}
            value={fields.answer}
            onChange={update("answer")}
            placeholder="Answer the product/spec question with the bounded context needed for rerun."
            rows={3}
            aria-label="Product repair answer"
          />
        </label>
        <label className={styles.draftField}>
          <span>Affected ref</span>
          <input
            className={styles.draftInput}
            value={fields.affectedRef}
            onChange={update("affectedRef")}
            placeholder="candidate-spec..."
            aria-label="Affected product repair reference"
          />
        </label>
      </div>
    );
  }
  return (
    <div className={styles.ontologyDraftGrid}>
      <label className={styles.draftField}>
        <span>Resolution intent</span>
        <select
          className={styles.draftSelect}
          value={fields.resolutionIntent}
          onChange={update("resolutionIntent")}
          aria-label="Product gap resolution intent"
        >
          <option value="candidate_context_added">Add candidate context</option>
          <option value="enforcement_mechanism_added">Add enforcement mechanism</option>
          <option value="risk_accepted">Accept reviewed risk</option>
        </select>
      </label>
      <label className={styles.draftField}>
        <span>Mechanism / context</span>
        <textarea
          className={styles.draftTextarea}
          value={fields.mechanism}
          onChange={update("mechanism")}
          placeholder={target?.kind === "risk_requires_review" ? "Risk review decision and rationale" : "Concrete mechanism, validation, or policy context"}
          rows={3}
          aria-label="Product gap mechanism or context"
        />
      </label>
      <label className={styles.draftField}>
        <span>Owner</span>
        <input
          className={styles.draftInput}
          value={fields.owner}
          onChange={update("owner")}
          placeholder="Product owner, system owner, or operator"
          aria-label="Product gap owner"
        />
      </label>
      <label className={styles.draftField}>
        <span>Scope</span>
        <input
          className={styles.draftInput}
          value={fields.scope}
          onChange={update("scope")}
          placeholder="Workspace, subsystem, lifecycle phase"
          aria-label="Product gap scope"
        />
      </label>
      <label className={styles.draftField}>
        <span>Risk decision</span>
        <input
          className={styles.draftInput}
          value={fields.riskDecision}
          onChange={update("riskDecision")}
          placeholder="Accepted, mitigated, transferred, or not applicable"
          aria-label="Product gap risk decision"
        />
      </label>
      <label className={styles.draftField}>
        <span>Mitigation</span>
        <input
          className={styles.draftInput}
          value={fields.mitigation}
          onChange={update("mitigation")}
          placeholder="Mitigation or validation evidence"
          aria-label="Product gap mitigation"
        />
      </label>
    </div>
  );
}

function repairDraftStateDetail(
  state: Exclude<UseIdeaToSpecRepairDraftsState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace repair draft endpoint is unreachable from the browser.";
  }
  return state.message;
}

function repairRerunRequestStateDetail(
  state: Exclude<UseIdeaToSpecRepairRerunRequestsState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace repair rerun request endpoint is unreachable from the browser.";
  }
  return state.message;
}

function candidateApprovalIntentStateDetail(
  state: Exclude<UseIdeaToSpecCandidateApprovalIntentsState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace candidate approval intent endpoint is unreachable from the browser.";
  }
  return state.message;
}

function intakeClarificationAnswerStateDetail(
  state: Exclude<UseIdeaToSpecIntakeClarificationAnswersState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace intake clarification answer endpoint is unreachable from the browser.";
  }
  return state.message;
}

function intakeClarificationAnswerSaveErrorText(
  error: IdeaToSpecIntakeClarificationAnswerSaveError,
): string {
  if (error.kind === "http-error") return `HTTP ${error.status}: ${error.statusText}`;
  return "network error";
}

function intakeAnswerText(
  draft: IdeaToSpecIntakeClarificationAnswer | undefined,
  publishedAnswer: IdeaToSpecIntakeAnswer | undefined,
): string | null {
  const value = draft?.value;
  if (value) {
    if (Array.isArray(value.refs)) {
      return value.refs.filter((item): item is string => typeof item === "string").join(", ");
    }
    if (Array.isArray(value.entries)) {
      return value.entries.filter((item): item is string => typeof item === "string").join("\n");
    }
    if (typeof value.text === "string") return value.text;
    if (typeof value.answer === "string") return value.answer;
    if (typeof value.context === "string") return value.context;
    if (typeof value.reason === "string") return value.reason;
    if (typeof value.follow_up === "string") return value.follow_up;
    if (Array.isArray(value.terms)) {
      return value.terms.filter((item): item is string => typeof item === "string").join("\n");
    }
    if (typeof value.term === "string") return value.term;
  }
  if (publishedAnswer) {
    if (publishedAnswer.refs.length > 0) return publishedAnswer.refs.join(", ");
    if (publishedAnswer.entries.length > 0) return publishedAnswer.entries.join("\n");
    return publishedAnswer.text;
  }
  return null;
}

function splitIntakeAnswerList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function intakeClarificationValueForRequest(
  request: IdeaToSpecClarificationRequest,
  action: string,
  text: string,
): Record<string, unknown> {
  const value = text.trim();
  if (action === "reject" || action === "defer" || action === "defer_candidate") {
    return { reason: value };
  }
  const haystack = `${request.id} ${request.targetRef ?? ""} ${request.question ?? ""}`.toLowerCase();
  if (haystack.includes("actors") || haystack.includes("domain-events") || haystack.includes("domain_events") || haystack.includes("commands") || haystack.includes("constraints")) {
    return { entries: splitIntakeAnswerList(value) };
  }
  if (haystack.includes("refs") || haystack.includes("ontology") || haystack.includes("domain") || haystack.includes("context") || haystack.includes("applicability")) {
    return { refs: splitIntakeAnswerList(value) };
  }
  return { text: value };
}

function intakeClarificationValueForTemplate(
  target: IdeaToSpecRealIdeaAnswerTarget,
  action: string,
  text: string,
): Record<string, unknown> {
  const trimmed = text.trim();
  const required = intakeClarificationRequiredFields(target, action);
  const value: Record<string, unknown> = {};
  for (const field of required) {
    if (field === "value.refs[]" || field === "value.refs") {
      value.refs = splitIntakeAnswerList(trimmed);
    }
    if (field === "value.entries[]" || field === "value.entries") {
      value.entries = splitIntakeAnswerList(trimmed);
    }
    if (field === "value.terms[]" || field === "value.terms") {
      value.terms = splitIntakeAnswerList(trimmed);
    }
    if (field === "value.reason") value.reason = trimmed;
    if (field === "value.follow_up") value.follow_up = trimmed;
    if (field === "value.context") value.context = trimmed;
    if (field === "value.term") value.term = trimmed;
    if (field === "value.answer") value.answer = trimmed;
  }
  if (Object.keys(value).length > 0) return value;
  const template = target.valueTemplatesByAction[action];
  if (template && typeof template === "object" && !Array.isArray(template)) {
    const keys = Object.keys(template as Record<string, unknown>);
    if (keys.includes("answer")) return { answer: trimmed };
    if (keys.includes("context")) return { context: trimmed };
    if (keys.includes("refs")) return { refs: splitIntakeAnswerList(trimmed) };
    if (keys.includes("entries")) return { entries: splitIntakeAnswerList(trimmed) };
    if (keys.includes("terms")) return { terms: splitIntakeAnswerList(trimmed) };
    if (keys.includes("term")) return { term: trimmed };
    if (keys.includes("follow_up")) return { follow_up: trimmed };
  }
  return intakeClarificationValueForRequest(
    {
      id: target.requestId,
      kind: target.requestKind ?? target.targetType,
      severity: target.severity,
      status: target.status,
      targetRef: target.targetRef,
      targetArtifact: target.targetArtifact,
      question: target.question,
      suggestedActions: target.acceptedActions,
    },
    action,
    text,
  );
}

function intakeClarificationRequiredFields(
  target: IdeaToSpecRealIdeaAnswerTarget,
  action: string,
): string[] {
  const required = target.requiredFieldsByAction[action] ?? [];
  const template = target.valueTemplatesByAction[action];
  if (
    !required.includes("value") ||
    !template ||
    typeof template !== "object" ||
    Array.isArray(template)
  ) {
    return [...required];
  }
  const expanded = Object.entries(template as Record<string, unknown>).flatMap(
    ([key, item]) => (Array.isArray(item) ? [`value.${key}[]`] : [`value.${key}`]),
  );
  if (expanded.length === 0) return [...required];
  return required.flatMap((field) => (field === "value" ? expanded : [field]));
}

function intakeClarificationTemplateValueIsComplete(
  requiredFields: readonly string[],
  value: Record<string, unknown>,
): boolean {
  if (!requiredFields.length) {
    return Object.values(value).some(templateFieldValueIsPresent);
  }
  return requiredFields.every((field) => {
    if (field === "value") return Object.values(value).some(templateFieldValueIsPresent);
    if (!field.startsWith("value.")) return true;
    const key = field.replace(/^value\./, "").replace(/\[\]$/, "");
    if (key === "context") {
      return templateFieldValueIsPresent(value.context) || templateFieldValueIsPresent(value.text);
    }
    if (key === "answer") {
      return templateFieldValueIsPresent(value.answer) || templateFieldValueIsPresent(value.text);
    }
    return templateFieldValueIsPresent(value[key]);
  });
}

function templateFieldValueIsPresent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(templateFieldValueIsPresent);
  if (value && typeof value === "object") {
    return Object.values(value).some(templateFieldValueIsPresent);
  }
  return value !== null && value !== undefined && value !== false;
}

function intakeClarificationPlaceholder(request: IdeaToSpecClarificationRequest): string {
  const haystack = `${request.id} ${request.targetRef ?? ""} ${request.question ?? ""}`.toLowerCase();
  if (haystack.includes("actors") || haystack.includes("domain-events") || haystack.includes("domain_events") || haystack.includes("commands") || haystack.includes("constraints")) {
    return "One entry per line";
  }
  if (haystack.includes("refs") || haystack.includes("ontology") || haystack.includes("domain") || haystack.includes("context") || haystack.includes("applicability")) {
    return "Comma-separated refs";
  }
  return "Bounded answer for intake rerun";
}

function answerValueForDraftAction(
  action: string,
  text: string,
): Record<string, unknown> {
  const value = text.trim();
  if (action === "bind_existing_term") return { ontology_ref: value };
  if (action === "alias") return { alias_of: value };
  if (action === "propose_project_local_term") {
    return {
      terms: value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
      term_scope: "project_local",
    };
  }
  if (action === "reject" || action === "defer") return { reason: value };
  return { text: value };
}

function answerValueForOntologyGapAction(
  action: string,
  fields: OntologyGapDraftFieldState,
): Record<string, unknown> {
  const term = fields.term.trim();
  const ontologyRef = fields.ontologyRef.trim();
  const aliasOf = fields.aliasOf.trim();
  const reason = fields.reason.trim();
  if (action === "bind_existing_term") {
    return { term, ontology_ref: ontologyRef };
  }
  if (action === "alias") return { term, alias_of: aliasOf };
  if (action === "propose_project_local_term") {
    return {
      terms: ontologyGapDraftTerms(term),
      term_scope: "project_local",
    };
  }
  if (action === "reject") return { term, reason };
  if (action === "defer") return { reason };
  return { text: reason || term };
}

function answerValueForProductSpecAction(
  action: string,
  fields: ProductSpecGapDraftFieldState,
): Record<string, unknown> {
  if (action === "answer_question") {
    return {
      text: fields.answer.trim(),
      affected_ref: fields.affectedRef.trim(),
    };
  }
  if (action === "reject") {
    return { reason: fields.reason.trim() };
  }
  if (action === "defer") {
    return {
      reason: fields.reason.trim(),
      follow_up: fields.followUp.trim(),
    };
  }
  const structured: Record<string, string> = {
    resolution_intent: fields.resolutionIntent.trim(),
    mechanism: fields.mechanism.trim(),
    owner: fields.owner.trim(),
    scope: fields.scope.trim(),
    risk_decision: fields.riskDecision.trim(),
    mitigation: fields.mitigation.trim(),
    affected_ref: fields.affectedRef.trim(),
  };
  const text = productSpecDraftTextSummary(structured);
  return {
    text,
    ...structured,
  };
}

function productSpecDraftTextSummary(value: Record<string, string>): string {
  const labels: Record<string, string> = {
    resolution_intent: "Resolution",
    mechanism: "Mechanism",
    owner: "Owner",
    scope: "Scope",
    risk_decision: "Risk decision",
    mitigation: "Mitigation",
    affected_ref: "Affected ref",
  };
  return Object.entries(value)
    .filter(([, item]) => item.trim().length > 0)
    .map(([key, item]) => `${labels[key] ?? key}: ${item}`)
    .join("; ");
}

function ontologyGapDraftTerms(term: string): string[] {
  return term
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ontologyGapDraftCanSave(
  action: string,
  fields: OntologyGapDraftFieldState,
): boolean {
  const term = fields.term.trim();
  if (action === "bind_existing_term") {
    return term.length > 0 && fields.ontologyRef.trim().length > 0;
  }
  if (action === "alias") {
    return term.length > 0 && fields.aliasOf.trim().length > 0;
  }
  if (action === "propose_project_local_term") {
    return ontologyGapDraftTerms(term).length > 0;
  }
  if (action === "reject" || action === "defer") {
    return fields.reason.trim().length > 0;
  }
  return term.length > 0 || fields.reason.trim().length > 0;
}

function productSpecGapDraftCanSave(
  action: string,
  fields: ProductSpecGapDraftFieldState,
): boolean {
  if (action === "answer_question") {
    return fields.answer.trim().length > 0;
  }
  if (action === "reject") {
    return fields.reason.trim().length > 0;
  }
  if (action === "defer") {
    return fields.reason.trim().length > 0;
  }
  return (
    fields.mechanism.trim().length > 0 ||
    fields.riskDecision.trim().length > 0 ||
    fields.mitigation.trim().length > 0 ||
    fields.owner.trim().length > 0 ||
    fields.scope.trim().length > 0
  );
}

function ontologyDraftFields(
  draft: IdeaToSpecRepairDraft | undefined,
): OntologyGapDraftFieldState {
  const value = draft?.answerValue ?? {};
  const terms = Array.isArray(value.terms)
    ? value.terms.filter((item): item is string => typeof item === "string")
    : [];
  return {
    term:
      typeof value.term === "string"
        ? value.term
        : terms.length > 0
          ? terms.join(", ")
          : "",
    ontologyRef: typeof value.ontology_ref === "string" ? value.ontology_ref : "",
    aliasOf: typeof value.alias_of === "string" ? value.alias_of : "",
    reason: typeof value.reason === "string" ? value.reason : "",
  };
}

function productSpecDraftFields(
  draft: IdeaToSpecRepairDraft | undefined,
  request: IdeaToSpecClarificationRequest,
  repairTarget: IdeaToSpecRepairTarget | undefined,
): ProductSpecGapDraftFieldState {
  const value = draft?.answerValue ?? {};
  const target = productSpecRepairTarget(request, repairTarget);
  const text = typeof value.text === "string" ? value.text : "";
  const hasStructuredContext =
    typeof value.mechanism === "string" ||
    typeof value.owner === "string" ||
    typeof value.scope === "string" ||
    typeof value.risk_decision === "string" ||
    typeof value.mitigation === "string";
  return {
    resolutionIntent:
      typeof value.resolution_intent === "string" && value.resolution_intent.length > 0
        ? value.resolution_intent
        : target.defaultIntent,
    answer: text,
    mechanism:
      typeof value.mechanism === "string"
        ? value.mechanism
        : draft?.allowedAction === "provide_candidate_context" &&
            text.length > 0 &&
            !hasStructuredContext
          ? text
          : "",
    owner: typeof value.owner === "string" ? value.owner : "",
    scope: typeof value.scope === "string" ? value.scope : "",
    riskDecision: typeof value.risk_decision === "string" ? value.risk_decision : "",
    mitigation: typeof value.mitigation === "string" ? value.mitigation : "",
    affectedRef:
      typeof value.affected_ref === "string"
        ? value.affected_ref
        : request.targetRef ?? "",
    reason: typeof value.reason === "string" ? value.reason : "",
    followUp: typeof value.follow_up === "string" ? value.follow_up : "",
  };
}

function repairDraftText(draft: IdeaToSpecRepairDraft | undefined): string | null {
  if (!draft) return null;
  const value = draft.answerValue;
  if (typeof value.ontology_ref === "string") return value.ontology_ref;
  if (typeof value.alias_of === "string") return value.alias_of;
  if (typeof value.reason === "string") return value.reason;
  if (Array.isArray(value.terms)) {
    return value.terms.filter((item): item is string => typeof item === "string").join(", ");
  }
  if (typeof value.text === "string") return value.text;
  return null;
}

function productSpecRepairTarget(
  request: IdeaToSpecClarificationRequest,
  repairTarget: IdeaToSpecRepairTarget | undefined,
): ProductSpecRepairTarget & { defaultIntent: string } {
  if (repairTarget) {
    return {
      kind: repairTarget.kind,
      label: repairTarget.label,
      expectedEffect: repairTarget.expectedEffect,
      defaultIntent: productSpecDefaultIntent(repairTarget.expectedEffect),
    };
  }
  const haystack = [
    request.kind,
    request.id,
    request.targetRef ?? "",
    request.question ?? "",
  ].join(" ").toLowerCase();
  if (haystack.includes("risk")) {
    return {
      kind: "risk_requires_review",
      label: "Risk review",
      expectedEffect: "risk_accepted",
      defaultIntent: "risk_accepted",
    };
  }
  if (haystack.includes("enforcement")) {
    return {
      kind: "missing_enforcement_mechanism",
      label: "Enforcement mechanism",
      expectedEffect: "enforcement_mechanism_added",
      defaultIntent: "enforcement_mechanism_added",
    };
  }
  if (haystack.includes("required-field") || haystack.includes("required field")) {
    return {
      kind: "missing_required_fields",
      label: "Required fields",
      expectedEffect: "candidate_context_added",
      defaultIntent: "candidate_context_added",
    };
  }
  if (haystack.includes("policy") || haystack.includes("validation")) {
    return {
      kind: "policy_or_validation_gap",
      label: "Policy / validation",
      expectedEffect: "candidate_context_added",
      defaultIntent: "candidate_context_added",
    };
  }
  if (haystack.includes("constraint")) {
    return {
      kind: "ambiguous_product_constraint",
      label: "Product constraint",
      expectedEffect: "candidate_context_added",
      defaultIntent: "candidate_context_added",
    };
  }
  return {
    kind: "unknown",
    label: "Product/spec gap",
    expectedEffect: "candidate_context_added",
    defaultIntent: "candidate_context_added",
  };
}

function productSpecDefaultIntent(expectedEffect: string): string {
  if (expectedEffect === "risk_accepted") return "risk_accepted";
  if (expectedEffect === "enforcement_mechanism_added") {
    return "enforcement_mechanism_added";
  }
  return "candidate_context_added";
}

function draftPlaceholder(action: string): string {
  if (action === "bind_existing_term") return "ontology://...";
  if (action === "alias") return "accepted term";
  if (action === "propose_project_local_term") return "Project-local term";
  if (action === "reject" || action === "defer") return "Reason";
  return "Draft answer";
}

function repairDraftSaveErrorText(error: IdeaToSpecRepairDraftSaveError): string {
  if (error.kind === "http-error") return `HTTP ${error.status}: ${error.statusText}`;
  return "network error";
}

function projectLocalDecisionText(
  savedDecision: ProjectLocalOntologyReviewDecision | undefined,
  action: string,
): string {
  if (savedDecision?.reviewAction !== action) return "";
  const value = savedDecision?.decisionValue ?? {};
  if (typeof value.ontology_ref === "string") return value.ontology_ref;
  if (typeof value.alias_of === "string") return value.alias_of;
  if (typeof value.reason === "string") return value.reason;
  if (typeof value.text === "string") return value.text;
  if (typeof value.term === "string" && action !== "keep_project_local") {
    return value.term;
  }
  return "";
}

function projectLocalActionLabel(action: string): string {
  switch (action) {
    case "keep_project_local":
      return "Keep project-local";
    case "bind_existing":
      return "Bind existing";
    case "alias":
      return "Alias";
    case "request_workspace_promotion":
      return "Request workspace promotion";
    case "reject":
      return "Reject";
    case "defer":
      return "Defer";
    default:
      return action.replace(/_/g, " ");
  }
}

function projectLocalDecisionValue(
  term: IdeaToSpecProjectLocalOntologyTerm,
  action: string,
  text: string,
): Record<string, unknown> {
  const value = text.trim();
  const termText = compact(term.term, term.termKey);
  if (action === "keep_project_local") {
    return { term: termText, reason: value };
  }
  if (action === "bind_existing") return { term: termText, ontology_ref: value };
  if (action === "alias") return { term: termText, alias_of: value };
  if (action === "request_workspace_promotion") {
    return { term: termText, reason: value, promotion_scope: "workspace" };
  }
  if (action === "reject" || action === "defer") {
    return { term: termText, reason: value };
  }
  return { term: termText, text: value };
}

function projectLocalDecisionValueIsComplete(
  action: string,
  value: Record<string, unknown>,
): boolean {
  if (action === "keep_project_local") return typeof value.term === "string";
  if (action === "bind_existing") {
    return typeof value.ontology_ref === "string" && value.ontology_ref.trim().length > 0;
  }
  if (action === "alias") {
    return typeof value.alias_of === "string" && value.alias_of.trim().length > 0;
  }
  if (action === "reject" || action === "defer" || action === "request_workspace_promotion") {
    return typeof value.reason === "string" && value.reason.trim().length > 0;
  }
  return Object.values(value).some(templateFieldValueIsPresent);
}

function projectLocalDecisionFieldLabel(action: string): string {
  if (action === "bind_existing") return "Accepted ontology ref";
  if (action === "alias") return "Accepted alias target";
  if (action === "request_workspace_promotion") return "Promotion review reason";
  if (action === "reject") return "Rejection reason";
  if (action === "defer") return "Follow-up reason";
  if (action === "keep_project_local") return "Project-local rationale";
  return "Review note";
}

function projectLocalDecisionHint(action: string): string {
  if (action === "bind_existing") {
    return "stores term plus ontology_ref for an existing accepted ontology term";
  }
  if (action === "alias") {
    return "stores term plus alias_of without accepting a new ontology term";
  }
  if (action === "request_workspace_promotion") {
    return "requests later owner review but does not write an ontology package";
  }
  if (action === "reject") {
    return "marks this as not a project ontology term for the candidate review";
  }
  if (action === "defer") {
    return "keeps the term unresolved until a later owner review";
  }
  if (action === "keep_project_local") {
    return "keeps the term local to this candidate/workspace";
  }
  return "stores operator intent for SpecGraph import preview";
}

function projectLocalDecisionPreview(
  term: IdeaToSpecProjectLocalOntologyTerm,
  action: string,
  value: Record<string, unknown>,
): string {
  const termText = compact(term.term, term.termKey);
  if (action === "bind_existing") {
    const ontologyRef =
      typeof value.ontology_ref === "string" && value.ontology_ref.trim().length > 0
        ? value.ontology_ref.trim()
        : "required";
    return `Will save term "${termText}" with ontology_ref "${ontologyRef}".`;
  }
  if (action === "alias") {
    const aliasOf =
      typeof value.alias_of === "string" && value.alias_of.trim().length > 0
        ? value.alias_of.trim()
        : "required";
    return `Will save term "${termText}" with alias_of "${aliasOf}".`;
  }
  if (action === "request_workspace_promotion") {
    return `Will request workspace-level review for "${termText}".`;
  }
  if (action === "reject") {
    return `Will reject "${termText}" for this candidate ontology review.`;
  }
  if (action === "defer") {
    return `Will keep "${termText}" open as deferred follow-up.`;
  }
  if (action === "keep_project_local") {
    return `Will keep "${termText}" project-local for this candidate.`;
  }
  return `Will save operator note for "${termText}".`;
}

function projectLocalDecisionPlaceholder(action: string): string {
  if (action === "keep_project_local") return "Optional reason for keeping this term project-local";
  if (action === "bind_existing") return "ontology://.../classes/AcceptedTerm";
  if (action === "alias") return "Accepted term to alias";
  if (action === "request_workspace_promotion") return "Reason to review this term for workspace ontology promotion";
  if (action === "reject") return "Reason this is not a domain term";
  if (action === "defer") return "Reason or follow-up owner review needed";
  return "Review note";
}

function projectLocalOntologyDecisionStateDetail(
  state: Exclude<UseProjectLocalOntologyReviewDecisionState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace project-local ontology decision endpoint is unreachable from the browser.";
  }
  return state.message;
}

function projectLocalOntologyDecisionErrorText(
  error: ProjectLocalOntologyReviewDecisionSaveError,
): string {
  if (error.kind === "http-error") return `HTTP ${error.status}: ${error.statusText}`;
  return "network error";
}

function repairRerunRequestErrorText(error: IdeaToSpecRepairRerunRequestError): string {
  if (error.kind === "http-error") return `HTTP ${error.status}: ${error.statusText}`;
  return "network error";
}

function candidateApprovalIntentErrorText(
  error: IdeaToSpecCandidateApprovalIntentError,
): string {
  if (error.kind === "http-error") return `HTTP ${error.status}: ${error.statusText}`;
  return "network error";
}

function OntologyDecisionRow({
  decision,
}: {
  decision: IdeaToSpecOntologyDecision;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{decision.id}</span>
        <Pill value={decision.decisionType} />
      </div>
      <h3 className={styles.title}>{compact(decision.term, "ontology decision")}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Status" value={decision.status} />
        <Meta label="Ontology ref" value={decision.ontologyRef} />
        <Meta label="Alias of" value={decision.aliasOf} />
        <Meta label="Target" value={decision.targetRef} />
        <Meta label="Intent" value={decision.materializationIntent} />
      </div>
    </div>
  );
}

function ResolvedGapRow({ gap }: { gap: IdeaToSpecResolvedOntologyGap }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{gap.gapId}</span>
        <Pill value={compact(gap.decision, "resolved")} />
      </div>
      <h3 className={styles.title}>{compact(gap.term, "Resolved ontology gap")}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Node" value={gap.nodeId} />
        <Meta label="Source" value={gap.sourceRef} />
        <Meta label="Target" value={gap.targetRef} />
      </div>
    </div>
  );
}

function MaterializationSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const materialization = state.data.materialization;
  const request = materialization.promotionRequest;
  return (
    <section id="idea-to-spec-materialization" className={styles.reviewSection}>
      <SectionHeader
        title="Promotion preview"
        count={materialization.files.length}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Ready"
          value={boolText(materialization.readiness.ready)}
        />
        <PostureItem
          label="Review state"
          value={compact(materialization.readiness.reviewState)}
        />
        <PostureItem
          label="Source"
          value={compact(materialization.materializationSource)}
        />
        <PostureItem
          label="Platform request"
          value={compact(request.platformArtifactKind)}
        />
      </div>
      {materialization.files.length === 0 ? (
        <Status
          label="No materialized candidate specs"
          detail="Candidate materialization report is missing or empty."
        />
      ) : null}
      {materialization.files.map((file) => (
        <MaterializedFileRow key={file.path} file={file} />
      ))}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Platform handoff</span>
          <Pill value={compact(request.pathArgument, "--path")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Promotion paths" value={joined(request.paths)} />
          <Meta label="Next" value={materialization.readiness.nextArtifact} />
        </div>
      </div>
    </section>
  );
}

function MaterializedFileRow({ file }: { file: IdeaToSpecMaterializedFile }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{file.materializedId}</span>
        <Pill value="review-only" />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Candidate node" value={file.candidateNodeId} />
        <Meta label="Preview path" value={file.path} />
        <Meta label="Promotion path" value={file.promotionPath} />
      </div>
    </div>
  );
}

function PromotionGateSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const gate = state.data.promotionGate;
  const request = gate.promotionRequest;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Promotion gate" count={gate.findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(gate.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(gate.readiness.reviewState)}
        />
        <PostureItem
          label="Blocked by"
          value={joined(gate.readiness.blockedBy)}
        />
        <PostureItem
          label="Promotion paths"
          value={String(request.paths.length)}
        />
      </div>
      {gate.findings.length === 0 ? (
        <Status
          label="Promotion gate clear"
          detail={compact(gate.readiness.nextArtifact, "Platform handoff ready.")}
        />
      ) : null}
      {gate.findings.map((finding, index) => (
        <div key={findingKey(finding, index)} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Gate handoff</span>
          <Pill value={compact(request.pathArgument, "--path")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Platform request" value={request.platformArtifactKind} />
          <Meta label="Promotion paths" value={joined(request.paths)} />
          <Meta label="Next" value={gate.readiness.nextArtifact} />
        </div>
      </div>
    </section>
  );
}

function ControlledPromotionSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const promotion = state.data.controlledPromotion;
  const approvalExecution = promotion.candidateApprovalExecution;
  const approval = promotion.candidateApproval;
  const request = promotion.platformRequest;
  const productExecution = promotion.productPromotionExecution;
  const execution = promotion.gitServiceExecution;
  const reviewStatus = promotion.reviewStatus;
  const readModel = promotion.readModelPublication;
  const finalization = promotion.promotionFinalization;
  const gitOperationCount =
    productExecution.gitServiceOperations.length +
    execution.operations.length +
    finalization.operations.length;
  const promotionOperationCount = productExecution.operations.length;
  const postReviewOperationCount =
    reviewStatus.operations.length + readModel.operations.length;
  const operationCount =
    approvalExecution.operations.length +
    promotionOperationCount +
    gitOperationCount +
    postReviewOperationCount;
  return (
    <section
      id="idea-to-spec-controlled-promotion"
      className={styles.reviewSection}
    >
      <SectionHeader
        title="Controlled promotion"
        count={operationCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Inspect only" value={boolText(promotion.actionBoundary.inspectOnly)} />
        <PostureItem label="Execute" value={boolText(promotion.actionBoundary.mayExecuteGitService)} />
        <PostureItem label="Commit" value={boolText(promotion.actionBoundary.mayCreateBranchOrCommit)} />
        <PostureItem label="Merge" value={boolText(promotion.actionBoundary.mayMergeReview)} />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Candidate approval execution</span>
          <Pill
            value={
              approvalExecution.available
                ? !approvalExecution.ok
                  ? "blocked"
                  : approvalExecution.dryRun
                    ? "dry_run"
                    : "ok"
                : "missing"
            }
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Status" value={approvalExecution.status} />
          <Meta label="Candidate" value={approvalExecution.candidateId} />
          <Meta label="Workspace" value={approvalExecution.workspaceId} />
          <Meta label="Gate ready" value={boolText(approvalExecution.gateReady)} />
          <Meta
            label="Decision written"
            value={boolText(approvalExecution.decisionWritten)}
          />
          <Meta label="Dry run" value={boolText(approvalExecution.dryRun)} />
          <Meta label="Approved paths" value={String(approvalExecution.approvedPathCount)} />
          <Meta label="Gate report" value={approvalExecution.gateReportRef} />
          <Meta
            label="Decision ref"
            value={approvalExecution.candidateApprovalDecisionRef}
          />
          <Meta label="Intent" value={approvalExecution.approvalIntentRef} />
          <Meta label="Errors" value={String(approvalExecution.errorCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Candidate approval</span>
          <Pill value={approval.available ? (approval.ready ? "approved" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={approval.candidateId} />
          <Meta label="Decision" value={approval.decisionState} />
          <Meta label="Review state" value={approval.reviewState} />
          <Meta label="Operator" value={approval.operatorRef} />
          <Meta label="Reason" value={approval.reason} />
          <Meta label="Promotion paths" value={joined(approval.promotionPaths)} />
          <Meta label="Blocked by" value={joined(approval.blockedBy)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Platform promotion request</span>
          <Pill value={request.available ? (request.ok ? "ready" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={request.candidateId} />
          <Meta label="Branch" value={request.candidateBranch} />
          <Meta label="Base" value={request.review.baseBranch} />
          <Meta label="Title" value={request.review.title} />
          <Meta label="Commit paths" value={joined(request.commitPaths)} />
          <Meta label="Operations" value={joined(request.requestedOperations)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Product promotion execution</span>
          <Pill
            value={
              productExecution.available
                ? !productExecution.ok || productExecution.errorCount > 0
                  ? "blocked"
                  : productExecution.dryRun || productExecution.openReviewDryRun
                    ? "dry_run"
                    : "ok"
                : "missing"
            }
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Status" value={productExecution.status} />
          <Meta label="Candidate" value={productExecution.candidateId} />
          <Meta label="Branch" value={productExecution.candidateBranch} />
          <Meta label="Commit" value={productExecution.commitSha} />
          <Meta label="Review URL" value={productExecution.reviewUrl} />
          <Meta label="Review #" value={productExecution.reviewNumber ? String(productExecution.reviewNumber) : null} />
          <Meta label="Workspace" value={productExecution.workspaceDir} />
          <Meta label="Dry run" value={boolText(productExecution.dryRun)} />
          <Meta label="Open review dry run" value={boolText(productExecution.openReviewDryRun)} />
          <Meta label="Worktree" value={boolText(productExecution.worktreePrepared)} />
          <Meta label="Commit created" value={boolText(productExecution.commitCreated)} />
          <Meta label="Copied files" value={String(productExecution.copiedFileCount)} />
          <Meta label="Completed ops" value={String(productExecution.completedOperationCount)} />
          <Meta label="Errors" value={String(productExecution.errorCount)} />
          <Meta label="Diagnostics" value={String(productExecution.diagnosticCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Git Service execution</span>
          <Pill value={execution.available ? (execution.ok ? "ok" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={execution.candidateId} />
          <Meta label="Ref" value={execution.candidateRef} />
          <Meta label="Workspace" value={execution.workspaceDir} />
          <Meta label="Dry run" value={boolText(execution.dryRun)} />
          <Meta label="Open review dry run" value={boolText(execution.openReviewDryRun)} />
          <Meta label="Copied files" value={String(execution.copiedFileCount)} />
          <Meta label="Completed ops" value={String(execution.completedOperationCount)} />
          <Meta label="Errors" value={String(execution.errorCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Review status</span>
          <Pill
            value={
              reviewStatus.available
                ? !reviewStatus.ok
                  ? "blocked"
                  : reviewStatus.reviewMerged
                    ? "merged"
                    : compact(reviewStatus.reviewState, "open")
                : "missing"
            }
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Source" value={reviewStatus.sourceMode} />
          <Meta label="Status" value={reviewStatus.status} />
          <Meta label="Next" value={reviewStatus.nextAction} />
          <Meta label="Candidate" value={reviewStatus.candidateId} />
          <Meta label="Branch" value={reviewStatus.candidateBranch} />
          <Meta label="State" value={reviewStatus.reviewState} />
          <Meta label="Decision" value={reviewStatus.reviewDecision} />
          <Meta label="URL" value={reviewStatus.reviewUrl} />
          <Meta
            label="Review #"
            value={reviewStatus.reviewNumber ? String(reviewStatus.reviewNumber) : null}
          />
          <Meta label="Base" value={reviewStatus.baseBranch} />
          <Meta label="Head" value={reviewStatus.headBranch} />
          <Meta label="Merged" value={boolText(reviewStatus.reviewMerged)} />
          <Meta label="Merged at" value={reviewStatus.mergedAt} />
          <Meta label="Merge commit" value={reviewStatus.mergeCommit} />
          <Meta
            label="Product execution"
            value={reviewStatus.promotionExecutionReportRef}
          />
          <Meta
            label="Child review report"
            value={reviewStatus.graphRepositoryReviewStatusReportRef}
          />
          <Meta label="Operations" value={String(reviewStatus.operationCount)} />
          <Meta label="Errors" value={String(reviewStatus.errorCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Read-model publication</span>
          <Pill
            value={
              readModel.available
                ? !readModel.ok
                  ? "blocked"
                  : readModel.dryRun
                    ? "dry_run"
                    : readModel.published || readModel.readModelPublished
                      ? "published"
                      : compact(readModel.status, "review_required")
                : finalization.readModelPublished
                  ? "published"
                  : "missing"
            }
          />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Source" value={readModel.sourceMode} />
          <Meta label="Status" value={readModel.status} />
          <Meta label="Next" value={readModel.nextAction} />
          <Meta label="Candidate" value={readModel.candidateId} />
          <Meta label="Branch" value={readModel.candidateBranch} />
          <Meta label="Review" value={readModel.reviewState ?? finalization.reviewState} />
          <Meta
            label="Published"
            value={boolText(
              readModel.published ||
                readModel.readModelPublished ||
                finalization.readModelPublished,
            )}
          />
          <Meta label="Dry run" value={boolText(readModel.dryRun || finalization.dryRun)} />
          <Meta label="Manifest" value={readModel.manifest} />
          <Meta label="Manifest name" value={readModel.manifestName} />
          <Meta label="Bundle" value={readModel.bundleDir} />
          <Meta label="Output" value={readModel.outputDir} />
          <Meta label="Files" value={String(readModel.fileCount)} />
          <Meta
            label="Product review"
            value={readModel.productReviewStatusReportRef}
          />
          <Meta
            label="Child review report"
            value={readModel.graphRepositoryReviewStatusReportRef}
          />
          <Meta
            label="Child publish report"
            value={readModel.graphRepositoryPublishReadModelReportRef}
          />
          <Meta label="Operations" value={String(readModel.operationCount)} />
          <Meta label="Finalization ops" value={String(finalization.operationCount)} />
          <Meta label="Errors" value={String(readModel.errorCount + finalization.errorCount)} />
        </div>
      </div>
      {gitOperationCount === 0 ? (
        <Status
          label="No Git Service execution"
          detail="Promotion can be inspected here after Platform publishes the execution report."
        />
      ) : null}
      {approvalExecution.operations.map((operation) => (
        <div key={`candidate-approval.${operation.name}`} className={styles.subRow}>
          <span>{operation.name}</span>
          <Pill value={operation.status} />
          <span className={styles.statusDetail}>
            {compact(operation.reason, joined(operation.evidence))}
          </span>
        </div>
      ))}
      {approvalExecution.outputArtifacts.map((artifact) => (
        <div key={`candidate-approval-artifact.${artifact.key}`} className={styles.subRow}>
          <span>{artifact.key}</span>
          <Pill value={artifact.ready ? "ready" : artifact.present ? "present" : "missing"} />
          <span className={styles.statusDetail}>
            {artifact.path ?? compact(artifact.artifactKind)}
          </span>
        </div>
      ))}
      {productExecution.operations.map((operation) => (
        <div key={`product-promotion.${operation.name}`} className={styles.subRow}>
          <span>{operation.name}</span>
          <Pill value={operation.status} />
          <span className={styles.statusDetail}>
            {compact(operation.reason, joined(operation.evidence))}
          </span>
        </div>
      ))}
      {reviewStatus.operations.map((operation) => (
        <div key={`product-review-status.${operation.name}`} className={styles.subRow}>
          <span>{operation.name}</span>
          <Pill value={operation.status} />
          <span className={styles.statusDetail}>
            {compact(operation.reason, joined(operation.evidence))}
          </span>
        </div>
      ))}
      {readModel.operations.map((operation) => (
        <div key={`product-read-model.${operation.name}`} className={styles.subRow}>
          <span>{operation.name}</span>
          <Pill value={operation.status} />
          <span className={styles.statusDetail}>
            {compact(operation.reason, joined(operation.evidence))}
          </span>
        </div>
      ))}
      {productExecution.gitServiceOperations.map((operation) => (
        <GitServiceOperationRow
          key={`product-promotion-git.${operation.name}`}
          operation={operation}
        />
      ))}
      {execution.operations.map((operation) => (
        <GitServiceOperationRow key={operation.name} operation={operation} />
      ))}
      {finalization.operations.map((operation) => (
        <GitServiceOperationRow key={`finalization.${operation.name}`} operation={operation} />
      ))}
    </section>
  );
}

function GitServiceOperationRow({
  operation,
}: {
  operation: IdeaToSpecGitServiceOperation;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{operation.name.replace(/_/g, " ")}</span>
        <Pill value={operation.status} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Request" value={operation.requestArtifactKind} />
        <Meta label="Response" value={operation.responseArtifactKind} />
        <Meta label="Report" value={operation.reportRef} />
        <Meta label="Diagnostics" value={String(operation.diagnosticCount)} />
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.kicker}>{title}</span>
      <span className={styles.sectionCount}>{count}</span>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function Pill({ value }: { value: string }) {
  return <span className={styles.pill}>{value}</span>;
}

function PostureItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.postureItem}>
      <span className={styles.postureLabel}>{label}</span>
      <span className={styles.postureValue}>{value}</span>
    </div>
  );
}

export function ReportStatusRow({
  title,
  status,
  path,
  detail,
}: {
  title: string;
  status: string;
  path: string | null | undefined;
  detail?: string;
}) {
  const detailText = detail
    ? `${compact(path, "report")} · ${detail}`
    : compact(path, "report");
  return (
    <div className={`${styles.reportRow} ${styles.reportRowSplit}`}>
      <div className={styles.reportMain}>
        <span className={styles.rowId}>{title}</span>
        <span className={`${styles.statusDetail} ${styles.subRowDetail}`}>
          {detailText}
        </span>
      </div>
      <div className={styles.reportStatus}>
        <Pill value={status} />
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  kind,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  kind?: MetaValueKind;
  wide?: boolean;
}) {
  const displayValue = compact(value, "none");
  const resolvedKind = kind ?? metaValueKind(label, displayValue);
  const shouldSpan = wide ?? metaShouldSpan(resolvedKind, displayValue);
  const metaClassName = shouldSpan
    ? `${styles.meta} ${styles.metaWide}`
    : styles.meta;
  return (
    <div className={metaClassName}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={metaValueClassName(resolvedKind)}>
        {displayValue}
      </span>
    </div>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.status}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
