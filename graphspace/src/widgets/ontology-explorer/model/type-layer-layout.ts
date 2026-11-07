import dagre from "@dagrejs/dagre";
import { buildGraph } from "@/entities/ontology-diagram";
import { directedLayout } from "./directed-layout";

type Graph = ReturnType<typeof buildGraph>;
type Node = Graph["nodes"][number];
type Edge = Graph["edges"][number];
type Hierarchy = dagre.graphlib.Graph;

function collapseHierarchyCycles(hierarchy: Hierarchy, nodes: Node[]) {
  // A cycle cannot be drawn strictly left-to-right. Treat each strongly
  // connected component as one column while keeping every edge visible.
  const component = new Map(nodes.map((node) => [node.id, node.id]));
  for (const cycle of dagre.graphlib.alg.findCycles(hierarchy)) {
    const [first, ...rest] = cycle;
    const representative = rest.reduce((left, right) => (left < right ? left : right), first);
    for (const id of cycle) component.set(id, representative);
  }
  const acyclic = new dagre.graphlib.Graph();
  for (const id of component.values()) acyclic.setNode(id, {});
  for (const edge of hierarchy.edges()) {
    const from = component.get(edge.v)!;
    const to = component.get(edge.w)!;
    if (from !== to) acyclic.setEdge(from, to);
  }

  return { component, acyclic };
}

/** Keep descendants to the right of all their parents inside each type group. */
function hierarchyColumns(nodes: Node[], edges: Edge[]): Node[][] {
  const hierarchy = new dagre.graphlib.Graph();
  for (const node of nodes) hierarchy.setNode(node.id, {});
  for (const edge of edges) {
    if (hierarchy.hasNode(edge.source) && hierarchy.hasNode(edge.target)) {
      hierarchy.setEdge(edge.source, edge.target);
    }
  }
  const { component, acyclic } = collapseHierarchyCycles(hierarchy, nodes);
  const depth = new Map(acyclic.nodes().map((id) => [id, 0]));
  for (const id of dagre.graphlib.alg.topsort(acyclic)) {
    for (const child of acyclic.successors(id) ?? []) {
      depth.set(child, Math.max(depth.get(child)!, depth.get(id)! + 1));
    }
  }
  const columns = new Map<number, Node[]>();
  for (const node of nodes) {
    const level = depth.get(component.get(node.id)!)!;
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level)!.push(node);
  }
  return [...columns.entries()].sort(([left], [right]) => left - right).map(([, column]) => column);
}

/** Arrange declarations by visual role, without inventing ontology edges. */
export function typeLayerLayout(input: Graph): Graph {
  // Reuse the base-to-subtype visual direction and preserve all edge data.
  const graph = directedLayout(input, "relations");
  const hierarchy = graph.edges.filter(
    (edge) => edge.data?.kind === "extends" || edge.data?.kind === "implements",
  );
  const hierarchyBases = new Set(hierarchy.map((edge) => edge.source));
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
  const nodeLanes = new Map(graph.nodes.map((node) => [node.id, lane(node)]));
  // Hierarchy takes precedence if an unusual cross-type edge points backwards.
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of hierarchy) {
      const parent = nodeLanes.get(edge.source)!;
      const child = nodeLanes.get(edge.target)!;
      if (parent > child) {
        nodeLanes.set(edge.target, parent);
        changed = true;
      }
    }
  }
  const lanes = new Map<number, Node[]>();
  for (const node of graph.nodes) {
    const number = nodeLanes.get(node.id)!;
    if (!lanes.has(number)) lanes.set(number, []);
    lanes.get(number)!.push(node);
  }
  const nodeHeight = (node: Node) => 76 + (node.data.ports?.length ?? 0) * 34;
  const gap = 52;
  const ordered = [...lanes.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, nodes]) => hierarchyColumns(nodes, hierarchy))
    .map((nodes) => ({
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
