import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type {
  SpecInspectorModel,
  SpecInspectorSelection,
  SpecRelation,
  SpecRelationGroup,
} from "./types";

const byNodeId = (a: SpecRelation, b: SpecRelation) =>
  a.nodeId.localeCompare(b.nodeId);

function relationFromId(
  nodeId: string,
  nodesById: ReadonlyMap<string, SpecNode>,
  edge: SpecEdge | null,
): SpecRelation {
  const node = nodesById.get(nodeId);
  return {
    nodeId,
    title: node?.title ?? null,
    status: node && edge?.status !== "broken" ? "resolved" : "broken",
    edgeId: edge?.edge_id ?? null,
  };
}

function findEdge(
  edges: readonly SpecEdge[],
  edgeKind: SpecEdge["edge_kind"],
  sourceId: string,
  targetId: string,
): SpecEdge | null {
  return edges.find(
    (edge) =>
      edge.edge_kind === edgeKind &&
      edge.source_id === sourceId &&
      edge.target_id === targetId,
  ) ?? null;
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export function buildSpecInspectorModel(
  selection: SpecInspectorSelection,
): SpecInspectorModel {
  const { node, nodes, edges } = selection;
  const nodesById = new Map(nodes.map((candidate) => [candidate.node_id, candidate]));

  const dependsOn = uniqueSorted(node.depends_on).map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "depends_on", node.node_id, targetId),
    ),
  );
  const refines = uniqueSorted(node.refines).map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "refines", node.node_id, targetId),
    ),
  );
  const refinedBy = edges
    .filter((edge) => edge.edge_kind === "refines" && edge.target_id === node.node_id)
    .map((edge) => relationFromId(edge.source_id, nodesById, edge))
    .sort(byNodeId);
  const relatedIds = uniqueSorted([
    ...node.relates_to,
    ...edges
      .filter((edge) => edge.edge_kind === "relates_to" && edge.target_id === node.node_id)
      .map((edge) => edge.source_id),
  ]);
  const related = relatedIds.map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "relates_to", node.node_id, targetId) ??
        findEdge(edges, "relates_to", targetId, node.node_id),
    ),
  );

  const relationGroups: SpecRelationGroup[] = [
    { id: "depends_on", label: "Depends on", items: dependsOn },
    { id: "refines", label: "Refines", items: refines },
    { id: "refined_by", label: "Refined by", items: refinedBy },
    { id: "relates_to", label: "Related", items: related },
  ];

  return {
    node,
    maturityLabel:
      typeof node.maturity === "number" ? `${Math.round(node.maturity * 100)}%` : "n/a",
    relationGroups,
  };
}
