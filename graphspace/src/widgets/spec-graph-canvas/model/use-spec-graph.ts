import { useEffect, useState } from "react";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";
import {
  loadSpecGraph,
  type SpecGraphResolvedState,
} from "./load-spec-graph";
import { SAMPLE_SPEC_GRAPH } from "./sample-data";

export type UseSpecGraphState =
  | { kind: "idle"; source: "sample"; data: SpecGraphResponse }
  | { kind: "loading"; source: "sample"; data: SpecGraphResponse }
  | SpecGraphResolvedState;

type Options = {
  /** Default `/api/spec-graph`. Override for tests or alternate deployments. */
  url?: string;
  /** Test injection point; defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Increment to refetch, e.g. from a future spec-watch bridge. */
  refreshKey?: number;
  /** Override sample data for visual tests without a backend. */
  sample?: SpecGraphResponse;
};

export function useSpecGraph(options: Options = {}): UseSpecGraphState {
  const {
    url = "/api/spec-graph",
    fetcher,
    refreshKey = 0,
    sample = SAMPLE_SPEC_GRAPH,
  } = options;
  const [state, setState] = useState<UseSpecGraphState>({
    kind: "idle",
    source: "sample",
    data: sample,
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) =>
      current.kind === "idle"
        ? { kind: "loading", source: "sample", data: sample }
        : current,
    );

    loadSpecGraph({
      url,
      fetcher,
      signal: controller.signal,
      sample,
    })
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) {
          setState({
            kind: "sample",
            source: "sample",
            data: sample,
            failure: {
              kind: "network-error",
              message: error instanceof Error ? error.message : "Network error",
              error,
            },
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, fetcher, refreshKey, sample]);

  return state;
}
