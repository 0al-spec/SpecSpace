import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";

export type SpecEdgeEndpointModel = {
  nodeId: string;
  title: string | null;
  missing: boolean;
};

export type SpecEdgeInspectorModel = {
  edge: SpecEdge;
  source: SpecEdgeEndpointModel;
  target: SpecEdgeEndpointModel;
  directionLabel: string;
  relationLabel: string;
  statusLabel: string;
  hasMissingEndpoint: boolean;
};

const EDGE_KIND_LABELS: Record<SpecEdge["edge_kind"], string> = {
  depends_on: "Depends on",
  refines: "Refines",
  relates_to: "Relates to",
};

function endpointModel(
  nodeId: string,
  nodesById: ReadonlyMap<string, Pick<SpecNode, "title">>,
): SpecEdgeEndpointModel {
  const node = nodesById.get(nodeId);
  return {
    nodeId,
    title: node?.title ?? null,
    missing: !node,
  };
}

export function buildSpecEdgeInspectorModel(
  edge: SpecEdge,
  nodesById: ReadonlyMap<string, Pick<SpecNode, "title">>,
): SpecEdgeInspectorModel {
  const source = endpointModel(edge.source_id, nodesById);
  const target = endpointModel(edge.target_id, nodesById);
  return {
    edge,
    source,
    target,
    directionLabel: `${edge.source_id} -> ${edge.target_id}`,
    relationLabel: EDGE_KIND_LABELS[edge.edge_kind],
    statusLabel: edge.status.replace(/_/g, " "),
    hasMissingEndpoint: source.missing || target.missing,
  };
}
