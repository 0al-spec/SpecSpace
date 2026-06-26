import { useCallback, useEffect, useMemo, useState } from "react";

export type IdeaToSpecCandidateApprovalIntent = {
  id: string;
  status: string;
  requestedAction: "approve_candidate_for_promotion_review";
  workspaceId: string;
  candidateId: string;
  repairSessionId: string | null;
  repairSessionRef: string | null;
  promotionGateRef: string | null;
  requestedBy: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  readyForCandidateApproval: boolean;
  readyForPlatformPromotion: boolean;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  mayExecuteSpecgraph: false;
  mayExecutePromptAgent: false;
  mayApplyToSpecgraph: false;
  mayMarkCandidateAccepted: false;
  mayMutateCandidateSourceArtifacts: false;
  mayMutateCanonicalSpecs: false;
  mayWriteOntologyPackage: false;
  mayAcceptOntologyTerms: false;
  mayCreateBranchOrCommit: false;
  mayOpenPullRequest: false;
  mayExecuteGitServiceOperation: false;
};

export type IdeaToSpecCandidateApprovalIntentState = {
  artifactKind: "specspace_idea_to_spec_candidate_approval_intent_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  selectedWorkspaceId: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  intents: readonly IdeaToSpecCandidateApprovalIntent[];
  summary: {
    status: string;
    intentCount: number;
    activeIntentCount: number;
    workspaceCount: number;
    nextGap: string | null;
  };
  workflowStatus: {
    repairSessionStatus: string;
    repairSessionRef: string | null;
    repairSessionReady: boolean;
    candidateApprovalReady: boolean;
    readyForPlatformPromotion: boolean;
    openBlockerCount: number;
    promotionGateRef: string | null;
    platformExecutionStatus: string;
    platformExecutionOk: boolean;
    platformPublicationStatus: string;
    platformPublicationOk: boolean;
    latestJournalState: string;
    requestReady: boolean;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forCandidateApprovalWorkflow: boolean;
    mayExecuteSpecgraph: boolean;
    mayExecutePromptAgent: boolean;
    mayApplyToSpecgraph: boolean;
    mayMarkCandidateAccepted: boolean;
    mayMutateCandidateSourceArtifacts: boolean;
    mayMutateCanonicalSpecs: boolean;
    mayWriteOntologyPackage: boolean;
    mayAcceptOntologyTerms: boolean;
    mayCreateBranchOrCommit: boolean;
    mayOpenPullRequest: boolean;
    mayExecuteGitServiceOperation: boolean;
  };
  authorityBoundary: {
    approvalIntentStateIsAuthority: boolean;
    specgraphExecutionAuthority: boolean;
    specgraphArtifactAuthority: boolean;
    ontologyAuthority: boolean;
    candidateApprovalAuthority: boolean;
    gitServiceAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseIdeaToSpecCandidateApprovalIntentsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecCandidateApprovalIntentState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type IdeaToSpecCandidateApprovalIntentInput = {
  workspaceId?: string | null;
  operatorRef?: string | null;
  reason?: string | null;
};

export type IdeaToSpecCandidateApprovalIntentError =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  enabled?: boolean;
  refreshKey?: number | string;
};

const topLevelMutationFields = [
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
] as const;

const consumerMutationFields = [
  "may_execute_specgraph",
  "may_execute_prompt_agent",
  "may_apply_to_specgraph",
  "may_mark_candidate_accepted",
  "may_mark_candidate_graph_accepted",
  "may_mutate_candidate_source_artifacts",
  "may_mutate_canonical_specs",
  "may_write_ontology_package",
  "may_accept_ontology_terms",
  "may_create_branch_or_commit",
  "may_open_pull_request",
  "may_execute_git_service_operation",
] as const;

const authorityMutationFields = [
  "approval_intent_state_is_authority",
  "candidate_approval_intent_state_is_authority",
  "specgraph_execution_authority",
  "specgraph_artifact_authority",
  "ontology_authority",
  "candidate_approval_authority",
  "candidate_approval_decision_authority",
  "git_service_authority",
  "canonical_mutations_allowed",
] as const;

const intentMutationFields = [
  "may_execute_specgraph",
  "may_execute_prompt_agent",
  "may_apply_to_specgraph",
  "may_mark_candidate_accepted",
  "may_mark_candidate_graph_accepted",
  "may_mutate_candidate_source_artifacts",
  "may_mutate_canonical_specs",
  "may_write_ontology_package",
  "may_accept_ontology_terms",
  "may_create_branch_or_commit",
  "may_open_pull_request",
  "may_execute_git_service_operation",
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return optionalString(value) ?? fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boolValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.length > 0) out[key] = item;
  }
  return out;
}

