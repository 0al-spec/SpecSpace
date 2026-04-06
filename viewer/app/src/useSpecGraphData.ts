import { useState, useEffect, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ApiSpecGraph, SpecViewOptions } from "./types";
import type { SpecNodeData } from "./SpecNode";
import { computeBasePositions } from "./layoutGraph";

// Spec node dimensions
const SPEC_NODE_WIDTH = 220;
const SPEC_NODE_HEIGHT = 130;

// ---------------------------------------------------------------------------
// Edge styles
// ---------------------------------------------------------------------------

/** Canonical mode: every edge kind is rendered as-is */
const CANONICAL_EDGE_STYLES: Record<string, React.CSSProperties> = {
  depends_on: { stroke: "#dc2626", strokeWidth: 2 },
  refines: { stroke: "#4e689b", strokeWidth: 1.5, strokeDasharray: "6 3" },
  relates_to: { stroke: "#7c3aed", strokeWidth: 1.5, strokeDasharray: "2 4" },
};

/** Tree mode: refinement tree edge */
const TREE_EDGE_STYLE: React.CSSProperties = {
  stroke: "#4e689b",
  strokeWidth: 2,
};

/** Tree mode: refinement + blocking edge (parent depends_on child) */
const TREE_BLOCKING_EDGE_STYLE: React.CSSProperties = {
  stroke: "#dc2626",
  strokeWidth: 2.5,
};

/** Tree mode: cross-link overlay (relates_to or cross-branch depends_on) */
const TREE_CROSSLINK_STYLE: React.CSSProperties = {
  stroke: "#7c3aed",
  strokeWidth: 1.5,
  strokeDasharray: "3 5",
};

