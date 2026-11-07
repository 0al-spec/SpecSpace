import { buildGraph } from "@/entities/ontology-diagram";
import { directedLayout } from "./directed-layout";

type Graph = ReturnType<typeof buildGraph>;
type Node = Graph["nodes"][number];

/** Arrange declarations by visual role, without inventing ontology edges. */
export function typeLayerLayout(input: Graph): Graph {
  // Reuse the base-to-subtype visual direction and preserve all edge data.
  const graph = directedLayout(input, "relations");
  const hierarchyBases = new Set(
    graph.edges
      .filter((edge) => edge.data?.kind === "extends" || edge.data?.kind === "implements")
      .map((edge) => edge.source),
  );
  const actionRoles = new Set(
    graph.edges
      .filter((edge) => edge.data?.kind === "relation" && edge.targetHandle === "action")
      .map((edge) => edge.source),
  );
  const lane = (node: Node): number => {
    if (
      hierarchyBases.has(node.id) &&
      (node.data.kind === "external" || node.data.source?.id === "ontology.foundation")
    )
      return 0;
    if (node.data.kind === "relation") return 3;
    if (node.data.isAction || actionRoles.has(node.id)) return 2;
    // Unknown external references stay in the neutral declaration lane.
    return 1;
  };
  const lanes = new Map<number, Node[]>();
  for (const node of graph.nodes) {
    const number = lane(node);
    if (!lanes.has(number)) lanes.set(number, []);
    lanes.get(number)!.push(node);
  }
  const nodeHeight = (node: Node) => 76 + (node.data.ports?.length ?? 0) * 34;
  const gap = 52;
  const ordered = [...lanes.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, nodes]) => ({
      nodes,
      height: nodes.reduce((sum, node) => sum + nodeHeight(node), 0) + gap * (nodes.length - 1),
    }));
  const maximum = Math.max(0, ...ordered.map((column) => column.height));
  const positions = new Map<string, { x: number; y: number }>();
  ordered.forEach(({ nodes, height }, index) => {
    nodes.sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
    let y = 28 + (maximum - height) / 2;
    for (const node of nodes) {
      positions.set(node.id, { x: 28 + index * 450, y });
      y += nodeHeight(node) + gap;
    }
  });
  return {
    nodes: graph.nodes.map((node) => ({ ...node, position: positions.get(node.id)! })),
    edges: graph.edges,
  };
}
