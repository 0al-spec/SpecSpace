import { useEffect, useState } from "react";
import {
  fetchSpecPMLifecycleBadges,
  type SpecPMLifecycleBadgesResult,
} from "./load-specpm-lifecycle-badges";

export type UseSpecPMLifecycleBadgesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | SpecPMLifecycleBadgesResult;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

export function useSpecPMLifecycleBadges(
  options: Options = {},
): UseSpecPMLifecycleBadgesState {
  const { url, fetcher, refreshKey = 0 } = options;
  const [state, setState] = useState<UseSpecPMLifecycleBadgesState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchSpecPMLifecycleBadges({
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
  }, [fetcher, refreshKey, url]);

  return state;
}
