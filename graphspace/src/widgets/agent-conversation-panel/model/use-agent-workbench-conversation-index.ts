import { useEffect, useState } from "react";
import {
  fetchAgentConversationIndex,
  type AgentConversationIndexArtifact,
  type AgentWorkbenchReadResult,
} from "@/entities/agent-workbench";

export type AgentWorkbenchConversationIndexState =
  | { kind: "idle" }
  | { kind: "loading" }
  | AgentWorkbenchReadResult<AgentConversationIndexArtifact>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

export function useAgentWorkbenchConversationIndex({
  url,
  fetcher,
  refreshKey = 0,
}: Options = {}): AgentWorkbenchConversationIndexState {
  const [state, setState] = useState<AgentWorkbenchConversationIndexState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading" });

    fetchAgentConversationIndex({
      url,
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
  }, [fetcher, refreshKey, url]);

  return state;
}
