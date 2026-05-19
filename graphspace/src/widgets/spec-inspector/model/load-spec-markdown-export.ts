import {
  parseSpecMarkdownExport,
  type ParseResult,
  type SpecMarkdownExportResponse,
} from "@/shared/spec-graph-contract";

type SpecMarkdownExportParseFailure = Exclude<
  ParseResult<SpecMarkdownExportResponse>,
  { kind: "ok" }
>;

export type SpecMarkdownExportFetchFailure =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; message: string; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | SpecMarkdownExportParseFailure;

export type SpecMarkdownExportFetchResult =
  | { kind: "ok"; data: SpecMarkdownExportResponse }
  | SpecMarkdownExportFetchFailure;

type FetchSpecMarkdownExportArgs = {
  rootId: string;
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

const exportUrl = (baseUrl: string, rootId: string): string => {
  const params = new URLSearchParams({ root: rootId });
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${params.toString()}`;
};

export async function fetchSpecMarkdownExport({
  rootId,
  url = "/api/v1/spec-markdown",
  fetcher = fetch,
  signal,
}: FetchSpecMarkdownExportArgs): Promise<SpecMarkdownExportFetchResult> {
  let response: Response;
  try {
    response = await fetcher(exportUrl(url, rootId), { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "network-error", message: errorMessage(error), error };
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error bodies are allowed; status is still actionable.
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

  const parsed = parseSpecMarkdownExport(payload);
  if (parsed.kind !== "ok") return parsed;
  return { kind: "ok", data: parsed.data };
}
