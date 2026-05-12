import { useEffect, useState } from "react";
import {
  fetchSpecNodeDetail,
  type SpecNodeDetailFetchResult,
} from "./load-spec-node-detail";

export type UseSpecNodeDetailState =
  | { kind: "idle" }
  | { kind: "loading" }
  | SpecNodeDetailFetchResult;

type Options = {
  nodeId: string;
  url?: string;
  fetcher?: typeof fetch;
};

export function useSpecNodeDetail({
  nodeId,
  url,
  fetcher,
}: Options): UseSpecNodeDetailState {
  const [state, setState] = useState<UseSpecNodeDetailState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });

    fetchSpecNodeDetail({
      nodeId,
      url,
      fetcher,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) {
          setState({
            kind: "network-error",
            message: error instanceof Error ? error.message : "Network error",
            error,
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nodeId, url, fetcher]);

  return state;
}
