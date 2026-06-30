import { useCallback, useEffect, useMemo, useState } from "react";

export type IdeaToSpecIntakeClarificationAnswer = {
  answerId: string;
  workspaceId: string;
  candidateId: string;
  requestId: string;
  requestKind: string | null;
  requestStatus: string | null;
  targetRef: string | null;
  targetArtifact: string | null;
  answerKind: string;
  status: string;
  authority: string;
  value: Record<string, unknown>;
  operatorRef: string;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
  sourceArtifact: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  appliesToSpecgraph: false;
  appliesToCandidateSource: false;
  mutatesUserIntent: false;
  mutatesCanonicalSpecs: false;
  writesOntologyPackage: false;
  acceptsOntologyTerms: false;
  createsBranchOrCommit: false;
  opensPullRequest: false;
};

export type IdeaToSpecIntakeClarificationAnswerState = {
  artifactKind: "specspace_idea_intake_clarification_answer_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  selectedWorkspaceId: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  answers: readonly IdeaToSpecIntakeClarificationAnswer[];
  answerSet: Record<string, unknown>;
  summary: {
    status: string;
    answerCount: number;
    acceptedAnswerCount: number;
    invalidAnswerCount: number;
    workspaceCount: number;
    nextGap: string | null;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forRealIdeaIntakeWorkflow: boolean;
    mayExecuteSpecgraph: boolean;
    mayExecutePromptAgent: boolean;
    mayApplyToSpecgraph: boolean;
    mayApplyAnswers: boolean;
    mayMutateCandidateSourceArtifacts: boolean;
    mayMutateCanonicalSpecs: boolean;
    mayWriteOntologyPackage: boolean;
    mayAcceptOntologyTerms: boolean;
    mayCreateBranchOrCommit: boolean;
    mayOpenPullRequest: boolean;
    mayExecuteGitServiceOperation: boolean;
  };
  authorityBoundary: {
    intakeAnswerStateIsAuthority: boolean;
    specgraphArtifactAuthority: boolean;
    ontologyAuthority: boolean;
    gitServiceAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseIdeaToSpecIntakeClarificationAnswersState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecIntakeClarificationAnswerState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type IdeaToSpecIntakeClarificationAnswerInput = {
  requestId: string;
  answerKind: string;
  value: Record<string, unknown>;
  workspaceId?: string | null;
  operatorRef?: string | null;
  status?: string | null;
  authority?: string | null;
  rationale?: string | null;
};

export type IdeaToSpecIntakeClarificationAnswerSaveError =
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
  "may_mutate_candidate_source_artifacts",
  "may_mutate_canonical_specs",
  "may_write_ontology_package",
  "may_accept_ontology_terms",
  "may_create_branch_or_commit",
  "may_open_pull_request",
  "may_execute_git_service_operation",
] as const;

const authorityMutationFields = [
  "intake_answer_state_is_authority",
  "specgraph_artifact_authority",
  "ontology_authority",
  "git_service_authority",
  "canonical_mutations_allowed",
] as const;

const answerMutationFields = [
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
  "applies_to_specgraph",
  "applies_to_candidate_source",
  "mutates_user_intent",
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

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function firstTrue(
  raw: Record<string, unknown>,
  fields: readonly string[],
): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

function intakeAnswer(
  raw: Record<string, unknown>,
): IdeaToSpecIntakeClarificationAnswer | null {
  const workspaceId = optionalString(raw.workspace_id);
  const candidateId = optionalString(raw.candidate_id);
  const requestId = optionalString(raw.request_id);
  const answerKind = optionalString(raw.answer_kind);
  if (!workspaceId || !candidateId || !requestId || !answerKind) return null;
  return {
    answerId: stringValue(raw.answer_id, `specspace-intake-answer::${workspaceId}::${requestId}`),
    workspaceId,
    candidateId,
    requestId,
    requestKind: optionalString(raw.request_kind),
    requestStatus: optionalString(raw.request_status),
    targetRef: optionalString(raw.target_ref),
    targetArtifact: optionalString(raw.target_artifact),
    answerKind,
    status: stringValue(raw.status, "proposed"),
    authority: stringValue(raw.authority, "operator_approved"),
    value: isRecord(raw.value) ? raw.value : {},
    operatorRef: stringValue(raw.operator_ref, "local_operator"),
    rationale: optionalString(raw.rationale),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
    sourceArtifact: optionalString(raw.source_artifact),
    canonicalMutationsAllowed: false,
    trackedArtifactsWritten: false,
    appliesToSpecgraph: false,
    appliesToCandidateSource: false,
    mutatesUserIntent: false,
    mutatesCanonicalSpecs: false,
    writesOntologyPackage: false,
    acceptsOntologyTerms: false,
    createsBranchOrCommit: false,
    opensPullRequest: false,
  };
}

export function parseIdeaToSpecIntakeClarificationAnswerState(
  raw: unknown,
): UseIdeaToSpecIntakeClarificationAnswersState {
  if (!isRecord(raw)) return { kind: "parse-error", message: "State root must be an object.", raw };
  if (raw.artifact_kind !== "specspace_idea_intake_clarification_answer_state") {
    return { kind: "parse-error", message: "Unexpected intake clarification answer artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported intake clarification answer schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Intake clarification answer state must be owned by SpecSpace.", raw };
  }
  const topLevelMutation = firstTrue(raw, topLevelMutationFields);
  if (topLevelMutation) {
    return { kind: "parse-error", message: `Intake clarification state cannot claim ${topLevelMutation}.`, raw };
  }

  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Intake clarification consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Intake clarification authority boundary cannot claim ${authorityMutation}.`, raw };
  }

  const answerRows = Array.isArray(raw.answers) ? raw.answers.filter(isRecord) : [];
  for (const row of answerRows) {
    const recordMutation = firstTrue(row, answerMutationFields);
    if (recordMutation) {
      return { kind: "parse-error", message: `Intake clarification answer cannot claim ${recordMutation}.`, raw };
    }
  }
  const answers = answerRows
    .map(intakeAnswer)
    .filter((item): item is IdeaToSpecIntakeClarificationAnswer => !!item);
  const summary = isRecord(raw.summary) ? raw.summary : {};
  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_idea_intake_clarification_answer_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      answers,
      answerSet: isRecord(raw.answer_set) ? raw.answer_set : {},
      summary: {
        status: stringValue(summary.status, answers.length > 0 ? "intake_clarification_answers_recorded" : "no_intake_clarification_answers"),
        answerCount: numberValue(summary.answer_count),
        acceptedAnswerCount: numberValue(summary.accepted_answer_count),
        invalidAnswerCount: numberValue(summary.invalid_answer_count),
        workspaceCount: numberValue(summary.workspace_count),
        nextGap: optionalString(summary.next_gap),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forRealIdeaIntakeWorkflow: boolValue(
          consumerBoundary.for_real_idea_intake_workflow,
        ),
        mayExecuteSpecgraph: false,
        mayExecutePromptAgent: false,
        mayApplyToSpecgraph: false,
        mayApplyAnswers: false,
        mayMutateCandidateSourceArtifacts: false,
        mayMutateCanonicalSpecs: false,
        mayWriteOntologyPackage: false,
        mayAcceptOntologyTerms: false,
        mayCreateBranchOrCommit: false,
        mayOpenPullRequest: false,
        mayExecuteGitServiceOperation: false,
      },
      authorityBoundary: {
        intakeAnswerStateIsAuthority: false,
        specgraphArtifactAuthority: false,
        ontologyAuthority: false,
        gitServiceAuthority: false,
        canonicalMutationsAllowed: false,
      },
    },
  };
}

export function useIdeaToSpecIntakeClarificationAnswers(
  options: Options = {},
) {
  const {
    url = "/api/v1/idea-to-spec-intake-clarification-answers",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecIntakeClarificationAnswersState>({
    kind: enabled ? "loading" : "idle",
  });
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [saveError, setSaveError] =
    useState<IdeaToSpecIntakeClarificationAnswerSaveError | null>(null);

  const load = useCallback(() => {
    if (!enabled) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));
    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON deploy failures are possible.
          }
          setState({
            kind: "http-error",
            status: response.status,
            statusText: response.statusText,
            body,
          });
          return;
        }
        const payload = await response.json();
        setState(parseIdeaToSpecIntakeClarificationAnswerState(payload));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ kind: "network-error", error });
      });
    return controller;
  }, [enabled, fetcher, url]);

  useEffect(() => {
    const controller = load();
    return () => controller?.abort();
  }, [load, refreshKey]);

  const saveAnswer = useCallback(
    async (input: IdeaToSpecIntakeClarificationAnswerInput) => {
      setPendingRequestId(input.requestId);
      setSaveError(null);
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: input.workspaceId,
            request_id: input.requestId,
            answer_kind: input.answerKind,
            value: input.value,
            status: input.status ?? "accepted_for_candidate",
            authority: input.authority ?? "operator_approved",
            operator_ref: input.operatorRef ?? "operator://specspace-local",
            rationale: input.rationale ?? "",
          }),
        });
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON proxy errors are possible.
          }
          setSaveError({
            kind: "http-error",
            requestId: input.requestId,
            status: response.status,
            statusText: response.statusText,
            body,
          });
          return;
        }
        const payload = await response.json();
        setState(parseIdeaToSpecIntakeClarificationAnswerState(payload));
      } catch (error: unknown) {
        setSaveError({ kind: "network-error", requestId: input.requestId, error });
      } finally {
        setPendingRequestId(null);
      }
    },
    [fetcher, url],
  );

  const answersByRequestId = useMemo(() => {
    if (state.kind !== "ok") return new Map<string, IdeaToSpecIntakeClarificationAnswer>();
    return new Map(state.data.answers.map((answer) => [answer.requestId, answer]));
  }, [state]);

  return {
    state,
    answersByRequestId,
    pendingRequestId,
    saveError,
    saveAnswer,
  };
}
