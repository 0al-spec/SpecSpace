export type SpecSelectionHistory = {
  readonly back: readonly string[];
  readonly forward: readonly string[];
};

export type SpecSelectionHistoryStep = {
  readonly history: SpecSelectionHistory;
  readonly selectedNodeId: string | null;
};

const DEFAULT_LIMIT = 32;

export function createSpecSelectionHistory(): SpecSelectionHistory {
  return { back: [], forward: [] };
}

export function pushSpecSelectionHistory(
  history: SpecSelectionHistory,
  currentNodeId: string | null,
  nextNodeId: string,
  limit = DEFAULT_LIMIT,
): SpecSelectionHistory {
  if (currentNodeId === nextNodeId) return history;

  return {
    back: currentNodeId
      ? appendBounded(history.back, currentNodeId, limit)
      : history.back,
    forward: [],
  };
}

export function goBackSpecSelectionHistory(
  history: SpecSelectionHistory,
  currentNodeId: string | null,
): SpecSelectionHistoryStep {
  const selectedNodeId = history.back[history.back.length - 1] ?? null;
  if (!selectedNodeId) return { history, selectedNodeId: currentNodeId };

  return {
    selectedNodeId,
    history: {
      back: history.back.slice(0, -1),
      forward: currentNodeId
        ? appendUnique(history.forward, currentNodeId)
        : history.forward,
    },
  };
}

export function goForwardSpecSelectionHistory(
  history: SpecSelectionHistory,
  currentNodeId: string | null,
): SpecSelectionHistoryStep {
  const selectedNodeId = history.forward[history.forward.length - 1] ?? null;
  if (!selectedNodeId) return { history, selectedNodeId: currentNodeId };

  return {
    selectedNodeId,
    history: {
      back: currentNodeId ? appendUnique(history.back, currentNodeId) : history.back,
      forward: history.forward.slice(0, -1),
    },
  };
}

export function pruneSpecSelectionHistory(
  history: SpecSelectionHistory,
  selectableNodeIds: ReadonlySet<string>,
): SpecSelectionHistory {
  return {
    back: history.back.filter((nodeId) => selectableNodeIds.has(nodeId)),
    forward: history.forward.filter((nodeId) => selectableNodeIds.has(nodeId)),
  };
}

function appendBounded(
  stack: readonly string[],
  nodeId: string,
  limit: number,
): readonly string[] {
  const next = appendUnique(stack, nodeId);
  return next.slice(Math.max(0, next.length - limit));
}

function appendUnique(stack: readonly string[], nodeId: string): readonly string[] {
  if (stack[stack.length - 1] === nodeId) return stack;
  return [...stack, nodeId];
}
