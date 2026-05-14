import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import {
  parseSpecActivityFeed,
  type SpecActivityFeed,
} from "@/shared/spec-graph-contract";

/**
 * State machine the widget can render directly.
 *
 * - "idle"   : pre-mount placeholder; transitions immediately to "loading".
 * - "loading": one outstanding fetch in flight.
 * - everything else: forwarded from `EnvelopeResult<SpecActivityFeed>`.
 *
 * "ok" carries `meta` (path, mtime) so the UI can show "last refreshed at".
 * Failure variants carry enough info to render a readable empty state.
 */
export type UseRecentChangesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<SpecActivityFeed>;

type Options = {
  /** Default `/api/v1/spec-activity`. Override for tests or alternate deployments. */
  url?: string;
  /** Test injection point; defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Increment to refetch, e.g. from /api/runs-watch SSE. */
  refreshKey?: number;
};

/**
 * Fetch on mount and whenever the shared runs-watch tick changes. The previous
 * ok/error state is kept during refetch so the panel does not flash back to
 * sample data between SSE changes and response arrival.
 */
export function useRecentChanges(options: Options = {}): UseRecentChangesState {
  const { url = "/api/v1/spec-activity", fetcher, refreshKey = 0 } = options;
  const [state, setState] = useState<UseRecentChangesState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseSpecActivityFeed,
      fetcher,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((error: unknown) => {
        // AbortError is the only thing that bubbles out of fetchEnvelope.
        // Component unmounted; nothing to do.
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) {
          setState({ kind: "network-error", error });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, fetcher, refreshKey]);

  return state;
}
