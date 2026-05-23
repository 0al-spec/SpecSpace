import type {
  SpecGraphEdge,
  SpecGraphResponse,
  SpecGraphSummary,
} from "@/shared/spec-graph-contract";

export type SpecGraphCanvasSubtreeCollapseModel = {
  response: SpecGraphResponse;
  hiddenNodeIds: ReadonlySet<string>;
  childCountsByNodeId: ReadonlyMap<string, number>;
  descendantCountsByNodeId: ReadonlyMap<string, number>;
  hiddenDescendantCountsByNodeId: ReadonlyMap<string, number>;
};

function buildRefinesChildrenByParent(
  response: SpecGraphResponse,
): Map<string, string[]> {
  const nodeIds = new Set(response.graph.nodes.map((node) => node.node_id));
  const childrenByParent = new Map<string, string[]>();

  for (const edge of response.graph.edges) {
    if (edge.status !== "resolved" || edge.edge_kind !== "refines") continue;
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue;
    childrenByParent.set(edge.target_id, [
      ...(childrenByParent.get(edge.target_id) ?? []),
      edge.source_id,
    ]);
  }

  for (const [parentId, children] of childrenByParent.entries()) {
    childrenByParent.set(parentId, [...new Set(children)].sort((a, b) => a.localeCompare(b)));
  }

  return childrenByParent;
}

function collectDescendants(
  nodeId: string,
  childrenByParent: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(nodeId) ?? [])].sort((a, b) =>
    b.localeCompare(a),
  );

  while (stack.length > 0) {
    const childId = stack.pop()!;
    if (childId === nodeId || descendants.has(childId)) continue;
    descendants.add(childId);
    stack.push(...(childrenByParent.get(childId) ?? []));
  }

  return descendants;
}

function summarizeVisibleGraph(
  source: SpecGraphSummary,
  visibleNodeCount: number,
  visibleEdges: readonly SpecGraphEdge[],
  visibleRootCount: number,
): SpecGraphSummary {
  return {
    ...source,
    node_count: visibleNodeCount,
    edge_count: visibleEdges.length,
    root_count: visibleRootCount,
    broken_edge_count: visibleEdges.filter((edge) => edge.status === "broken").length,
  };
}

export function buildSpecGraphCanvasSubtreeCollapseModel(
  response: SpecGraphResponse,
  collapsedNodeIds: ReadonlySet<string>,
): SpecGraphCanvasSubtreeCollapseModel {
  const childrenByParent = buildRefinesChildrenByParent(response);
  const childCountsByNodeId = new Map(
    [...childrenByParent.entries()].map(([nodeId, children]) => [
      nodeId,
      children.length,
    ]),
  );
  const descendantCountsByNodeId = new Map(
    [...childrenByParent.keys()].map((nodeId) => [
      nodeId,
      collectDescendants(nodeId, childrenByParent).size,
    ]),
  );
  const hiddenNodeIds = new Set<string>();
  const hiddenDescendantCountsByNodeId = new Map<string, number>();

  for (const nodeId of [...collapsedNodeIds].sort((a, b) => a.localeCompare(b))) {
    const descendants = collectDescendants(nodeId, childrenByParent);
    hiddenDescendantCountsByNodeId.set(nodeId, descendants.size);
    for (const descendantId of descendants) hiddenNodeIds.add(descendantId);
  }

  const visibleNodes = response.graph.nodes.filter(
    (node) => !hiddenNodeIds.has(node.node_id),
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.node_id));
  const visibleEdges = response.graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id),
  );
  const visibleRoots = response.graph.roots.filter((nodeId) =>
    visibleNodeIds.has(nodeId),
  );
  const graphSummary = summarizeVisibleGraph(
    response.graph.summary,
    visibleNodes.length,
    visibleEdges,
    visibleRoots.length,
  );
  const summary = summarizeVisibleGraph(
    response.summary,
    visibleNodes.length,
    visibleEdges,
    visibleRoots.length,
  );

  return {
    response: {
      ...response,
      graph: {
        ...response.graph,
        nodes: visibleNodes,
        edges: visibleEdges,
        roots: visibleRoots,
        summary: graphSummary,
      },
      summary,
    },
    hiddenNodeIds,
    childCountsByNodeId,
    descendantCountsByNodeId,
    hiddenDescendantCountsByNodeId,
  };
}
