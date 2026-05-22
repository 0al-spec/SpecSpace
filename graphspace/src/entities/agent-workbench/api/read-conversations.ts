import {
  parseAgentConversationArtifact,
  parseAgentConversationIndexArtifact,
  type AgentConversationParseResult,
} from "../model/conversation-artifact-read";
import type {
  AgentConversationArtifact,
  AgentConversationIndexArtifact,
} from "../model/conversation-artifact";
import type { AgentConversationId } from "../model/runtime";

export type AgentWorkbenchSource = {
  name: string;
  path: string | null;
  status: string;
  detail?: string;
  item_count?: number;
};

export type AgentWorkbenchReadResult<T> =
  | { kind: "ok"; data: T; source: AgentWorkbenchSource | null }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | AgentConversationParseFailure<T>;

type AgentConversationParseFailure<T> = Exclude<
  AgentConversationParseResult<T>,
  { kind: "ok" }
>;

type FetchAgentConversationIndexArgs = {
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

type FetchAgentConversationArtifactArgs = {
  conversationId: AgentConversationId;
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

const DEFAULT_INDEX_URL = "/api/v1/agent-workbench/conversations";

export async function fetchAgentConversationIndex({
  url = DEFAULT_INDEX_URL,
  fetcher = fetch,
  signal,
}: FetchAgentConversationIndexArgs = {}): Promise<
  AgentWorkbenchReadResult<AgentConversationIndexArtifact>
> {
  return fetchAgentWorkbenchData({
    url,
    fetcher,
    signal,
    parse: parseAgentConversationIndexArtifact,
  });
}

export async function fetchAgentConversationArtifact({
  conversationId,
  url = DEFAULT_INDEX_URL,
  fetcher = fetch,
  signal,
}: FetchAgentConversationArtifactArgs): Promise<
  AgentWorkbenchReadResult<AgentConversationArtifact>
> {
  return fetchAgentWorkbenchData({
    url: conversationUrl(url, conversationId),
    fetcher,
    signal,
    parse: parseAgentConversationArtifact,
  });
}

async function fetchAgentWorkbenchData<T>({
  url,
  fetcher,
  signal,
  parse,
}: {
  url: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  parse: (raw: unknown) => AgentConversationParseResult<T>;
}): Promise<AgentWorkbenchReadResult<T>> {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "network-error", error };
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON proxy errors still carry useful HTTP status.
    }
    return {
      kind: "http-error",
      status: response.status,
      statusText: response.statusText,
      body,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return {
      kind: "response-error",
      reason: "response was not valid JSON",
      raw: error,
    };
  }

  const data = responseData(payload);
  if (!data.ok) {
    return {
      kind: "response-error",
      reason: data.reason,
      raw: payload,
    };
  }

  const parsed = parse(data.value);
  if (parsed.kind !== "ok") return parsed;

  return {
    kind: "ok",
    data: parsed.data,
    source: responseSource(payload),
  };
}

function conversationUrl(baseUrl: string, conversationId: AgentConversationId): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/${encodeURIComponent(conversationId)}`;
}

function responseData(payload: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    return { ok: false, reason: "Agent Workbench response did not contain data." };
  }
  return { ok: true, value: (payload as { data: unknown }).data };
}

function responseSource(payload: unknown): AgentWorkbenchSource | null {
  if (!payload || typeof payload !== "object" || !("source" in payload)) return null;
  const source = (payload as { source: unknown }).source;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  if (typeof record.name !== "string" || typeof record.status !== "string") return null;
  return {
    name: record.name,
    path: typeof record.path === "string" ? record.path : null,
    status: record.status,
    detail: typeof record.detail === "string" ? record.detail : undefined,
    item_count: typeof record.item_count === "number" ? record.item_count : undefined,
  };
}