function firstTrue(raw: Record<string, unknown>, fields: readonly string[]): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

function parseIntent(raw: Record<string, unknown>): IdeaToSpecCandidateApprovalIntent | null {
  const id = optionalString(raw.id);
  const workspaceId = optionalString(raw.workspace_id);
  const candidateId = optionalString(raw.candidate_id);
  const requestedAction = optionalString(raw.requested_action);
  if (!id || !workspaceId || !candidateId || requestedAction !== "approve_candidate_for_promotion_review") {
    return null;
  }
  return {
    id,
    status: stringValue(raw.status, "requested"),
    requestedAction: "approve_candidate_for_promotion_review",
    workspaceId,
    candidateId,
    repairSessionId: optionalString(raw.repair_session_id),
    repairSessionRef: optionalString(raw.repair_session_ref),
    promotionGateRef: optionalString(raw.promotion_gate_ref),
    requestedBy: stringValue(raw.requested_by, "operator://specspace-local"),
    reason: optionalString(raw.reason),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
    readyForCandidateApproval: boolValue(raw.ready_for_candidate_approval),
    readyForPlatformPromotion: boolValue(raw.ready_for_platform_promotion),
    canonicalMutationsAllowed: false,
    trackedArtifactsWritten: false,
    mayExecuteSpecgraph: false,
    mayExecutePromptAgent: false,
    mayApplyToSpecgraph: false,
    mayMarkCandidateAccepted: false,
    mayMutateCandidateSourceArtifacts: false,
    mayMutateCanonicalSpecs: false,
    mayWriteOntologyPackage: false,
    mayAcceptOntologyTerms: false,
    mayCreateBranchOrCommit: false,
    mayOpenPullRequest: false,
    mayExecuteGitServiceOperation: false,
  };
}

