import { buildGraph } from "@/entities/ontology-diagram";

type Graph = ReturnType<typeof buildGraph>;

/** Reflect the layout while keeping arrowheads at their semantic targets. */
export function mirrorGraph(graph: Graph): Graph {
  const xs = graph.nodes.map((node) => node.position.x);
  const axis = xs.length ? Math.min(...xs) + Math.max(...xs) : 0;
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position, x: axis - node.position.x },
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      source: edge.target,
      target: edge.source,
      markerStart: edge.markerEnd,
      markerEnd: edge.markerStart,
      ariaLabel: edge.ariaLabel ?? `Edge from ${edge.source} to ${edge.target}`,
    })),
  };
}
