import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ApiSpecGraph, SpecViewOptions } from "./types";
import type { SpecNodeData } from "./SpecNode";
import { SPEC_HANDLE_KINDS, type SpecHandleKind } from "./SpecNode";
import type { ExpandedSpecGroupData } from "./ExpandedSpecNode";
import type { SpecSubItemNodeData } from "./SpecSubItemNode";
import { computeBasePositions, computeLinearPositions } from "./layoutGraph";
import { useSessionSet } from "./useSessionState";

// Spec node dimensions
const SPEC_NODE_WIDTH = 280;
const SPEC_NODE_HEIGHT = 130;

// Expanded spec group layout constants
// EXP_BODY_H: height of the spec content block (mirrors collapsed node ~130px)
const EXP_BODY_H = SPEC_NODE_HEIGHT;
const EXP_ITEM_H = 24;
const EXP_ITEM_GAP = 4;
const EXP_PAD = 10;
const EXP_GROUP_W = 280;

interface SubItemSpec {
  subKind: SpecSubItemNodeData["subKind"];
  index: number;
  label: string;
  met: boolean;
}

/** Extract acceptance criteria, decisions, and invariants from raw spec YAML detail. */
function extractSubItems(detail: Record<string, unknown>): SubItemSpec[] {
  const items: SubItemSpec[] = [];

  const acceptance = Array.isArray(detail.acceptance) ? (detail.acceptance as unknown[]) : [];
  const specSection =
    typeof detail.specification === "object" &&
    detail.specification !== null &&
    !Array.isArray(detail.specification)
      ? (detail.specification as Record<string, unknown>)
      : {};
  const decisions = Array.isArray(specSection.decisions) ? (specSection.decisions as unknown[]) : [];
  const invariants = Array.isArray(specSection.invariants) ? (specSection.invariants as unknown[]) : [];

  // Met criteria from evidence
  const evidenceList = Array.isArray(detail.acceptance_evidence)
    ? (detail.acceptance_evidence as Array<Record<string, unknown>>)
    : [];
  const metCriteria = new Set(
    evidenceList
      .filter((ev) => ev && ev.evidence)
      .map((ev) => String(ev.criterion ?? "").trim())
      .filter(Boolean),
  );

  const truncate = (s: string) => (s.length > 58 ? s.slice(0, 57) + "…" : s);

  acceptance.forEach((item, i) => {
    const text = typeof item === "string" ? item : JSON.stringify(item);
    items.push({ subKind: "acceptance", index: i, label: truncate(text), met: metCriteria.has(text.trim()) });
  });

  decisions.forEach((item, i) => {
    let text: string;
    if (typeof item === "string") {
      text = item;
    } else if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      text =
        typeof obj.decision === "string"
          ? obj.decision
          : typeof obj.title === "string"
            ? obj.title
            : JSON.stringify(item);
    } else {
      text = String(item);
    }
    items.push({ subKind: "decision", index: i, label: truncate(text), met: false });
  });

  invariants.forEach((item, i) => {
    const text = typeof item === "string" ? item : JSON.stringify(item);
    items.push({ subKind: "invariant", index: i, label: truncate(text), met: false });
  });

  return items;
}

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
  strokeWidth: 2.5,
  strokeDasharray: "5 4",
};