export function parseIdeaToSpecCandidateApprovalIntentState(
  raw: unknown,
): UseIdeaToSpecCandidateApprovalIntentsState {
  if (!isRecord(raw)) return { kind: "parse-error", message: "State root must be an object.", raw };
  if (raw.artifact_kind !== "specspace_idea_to_spec_candidate_approval_intent_state") {
    return { kind: "parse-error", message: "Unexpected candidate approval intent artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported candidate approval intent schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Candidate approval intent state must be owned by SpecSpace.", raw };
  }
  const topLevelMutation = firstTrue(raw, topLevelMutationFields);
  if (topLevelMutation) {
    return { kind: "parse-error", message: `Candidate approval intent state cannot claim ${topLevelMutation}.`, raw };
  }

  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Candidate approval intent consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Candidate approval intent authority boundary cannot claim ${authorityMutation}.`, raw };
  }
  const intentRows = Array.isArray(raw.intents) ? raw.intents.filter(isRecord) : [];
  for (const row of intentRows) {
    const recordMutation = firstTrue(row, intentMutationFields);
    if (recordMutation) {
      return { kind: "parse-error", message: `Candidate approval intent record cannot claim ${recordMutation}.`, raw };
    }
  }

  const intents = intentRows
    .map(parseIntent)
    .filter((entry): entry is IdeaToSpecCandidateApprovalIntent => !!entry);
  const summary = isRecord(raw.summary) ? raw.summary : {};
  const workflow = isRecord(raw.workflow_status) ? raw.workflow_status : {};

  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_idea_to_spec_candidate_approval_intent_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      intents,
      summary: {
        status: stringValue(summary.status, intents.length > 0 ? "approval_intent_requested" : "no_approval_intents"),
        intentCount: numberValue(summary.intent_count) || intents.length,
        activeIntentCount: numberValue(summary.active_intent_count),
        workspaceCount: numberValue(summary.workspace_count),
        nextGap: optionalString(summary.next_gap),
      },
      workflowStatus: {
        repairSessionStatus: stringValue(workflow.repair_session_status, "missing"),
        repairSessionRef: optionalString(workflow.repair_session_ref),
        repairSessionReady: boolValue(workflow.repair_session_ready),
        candidateApprovalReady: boolValue(
          workflow.candidate_approval_ready
            ?? workflow.ready_for_candidate_approval,
        ),
        readyForPlatformPromotion: boolValue(workflow.ready_for_platform_promotion),
        openBlockerCount: numberValue(workflow.open_blocker_count),
        promotionGateRef: optionalString(workflow.promotion_gate_ref),
        platformExecutionStatus: stringValue(
          workflow.platform_execution_status
            ?? workflow.platform_rerun_execution_status,
          "missing",
        ),
        platformExecutionOk: boolValue(
          workflow.platform_execution_ok
            ?? workflow.platform_rerun_execution_ok,
        ),
        platformPublicationStatus: stringValue(
          workflow.platform_publication_status
            ?? workflow.platform_rerun_publication_status,
          "missing",
        ),
        platformPublicationOk: boolValue(
          workflow.platform_publication_ok
            ?? workflow.platform_rerun_publication_ok,
        ),
        latestJournalState: stringValue(workflow.latest_journal_state, "not_requested"),
        requestReady: boolValue(workflow.request_ready),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forCandidateApprovalWorkflow: boolValue(
          consumerBoundary.for_candidate_approval_workflow
            ?? consumerBoundary.for_product_approval_workflow,
        ),
        mayExecuteSpecgraph: boolValue(consumerBoundary.may_execute_specgraph),
        mayExecutePromptAgent: boolValue(consumerBoundary.may_execute_prompt_agent),
        mayApplyToSpecgraph: boolValue(consumerBoundary.may_apply_to_specgraph),
        mayMarkCandidateAccepted: boolValue(
          consumerBoundary.may_mark_candidate_accepted
            ?? consumerBoundary.may_mark_candidate_graph_accepted,
        ),
        mayMutateCandidateSourceArtifacts: boolValue(consumerBoundary.may_mutate_candidate_source_artifacts),
        mayMutateCanonicalSpecs: boolValue(consumerBoundary.may_mutate_canonical_specs),
        mayWriteOntologyPackage: boolValue(consumerBoundary.may_write_ontology_package),
        mayAcceptOntologyTerms: boolValue(consumerBoundary.may_accept_ontology_terms),
        mayCreateBranchOrCommit: boolValue(consumerBoundary.may_create_branch_or_commit),
        mayOpenPullRequest: boolValue(consumerBoundary.may_open_pull_request),
        mayExecuteGitServiceOperation: boolValue(consumerBoundary.may_execute_git_service_operation),
      },
      authorityBoundary: {
        approvalIntentStateIsAuthority: boolValue(
          authorityBoundary.approval_intent_state_is_authority
            ?? authorityBoundary.candidate_approval_intent_state_is_authority,
        ),
        specgraphExecutionAuthority: boolValue(authorityBoundary.specgraph_execution_authority),
        specgraphArtifactAuthority: boolValue(authorityBoundary.specgraph_artifact_authority),
        ontologyAuthority: boolValue(authorityBoundary.ontology_authority),
        candidateApprovalAuthority: boolValue(
          authorityBoundary.candidate_approval_authority
            ?? authorityBoundary.candidate_approval_decision_authority,
        ),
        gitServiceAuthority: boolValue(authorityBoundary.git_service_authority),
        canonicalMutationsAllowed: boolValue(authorityBoundary.canonical_mutations_allowed),
      },
    },
  };
}

export function useIdeaToSpecCandidateApprovalIntents(options: Options = {}) {
  const {
    url = "/api/v1/idea-to-spec-candidate-approval-intents",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecCandidateApprovalIntentsState>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] =
    useState<IdeaToSpecCandidateApprovalIntentError | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    let response: Response;
    try {
      response = await fetcher(url, { signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      setState({ kind: "network-error", error });
      return;
    }
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      setState({ kind: "http-error", status: response.status, statusText: response.statusText, body });
      return;
    }
    setState(parseIdeaToSpecCandidateApprovalIntentState(await response.json()));
  }, [fetcher, url]);

  useEffect(() => {
    if (!enabled) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));
    load(controller.signal).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      setState({ kind: "network-error", error });
    });
    return () => controller.abort();
  }, [enabled, load, refreshKey]);

  const requestApprovalIntent = useCallback(async (
    input: IdeaToSpecCandidateApprovalIntentInput = {},
  ) => {
    setPending(true);
    setRequestError(null);
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: input.workspaceId ?? undefined,
          requested_action: "approve_candidate_for_promotion_review",
          operator_ref: input.operatorRef ?? "operator://specspace-local",
          reason: input.reason ?? "Approve candidate for promotion review.",
        }),
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = undefined;
        }
        setRequestError({
          kind: "http-error",
          status: response.status,
          statusText: response.statusText,
          body,
        });
        return;
      }
      setState(parseIdeaToSpecCandidateApprovalIntentState(await response.json()));
    } catch (error) {
      setRequestError({ kind: "network-error", error });
    } finally {
      setPending(false);
    }
  }, [fetcher, url]);

  const activeIntent = useMemo(() => {
    if (state.kind !== "ok") return null;
    return [...state.data.intents].reverse().find((intent) => intent.status === "requested") ?? null;
  }, [state]);

  return { state, activeIntent, pending, requestError, requestApprovalIntent };
}
