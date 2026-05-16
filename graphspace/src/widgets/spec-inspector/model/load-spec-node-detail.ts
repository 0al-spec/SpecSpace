import {
  parseSpecNodeDetail,
  type ParseResult,
  type SpecNodeDetailResponse,
} from "@/shared/spec-graph-contract";

type SpecNodeDetailParseFailure = Exclude<
  ParseResult<SpecNodeDetailResponse>,
  { kind: "ok" }
>;

export type SpecNodeDetailFetchFailure =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; message: string; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | SpecNodeDetailParseFailure;

export type SpecNodeDetailFetchResult =
  | { kind: "ok"; data: SpecNodeDetailResponse }
  | SpecNodeDetailFetchFailure;

type FetchSpecNodeDetailArgs = {
  nodeId: string;
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

const detailUrl = (baseUrl: string, nodeId: string): string => {
  const encodedNodeId = encodeURIComponent(nodeId);
  const queryStart = baseUrl.indexOf("?");
  const path = queryStart === -1 ? baseUrl : baseUrl.slice(0, queryStart);
  const query = queryStart === -1 ? "" : baseUrl.slice(queryStart);
  return `${path.replace(/\/$/, "")}/${encodedNodeId}${query}`;
};

export async function fetchSpecNodeDetail({
  nodeId,
  url = "/api/v1/spec-nodes",
  fetcher = fetch,
  signal,
}: FetchSpecNodeDetailArgs): Promise<SpecNodeDetailFetchResult> {
  let response: Response;
  try {
    response = await fetcher(detailUrl(url, nodeId), { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "network-error", message: errorMessage(error), error };
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error bodies are common enough; status is sufficient.
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

  const parsed = parseSpecNodeDetail(payload);
  if (parsed.kind !== "ok") return parsed;
  return { kind: "ok", data: parsed.data };
}
