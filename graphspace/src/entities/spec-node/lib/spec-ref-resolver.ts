import type { SpecNode } from "../model/types";

type SpecRefNode = Pick<SpecNode, "node_id">;
export type SpecNodeRefResolver = (token: string) => string | null;

function normalizeRef(value: string): string {
  return value.trim().toUpperCase();
}

export function createSpecNodeRefResolver(
  nodes: readonly SpecRefNode[],
): SpecNodeRefResolver {
  const nodeIds = nodes.map((node) => node.node_id);
  const exactByNormalizedId = new Map(
    nodeIds.map((nodeId) => [normalizeRef(nodeId), nodeId]),
  );

  return (token: string) => {
    const normalizedToken = normalizeRef(token);
    if (!normalizedToken) return null;

    const exact = exactByNormalizedId.get(normalizedToken);
    if (exact) return exact;

    const suffixMatches = nodeIds.filter((nodeId) =>
      normalizeRef(nodeId).endsWith(`-${normalizedToken}`),
    );

    return suffixMatches.length === 1 ? suffixMatches[0] : null;
  };
}
