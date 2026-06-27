import type { Edge, Node } from "@xyflow/react";
import type {
  OntologyGraphEdge,
  OntologyGraphNode,
  OntologyGraphProjection,
} from "@/shared/ontology-graph-contract";

export type OntologyFlowNodeData = {
  label: string;
  fqid: string;
  kind: string;
  central: boolean;
  matched: boolean;
};

export type OntologyFlowEdgeData = {
  label: string;
  kind: OntologyGraphEdge["kind"];
  matched: boolean;
};

export type OntologyFlowNode = Node<OntologyFlowNodeData, "ontologyNode">;
export type OntologyFlowEdge = Edge<OntologyFlowEdgeData>;

export type OntologyFlowElements = {
  nodes: OntologyFlowNode[];
  edges: OntologyFlowEdge[];
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 92;
const COLUMN_GAP = 320;
const ROW_GAP = 140;

function normalizedQuery(query: string): string {
  return query.trim().toLowerCase();
}

function nodeMatches(node: OntologyGraphNode, query: string): boolean {
  if (!query) return false;
  return [node.id, node.label, node.fqid, node.kind, node.description ?? ""].some((value) =>
    value.toLowerCase().includes(query),
  );
}

function edgeMatches(edge: OntologyGraphEdge, query: string): boolean {
  if (!query) return false;
  return [
    edge.id,
    edge.label,
    edge.relationFqid,
    edge.description ?? "",
    edge.source,
    edge.target,
  ].some((value) => value.toLowerCase().includes(query));
}

function incomingCountByNode(edges: readonly OntologyGraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

function rankNodes(
  nodes: readonly OntologyGraphNode[],
  edges: readonly OntologyGraphEdge[],
): Map<string, number> {
  const incoming = incomingCountByNode(edges);
  const sorted = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  return new Map(
    sorted.map((node, index) => {
      const centralOffset = node.central ? -1 : 0;
      const rank = Math.max(0, (incoming.get(node.id) ?? 0) + centralOffset);
      return [node.id, rank + Math.floor(index / 8)] as const;
    }),
  );
}

function flowNodeClassName(node: OntologyGraphNode, matched: boolean): string {
  return [
    "ontology-flow-node",
    node.central ? "ontology-flow-node-central" : "",
    matched ? "ontology-flow-node-match" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function toOntologyFlowElements(
  projection: OntologyGraphProjection,
  query = "",
): OntologyFlowElements {
  const search = normalizedQuery(query);
  const ranks = rankNodes(projection.nodes, projection.edges);
  const rowsByRank = new Map<number, number>();

  const nodes = [...projection.nodes]
    .sort((left, right) => {
      const rankDelta = (ranks.get(left.id) ?? 0) - (ranks.get(right.id) ?? 0);
      return rankDelta || left.id.localeCompare(right.id);
    })
    .map((node): OntologyFlowNode => {
      const rank = ranks.get(node.id) ?? 0;
      const row = rowsByRank.get(rank) ?? 0;
      rowsByRank.set(rank, row + 1);
      const matched = nodeMatches(node, search);
      return {
        id: node.id,
        type: "ontologyNode",
        position: {
          x: rank * COLUMN_GAP,
          y: row * ROW_GAP,
        },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        className: flowNodeClassName(node, matched),
        data: {
          label: node.label,
          fqid: node.fqid,
          kind: node.kind,
          central: node.central,
          matched,
        },
      };
    });

  const edges = projection.edges.map((edge) => {
    const matched = edgeMatches(edge, search);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      animated: matched,
      className: [
        "ontology-flow-edge",
        edge.kind === "extends" ? "ontology-flow-edge-extends" : "",
        matched ? "ontology-flow-edge-match" : "",
      ]
        .filter(Boolean)
        .join(" "),
      data: {
        label: edge.label,
        kind: edge.kind,
        matched,
      },
    };
  });

  return { nodes, edges };
}
