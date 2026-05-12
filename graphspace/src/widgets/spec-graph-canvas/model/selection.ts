import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";

export type SpecGraphSelection = {
  specDir: string;
  node: SpecNode;
  nodes: readonly SpecNode[];
  edges: readonly SpecEdge[];
};

export function buildSpecGraphSelection(
  response: SpecGraphResponse,
  nodeId: string | null,
): SpecGraphSelection | null {
  if (!nodeId) return null;
  const node = response.graph.nodes.find((candidate) => candidate.node_id === nodeId);
  if (!node) return null;
  return {
    specDir: response.spec_dir,
    node,
    nodes: response.graph.nodes,
    edges: response.graph.edges,
  };
}