/** Linear mode: backward relates_to (pointing to ancestor / left) */
const LINEAR_BACKWARD_STYLE: React.CSSProperties = {
  stroke: "#9b8ec4",
  strokeWidth: 2.5,
  strokeDasharray: "3 6",
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

  // Expansion state
  const [expandedSpecIds, setExpandedSpecIds] = useState<Set<string>>(new Set());
  const specDetailsRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const [specDetails, setSpecDetails] = useState<Map<string, Record<string, unknown>>>(new Map());

  // Branch collapse state
  const [collapsedBranchIds, setCollapsedBranchIds] = useSessionSet("collapsed_spec_branches");

  const onToggleBranch = useCallback((nodeId: string) => {
    setCollapsedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, [setCollapsedBranchIds]);

  const onToggleExpand = useCallback(async (nodeId: string) => {
    setExpandedSpecIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    // Fetch full YAML detail if not already cached
    if (!specDetailsRef.current.has(nodeId)) {
      try {
        const res = await fetch(`/api/spec-node?id=${encodeURIComponent(nodeId)}`);
        if (res.ok) {
          const json = await res.json();
          const detail: Record<string, unknown> = json.data ?? json.node ?? json;
          specDetailsRef.current.set(nodeId, detail);
          setSpecDetails(new Map(specDetailsRef.current));
        }
      } catch {
        // ignore fetch errors — node stays collapsed
      }
    }
  }, []);

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

  // SSE: re-fetch whenever spec files change on disk
  useEffect(() => {
    const es = new EventSource("/api/spec-watch");
    es.addEventListener("change", () => fetchGraph());
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    };
    return () => es.close();
  }, [fetchGraph]);

  const { viewMode, showCrossLinks, showBlocking, showDependsOn } = viewOptions;

  // -----------------------------------------------------------------------
  // Layout — topology-dependent, recomputed only when graph or mode changes
  // -----------------------------------------------------------------------
  const layoutResult = useMemo<{
    positions: Map<string, { x: number; y: number }>;
    backEdges: Set<string>;
  }>(() => {
    const empty = { positions: new Map<string, { x: number; y: number }>(), backEdges: new Set<string>() };
    if (!apiGraph) return empty;

    const nodeIds = apiGraph.nodes.map((n) => n.node_id);

    if (viewMode === "canonical") {
      const edgePairs = apiGraph.edges
        .filter((e) => e.status === "resolved")
        .map((e) => ({ source: e.source_id, target: e.target_id }));
      return {
        positions: computeBasePositions(nodeIds, edgePairs, { direction: "LR", nodeSep: SPEC_NODE_WIDTH, rankSep: SPEC_NODE_WIDTH }),
        backEdges: new Set<string>(),
      };
    }

    if (viewMode === "linear") {
      // All forward edges: inverted refines + depends_on as-is + relates_to as-is
      const resolved = apiGraph.edges.filter((e) => e.status === "resolved");
      const allForward = [
        ...resolved.filter((e) => e.edge_kind === "refines")
          .map((e) => ({ source: e.target_id, target: e.source_id })), // invert
        ...resolved.filter((e) => e.edge_kind === "depends_on")
          .map((e) => ({ source: e.source_id, target: e.target_id })), // as-is
        ...resolved.filter((e) => e.edge_kind === "relates_to")
          .map((e) => ({ source: e.source_id, target: e.target_id })), // as-is
      ];
      const treeEdges = resolved.filter((e) => e.edge_kind === "refines")
        .map((e) => ({ source: e.target_id, target: e.source_id }));
      return computeLinearPositions(nodeIds, allForward, treeEdges);
    }

    // Tree mode
    const edgePairs = apiGraph.edges
      .filter((e) => e.status === "resolved" && e.edge_kind === "refines")
      .map((e) => ({ source: e.target_id, target: e.source_id }));
    return {
      positions: computeBasePositions(nodeIds, edgePairs, { direction: "LR", nodeSep: SPEC_NODE_WIDTH, rankSep: SPEC_NODE_WIDTH }),
      backEdges: new Set<string>(),
    };
  }, [apiGraph, viewMode]);

  const basePositions = layoutResult.positions;
  const linearBackEdges = layoutResult.backEdges;

  // -----------------------------------------------------------------------
  // Build React Flow nodes + edges
  // -----------------------------------------------------------------------
  const { nodes, edges } = useMemo(() => {
    if (!apiGraph) return { nodes: [], edges: [] };

    // Determine which handle kinds are visible based on mode + toggles
    let visibleKinds: readonly SpecHandleKind[];
    if (viewMode === "canonical" || viewMode === "linear") {
      visibleKinds = SPEC_HANDLE_KINDS; // all three
    } else {
      // Tree mode: always show refines (tree skeleton)
      const kinds: SpecHandleKind[] = ["refines"];
      if (showCrossLinks) {
        kinds.push("depends_on", "relates_to");
      }
      visibleKinds = kinds;
    }

    // Pre-compute lookup structures
    const refinesEdges = apiGraph.edges.filter((e) => e.edge_kind === "refines");
    const dependsOnEdges = apiGraph.edges.filter((e) => e.edge_kind === "depends_on");
    const relatesToEdges = apiGraph.edges.filter((e) => e.edge_kind === "relates_to");

    // parent→children map (in tree direction: parent is e.target_id, child is e.source_id)
    const parentToChildren = new Map<string, string[]>();
    for (const e of refinesEdges) {
      if (!parentToChildren.has(e.target_id)) parentToChildren.set(e.target_id, []);
      parentToChildren.get(e.target_id)!.push(e.source_id);
    }

    // BFS: find all node IDs hidden because their ancestor is collapsed
    const hiddenNodeIds = new Set<string>();
    for (const rootId of collapsedBranchIds) {
      const queue = [...(parentToChildren.get(rootId) ?? [])];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (hiddenNodeIds.has(id)) continue;
        hiddenNodeIds.add(id);
        queue.push(...(parentToChildren.get(id) ?? []));
      }
    }

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
    } else if (viewMode === "linear") {
      // ── Linear mode ──
      // All forward edges rendered; relates_to that point backward get distinct style.
      // Use basePositions x-coordinate to determine direction.

      // (1) Tree edges from inverted refines (parent → child)
      for (const e of refinesEdges) {
        if (e.status === "broken") continue;
        const parentId = e.target_id;
        const childId = e.source_id;
        const pairKey = `${parentId}::${childId}`;
        const isBlocking = pairedBlockingSet.has(pairKey);
        markActive(parentId, childId, "refines");
        allEdges.push({
          id: `tree-${e.edge_id}`,
          source: parentId,
          target: childId,
          sourceHandle: "src-refines",
          targetHandle: "tgt-refines",
          label: isBlocking && showBlocking ? "blocking" : undefined,
          type: "default",
          animated: false,
          zIndex: 2,
          style: isBlocking && showBlocking ? TREE_BLOCKING_EDGE_STYLE : TREE_EDGE_STYLE,
        });
      }

      // (2) depends_on (not paired blocking)
      for (const d of dependsOnEdges) {
        if (!showDependsOn) continue;
        if (d.status === "broken") continue;
        const pairKey = `${d.source_id}::${d.target_id}`;
        if (pairedBlockingSet.has(pairKey)) continue;
        markActive(d.source_id, d.target_id, "depends_on");
        allEdges.push({
          id: `lin-dep-${d.edge_id}`,
          source: d.source_id,
          target: d.target_id,
          sourceHandle: "src-depends_on",
          targetHandle: "tgt-depends_on",
          label: "depends_on",
          type: "default",
          animated: false,
          zIndex: 1,
          style: CANONICAL_EDGE_STYLES.depends_on,
        });
      }

      // (3) relates_to — use linearBackEdges to detect backward
      for (const r of relatesToEdges) {
        if (r.status === "broken") continue;
        const isBackward = linearBackEdges.has(`${r.source_id}::${r.target_id}`);
        markActive(r.source_id, r.target_id, "relates_to");
        allEdges.push({
          id: `lin-rel-${r.edge_id}`,
          source: r.source_id,
          target: r.target_id,
          sourceHandle: "src-relates_to",
          targetHandle: "tgt-relates_to",
          label: "relates_to",
          type: "default",
          animated: false,
          zIndex: 0,
          style: isBackward ? LINEAR_BACKWARD_STYLE : TREE_CROSSLINK_STYLE,
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

    // Build nodes — switch to expanded group + sub-items when expanded and detail is loaded
    const allNodes: Node[] = [];

    for (const apiNode of apiGraph.nodes) {
      if (hiddenNodeIds.has(apiNode.node_id)) continue;
      const hasBrokenEdges = apiNode.diagnostics.length > 0;
      const isExpanded = expandedSpecIds.has(apiNode.node_id);
      const expandedDetail = isExpanded ? specDetails.get(apiNode.node_id) : undefined;

      if (isExpanded && expandedDetail) {
        // ── Expanded: group container + sub-item children ──
        const subItems = extractSubItems(expandedDetail);
        const n = subItems.length;
        const GRP_H =
          n === 0
            ? EXP_BODY_H + EXP_PAD * 2 + EXP_ITEM_H // spec content + empty placeholder row
            : EXP_BODY_H + EXP_PAD + n * EXP_ITEM_H + (n - 1) * EXP_ITEM_GAP + EXP_PAD;

        const groupData: ExpandedSpecGroupData = {
          nodeId: apiNode.node_id,
          title: apiNode.title,
          kind: apiNode.kind,
          status: apiNode.status,
          maturity: apiNode.maturity,
          hasBrokenEdges: apiNode.diagnostics.length > 0,
          refinedByCount: refinedByCount.get(apiNode.node_id) ?? 0,
          onToggleExpand,
          visibleHandleKinds: visibleKinds,
          activeSourceKinds: activeSourceKinds.get(apiNode.node_id) ?? new Set(),
          activeTargetKinds: activeTargetKinds.get(apiNode.node_id) ?? new Set(),
          isBranchCollapsed: collapsedBranchIds.has(apiNode.node_id),
          onToggleBranch,
        };

        allNodes.push({
          id: apiNode.node_id,
          type: "expandedSpec",
          position: basePositions.get(apiNode.node_id) ?? { x: 0, y: 0 },
          data: groupData,
          width: EXP_GROUP_W,
          height: GRP_H,
          style: { width: EXP_GROUP_W, height: GRP_H },
        });

        subItems.forEach((item, i) => {
          const subId = `${apiNode.node_id}-sub-${item.subKind}-${item.index}`;
          const subData: SpecSubItemNodeData = {
            subKind: item.subKind,
            index: item.index,
            label: item.label,
            met: item.met,
          };
          allNodes.push({
            id: subId,
            type: "specSubItem",
            position: {
              x: EXP_PAD,
              y: EXP_BODY_H + EXP_PAD + i * (EXP_ITEM_H + EXP_ITEM_GAP),
            },
            parentId: apiNode.node_id,
            extent: "parent" as const,
            draggable: false,
            selectable: false,
            data: subData,
            style: { width: EXP_GROUP_W - EXP_PAD * 2, height: EXP_ITEM_H },
          });
        });
      } else {
        // ── Collapsed (or expansion pending detail fetch) ──
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
          visibleHandleKinds: visibleKinds,
          gapCount: apiNode.gap_count ?? 0,
          isExpanded,
          onToggleExpand,
          isBranchCollapsed: collapsedBranchIds.has(apiNode.node_id),
          onToggleBranch,
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
    }

    const visibleEdges = allEdges.filter(
      (e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target)
    );
    return { nodes: allNodes, edges: visibleEdges };
  }, [apiGraph, basePositions, viewMode, showCrossLinks, showBlocking, showDependsOn, expandedSpecIds, specDetails, onToggleExpand, collapsedBranchIds, onToggleBranch]);

  return {
    nodes,
    edges,
    loading,
    error,
    refresh: fetchGraph,
    summary: apiGraph?.summary ?? null,
  };
}
