import { useState, useEffect, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ApiSpecGraph } from "./types";
import type { SpecNodeData } from "./SpecNode";
import { computeBasePositions } from "./layoutGraph";

// Spec node dimensions (slightly narrower than conversation nodes)
const SPEC_NODE_WIDTH = 220;
const SPEC_NODE_HEIGHT = 130;

// `refines` edges are hidden from the canvas: they create confusing back-loops
// (child→parent) while the same information is surfaced as node badges.
// Only depends_on and relates_to are rendered as edges.
const RENDERED_EDGE_KINDS = new Set(["depends_on", "relates_to"]);

// Edge style per kind
const EDGE_STYLES: Record<string, React.CSSProperties> = {
  depends_on: { stroke: "#b54131", strokeWidth: 2 },
  relates_to: { stroke: "#9b8ec4", strokeWidth: 1.5, strokeDasharray: "2 4" },
};

const EDGE_LABELS: Record<string, string> = {
  depends_on: "depends_on",
  relates_to: "relates_to",
};

export function useSpecGraphData() {
  const [apiGraph, setApiGraph] = useState<ApiSpecGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spec-graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: ApiSpecGraph = json.graph ?? json;
      setApiGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch spec graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Stable Dagre positions — only recomputed when graph topology changes.
  // `refines` edges are excluded from layout: they go child→parent and would
  // place children to the LEFT of parents, inverting the semantic hierarchy.
  // Only depends_on and relates_to drive left-to-right positioning.
  const basePositions = useMemo(() => {
    if (!apiGraph) return new Map<string, { x: number; y: number }>();
    const nodeIds = apiGraph.nodes.map((n) => n.node_id);
    const edgePairs = apiGraph.edges
      .filter((e) => e.status === "resolved" && RENDERED_EDGE_KINDS.has(e.edge_kind))
      .map((e) => ({ source: e.source_id, target: e.target_id }));
    return computeBasePositions(nodeIds, edgePairs, {
      direction: "LR",
      nodeSep: 60,
      rankSep: 140,
    });
  }, [apiGraph]);

  const { nodes, edges } = useMemo(() => {
    if (!apiGraph) return { nodes: [], edges: [] };

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    // Pre-compute which edge kinds are active per node (for handle coloring)
    // and a refinedByCount badge counter from the hidden refines edges.
    const activeSourceKinds = new Map<string, Set<string>>(); // nodeId → Set<edgeKind>
    const activeTargetKinds = new Map<string, Set<string>>(); // nodeId → Set<edgeKind>
    const refinedByCount = new Map<string, number>();          // nodeId → count

    for (const apiEdge of apiGraph.edges) {
      if (apiEdge.edge_kind === "refines") {
        refinedByCount.set(apiEdge.target_id, (refinedByCount.get(apiEdge.target_id) ?? 0) + 1);
        continue;
      }
      if (!RENDERED_EDGE_KINDS.has(apiEdge.edge_kind)) continue;

      if (!activeSourceKinds.has(apiEdge.source_id)) activeSourceKinds.set(apiEdge.source_id, new Set());
      activeSourceKinds.get(apiEdge.source_id)!.add(apiEdge.edge_kind);

      if (!activeTargetKinds.has(apiEdge.target_id)) activeTargetKinds.set(apiEdge.target_id, new Set());
      activeTargetKinds.get(apiEdge.target_id)!.add(apiEdge.edge_kind);
    }

    for (const apiNode of apiGraph.nodes) {
      const hasBrokenEdges = apiNode.diagnostics.length > 0;

      const nodeData: SpecNodeData = {
        nodeId: apiNode.node_id,
        title: apiNode.title,
        kind: apiNode.kind,
        status: apiNode.status,
        maturity: apiNode.maturity,
        acceptanceCount: apiNode.acceptance_count,
        decisionsCount: apiNode.decisions_count,
        hasBrokenEdges,
        refinedByCount: refinedByCount.get(apiNode.node_id) ?? 0,
        activeSourceKinds: activeSourceKinds.get(apiNode.node_id) ?? new Set(),
        activeTargetKinds: activeTargetKinds.get(apiNode.node_id) ?? new Set(),
      };

      allNodes.push({
        id: apiNode.node_id,
        type: "spec",
        position: basePositions.get(apiNode.node_id) ?? { x: 0, y: 0 },
        data: nodeData,
        width: SPEC_NODE_WIDTH,
        height: SPEC_NODE_HEIGHT,
        style: { width: SPEC_NODE_WIDTH, height: SPEC_NODE_HEIGHT },
      });
    }

    for (const apiEdge of apiGraph.edges) {
      if (!RENDERED_EDGE_KINDS.has(apiEdge.edge_kind)) continue; // skip refines

      const isBroken = apiEdge.status === "broken";
      const style = isBroken
        ? { stroke: "#b54131", strokeDasharray: "4 3", strokeWidth: 1.5 }
        : (EDGE_STYLES[apiEdge.edge_kind] ?? { stroke: "#9b8ec4", strokeWidth: 1.5 });

      allEdges.push({
        id: apiEdge.edge_id,
        source: apiEdge.source_id,
        target: apiEdge.target_id,
        sourceHandle: `src-${apiEdge.edge_kind}`,
        targetHandle: `tgt-${apiEdge.edge_kind}`,
        label: EDGE_LABELS[apiEdge.edge_kind] ?? apiEdge.edge_kind,
        type: "default",
        animated: isBroken,
        zIndex: 1,
        style,
      });
    }

    return { nodes: allNodes, edges: allEdges };
  }, [apiGraph, basePositions]);

  return {
    nodes,
    edges,
    loading,
    error,
    refresh: fetchGraph,
    summary: apiGraph?.summary ?? null,
  };
}
