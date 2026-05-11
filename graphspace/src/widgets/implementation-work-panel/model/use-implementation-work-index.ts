import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import {
  parseImplementationWorkIndex,
  type ImplementationWorkIndex,
} from "@/shared/api/spec-graph-contract";

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
};

/**
 * One-shot fetch on mount, mirroring useRecentChanges. Shared the fetchEnvelope
 * + parseArtifact pipeline so adding a third artifact next time is more wiring
 * and less new code.
 */
export function useImplementationWorkIndex(
  options: Options = {},
): UseImplementationWorkState {
  const { url = "/api/implementation-work-index", fetcher } = options;
  const [state, setState] = useState<UseImplementationWorkState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });

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
  }, [url, fetcher]);

  return state;
}
