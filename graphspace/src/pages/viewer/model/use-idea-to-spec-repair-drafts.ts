import { useCallback, useEffect, useMemo, useState } from "react";

export type IdeaToSpecRepairDraft = {
  draftId: string;
  workspaceId: string;
  candidateId: string;
  repairSessionId: string | null;
  repairSessionRef: string | null;
  requestId: string;
  requestKind: string | null;
  requestStatus: string | null;
  targetRef: string | null;
  targetArtifact: string | null;
  allowedAction: string;
  answerValue: Record<string, unknown>;
  operatorRef: string;
  createdAt: string;
  updatedAt: string;
  sourceArtifact: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  appliesToSpecgraph: false;
  appliesToCandidateArtifacts: false;
  mutatesCanonicalSpecs: false;
  writesOntologyPackage: false;
  acceptsOntologyTerms: false;
  createsBranchOrCommit: false;
  opensPullRequest: false;
};

export type IdeaToSpecRepairDraftState = {
  artifactKind: "specspace_idea_to_spec_repair_draft_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  selectedWorkspaceId: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  drafts: readonly IdeaToSpecRepairDraft[];
  summary: {
    status: string;
    draftCount: number;
    workspaceCount: number;
    actionCounts: Record<string, number>;
    nextGap: string | null;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forProductRepairWorkflow: boolean;
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
  };
  authorityBoundary: {
    repairDraftStateIsAuthority: boolean;
    specgraphArtifactAuthority: boolean;
    ontologyAuthority: boolean;
    gitServiceAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseIdeaToSpecRepairDraftsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecRepairDraftState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type IdeaToSpecRepairDraftInput = {
  requestId: string;
  action: string;
  answerValue: Record<string, unknown>;
  workspaceId?: string | null;
  targetRef?: string | null;
  targetArtifact?: string | null;
  operatorRef?: string | null;
};

export type IdeaToSpecRepairDraftSaveError =
  | {
      kind: "http-error";
      requestId: string;
      status: number;
      statusText: string;
      body?: unknown;
    }
  | {
      kind: "network-error";
      requestId: string;
      error: unknown;
    };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  enabled?: boolean;
  refreshKey?: number;
};

const topLevelMutationFields = [
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
] as const;

const consumerMutationFields = [
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
] as const;

const authorityMutationFields = [
  "repair_draft_state_is_authority",
  "specgraph_artifact_authority",
  "ontology_authority",
  "git_service_authority",
  "canonical_mutations_allowed",
] as const;

const draftMutationFields = [
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
  "applies_to_specgraph",
  "applies_to_candidate_artifacts",
  "mutates_canonical_specs",
  "writes_ontology_package",
  "accepts_ontology_terms",
  "creates_branch_or_commit",
  "opens_pull_request",
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

function numberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) out[key] = item;
  }
  return out;
}

function firstTrue(
  raw: Record<string, unknown>,
  fields: readonly string[],
): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

function repairDraft(raw: Record<string, unknown>): IdeaToSpecRepairDraft | null {
  const workspaceId = optionalString(raw.workspace_id);
  const candidateId = optionalString(raw.candidate_id);
  const requestId = optionalString(raw.request_id);
  const allowedAction = optionalString(raw.allowed_action);
  if (!workspaceId || !candidateId || !requestId || !allowedAction) return null;
  return {
    draftId: stringValue(raw.draft_id, `specspace-repair-draft::${workspaceId}::${requestId}`),
    workspaceId,
    candidateId,
    repairSessionId: optionalString(raw.repair_session_id),
    repairSessionRef: optionalString(raw.repair_session_ref),
    requestId,
    requestKind: optionalString(raw.request_kind),
    requestStatus: optionalString(raw.request_status),
    targetRef: optionalString(raw.target_ref),
    targetArtifact: optionalString(raw.target_artifact),
    allowedAction,
    answerValue: isRecord(raw.answer_value) ? raw.answer_value : {},
    operatorRef: stringValue(raw.operator_ref, "local_operator"),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
    sourceArtifact: optionalString(raw.source_artifact),
    canonicalMutationsAllowed: false,
    trackedArtifactsWritten: false,
    appliesToSpecgraph: false,
    appliesToCandidateArtifacts: false,
    mutatesCanonicalSpecs: false,
    writesOntologyPackage: false,
    acceptsOntologyTerms: false,
    createsBranchOrCommit: false,
    opensPullRequest: false,
  };
}

