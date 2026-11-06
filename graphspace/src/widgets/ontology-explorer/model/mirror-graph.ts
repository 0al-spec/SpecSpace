import { buildGraph } from "@/entities/ontology-diagram";

type Graph = ReturnType<typeof buildGraph>;

/** Reflect node positions without reversing semantic endpoints or named handles. */
export function mirrorGraph(graph: Graph): Graph {
  const xs = graph.nodes.map((node) => node.position.x);
  const axis = xs.length ? Math.min(...xs) + Math.max(...xs) : 0;
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position, x: axis - node.position.x },
    })),
    // Keep named handles attached to their original nodes; only reflect positions.
    edges: graph.edges,
  };
}
