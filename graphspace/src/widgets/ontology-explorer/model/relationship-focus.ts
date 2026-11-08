import { type Selection, buildGraph } from "@/entities/ontology-diagram";

type Graph = ReturnType<typeof buildGraph>;
type GraphEdge = Graph["edges"][number];
type Dependency = { edge: GraphEdge; target: string };

export type RelationshipFocus = {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
};

function selectedRelationshipId(graph: Graph, selection: Selection | null): string | undefined {
  if (!selection) return undefined;
  if (selection.type === "node") {
    const node = graph.nodes.find((item) => item.id === selection.id);
    return node?.data.kind === "relation" ? node.data.label : undefined;
  }
  const edge = graph.edges.find((item) => item.id === selection.id);
  return edge?.data?.kind === "relation" ? edge.data.semanticId : undefined;
}

/** The raw graph points from a declaration to its base, and from a Ref type
 * to its owner. Use these semantics rather than the current visual direction.
 */
function dependencyIndex(graph: Graph): Map<string, Dependency[]> {
  const dependencies = new Map<string, Dependency[]>();
  for (const edge of graph.edges) {
    const kind = edge.data?.kind;
    if (kind !== "field-ref" && kind !== "extends" && kind !== "implements") continue;
    const owner = kind === "field-ref" ? edge.target : edge.source;
    const target = kind === "field-ref" ? edge.source : edge.target;
    const entries = dependencies.get(owner) ?? [];
    entries.push({ edge, target });
    dependencies.set(owner, entries);
  }
  return dependencies;
}

/** Focus the selected relationship, its roles and declaration dependencies.
 * Other ontology relations are not recursively expanded.
 */
export function relationshipFocus(
  graph: Graph,
  selection: Selection | null,
): RelationshipFocus | null {
  const semanticId = selectedRelationshipId(graph, selection);
  if (!semanticId) return null;
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const relationNode = graph.nodes.find(
    (node) => node.data.kind === "relation" && node.data.label === semanticId,
  );
  if (relationNode) nodeIds.add(relationNode.id);
  for (const edge of graph.edges) {
    if (edge.data?.kind !== "relation" || edge.data.semanticId !== semanticId) continue;
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }
  if (!nodeIds.size) return null;

  const dependencies = dependencyIndex(graph);
  const queue = [...nodeIds];
  for (const id of queue) {
    for (const { edge, target } of dependencies.get(id) ?? []) {
      edgeIds.add(edge.id);
      if (!nodeIds.has(target)) {
        nodeIds.add(target);
        queue.push(target);
      }
    }
  }
  return { nodeIds, edgeIds };
}

/** Add display-only classes; leave positions, declarations and filters intact. */
export function dimOutsideRelationship(graph: Graph, focus: RelationshipFocus | null): Graph {
  if (!focus) return graph;
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      className: `${node.className ?? ""}${focus.nodeIds.has(node.id) ? "" : " filter-dim"}`,
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      className: `${edge.className ?? ""}${focus.edgeIds.has(edge.id) ? "" : " filter-dim"}`,
    })),
  };
}
