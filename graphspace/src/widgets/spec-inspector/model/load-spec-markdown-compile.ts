import {
  parseSpecMarkdownCompile,
  type ParseResult,
  type SpecMarkdownCompileResponse,
  type SpecMarkdownExportScope,
} from "@/shared/spec-graph-contract";

type SpecMarkdownCompileParseFailure = Exclude<
  ParseResult<SpecMarkdownCompileResponse>,
  { kind: "ok" }
>;

export type SpecMarkdownCompileFetchFailure =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; message: string; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | SpecMarkdownCompileParseFailure;

export type SpecMarkdownCompileFetchResult =
  | { kind: "ok"; data: SpecMarkdownCompileResponse }
  | SpecMarkdownCompileFetchFailure;

type FetchSpecMarkdownCompileArgs = {
  rootId: string;
  scope?: SpecMarkdownExportScope;
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

export type SpecMarkdownCompileCapability = {
  available: boolean;
  status: string;
  detail: string;
  resolvedBinary?: string | null;
  scratchWorkspace?: string | null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

export async function fetchSpecMarkdownCompile({
  rootId,
  scope = "subtree",
  url = "/api/v1/spec-markdown/compile",
  fetcher = fetch,
  signal,
}: FetchSpecMarkdownCompileArgs): Promise<SpecMarkdownCompileFetchResult> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: rootId, scope }),
      signal,
    });
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

  const parsed = parseSpecMarkdownCompile(payload);
  if (parsed.kind !== "ok") return parsed;
  return { kind: "ok", data: parsed.data };
}
