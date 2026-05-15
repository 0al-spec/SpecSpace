import {
  parseSpecGraph,
  type ParseResult,
  type SpecGraphResponse,
} from "@/shared/spec-graph-contract";
import { SAMPLE_SPEC_GRAPH } from "./sample-data";

type SpecGraphParseFailure = Exclude<ParseResult<SpecGraphResponse>, { kind: "ok" }>;

export type SpecGraphFetchFailure =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; message: string; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | SpecGraphParseFailure;

export type SpecGraphFetchResult =
  | { kind: "ok"; data: SpecGraphResponse }
  | SpecGraphFetchFailure;

export type SpecGraphResolvedState =
  | { kind: "ok"; source: "live"; data: SpecGraphResponse }
  | {
      kind: "sample";
      source: "sample";
      data: SpecGraphResponse;
      failure: SpecGraphFetchFailure;
    };

type FetchSpecGraphArgs = {
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

type LoadSpecGraphArgs = FetchSpecGraphArgs & {
  sample?: SpecGraphResponse;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export async function fetchSpecGraph({
  url = "/api/v1/spec-graph",
  fetcher = fetch,
  signal,
}: FetchSpecGraphArgs = {}): Promise<SpecGraphFetchResult> {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "network-error", message: errorMessage(error), error };
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await readJson(response);
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
    payload = await readJson(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return {
      kind: "response-error",
      reason: "response was not valid JSON",
      raw: error,
    };
  }

  const parsed = parseSpecGraph(payload);
  if (parsed.kind !== "ok") return parsed;
  return { kind: "ok", data: parsed.data };
}

export async function loadSpecGraph({
  sample = SAMPLE_SPEC_GRAPH,
  ...fetchArgs
}: LoadSpecGraphArgs = {}): Promise<SpecGraphResolvedState> {
  const result = await fetchSpecGraph(fetchArgs);
  if (result.kind === "ok") {
    return { kind: "ok", source: "live", data: result.data };
  }
  return { kind: "sample", source: "sample", data: sample, failure: result };
}
