import { useEffect, useState } from "react";
import {
  parseSpecNodeDetail,
  type SpecNodeDetail,
} from "@/shared/spec-graph-contract";

export type UseSpecNodePreviewDetailState =
  | { kind: "idle" }
  | { kind: "loading"; nodeId: string }
  | { kind: "ok"; nodeId: string; data: SpecNodeDetail }
  | { kind: "unavailable"; nodeId: string; reason: string };

type Options = {
  nodeId: string | null;
  url?: string;
  fetcher?: typeof fetch;
};

const detailUrl = (baseUrl: string, nodeId: string): string => {
  const encodedNodeId = encodeURIComponent(nodeId);
  const queryStart = baseUrl.indexOf("?");
  const path = queryStart === -1 ? baseUrl : baseUrl.slice(0, queryStart);
  const query = queryStart === -1 ? "" : baseUrl.slice(queryStart);
  return `${path.replace(/\/$/, "")}/${encodedNodeId}${query}`;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Network error";

export function useSpecNodePreviewDetail({
  nodeId,
  url = "/api/v1/spec-nodes",
  fetcher = fetch,
}: Options): UseSpecNodePreviewDetailState {
  const [state, setState] = useState<UseSpecNodePreviewDetailState>({ kind: "idle" });

  useEffect(() => {
    if (!nodeId) {
      setState({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading", nodeId });

    fetcher(detailUrl(url, nodeId), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return {
            kind: "unavailable" as const,
            nodeId,
            reason: `${response.status} ${response.statusText}`.trim(),
          };
        }

        const payload = await response.json();
        const parsed = parseSpecNodeDetail(payload);
        if (parsed.kind !== "ok") {
          return {
            kind: "unavailable" as const,
            nodeId,
            reason: parsed.kind,
          };
        }

        return {
          kind: "ok" as const,
          nodeId,
          data: parsed.data.data,
        };
      })
      .then((nextState) => {
        if (!cancelled) setState(nextState);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) {
          setState({
            kind: "unavailable",
            nodeId,
            reason: errorMessage(error),
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, nodeId, url]);

  return state;
}