const BROKEN_EDGE_STYLE: React.CSSProperties = {
  stroke: "#b54131",
  strokeDasharray: "4 3",
  strokeWidth: 1.5,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpecGraphData(viewOptions: SpecViewOptions) {
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

  const { viewMode, showCrossLinks, showBlocking } = viewOptions;

  // -----------------------------------------------------------------------
  // Dagre layout — topology-dependent, recomputed only when graph or mode changes
  // -----------------------------------------------------------------------
  const basePositions = useMemo(() => {
    if (!apiGraph) return new Map<string, { x: number; y: number }>();

    const nodeIds = apiGraph.nodes.map((n) => n.node_id);

    if (viewMode === "canonical") {
      // Canonical: all resolved edges drive layout
      const edgePairs = apiGraph.edges
        .filter((e) => e.status === "resolved")
        .map((e) => ({ source: e.source_id, target: e.target_id }));
      return computeBasePositions(nodeIds, edgePairs, {
        direction: "LR",
        nodeSep: 60,
        rankSep: 140,
      });
    }

    // Tree mode: inverted refines edges form the tree skeleton
    const edgePairs = apiGraph.edges
      .filter((e) => e.status === "resolved" && e.edge_kind === "refines")
      .map((e) => ({
        source: e.target_id, // invert: parent → child
        target: e.source_id,
      }));
    return computeBasePositions(nodeIds, edgePairs, {
      direction: "TB",
      nodeSep: 80,
      rankSep: 120,
    });
  }, [apiGraph, viewMode]);

  // -----------------------------------------------------------------------
  // Build React Flow nodes + edges
  // -----------------------------------------------------------------------
  const { nodes, edges } = useMemo(() => {
    if (!apiGraph) return { nodes: [], edges: [] };

    // Pre-compute lookup structures
    const refinesEdges = apiGraph.edges.filter((e) => e.edge_kind === "refines");
    const dependsOnEdges = apiGraph.edges.filter((e) => e.edge_kind === "depends_on");
    const relatesToEdges = apiGraph.edges.filter((e) => e.edge_kind === "relates_to");

    // "parent depends_on child" paired with "child refines parent"
    // Key: `${parent}::${child}`, exists if both refines and depends_on link them
    const pairedBlockingSet = new Set<string>();
    const refinesPairs = new Set(
      refinesEdges.map((e) => `${e.target_id}::${e.source_id}`), // parent::child
    );
    for (const d of dependsOnEdges) {
      const key = `${d.source_id}::${d.target_id}`; // parent::child
      if (refinesPairs.has(key)) {
        pairedBlockingSet.add(key);
      }
    }

    // refinedByCount for badges
    const refinedByCount = new Map<string, number>();
    for (const e of refinesEdges) {
      refinedByCount.set(e.target_id, (refinedByCount.get(e.target_id) ?? 0) + 1);
    }

    // Active handle kinds per node
    const activeSourceKinds = new Map<string, Set<string>>();
    const activeTargetKinds = new Map<string, Set<string>>();

    function markActive(sourceId: string, targetId: string, kind: string) {
      if (!activeSourceKinds.has(sourceId)) activeSourceKinds.set(sourceId, new Set());
      activeSourceKinds.get(sourceId)!.add(kind);
      if (!activeTargetKinds.has(targetId)) activeTargetKinds.set(targetId, new Set());
      activeTargetKinds.get(targetId)!.add(kind);
    }

    // Build edges based on mode
    const allEdges: Edge[] = [];

    if (viewMode === "canonical") {
      // ── Canonical mode: render all edges as-is ──
      for (const apiEdge of apiGraph.edges) {
        const isBroken = apiEdge.status === "broken";
        const style = isBroken
          ? BROKEN_EDGE_STYLE
          : (CANONICAL_EDGE_STYLES[apiEdge.edge_kind] ?? { stroke: "#9b8ec4", strokeWidth: 1.5 });

        markActive(apiEdge.source_id, apiEdge.target_id, apiEdge.edge_kind);

        allEdges.push({
          id: apiEdge.edge_id,
          source: apiEdge.source_id,
          target: apiEdge.target_id,
          sourceHandle: `src-${apiEdge.edge_kind}`,
          targetHandle: `tgt-${apiEdge.edge_kind}`,
          label: apiEdge.edge_kind,
          type: "default",
          animated: isBroken,
          zIndex: 1,
          style,
        });
      }
    } else {
      // ── Tree Projection mode ──
      //
      // 1) Tree skeleton: inverted refines edges (parent → child)
      // 2) Blocking decoration: if paired depends_on exists
      // 3) Cross-links: relates_to + cross-branch depends_on (hidden by default)

      // (1) Tree edges from refines
      for (const e of refinesEdges) {
        if (e.status === "broken") continue;
        const parentId = e.target_id;  // canonical: child→parent, invert: parent→child
        const childId = e.source_id;
        const pairKey = `${parentId}::${childId}`;
        const isBlocking = pairedBlockingSet.has(pairKey);

        const treeKind = "refines"; // handle kind for tree edges
        markActive(parentId, childId, treeKind);

        allEdges.push({
          id: `tree-${e.edge_id}`,
          source: parentId,
          target: childId,
          sourceHandle: `src-${treeKind}`,
          targetHandle: `tgt-${treeKind}`,
          label: isBlocking && showBlocking ? "blocking" : undefined,
          type: "default",
          animated: false,
          zIndex: 2,
          style: isBlocking && showBlocking ? TREE_BLOCKING_EDGE_STYLE : TREE_EDGE_STYLE,
        });
      }

      // (2) Cross-branch depends_on (not paired with refines)
      if (showCrossLinks) {
        for (const d of dependsOnEdges) {
          if (d.status === "broken") continue;
          const pairKey = `${d.source_id}::${d.target_id}`;
          if (pairedBlockingSet.has(pairKey)) continue; // already shown as tree blocking
          markActive(d.source_id, d.target_id, "depends_on");
          allEdges.push({
            id: `cross-dep-${d.edge_id}`,
            source: d.source_id,
            target: d.target_id,
            sourceHandle: "src-depends_on",
            targetHandle: "tgt-depends_on",
            label: "depends_on",
            type: "default",
            animated: false,
            zIndex: 0,
            style: TREE_CROSSLINK_STYLE,
          });
        }
      }

      // (3) relates_to
      if (showCrossLinks) {
        for (const r of relatesToEdges) {
          if (r.status === "broken") continue;
          markActive(r.source_id, r.target_id, "relates_to");
          allEdges.push({
            id: `cross-rel-${r.edge_id}`,
            source: r.source_id,
            target: r.target_id,
            sourceHandle: "src-relates_to",
            targetHandle: "tgt-relates_to",
            label: "relates_to",
            type: "default",
            animated: false,
            zIndex: 0,
            style: TREE_CROSSLINK_STYLE,
          });
        }
      }
    }

    // Build nodes
    const allNodes: Node[] = apiGraph.nodes.map((apiNode) => {
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

      return {
        id: apiNode.node_id,
        type: "spec",
        position: basePositions.get(apiNode.node_id) ?? { x: 0, y: 0 },
        data: nodeData,
        width: SPEC_NODE_WIDTH,
        height: SPEC_NODE_HEIGHT,
        style: { width: SPEC_NODE_WIDTH, height: SPEC_NODE_HEIGHT },
      };
    });

    return { nodes: allNodes, edges: allEdges };
  }, [apiGraph, basePositions, viewMode, showCrossLinks, showBlocking]);

  return {
    nodes,
    edges,
    loading,
    error,
    refresh: fetchGraph,
    summary: apiGraph?.summary ?? null,
  };
}
