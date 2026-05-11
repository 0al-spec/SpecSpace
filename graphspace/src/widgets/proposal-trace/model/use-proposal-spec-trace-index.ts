import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import {
  parseProposalSpecTraceIndex,
  type ProposalSpecTraceIndex,
} from "@/shared/spec-graph-contract";

export type UseProposalTraceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<ProposalSpecTraceIndex>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

export function useProposalSpecTraceIndex(options: Options = {}): UseProposalTraceState {
  const { url = "/api/proposal-spec-trace-index", fetcher, refreshKey = 0 } = options;
  const [state, setState] = useState<UseProposalTraceState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseProposalSpecTraceIndex,
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
