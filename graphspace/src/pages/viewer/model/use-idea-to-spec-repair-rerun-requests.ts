import { useCallback, useEffect, useMemo, useState } from "react";

export type IdeaToSpecRepairRerunRequest = {
  id: string;
  status: string;
  requestedAction: "prepare_repair_draft_rerun";
  workspaceId: string;
  candidateId: string;
  repairSessionId: string | null;
  repairSessionRef: string | null;
  draftStateRef: string | null;
  importPreviewRef: string | null;
  rerunReportRef: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  draftCount: number;
  acceptedForRerunCount: number;
  operatorCommand: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  mayExecuteSpecgraph: false;
  mayRunMakeTarget: false;
  mayMutateCandidateSourceArtifacts: false;
  mayMutateCanonicalSpecs: false;
  mayWriteOntologyPackage: false;
  mayAcceptOntologyTerms: false;
  mayCreateBranchOrCommit: false;
  mayOpenPullRequest: false;
  mayExecuteGitServiceOperation: false;
};

export type IdeaToSpecRepairRerunRequestState = {
  artifactKind: "specspace_idea_to_spec_repair_rerun_request_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  selectedWorkspaceId: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  requests: readonly IdeaToSpecRepairRerunRequest[];
  summary: {
    status: string;
    requestCount: number;
    activeRequestCount: number;
    workspaceCount: number;
    nextGap: string | null;
  };
  workflowStatus: {
    draftsSaved: boolean;
    draftCount: number;
    importPreviewStatus: string;
    importPreviewRef: string | null;
    acceptedForRerunCount: number;
    rerunStatus: string;
    rerunReportRef: string | null;
    latestJournalState: string;
    operatorCommand: string | null;
    requestReady: boolean;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forProductRepairWorkflow: boolean;
    mayExecuteSpecgraph: boolean;
    mayExecutePromptAgent: boolean;
    mayApplyToSpecgraph: boolean;
    mayApplyAnswers: boolean;
    mayApplyDecisions: boolean;
    mayMutateCandidateSourceArtifacts: boolean;
    mayMutateCanonicalSpecs: boolean;
    mayWriteOntologyPackage: boolean;
    mayAcceptOntologyTerms: boolean;
    mayCreateBranchOrCommit: boolean;
    mayOpenPullRequest: boolean;
    mayExecuteGitServiceOperation: boolean;
  };
  authorityBoundary: {
    rerunRequestStateIsAuthority: boolean;
    specgraphExecutionAuthority: boolean;
    specgraphArtifactAuthority: boolean;
    ontologyAuthority: boolean;
    gitServiceAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseIdeaToSpecRepairRerunRequestsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecRepairRerunRequestState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type IdeaToSpecRepairRerunRequestInput = {
  workspaceId?: string | null;
  operatorRef?: string | null;
};

export type IdeaToSpecRepairRerunRequestError =
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
  "may_apply_answers",
  "may_apply_decisions",
  "may_mutate_candidate_source_artifacts",
  "may_mutate_canonical_specs",
  "may_write_ontology_package",
  "may_accept_ontology_terms",
  "may_create_branch_or_commit",
  "may_open_pull_request",
  "may_execute_git_service_operation",
] as const;

const authorityMutationFields = [
  "rerun_request_state_is_authority",
  "specgraph_execution_authority",
  "specgraph_artifact_authority",
  "ontology_authority",
  "git_service_authority",
  "canonical_mutations_allowed",
] as const;

const requestMutationFields = [
  "may_execute_specgraph",
  "may_run_make_target",
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

function parseRequest(raw: Record<string, unknown>): IdeaToSpecRepairRerunRequest | null {
  const id = optionalString(raw.id);
  const workspaceId = optionalString(raw.workspace_id);
  const candidateId = optionalString(raw.candidate_id);
  const requestedAction = optionalString(raw.requested_action);
  if (!id || !workspaceId || !candidateId || requestedAction !== "prepare_repair_draft_rerun") {
    return null;
  }
  return {
    id,
    status: stringValue(raw.status, "requested"),
    requestedAction: "prepare_repair_draft_rerun",
    workspaceId,
    candidateId,
    repairSessionId: optionalString(raw.repair_session_id),
    repairSessionRef: optionalString(raw.repair_session_ref),
    draftStateRef: optionalString(raw.draft_state_ref),
    importPreviewRef: optionalString(raw.import_preview_ref),
    rerunReportRef: optionalString(raw.rerun_report_ref),
    requestedBy: stringValue(raw.requested_by, "operator://specspace-local"),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
    draftCount: numberValue(raw.draft_count),
    acceptedForRerunCount: numberValue(raw.accepted_for_rerun_count),
    operatorCommand: optionalString(raw.operator_command),
    canonicalMutationsAllowed: false,
    trackedArtifactsWritten: false,
    mayExecuteSpecgraph: false,
    mayRunMakeTarget: false,
    mayMutateCandidateSourceArtifacts: false,
    mayMutateCanonicalSpecs: false,
    mayWriteOntologyPackage: false,
    mayAcceptOntologyTerms: false,
    mayCreateBranchOrCommit: false,
    mayOpenPullRequest: false,
    mayExecuteGitServiceOperation: false,
  };
}

export function parseIdeaToSpecRepairRerunRequestState(
  raw: unknown,
): UseIdeaToSpecRepairRerunRequestsState {
  if (!isRecord(raw)) return { kind: "parse-error", message: "State root must be an object.", raw };
  if (raw.artifact_kind !== "specspace_idea_to_spec_repair_rerun_request_state") {
    return { kind: "parse-error", message: "Unexpected repair rerun request artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported repair rerun request schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Repair rerun request state must be owned by SpecSpace.", raw };
  }
  const topLevelMutation = firstTrue(raw, topLevelMutationFields);
  if (topLevelMutation) {
    return { kind: "parse-error", message: `Repair rerun request state cannot claim ${topLevelMutation}.`, raw };
  }

  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Repair rerun request consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Repair rerun request authority boundary cannot claim ${authorityMutation}.`, raw };
  }
  const requestRows = Array.isArray(raw.requests) ? raw.requests.filter(isRecord) : [];
  for (const row of requestRows) {
    const recordMutation = firstTrue(row, requestMutationFields);
    if (recordMutation) {
      return { kind: "parse-error", message: `Repair rerun request record cannot claim ${recordMutation}.`, raw };
    }
  }

  const requests = requestRows
    .map(parseRequest)
    .filter((entry): entry is IdeaToSpecRepairRerunRequest => !!entry);
  const summary = isRecord(raw.summary) ? raw.summary : {};
  const workflow = isRecord(raw.workflow_status) ? raw.workflow_status : {};

  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_idea_to_spec_repair_rerun_request_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      requests,
      summary: {
        status: stringValue(summary.status, requests.length > 0 ? "rerun_requested" : "no_rerun_requests"),
        requestCount: numberValue(summary.request_count) || requests.length,
        activeRequestCount: numberValue(summary.active_request_count),
        workspaceCount: numberValue(summary.workspace_count),
        nextGap: optionalString(summary.next_gap),
      },
      workflowStatus: {
        draftsSaved: boolValue(workflow.drafts_saved),
        draftCount: numberValue(workflow.draft_count),
        importPreviewStatus: stringValue(workflow.import_preview_status, "missing"),
        importPreviewRef: optionalString(workflow.import_preview_ref),
        acceptedForRerunCount: numberValue(workflow.accepted_for_rerun_count),
        rerunStatus: stringValue(workflow.rerun_status, "not_prepared"),
        rerunReportRef: optionalString(workflow.rerun_report_ref),
        latestJournalState: stringValue(workflow.latest_journal_state, "not_requested"),
        operatorCommand: optionalString(workflow.operator_command),
        requestReady: boolValue(workflow.request_ready),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forProductRepairWorkflow: boolValue(consumerBoundary.for_product_repair_workflow),
        mayExecuteSpecgraph: boolValue(consumerBoundary.may_execute_specgraph),
        mayExecutePromptAgent: boolValue(consumerBoundary.may_execute_prompt_agent),
        mayApplyToSpecgraph: boolValue(consumerBoundary.may_apply_to_specgraph),
        mayApplyAnswers: boolValue(consumerBoundary.may_apply_answers),
        mayApplyDecisions: boolValue(consumerBoundary.may_apply_decisions),
        mayMutateCandidateSourceArtifacts: boolValue(consumerBoundary.may_mutate_candidate_source_artifacts),
        mayMutateCanonicalSpecs: boolValue(consumerBoundary.may_mutate_canonical_specs),
        mayWriteOntologyPackage: boolValue(consumerBoundary.may_write_ontology_package),
        mayAcceptOntologyTerms: boolValue(consumerBoundary.may_accept_ontology_terms),
        mayCreateBranchOrCommit: boolValue(consumerBoundary.may_create_branch_or_commit),
        mayOpenPullRequest: boolValue(consumerBoundary.may_open_pull_request),
        mayExecuteGitServiceOperation: boolValue(consumerBoundary.may_execute_git_service_operation),
      },
      authorityBoundary: {
        rerunRequestStateIsAuthority: boolValue(authorityBoundary.rerun_request_state_is_authority),
        specgraphExecutionAuthority: boolValue(authorityBoundary.specgraph_execution_authority),
        specgraphArtifactAuthority: boolValue(authorityBoundary.specgraph_artifact_authority),
        ontologyAuthority: boolValue(authorityBoundary.ontology_authority),
        gitServiceAuthority: boolValue(authorityBoundary.git_service_authority),
        canonicalMutationsAllowed: boolValue(authorityBoundary.canonical_mutations_allowed),
      },
    },
  };
}

export function useIdeaToSpecRepairRerunRequests(options: Options = {}) {
  const {
    url = "/api/v1/idea-to-spec-repair-rerun-requests",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecRepairRerunRequestsState>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] =
    useState<IdeaToSpecRepairRerunRequestError | null>(null);

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
    setState(parseIdeaToSpecRepairRerunRequestState(await response.json()));
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

  const requestRerun = useCallback(async (input: IdeaToSpecRepairRerunRequestInput = {}) => {
    setPending(true);
    setRequestError(null);
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: input.workspaceId ?? undefined,
          requested_action: "prepare_repair_draft_rerun",
          operator_ref: input.operatorRef ?? "operator://specspace-local",
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
      setState(parseIdeaToSpecRepairRerunRequestState(await response.json()));
    } catch (error) {
      setRequestError({ kind: "network-error", error });
    } finally {
      setPending(false);
    }
  }, [fetcher, url]);

  const activeRequest = useMemo(() => {
    if (state.kind !== "ok") return null;
    return [...state.data.requests].reverse().find((request) => request.status === "requested") ?? null;
  }, [state]);

  return { state, activeRequest, pending, requestError, requestRerun };
}
