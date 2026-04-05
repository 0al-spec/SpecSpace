import { useState, useEffect, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ApiSpecGraph } from "./types";
import type { SpecNodeData, SpecEdgeHandle } from "./SpecNode";
import { computeBasePositions } from "./layoutGraph";

// Spec node dimensions (slightly narrower than conversation nodes)
const SPEC_NODE_WIDTH = 220;
const SPEC_NODE_HEIGHT = 130;

// Edge style per kind
const EDGE_STYLES: Record<string, React.CSSProperties> = {
  depends_on: { stroke: "#b54131", strokeWidth: 2 },
  refines: { stroke: "#4e689b", strokeWidth: 1.5, strokeDasharray: "6 3" },
  relates_to: { stroke: "#9b8ec4", strokeWidth: 1.5, strokeDasharray: "2 4" },
};

const EDGE_LABELS: Record<string, string> = {
  depends_on: "depends_on",
  refines: "refines",
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

  // Stable Dagre positions — only recomputed when graph topology changes
  const basePositions = useMemo(() => {
    if (!apiGraph) return new Map<string, { x: number; y: number }>();
    const nodeIds = apiGraph.nodes.map((n) => n.node_id);
    const edgePairs = apiGraph.edges
      .filter((e) => e.status === "resolved")
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

    // Pre-compute per-node handle lists so each edge gets its own socket
    const sourceHandlesMap = new Map<string, SpecEdgeHandle[]>();
    const targetHandlesMap = new Map<string, SpecEdgeHandle[]>();

    for (const apiEdge of apiGraph.edges) {
      const isBroken = apiEdge.status === "broken";
      const srcHandle: SpecEdgeHandle = {
        handleId: `src-${apiEdge.edge_id}`,
        edgeKind: apiEdge.edge_kind,
        broken: isBroken,
      };
      const tgtHandle: SpecEdgeHandle = {
        handleId: `tgt-${apiEdge.edge_id}`,
        edgeKind: apiEdge.edge_kind,
        broken: isBroken,
      };
      if (!sourceHandlesMap.has(apiEdge.source_id)) sourceHandlesMap.set(apiEdge.source_id, []);
      sourceHandlesMap.get(apiEdge.source_id)!.push(srcHandle);
      if (!targetHandlesMap.has(apiEdge.target_id)) targetHandlesMap.set(apiEdge.target_id, []);
      targetHandlesMap.get(apiEdge.target_id)!.push(tgtHandle);
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
        sourceHandles: sourceHandlesMap.get(apiNode.node_id) ?? [],
        targetHandles: targetHandlesMap.get(apiNode.node_id) ?? [],
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
      const isBroken = apiEdge.status === "broken";
      const style = isBroken
        ? { stroke: "#b54131", strokeDasharray: "4 3", strokeWidth: 1.5 }
        : (EDGE_STYLES[apiEdge.edge_kind] ?? { stroke: "#9b8ec4", strokeWidth: 1.5 });

      allEdges.push({
        id: apiEdge.edge_id,
        source: apiEdge.source_id,
        target: apiEdge.target_id,
        sourceHandle: `src-${apiEdge.edge_id}`,
        targetHandle: `tgt-${apiEdge.edge_id}`,
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
