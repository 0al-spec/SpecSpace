import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import {
  parseImplementationWorkIndex,
  type ImplementationWorkIndex,
} from "@/shared/spec-graph-contract";

/**
 * Same state machine shape as useRecentChanges — both widgets pattern-match
 * one discriminated union covering loading + every failure mode.
 */
export type UseImplementationWorkState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<ImplementationWorkIndex>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  /** Increment to refetch, e.g. from /api/runs-watch SSE. */
  refreshKey?: number;
};

/**
 * Fetch on mount and whenever the shared runs-watch tick changes. Mirrors
 * useRecentChanges so all live artifact panels share one refresh contract.
 */
export function useImplementationWorkIndex(
  options: Options = {},
): UseImplementationWorkState {
  const { url = "/api/v1/implementation-work-index", fetcher, refreshKey = 0 } = options;
  const [state, setState] = useState<UseImplementationWorkState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseImplementationWorkIndex,
      fetcher,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, fetcher, refreshKey]);

  return state;
}