export function parseIdeaToSpecRepairDraftState(
  raw: unknown,
): UseIdeaToSpecRepairDraftsState {
  if (!isRecord(raw)) return { kind: "parse-error", message: "State root must be an object.", raw };
  if (raw.artifact_kind !== "specspace_idea_to_spec_repair_draft_state") {
    return { kind: "parse-error", message: "Unexpected repair draft artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported repair draft schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Repair draft state must be owned by SpecSpace.", raw };
  }
  const topLevelMutation = firstTrue(raw, topLevelMutationFields);
  if (topLevelMutation) {
    return { kind: "parse-error", message: `Repair draft state cannot claim ${topLevelMutation}.`, raw };
  }

  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Repair draft consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Repair draft authority boundary cannot claim ${authorityMutation}.`, raw };
  }

  const draftRows = Array.isArray(raw.drafts) ? raw.drafts.filter(isRecord) : [];
  for (const row of draftRows) {
    const recordMutation = firstTrue(row, draftMutationFields);
    if (recordMutation) {
      return { kind: "parse-error", message: `Repair draft record cannot claim ${recordMutation}.`, raw };
    }
  }
  const drafts = draftRows
    .map(repairDraft)
    .filter((entry): entry is IdeaToSpecRepairDraft => !!entry);
  const summary = isRecord(raw.summary) ? raw.summary : {};

  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_idea_to_spec_repair_draft_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      drafts,
      summary: {
        status: stringValue(summary.status, drafts.length > 0 ? "repair_drafts_recorded" : "no_repair_drafts"),
        draftCount: typeof summary.draft_count === "number" ? summary.draft_count : drafts.length,
        workspaceCount: typeof summary.workspace_count === "number" ? summary.workspace_count : 0,
        actionCounts: numberMap(summary.action_counts),
        nextGap: optionalString(summary.next_gap),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forProductRepairWorkflow: boolValue(consumerBoundary.for_product_repair_workflow),
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
      },
      authorityBoundary: {
        repairDraftStateIsAuthority: boolValue(authorityBoundary.repair_draft_state_is_authority),
        specgraphArtifactAuthority: boolValue(authorityBoundary.specgraph_artifact_authority),
        ontologyAuthority: boolValue(authorityBoundary.ontology_authority),
        gitServiceAuthority: boolValue(authorityBoundary.git_service_authority),
        canonicalMutationsAllowed: boolValue(authorityBoundary.canonical_mutations_allowed),
      },
    },
  };
}

export function useIdeaToSpecRepairDrafts(options: Options = {}) {
  const {
    url = "/api/v1/idea-to-spec-repair-drafts",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecRepairDraftsState>({ kind: "idle" });
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [saveError, setSaveError] =
    useState<IdeaToSpecRepairDraftSaveError | null>(null);

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
    setState(parseIdeaToSpecRepairDraftState(await response.json()));
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

  const saveDraft = useCallback(async (input: IdeaToSpecRepairDraftInput) => {
    setPendingRequestId(input.requestId);
    setSaveError(null);
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: input.requestId,
          action: input.action,
          answer_value: input.answerValue,
          workspace_id: input.workspaceId ?? undefined,
          target_ref: input.targetRef ?? undefined,
          target_artifact: input.targetArtifact ?? undefined,
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
        setSaveError({
          kind: "http-error",
          requestId: input.requestId,
          status: response.status,
          statusText: response.statusText,
          body,
        });
        return false;
      }
      setState(parseIdeaToSpecRepairDraftState(await response.json()));
      return true;
    } catch (error) {
      setSaveError({ kind: "network-error", requestId: input.requestId, error });
      return false;
    } finally {
      setPendingRequestId(null);
    }
  }, [fetcher, url]);

  const draftsByRequestId = useMemo(() => {
    if (state.kind !== "ok") return new Map<string, IdeaToSpecRepairDraft>();
    return new Map(state.data.drafts.map((draft) => [draft.requestId, draft]));
  }, [state]);

  return { state, draftsByRequestId, pendingRequestId, saveError, saveDraft };
}
