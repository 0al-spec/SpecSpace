import {
  buildSpecPMLifecycleBadgesByNode,
  type SpecPMLifecycleBadge,
} from "@/entities/specpm-lifecycle";
import {
  parseSpecPMLifecycle,
  type SpecPMLifecycleParseResult,
  type SpecPMLifecycle,
} from "@/shared/specpm-lifecycle-contract";

type SpecPMLifecycleParseFailure = Exclude<
  SpecPMLifecycleParseResult<SpecPMLifecycle>,
  { kind: "ok" }
>;

export type SpecPMLifecycleBadgesFailure =
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; message: string; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | SpecPMLifecycleParseFailure;

export type SpecPMLifecycleBadgesResult =
  | {
      kind: "ok";
      data: SpecPMLifecycle;
      badgesByNode: Map<string, SpecPMLifecycleBadge>;
    }
  | SpecPMLifecycleBadgesFailure;

type FetchSpecPMLifecycleBadgesArgs = {
  url?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

export async function fetchSpecPMLifecycleBadges({
  url = "/api/v1/specpm/lifecycle",
  fetcher = fetch,
  signal,
}: FetchSpecPMLifecycleBadgesArgs = {}): Promise<SpecPMLifecycleBadgesResult> {
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
      body = await response.json();
    } catch {
      // Non-JSON error bodies are normal for proxy/server failures.
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

  const parsed = parseSpecPMLifecycle(payload);
  if (parsed.kind !== "ok") return parsed;

  return {
    kind: "ok",
    data: parsed.data,
    badgesByNode: buildSpecPMLifecycleBadgesByNode(parsed.data.packages),
  };
}
