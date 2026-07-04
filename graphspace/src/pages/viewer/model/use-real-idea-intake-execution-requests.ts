import { useCallback, useEffect, useMemo, useState } from "react";

export type RealIdeaIntakeExecutionRequest = {
  requestId: string;
  workspaceId: string;
  entryRequestId: string;
  entryRequestsRef: string | null;
  workspaceInitializationRef: string;
  operatorRef: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RealIdeaIntakeExecutionRequestState = {
  artifactKind: "specspace_real_idea_intake_execution_request_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  selectedWorkspaceId: string | null;
  requests: readonly RealIdeaIntakeExecutionRequest[];
  activeRequest: RealIdeaIntakeExecutionRequest | null;
  summary: {
    status: string;
    requestCount: number;
    requestedCount: number;
    activeRequestedCount: number;
    invalidRequestCount: number;
    nextGap: string | null;
  };
};

export type UseRealIdeaIntakeExecutionRequestsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RealIdeaIntakeExecutionRequestState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type RealIdeaIntakeExecutionRequestInput = {
  workspaceId?: string | null;
  entryRequestId: string;
  entryRequestsRef?: string | null;
  workspaceInitializationRef: string;
  operatorRef?: string | null;
};

export type RealIdeaIntakeExecutionRequestError =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  enabled?: boolean;
  refreshKey?: number | string;
};

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

function firstTrue(raw: Record<string, unknown>, fields: readonly string[]): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

function parseRequest(raw: unknown): RealIdeaIntakeExecutionRequest | null {
  if (!isRecord(raw)) return null;
  const requestId = optionalString(raw.request_id);
  const workspaceId = optionalString(raw.workspace_id);
  const entryRequestId = optionalString(raw.entry_request_id);
  const workspaceInitializationRef = optionalString(raw.workspace_initialization_ref);
  if (!requestId || !workspaceId || !entryRequestId || !workspaceInitializationRef) {
    return null;
  }
  return {
    requestId,
    workspaceId,
    entryRequestId,
    entryRequestsRef: optionalString(raw.entry_requests_ref),
    workspaceInitializationRef,
    operatorRef: stringValue(raw.operator_ref, "operator://specspace-local"),
    status: stringValue(raw.status, "requested"),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
  };
}

export function parseRealIdeaIntakeExecutionRequestState(
  raw: unknown,
): UseRealIdeaIntakeExecutionRequestsState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", message: "intake execution request state must be an object", raw };
  }
  if (raw.artifact_kind !== "specspace_real_idea_intake_execution_request_state") {
    return { kind: "parse-error", message: "unexpected intake execution request artifact_kind", raw };
  }
  const expanded =
    firstTrue(raw, ["canonical_mutations_allowed", "tracked_artifacts_written"]) ??
    firstTrue(isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {}, [
      "may_execute_specgraph",
      "may_execute_platform",
      "may_execute_prompt_agent",
      "may_apply_to_specgraph",
      "may_mutate_user_intent",
      "may_mutate_candidate_source_artifacts",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_create_branch_or_commit",
      "may_open_pull_request",
      "may_execute_git_service_operation",
      "may_publish_read_model",
    ]) ??
    firstTrue(isRecord(raw.authority_boundary) ? raw.authority_boundary : {}, [
      "real_idea_intake_execution_request_state_is_authority",
      "specgraph_artifact_authority",
      "platform_execution_authority",
      "git_service_authority",
      "canonical_mutations_allowed",
    ]);
  if (expanded) {
    return { kind: "parse-error", message: `intake execution request authority expanded: ${expanded}`, raw };
  }
  const requests = Array.isArray(raw.requests)
    ? raw.requests.flatMap((item) => {
        const request = parseRequest(item);
        return request ? [request] : [];
      })
    : [];
  const summary = isRecord(raw.summary) ? raw.summary : {};
  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_real_idea_intake_execution_request_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      requests,
      activeRequest:
        requests.find((request) => request.status === "requested") ?? null,
      summary: {
        status: stringValue(summary.status, "no_real_idea_intake_execution_requests"),
        requestCount: numberValue(summary.request_count),
        requestedCount: numberValue(summary.requested_count),
        activeRequestedCount: numberValue(summary.active_requested_count),
        invalidRequestCount: numberValue(summary.invalid_request_count),
        nextGap: optionalString(summary.next_gap),
      },
    },
  };
}

export function useRealIdeaIntakeExecutionRequests({
  url,
  fetcher = fetch,
  enabled = true,
  refreshKey,
}: Options = {}) {
  const [state, setState] = useState<UseRealIdeaIntakeExecutionRequestsState>(
    enabled ? { kind: "loading" } : { kind: "idle" },
  );
  const [saveError, setSaveError] =
    useState<RealIdeaIntakeExecutionRequestError | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !url) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetcher(url);
      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        setState({
          kind: "http-error",
          status: response.status,
          statusText: response.statusText,
          body,
        });
        return;
      }
      setState(parseRealIdeaIntakeExecutionRequestState(body));
    } catch (error) {
      setState({ kind: "network-error", error });
    }
  }, [enabled, fetcher, url]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const requestExecution = useCallback(
    async (input: RealIdeaIntakeExecutionRequestInput) => {
      if (!url || pending) return false;
      setPending(true);
      setSaveError(null);
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspace_id: input.workspaceId,
            entry_request_id: input.entryRequestId,
            entry_requests_ref: input.entryRequestsRef,
            workspace_initialization_ref: input.workspaceInitializationRef,
            operator_ref: input.operatorRef,
          }),
        });
        const body = await response.json().catch(() => undefined);
        if (!response.ok) {
          setSaveError({
            kind: "http-error",
            status: response.status,
            statusText: response.statusText,
            body,
          });
          return false;
        }
        setState(parseRealIdeaIntakeExecutionRequestState(body));
        return true;
      } catch (error) {
        setSaveError({ kind: "network-error", error });
        return false;
      } finally {
        setPending(false);
      }
    },
    [fetcher, pending, url],
  );

  const activeRequest = useMemo(() => {
    if (state.kind !== "ok") return null;
    return state.data.activeRequest;
  }, [state]);

  return {
    state,
    activeRequest,
    pending,
    saveError,
    requestExecution,
    reload: load,
    configured: Boolean(url),
  };
}
