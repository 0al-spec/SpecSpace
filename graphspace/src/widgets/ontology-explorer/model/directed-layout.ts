import dagre from "@dagrejs/dagre";
import { buildGraph } from "@/entities/ontology-diagram";

type Graph = ReturnType<typeof buildGraph>;

/** Rank only the type hierarchy; secondary relationships never change node placement. */
export function directedLayout(graph: Graph): Graph {
  const layout = new dagre.graphlib.Graph({ multigraph: true });
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: "LR", nodesep: 42, ranksep: 110, marginx: 28, marginy: 28 });
  for (const node of [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    layout.setNode(node.id, { width: 220, height: 76 });
  }
  const edges = graph.edges.map((edge) => {
    if (edge.data?.kind !== "extends" && edge.data?.kind !== "implements") return edge;
    return {
      ...edge,
      source: edge.target,
      target: edge.source,
      markerStart: edge.markerEnd,
      markerEnd: edge.markerStart,
      ariaLabel: edge.ariaLabel ?? `Edge from ${edge.source} to ${edge.target}`,
    };
  });
  for (const edge of edges
    .filter((item) => isHierarchyEdge(item.data?.kind))
    .sort((a, b) => a.id.localeCompare(b.id))) {
    layout.setEdge(edge.source, edge.target, {}, edge.id);
  }
  dagre.layout(layout);
  return {
    nodes: graph.nodes.map((node) => {
      const position = layout.node(node.id) as { x: number; y: number };
      return { ...node, position: { x: position.x - 110, y: position.y - 38 } };
    }),
    edges,
  };
}

function isHierarchyEdge(kind: string | undefined): boolean {
  return kind === "extends" || kind === "implements";
}

/** The visual endpoints of hierarchy edges are swapped in this layout. */
export function reversesEdge(mode: string, kind: string | undefined): boolean {
  return mode === "RL" || (mode === "directed" && isHierarchyEdge(kind));
}
