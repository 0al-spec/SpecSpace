import { useEffect, useState } from "react";

type RunsWatchEventSource = Pick<
  EventSource,
  "addEventListener" | "removeEventListener" | "close"
>;

type RunsWatchEventSourceCtor = new (url: string) => RunsWatchEventSource;

type Options = {
  /** Default `/api/v1/runs-watch`. Override for tests or alternate deployments. */
  url?: string;
  /** Test injection point; defaults to `globalThis.EventSource`. */
  eventSourceCtor?: RunsWatchEventSourceCtor;
  /** Allows callers to disable SSE without branching their hook order. */
  enabled?: boolean;
};

/**
 * Monotonic tick from ContextBuilder's runs/ SSE endpoint.
 *
 * The endpoint emits `change` when a watched SpecGraph runs artifact changes.
 * Consumers use the returned number as a dependency for their own refetch
 * effects, keeping transport concerns separate from artifact parsing.
 */
export function useRunsWatchVersion(options: Options = {}): number {
  const {
    url = "/api/v1/runs-watch",
    eventSourceCtor,
    enabled = true,
  } = options;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const EventSourceCtor = eventSourceCtor ?? globalThis.EventSource;
    if (!EventSourceCtor) return;

    const es = new EventSourceCtor(url);
    const onChange = () => setVersion((current) => current + 1);

    es.addEventListener("change", onChange);

    return () => {
      es.removeEventListener("change", onChange);
      es.close();
    };
  }, [enabled, eventSourceCtor, url]);

  return version;
}
