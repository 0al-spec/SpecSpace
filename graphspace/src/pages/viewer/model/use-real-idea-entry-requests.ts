import { useCallback, useEffect, useMemo, useState } from "react";

export type RealIdeaEntryRequest = {
  requestId: string;
  workspaceId: string;
  operatorRef: string;
  ideaText: string;
  ideaSummaryHint: string | null;
  workspaceDisplayName: string | null;
  publicRouteHint: string | null;
  domainHints: readonly string[];
  constraints: readonly string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RealIdeaEntryRequestState = {
  artifactKind: "specspace_real_idea_entry_request_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  selectedWorkspaceId: string | null;
  requests: readonly RealIdeaEntryRequest[];
  summary: {
    status: string;
    requestCount: number;
    draftCount: number;
    submittedCount: number;
    activeSubmittedCount: number;
    invalidRequestCount: number;
    nextGap: string | null;
  };
};

export type UseRealIdeaEntryRequestsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RealIdeaEntryRequestState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type RealIdeaEntryRequestInput = {
  workspaceId?: string | null;
  ideaText: string;
  ideaSummaryHint?: string | null;
  workspaceDisplayName?: string | null;
  publicRouteHint?: string | null;
  domainHints?: readonly string[];
  constraints?: readonly string[];
  operatorRef?: string | null;
  status?: "draft" | "submitted";
};

export type RealIdeaEntryRequestError =
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

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function firstTrue(raw: Record<string, unknown>, fields: readonly string[]): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

function parseRequest(raw: unknown): RealIdeaEntryRequest | null {
  if (!isRecord(raw)) return null;
  const requestId = optionalString(raw.request_id);
  const workspaceId = optionalString(raw.workspace_id);
  const ideaText = optionalString(raw.idea_text);
  if (!requestId || !workspaceId || !ideaText) return null;
  return {
    requestId,
    workspaceId,
    operatorRef: stringValue(raw.operator_ref, "local_operator"),
    ideaText,
    ideaSummaryHint: optionalString(raw.idea_summary_hint),
    workspaceDisplayName: optionalString(raw.workspace_display_name),
    publicRouteHint: optionalString(raw.public_route_hint),
    domainHints: strings(raw.domain_hints),
    constraints: strings(raw.constraints),
    status: stringValue(raw.status, "draft"),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
  };
}

function parseState(raw: unknown): UseRealIdeaEntryRequestsState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", message: "real idea entry state must be an object", raw };
  }
  if (raw.artifact_kind !== "specspace_real_idea_entry_request_state") {
    return { kind: "parse-error", message: "unexpected real idea entry artifact_kind", raw };
  }
  const topLevelExpanded = firstTrue(raw, [
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
  ]);
  if (topLevelExpanded) {
    return { kind: "parse-error", message: `real idea entry state claims ${topLevelExpanded}`, raw };
  }
  const consumer = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authority = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const expanded =
    firstTrue(consumer, [
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
    firstTrue(authority, [
      "real_idea_entry_request_state_is_authority",
      "specgraph_artifact_authority",
      "platform_execution_authority",
      "ontology_authority",
      "git_service_authority",
      "canonical_mutations_allowed",
    ]);
  if (expanded) {
    return { kind: "parse-error", message: `real idea entry authority expanded: ${expanded}`, raw };
  }
  const summary = isRecord(raw.summary) ? raw.summary : {};
  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_real_idea_entry_request_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      requests: Array.isArray(raw.requests)
        ? raw.requests.flatMap((item) => {
            const request = parseRequest(item);
            return request ? [request] : [];
          })
        : [],
      summary: {
        status: stringValue(summary.status, "no_real_idea_entry_requests"),
        requestCount: numberValue(summary.request_count),
        draftCount: numberValue(summary.draft_count),
        submittedCount: numberValue(summary.submitted_count),
        activeSubmittedCount: numberValue(summary.active_submitted_count),
        invalidRequestCount: numberValue(summary.invalid_request_count),
        nextGap: optionalString(summary.next_gap),
      },
    },
  };
}

export function useRealIdeaEntryRequests({
  url,
  fetcher = fetch,
  enabled = true,
  refreshKey,
}: Options = {}) {
  const [state, setState] = useState<UseRealIdeaEntryRequestsState>(
    enabled ? { kind: "loading" } : { kind: "idle" },
  );
  const [saveError, setSaveError] = useState<RealIdeaEntryRequestError | null>(null);
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
      setState(parseState(body));
    } catch (error) {
      setState({ kind: "network-error", error });
    }
  }, [enabled, fetcher, url]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const saveRequest = useCallback(
    async (input: RealIdeaEntryRequestInput) => {
      if (!url || pending) return false;
      setPending(true);
      setSaveError(null);
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspace_id: input.workspaceId,
            idea_text: input.ideaText,
            idea_summary_hint: input.ideaSummaryHint,
            workspace_display_name: input.workspaceDisplayName,
            public_route_hint: input.publicRouteHint,
            domain_hints: input.domainHints,
            constraints: input.constraints,
            operator_ref: input.operatorRef,
            status: input.status ?? "submitted",
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
        setState(parseState(body));
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

  const activeSubmittedRequest = useMemo(
    () =>
      state.kind === "ok"
        ? state.data.requests.find((request) => request.status === "submitted") ?? null
        : null,
    [state],
  );

  return {
    configured: Boolean(enabled && url),
    state,
    saveRequest,
    saveError,
    pending,
    activeSubmittedRequest,
    reload: load,
  };
}
