import type { ParseResult } from "../spec-graph-contract";

/**
 * Standard ContextBuilder runs envelope. The Python backend wraps every
 * SpecGraph artifact in this shape so the viewer can show last-modified
 * info beside the data.
 */
type Envelope<T> = {
  path: string;
  mtime: number;
  mtime_iso: string;
  data: T;
};

/**
 * The result of trying to load and parse a contract artifact. Mirrors the
 * project CLAUDE.md requirement: the UI must show readable "not built /
 * parse error / version not yet supported" states instead of crashing.
 *
 * Parse-stage variants are forwarded from `ParseResult<T>` (defined by the
 * contract slice) so consumers can pattern-match a single union without
 * caring whether the failure was network, server, or schema.
 */
export type EnvelopeResult<T> =
  | {
      kind: "ok";
      data: T;
      meta: { path: string; mtime: number; mtime_iso: string };
    }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "envelope-error"; reason: string; raw: unknown }
  | Exclude<ParseResult<T>, { kind: "ok" }>;

type FetchEnvelopeArgs<T> = {
  url: string;
  parse: (raw: unknown) => ParseResult<T>;
  /** Injection point for tests and SWR-like wrappers. Defaults to global fetch. */
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

const isEnvelope = (v: unknown): v is Envelope<unknown> =>
  !!v &&
  typeof v === "object" &&
  "data" in v &&
  "path" in v &&
  "mtime" in v &&
  "mtime_iso" in v;

export async function fetchEnvelope<T>({
  url,
  parse,
  fetcher = fetch,
  signal,
}: FetchEnvelopeArgs<T>): Promise<EnvelopeResult<T>> {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error) {
    // Network failure, CORS, abort, etc. AbortErrors propagate so callers
    // unmounting in React effects can ignore them; everything else folds
    // into network-error for the UI.
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "network-error", error };
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Body wasn't JSON (e.g. HTML 502 page). Drop it; status is enough.
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
    // response.json() can reject with AbortError too if cancellation happens
    // after headers arrive but before the body finishes streaming. Treat that
    // identically to fetch()-time aborts — re-throw so callers ignoring
    // unmount events don't surface a phantom envelope-error.
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { kind: "envelope-error", reason: "response was not valid JSON", raw: error };
  }

  if (!isEnvelope(payload)) {
    return {
      kind: "envelope-error",
      reason: "response did not match the runs envelope shape",
      raw: payload,
    };
  }

  const parsed = parse(payload.data);
  if (parsed.kind !== "ok") return parsed;

  return {
    kind: "ok",
    data: parsed.data,
    meta: {
      path: payload.path,
      mtime: payload.mtime,
      mtime_iso: payload.mtime_iso,
    },
  };
}
