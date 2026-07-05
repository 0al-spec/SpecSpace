import { useCallback, useEffect, useMemo, useState } from "react";

export type ProductWorkspaceCreationRequest = {
  requestId: string;
  workspaceId: string;
  displayName: string;
  route: string;
  operatorRef: string;
  rootIntentSummary: string | null;
  rootIntentSummaryPresent: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductWorkspaceCreationRequestState = {
  artifactKind: "specspace_product_workspace_creation_request_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  selectedWorkspaceId: string | null;
  requests: readonly ProductWorkspaceCreationRequest[];
  activeRequest: ProductWorkspaceCreationRequest | null;
  summary: {
    status: string;
    requestCount: number;
    requestedCount: number;
    activeRequestedCount: number;
    invalidRequestCount: number;
    nextGap: string | null;
  };
};

export type UseProductWorkspaceCreationRequestsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: ProductWorkspaceCreationRequestState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

export type ProductWorkspaceCreationRequestInput = {
  workspaceId?: string | null;
  displayName: string;
  route?: string | null;
  rootIntentSummary?: string | null;
  operatorRef?: string | null;
  status?: "requested";
};

export type ProductWorkspaceCreationRequestError =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown };

type Options = {
  url?: string;
  writeUrl?: string;
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

function parseRequest(raw: unknown): ProductWorkspaceCreationRequest | null {
  if (!isRecord(raw)) return null;
  const requestId = optionalString(raw.request_id);
  const workspaceId = optionalString(raw.workspace_id);
  const displayName = optionalString(raw.display_name);
  const route = optionalString(raw.route);
  if (!requestId || !workspaceId || !displayName || !route) return null;
  return {
    requestId,
    workspaceId,
    displayName,
    route,
    operatorRef: stringValue(raw.operator_ref, "local_operator"),
    rootIntentSummary: optionalString(raw.root_intent_summary),
    rootIntentSummaryPresent:
      raw.root_intent_summary_present === true ||
      optionalString(raw.root_intent_summary) !== null,
    status: stringValue(raw.status, "requested"),
    createdAt: stringValue(raw.created_at, "unknown"),
    updatedAt: stringValue(raw.updated_at, "unknown"),
  };
}

export function parseProductWorkspaceCreationRequestState(
  raw: unknown,
): UseProductWorkspaceCreationRequestsState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", message: "workspace creation state must be an object", raw };
  }
  if (raw.artifact_kind !== "specspace_product_workspace_creation_request_state") {
    return { kind: "parse-error", message: "unexpected workspace creation artifact_kind", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "unexpected workspace creation schema_version", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "unexpected workspace creation state_owner", raw };
  }
  const topLevelExpanded = firstTrue(raw, [
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
  ]);
  if (topLevelExpanded) {
    return { kind: "parse-error", message: `workspace creation state claims ${topLevelExpanded}`, raw };
  }
  const consumer = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authority = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const expanded =
    firstTrue(consumer, [
      "may_execute_specgraph",
      "may_execute_platform",
      "may_execute_prompt_agent",
      "may_apply_to_specgraph",
      "may_create_workspace",
      "may_initialize_workspace",
      "may_mutate_canonical_specs",
      "may_write_ontology_package",
      "may_accept_ontology_terms",
      "may_create_branch_or_commit",
      "may_open_pull_request",
      "may_execute_git_service_operation",
      "may_publish_read_model",
    ]) ??
    firstTrue(authority, [
      "product_workspace_creation_request_state_is_authority",
      "specgraph_artifact_authority",
      "platform_execution_authority",
      "workspace_catalog_authority",
      "ontology_authority",
      "git_service_authority",
      "canonical_mutations_allowed",
    ]);
  if (expanded) {
    return { kind: "parse-error", message: `workspace creation authority expanded: ${expanded}`, raw };
  }
  const summary = isRecord(raw.summary) ? raw.summary : {};
  const requests = Array.isArray(raw.requests)
    ? raw.requests.flatMap((item) => {
        const request = parseRequest(item);
        return request ? [request] : [];
      })
    : [];
  const activeRequest = parseRequest(raw.active_request);
  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_product_workspace_creation_request_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      selectedWorkspaceId: optionalString(raw.selected_workspace_id),
      requests,
      activeRequest,
      summary: {
        status: stringValue(summary.status, "no_product_workspace_creation_requests"),
        requestCount: numberValue(summary.request_count),
        requestedCount: numberValue(summary.requested_count),
        activeRequestedCount: numberValue(summary.active_requested_count),
        invalidRequestCount: numberValue(summary.invalid_request_count),
        nextGap: optionalString(summary.next_gap),
      },
    },
  };
}

export function useProductWorkspaceCreationRequests({
  url,
  writeUrl,
  fetcher = fetch,
  enabled = true,
  refreshKey,
}: Options = {}) {
  const [state, setState] = useState<UseProductWorkspaceCreationRequestsState>(
    enabled ? { kind: "loading" } : { kind: "idle" },
  );
  const [saveError, setSaveError] =
    useState<ProductWorkspaceCreationRequestError | null>(null);
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
      setState(parseProductWorkspaceCreationRequestState(body));
    } catch (error) {
      setState({ kind: "network-error", error });
    }
  }, [enabled, fetcher, url]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const saveRequest = useCallback(
    async (input: ProductWorkspaceCreationRequestInput) => {
      const targetUrl = writeUrl ?? url;
      if (!targetUrl || pending) return false;
      setPending(true);
      setSaveError(null);
      try {
        const response = await fetcher(targetUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspace_id: input.workspaceId,
            display_name: input.displayName,
            route: input.route,
            root_intent_summary: input.rootIntentSummary,
            operator_ref: input.operatorRef,
            status: input.status ?? "requested",
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
        const parsed = parseProductWorkspaceCreationRequestState(body);
        setState(parsed);
        return parsed.kind === "ok" ? parsed.data : false;
      } catch (error) {
        setSaveError({ kind: "network-error", error });
        return false;
      } finally {
        setPending(false);
      }
    },
    [fetcher, pending, url, writeUrl],
  );

  const activeRequest = useMemo(
    () => (state.kind === "ok" ? state.data.activeRequest : null),
    [state],
  );
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    configured: Boolean(enabled && url),
    state,
    saveRequest,
    clearSaveError,
    saveError,
    pending,
    activeRequest,
    reload: load,
  };
}
