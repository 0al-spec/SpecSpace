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
  /** Default `/api/spec-activity`. Override for tests or alternate deployments. */
  url?: string;
  /** Test injection point; defaults to global fetch. */
  fetcher?: typeof fetch;
};

/**
 * One-shot fetch on mount. Live updates (SSE on /api/runs-watch) are deferred
 * to a follow-up — keeping this PR focused on the envelope -> parse -> render
 * pipeline before adding a watcher to it.
 */
export function useRecentChanges(options: Options = {}): UseRecentChangesState {
  const { url = "/api/spec-activity", fetcher } = options;
  const [state, setState] = useState<UseRecentChangesState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });

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
  }, [url, fetcher]);

  return state;
}
