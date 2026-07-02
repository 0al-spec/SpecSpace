import { useCallback, useEffect, useMemo, useState } from "react";

export type ProjectLocalOntologyReviewDecision = {
  decisionId: string;
  workspaceId: string;
  candidateId: string;
  repairSessionId: string | null;
  laneRef: string | null;
  termId: string | null;
  term: string | null;
  termKey: string;
  currentStatus: string;
  reviewAction: string;
  decisionValue: Record<string, unknown>;
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
  updatesOntologyLockfile: false;
  acceptsOntologyTerms: false;
  createsBranchOrCommit: false;
  opensPullRequest: false;
};

export type ProjectLocalOntologyReviewDecisionState = {
  artifactKind: "specspace_project_local_ontology_review_decision_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  selectedWorkspaceId: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  decisions: readonly ProjectLocalOntologyReviewDecision[];
  summary: {
    status: string;
    decisionCount: number;
    workspaceCount: number;
    actionCounts: Record<string, number>;
    nextGap: string | null;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forProjectLocalOntologyReview: boolean;
    mayExecutePromptAgent: boolean;
    mayExecuteSpecgraph: boolean;
    mayExecutePlatform: boolean;
    mayApplyToSpecgraph: boolean;
    mayApplyDecisions: boolean;
    mayMutateCandidateArtifacts: boolean;
    mayMutateCanonicalSpecs: boolean;
    mayWriteOntologyPackage: boolean;
    mayWriteOntologyLockfile: boolean;
    mayAcceptOntologyTerms: boolean;
    mayCreateBranchOrCommit: boolean;
    mayOpenPullRequest: boolean;
  };
  authorityBoundary: {
    decisionStateIsAuthority: boolean;
    specgraphArtifactAuthority: boolean;
    ontologyAuthority: boolean;
    gitServiceAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseProjectLocalOntologyReviewDecisionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: ProjectLocalOntologyReviewDecisionState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type ProjectLocalOntologyReviewDecisionInput = {
  termKey: string;
  action: string;
  decisionValue: Record<string, unknown>;
  workspaceId?: string | null;
  operatorRef?: string | null;
};

export type ProjectLocalOntologyReviewDecisionSaveError =
  | {
      kind: "http-error";
      termKey: string;
      status: number;
      statusText: string;
      body?: unknown;
    }
  | {
      kind: "network-error";
      termKey: string;
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
  "may_execute_prompt_agent",
  "may_execute_specgraph",
  "may_execute_platform",
  "may_apply_to_specgraph",
  "may_apply_decisions",
  "may_mutate_candidate_artifacts",
  "may_mutate_canonical_specs",
  "may_write_ontology_package",
  "may_write_ontology_lockfile",
  "may_accept_ontology_terms",
  "may_create_branch_or_commit",
  "may_open_pull_request",
] as const;

const authorityMutationFields = [
  "project_local_ontology_review_decision_state_is_authority",
  "specgraph_artifact_authority",
  "ontology_authority",
  "git_service_authority",
  "canonical_mutations_allowed",
] as const;

const decisionMutationFields = [
  "canonical_mutations_allowed",
  "tracked_artifacts_written",
  "applies_to_specgraph",
  "applies_to_candidate_artifacts",
  "mutates_canonical_specs",
  "writes_ontology_package",
  "updates_ontology_lockfile",
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

function parseDecision(
  raw: Record<string, unknown>,
): ProjectLocalOntologyReviewDecision | null {
  const workspaceId = optionalString(raw.workspace_id);
  const candidateId = optionalString(raw.candidate_id);
  const termKey = optionalString(raw.term_key);
  const reviewAction = optionalString(raw.review_action);
  if (!workspaceId || !candidateId || !termKey || !reviewAction) return null;
  return {
    decisionId: stringValue(
      raw.decision_id,
      `specspace-project-local-ontology-decision::${workspaceId}::${termKey}`,
    ),
    workspaceId,
    candidateId,
    repairSessionId: optionalString(raw.repair_session_id),
    laneRef: optionalString(raw.project_local_ontology_review_lane_ref),
    termId: optionalString(raw.term_id),
    term: optionalString(raw.term),
    termKey,
    currentStatus: stringValue(raw.current_status, "unreviewed"),
    reviewAction,
    decisionValue: isRecord(raw.decision_value) ? raw.decision_value : {},
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
    updatesOntologyLockfile: false,
    acceptsOntologyTerms: false,
    createsBranchOrCommit: false,
    opensPullRequest: false,
  };
}

export function parseProjectLocalOntologyReviewDecisionState(
  raw: unknown,
): UseProjectLocalOntologyReviewDecisionState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", message: "State root must be an object.", raw };
  }
  if (raw.artifact_kind !== "specspace_project_local_ontology_review_decision_state") {
    return { kind: "parse-error", message: "Unexpected project-local ontology decision artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported project-local ontology decision schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Project-local ontology decision state must be owned by SpecSpace.", raw };
  }
  const topLevelMutation = firstTrue(raw, topLevelMutationFields);
  if (topLevelMutation) {
    return { kind: "parse-error", message: `Project-local ontology decision state cannot claim ${topLevelMutation}.`, raw };
  }
  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Project-local ontology decision consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Project-local ontology decision authority boundary cannot claim ${authorityMutation}.`, raw };
  }

  const rows = Array.isArray(raw.decisions) ? raw.decisions.filter(isRecord) : [];
  for (const row of rows) {
    const decisionMutation = firstTrue(row, decisionMutationFields);
    if (decisionMutation) {
      return { kind: "parse-error", message: `Project-local ontology decision cannot claim ${decisionMutation}.`, raw };
    }
  }
  const decisions = rows
    .map(parseDecision)
    .filter((entry): entry is ProjectLocalOntologyReviewDecision => !!entry);
  const summary = isRecord(raw.summary) ? raw.summary : {};
  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_project_local_ontology_review_decision_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      decisions,
      summary: {
        status: stringValue(
          summary.status,
          decisions.length > 0
            ? "project_local_ontology_review_decisions_recorded"
            : "no_project_local_ontology_review_decisions",
        ),
        decisionCount:
          typeof summary.decision_count === "number"
            ? summary.decision_count
            : decisions.length,
        workspaceCount:
          typeof summary.workspace_count === "number" ? summary.workspace_count : 0,
        actionCounts: numberMap(summary.action_counts),
        nextGap: optionalString(summary.next_gap),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forProjectLocalOntologyReview: boolValue(
          consumerBoundary.for_project_local_ontology_review,
        ),
        mayExecutePromptAgent: boolValue(consumerBoundary.may_execute_prompt_agent),
        mayExecuteSpecgraph: boolValue(consumerBoundary.may_execute_specgraph),
        mayExecutePlatform: boolValue(consumerBoundary.may_execute_platform),
        mayApplyToSpecgraph: boolValue(consumerBoundary.may_apply_to_specgraph),
        mayApplyDecisions: boolValue(consumerBoundary.may_apply_decisions),
        mayMutateCandidateArtifacts: boolValue(
          consumerBoundary.may_mutate_candidate_artifacts,
        ),
        mayMutateCanonicalSpecs: boolValue(
          consumerBoundary.may_mutate_canonical_specs,
        ),
        mayWriteOntologyPackage: boolValue(
          consumerBoundary.may_write_ontology_package,
        ),
        mayWriteOntologyLockfile: boolValue(
          consumerBoundary.may_write_ontology_lockfile,
        ),
        mayAcceptOntologyTerms: boolValue(consumerBoundary.may_accept_ontology_terms),
        mayCreateBranchOrCommit: boolValue(
          consumerBoundary.may_create_branch_or_commit,
        ),
        mayOpenPullRequest: boolValue(consumerBoundary.may_open_pull_request),
      },
      authorityBoundary: {
        decisionStateIsAuthority: boolValue(
          authorityBoundary.project_local_ontology_review_decision_state_is_authority,
        ),
        specgraphArtifactAuthority: boolValue(
          authorityBoundary.specgraph_artifact_authority,
        ),
        ontologyAuthority: boolValue(authorityBoundary.ontology_authority),
        gitServiceAuthority: boolValue(authorityBoundary.git_service_authority),
        canonicalMutationsAllowed: boolValue(
          authorityBoundary.canonical_mutations_allowed,
        ),
      },
    },
  };
}

export function useProjectLocalOntologyReviewDecisions(options: Options = {}) {
  const {
    url = "/api/v1/project-local-ontology-review-decisions",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] =
    useState<UseProjectLocalOntologyReviewDecisionState>({ kind: "idle" });
  const [pendingTermKey, setPendingTermKey] = useState<string | null>(null);
  const [saveError, setSaveError] =
    useState<ProjectLocalOntologyReviewDecisionSaveError | null>(null);

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
    setState(parseProjectLocalOntologyReviewDecisionState(await response.json()));
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

  const saveDecision = useCallback(async (input: ProjectLocalOntologyReviewDecisionInput) => {
    setPendingTermKey(input.termKey);
    setSaveError(null);
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term_key: input.termKey,
          action: input.action,
          decision_value: input.decisionValue,
          workspace_id: input.workspaceId ?? undefined,
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
          termKey: input.termKey,
          status: response.status,
          statusText: response.statusText,
          body,
        });
        return;
      }
      setState(parseProjectLocalOntologyReviewDecisionState(await response.json()));
    } catch (error) {
      setSaveError({ kind: "network-error", termKey: input.termKey, error });
    } finally {
      setPendingTermKey(null);
    }
  }, [fetcher, url]);

  const decisionsByTermKey = useMemo(() => {
    if (state.kind !== "ok") return new Map<string, ProjectLocalOntologyReviewDecision>();
    return new Map(state.data.decisions.map((decision) => [decision.termKey, decision]));
  }, [state]);

  return { state, decisionsByTermKey, pendingTermKey, saveError, saveDecision };
}
