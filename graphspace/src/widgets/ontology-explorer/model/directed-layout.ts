import dagre from "@dagrejs/dagre";
import { MarkerType } from "@xyflow/react";
import { buildGraph } from "@/entities/ontology-diagram";

type Graph = ReturnType<typeof buildGraph>;

/** Draw hierarchy from the base to its descendants; retain the authored edge in data. */
export function directedLayout(
  graph: Graph,
  basis: "hierarchy" | "relations" = "hierarchy",
): Graph {
  const layout = new dagre.graphlib.Graph({ multigraph: true });
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: "LR",
    nodesep: 42,
    ranksep: 110,
    marginx: 28,
    marginy: 28,
  });
  for (const node of [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    layout.setNode(node.id, {
      width: 250,
      height: 76 + (node.data.ports?.length ?? 0) * 34,
    });
  }
  const edges = graph.edges.map((edge) => {
    if (edge.data?.kind === "relation" && edge.targetHandle) {
      return {
        ...edge,
        markerEnd: edge.markerEnd ?? {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: "#90aa9b",
        },
      };
    }
    if (!isHierarchyEdge(edge.data?.kind)) return edge;
    return {
      ...edge,
      source: edge.target,
      target: edge.source,
      // In this view the arrow shows the flow from base to descendant. The
      // original child-to-base relation remains in record and in the inspector.
      label: edge.data?.kind === "implements" ? "implemented by" : "extended by",
      ariaLabel: `Visual flow from ${edge.target} to ${edge.source}; ${edge.source} ${edge.data?.kind} ${edge.target}`,
    };
  });
  // Give the hierarchy precedence. Add relation constraints only if they do
  // not introduce a cycle; rejected edges remain visible in the graph.
  const outgoing = new Map<string, Set<string>>();
  const wouldCycle = (source: string, target: string): boolean => {
    const pending = [target];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === source) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(outgoing.get(current) ?? []));
    }
    return false;
  };
  const rankEdges = edges.filter(
    (item) =>
      isHierarchyEdge(item.data?.kind) ||
      (item.data?.kind === "relation" && (Boolean(item.targetHandle) || basis === "relations")),
  );
  const priority = (edge: (typeof edges)[number]) => {
    if (isHierarchyEdge(edge.data?.kind)) return 2;
    return edge.targetHandle ? 1 : 0;
  };
  rankEdges.sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
  for (const edge of rankEdges) {
    if (wouldCycle(edge.source, edge.target)) continue;
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, new Set());
    outgoing.get(edge.source)!.add(edge.target);
    layout.setEdge(edge.source, edge.target, {}, edge.id);
  }
  dagre.layout(layout);
  return {
    nodes: graph.nodes.map((node) => {
      const position = layout.node(node.id) as { x: number; y: number };
      const height = 76 + (node.data.ports?.length ?? 0) * 34;
      return {
        ...node,
        position: { x: position.x - 125, y: position.y - height / 2 },
      };
    }),
    edges,
  };
}

function isHierarchyEdge(kind: string | undefined): boolean {
  return kind === "extends" || kind === "implements";
}

/** The visual endpoints of hierarchy edges are swapped in this layout. */
export function reversesEdge(mode: string, kind: string | undefined): boolean {
  return (mode === "directed" || mode === "relations" || mode === "types") && isHierarchyEdge(kind);
}
