import { useEffect, useState } from "react";
import {
  parseMetricsIndex,
  type MetricsIndex,
  type MetricsIndexParseResult,
} from "@/shared/metrics-viewer-contract";

type MetricsIndexParseFailure = Exclude<
  MetricsIndexParseResult<MetricsIndex>,
  { kind: "ok" }
>;

export type UseMetricsIndexState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: MetricsIndex }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | MetricsIndexParseFailure;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

export function useMetricsIndex(options: Options = {}): UseMetricsIndexState {
  const { url = "/api/v1/metrics", fetcher = fetch, refreshKey = 0 } = options;
  const [state, setState] = useState<UseMetricsIndexState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON proxy failures are possible in production deploys.
          }
          if (!cancelled) {
            setState({
              kind: "http-error",
              status: response.status,
              statusText: response.statusText,
              body,
            });
          }
          return;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (!cancelled) {
            setState({
              kind: "response-error",
              reason: "response was not valid JSON",
              raw: error,
            });
          }
          return;
        }

        const parsed = parseMetricsIndex(payload);
        if (!cancelled) setState(parsed.kind === "ok" ? { kind: "ok", data: parsed.data } : parsed);
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
