import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ApiSpecGraph, ApiSpecNode, SpecOverlayMap, SpecViewOptions } from "./types";
import type { SpecNodeData } from "./SpecNode";
import { SPEC_HANDLE_KINDS, type SpecHandleKind } from "./SpecNode";
import type { ExpandedSpecGroupData } from "./ExpandedSpecNode";
import type { SpecSubItemNodeData } from "./SpecSubItemNode";
import type { CollapsedBranchNodeData } from "./CollapsedBranchNode";
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
// Edge visual state
// ---------------------------------------------------------------------------

/**
 * UX colour contract for spec graph edges:
 *
 *   red          = broken or actively blocked
 *   amber        = required but pending review / refinement
 *   amber dashed = not_available — contract says availability not satisfied (SG-SPEC-0043)
 *   muted green  = required and satisfied
 *   blue         = refinement structure (refines)
 *   purple/gray  = contextual relation (relates_to)
 *   gray ↓opacity = historical lineage (either endpoint historical)
 *
 * depends_on means "required dependency", NOT "error".
 * Red is reserved only for broken references and actively blocked targets.
 */
export type EdgeVisualState =
  | "refinement"
  | "context"
  | "required_satisfied"  // depends_on where target is linked/reviewed/frozen
  | "required_pending"    // depends_on where target is still in progress
  | "active_blocker"      // depends_on where target is explicitly blocked
  | "not_available"       // depends_on where availability contract exists and says not available (SG-SPEC-0043)
  | "broken_reference"    // edge.status === "broken" (target missing)
  | "historical_lineage"; // either endpoint is historical

const EDGE_VISUAL_STYLES: Record<EdgeVisualState, React.CSSProperties> = {
  refinement:         { stroke: "#4e689b", strokeWidth: 1.5, strokeDasharray: "6 3" },
  context:            { stroke: "#7c3aed", strokeWidth: 1.5, strokeDasharray: "2 4", opacity: 0.6 },
  required_satisfied: { stroke: "#5a7a52", strokeWidth: 2 },
  required_pending:   { stroke: "#c08820", strokeWidth: 2 },
  active_blocker:     { stroke: "#dc2626", strokeWidth: 2.5 },
  not_available:      { stroke: "#b06924", strokeWidth: 2.5, strokeDasharray: "5 3" },
  broken_reference:   { stroke: "#b54131", strokeDasharray: "4 3", strokeWidth: 1.5 },
  historical_lineage: { stroke: "#9b9b9b", strokeWidth: 1.5, opacity: 0.4 },
};

/**
 * Full contract (overlay takes precedence when available):
 *   broken_reference                                    → red
 *   historical_lineage                                  → gray
 *   depends_on + target gate "blocked"                  → red  (active_blocker)
 *   depends_on + target gate split_required/retry_pending/review_pending → amber (required_pending)
 *   depends_on + target status linked/reviewed/frozen AND no blocking gate → muted green (required_satisfied)
 *   depends_on + target status idea/stub/outlined/specified               → amber (required_pending)
 *   refines                                             → blue
 *   relates_to                                          → purple/gray
 *
 * When overlay is unavailable the gate_state is treated as unknown and only
 * target.status drives the satisfied/pending split (MVP approximation).
 */
function computeEdgeVisualState(
  edgeKind: string,
  edgeStatus: string,
  sourceNode: ApiSpecNode | undefined,
  targetNode: ApiSpecNode | undefined,
  targetGateState: string | undefined,
): EdgeVisualState {
  if (edgeStatus === "broken") return "broken_reference";
  if (
    sourceNode?.presence_state === "historical" ||
    targetNode?.presence_state === "historical"
  ) return "historical_lineage";
  if (edgeKind === "refines") return "refinement";
  if (edgeKind === "relates_to") return "context";

  // depends_on — gate_state wins when present.
  // Three-valued readiness (SG-SPEC-0043): satisfied / not_available / unresolved.
  // not_available = availability contract exists and explicitly says not satisfied.
  // Do NOT collapse not_available into required_pending — they have different semantics.
  if (targetGateState === "blocked") return "active_blocker";
  if (targetGateState === "not_available") return "not_available";
  if (["split_required", "retry_pending", "review_pending"].includes(targetGateState ?? "")) {
    return "required_pending";
  }

  // Fall back to status-based classification
  const targetStatus = targetNode?.status ?? "";
  if (["linked", "reviewed", "frozen"].includes(targetStatus)) return "required_satisfied";
  return "required_pending";
}

/** Tree mode: refinement tree edge */
const TREE_EDGE_STYLE: React.CSSProperties = {
  stroke: "#4e689b",
  strokeWidth: 2,
};

/** Tree mode: cross-link overlay for relates_to */
const TREE_CROSSLINK_STYLE: React.CSSProperties = {
  stroke: "#7c3aed",
  strokeWidth: 1.5,
  strokeDasharray: "5 4",
  opacity: 0.6,
};

/** Linear mode: backward relates_to (pointing to ancestor / left) */
const LINEAR_BACKWARD_STYLE: React.CSSProperties = {
  stroke: "#9b8ec4",
  strokeWidth: 2.5,
  opacity: 0.45,
};

/** Linear mode: forward relates_to cross-link (solid, no dasharray — avoids Safari dasharray texture per-edge) */
const LINEAR_CROSSLINK_STYLE: React.CSSProperties = {
  stroke: "#9b6ec4",
  strokeWidth: 1.5,
  opacity: 0.5,
};


// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Compute the set of node IDs that differ between two graph snapshots. */
function diffGraphNodes(prev: ApiSpecGraph, next: ApiSpecGraph): Set<string> {
  const changed = new Set<string>();
  const prevMap = new Map(prev.nodes.map((n) => [n.node_id, n]));
  for (const node of next.nodes) {
    const p = prevMap.get(node.node_id);
    if (!p) {
      changed.add(node.node_id); // added
    } else if (
      p.status !== node.status ||
      p.gap_count !== node.gap_count ||
      p.updated_at !== node.updated_at ||
      p.maturity !== node.maturity ||
      p.title !== node.title ||
      p.acceptance_count !== node.acceptance_count
    ) {
      changed.add(node.node_id); // modified
    }
  }
  return changed;
}

export function useSpecGraphData(viewOptions: SpecViewOptions, overlayMap?: SpecOverlayMap, autoCollapseExpanded: boolean = false) {
  const [apiGraph, setApiGraph] = useState<ApiSpecGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change highlighting after SSE reload
  const [changedNodeIds, setChangedNodeIds] = useState<Set<string>>(new Set());
  const prevApiGraphRef = useRef<ApiSpecGraph | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Detect changes only when we have a previous snapshot (i.e. SSE reload)
      if (prevApiGraphRef.current) {
        const changed = diffGraphNodes(prevApiGraphRef.current, data);
        if (changed.size > 0) {
          setChangedNodeIds(changed);
          if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
          changeTimerRef.current = setTimeout(
            () => setChangedNodeIds(new Set()),
            3000,
          );
        }
      }
      prevApiGraphRef.current = data;
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
  // Layout — topology-dependent, cached per viewMode so switching back is instant
  // -----------------------------------------------------------------------
  type LayoutResult = { positions: Map<string, { x: number; y: number }>; backEdges: Set<string> };
  const layoutCacheRef = useRef<{ graphKey: ApiSpecGraph | null; cache: Map<string, LayoutResult> }>({
    graphKey: null,
    cache: new Map(),
  });

  const layoutResult = useMemo<LayoutResult>(() => {
    const empty: LayoutResult = { positions: new Map(), backEdges: new Set<string>() };
    if (!apiGraph) return empty;

    // Invalidate all cached layouts when the graph data object changes
    if (layoutCacheRef.current.graphKey !== apiGraph) {
      layoutCacheRef.current.graphKey = apiGraph;
      layoutCacheRef.current.cache.clear();
    }

    const cached = layoutCacheRef.current.cache.get(viewMode);
    if (cached) return cached;

    const nodeIds = apiGraph.nodes.map((n) => n.node_id);
    let result: LayoutResult;

    if (viewMode === "canonical") {
      const edgePairs = apiGraph.edges
        .filter((e) => e.status === "resolved")
        .map((e) => ({ source: e.source_id, target: e.target_id }));
      result = {
        positions: computeBasePositions(nodeIds, edgePairs, { direction: "LR", nodeSep: SPEC_NODE_HEIGHT / 2, rankSep: SPEC_NODE_WIDTH }),
        backEdges: new Set<string>(),
      };
    } else if (viewMode === "linear") {
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
      result = computeLinearPositions(nodeIds, allForward, treeEdges);
    } else {
      // Tree mode
      const edgePairs = apiGraph.edges
        .filter((e) => e.status === "resolved" && e.edge_kind === "refines")
        .map((e) => ({ source: e.target_id, target: e.source_id }));
      result = {
        positions: computeBasePositions(nodeIds, edgePairs, { direction: "LR", nodeSep: SPEC_NODE_HEIGHT / 2, rankSep: SPEC_NODE_WIDTH }),
        backEdges: new Set<string>(),
      };
    }

    layoutCacheRef.current.cache.set(viewMode, result);
    return result;
  }, [apiGraph, viewMode]);

  const basePositions = layoutResult.positions;
  const linearBackEdges = layoutResult.backEdges;

  // -----------------------------------------------------------------------
  // Build React Flow nodes + edges
  // -----------------------------------------------------------------------
  const { nodes, edges } = useMemo(() => {
    if (!apiGraph) return { nodes: [], edges: [] };

    // Node lookup for visual-state computation
    const nodeMap = new Map<string, ApiSpecNode>(
      apiGraph.nodes.map((n) => [n.node_id, n]),
    );

    // Extract gate_state from overlay when available
    const gateState = (nodeId: string): string | undefined =>
      overlayMap?.[nodeId]?.health?.gate_state;

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

    // BFS: find all hidden node IDs and count descendants per collapsed root in one pass
    const hiddenNodeIds = new Set<string>();
    const descendantCountByRoot = new Map<string, number>();
    for (const rootId of collapsedBranchIds) {
      const queue = [...(parentToChildren.get(rootId) ?? [])];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        hiddenNodeIds.add(id);
        queue.push(...(parentToChildren.get(id) ?? []));
      }
      descendantCountByRoot.set(rootId, visited.size);
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
        const vstate = computeEdgeVisualState(
          apiEdge.edge_kind,
          apiEdge.status,
          nodeMap.get(apiEdge.source_id),
          nodeMap.get(apiEdge.target_id),
          gateState(apiEdge.target_id),
        );
        const style = EDGE_VISUAL_STYLES[vstate];
        const label = apiEdge.edge_kind === "depends_on" ? "requires" : apiEdge.edge_kind;

        markActive(apiEdge.source_id, apiEdge.target_id, apiEdge.edge_kind);

        allEdges.push({
          id: apiEdge.edge_id,
          source: apiEdge.source_id,
          target: apiEdge.target_id,
          sourceHandle: `src-${apiEdge.edge_kind}`,
          targetHandle: `tgt-${apiEdge.edge_kind}`,
          label,
          type: "default",
          animated: false,
          zIndex: 1,
          style,
          data: { kind: apiEdge.edge_kind, visualState: vstate },
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
        const isRequired = pairedBlockingSet.has(pairKey);
        let treeStyle = TREE_EDGE_STYLE;
        if (isRequired && showBlocking) {
          const vstate = computeEdgeVisualState("depends_on", "resolved", nodeMap.get(parentId), nodeMap.get(childId), gateState(childId));
          treeStyle = { ...EDGE_VISUAL_STYLES[vstate], strokeWidth: 2.5 };
        }
        markActive(parentId, childId, "refines");
        allEdges.push({
          id: `tree-${e.edge_id}`,
          source: parentId,
          target: childId,
          sourceHandle: "src-refines",
          targetHandle: "tgt-refines",
          label: undefined,
          type: "smoothstep",
          animated: false,
          zIndex: 2,
          style: treeStyle,
          data: { kind: "refines" },
        });
      }

      // (2) depends_on (not paired blocking)
      for (const d of dependsOnEdges) {
        if (!showDependsOn) continue;
        if (d.status === "broken") continue;
        const pairKey = `${d.source_id}::${d.target_id}`;
        if (pairedBlockingSet.has(pairKey)) continue;
        const vstate = computeEdgeVisualState("depends_on", "resolved", nodeMap.get(d.source_id), nodeMap.get(d.target_id), gateState(d.target_id));
        markActive(d.source_id, d.target_id, "depends_on");
        allEdges.push({
          id: `lin-dep-${d.edge_id}`,
          source: d.source_id,
          target: d.target_id,
          sourceHandle: "src-depends_on",
          targetHandle: "tgt-depends_on",
          label: undefined,
          type: "smoothstep",
          animated: false,
          zIndex: 1,
          style: EDGE_VISUAL_STYLES[vstate],
          data: { kind: "depends_on", visualState: vstate },
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
          label: undefined,
          type: "smoothstep",
          animated: false,
          zIndex: 0,
          style: isBackward ? LINEAR_BACKWARD_STYLE : LINEAR_CROSSLINK_STYLE,
          data: { kind: "relates_to" },
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
        const isRequired = pairedBlockingSet.has(pairKey);
        let treeStyle = TREE_EDGE_STYLE;
        if (isRequired && showBlocking) {
          const vstate = computeEdgeVisualState("depends_on", "resolved", nodeMap.get(parentId), nodeMap.get(childId), gateState(childId));
          treeStyle = { ...EDGE_VISUAL_STYLES[vstate], strokeWidth: 2.5 };
        }

        markActive(parentId, childId, "refines");

        allEdges.push({
          id: `tree-${e.edge_id}`,
          source: parentId,
          target: childId,
          sourceHandle: "src-refines",
          targetHandle: "tgt-refines",
          label: isRequired && showBlocking ? "required" : undefined,
          type: "default",
          animated: false,
          zIndex: 2,
          style: treeStyle,
          data: { kind: "refines" },
        });
      }

      // (2) Cross-branch depends_on (not paired with refines)
      if (showCrossLinks) {
        for (const d of dependsOnEdges) {
          if (d.status === "broken") continue;
          const pairKey = `${d.source_id}::${d.target_id}`;
          if (pairedBlockingSet.has(pairKey)) continue; // already shown as tree required
          const vstate = computeEdgeVisualState("depends_on", "resolved", nodeMap.get(d.source_id), nodeMap.get(d.target_id), gateState(d.target_id));
          markActive(d.source_id, d.target_id, "depends_on");
          allEdges.push({
            id: `cross-dep-${d.edge_id}`,
            source: d.source_id,
            target: d.target_id,
            sourceHandle: "src-depends_on",
            targetHandle: "tgt-depends_on",
            label: "requires",
            type: "default",
            animated: false,
            zIndex: 0,
            style: { ...EDGE_VISUAL_STYLES[vstate], strokeDasharray: "5 4" },
            data: { kind: "depends_on", visualState: vstate },
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
            data: { kind: "relates_to" },
          });
        }
      }
    }

    // Build nodes — switch to expanded group + sub-items when expanded and detail is loaded
    const allNodes: Node[] = [];

    for (const apiNode of apiGraph.nodes) {
      if (hiddenNodeIds.has(apiNode.node_id)) continue;
      const hasBrokenEdges = apiNode.diagnostics.length > 0;
      const isExpanded = !autoCollapseExpanded && expandedSpecIds.has(apiNode.node_id);
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
          isChanged: changedNodeIds.has(apiNode.node_id),
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
          isChanged: changedNodeIds.has(apiNode.node_id),
          isHistorical: apiNode.presence_state === "historical",
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

    // ── Synthetic collapsed-branch nodes ────────────────────────────────────
    // For each collapsed root that is itself visible, add a round proxy node
    // positioned at the centroid of its direct children's layout positions.
    const COLLAPSED_SIZE = 72;

    for (const collapsedRootId of collapsedBranchIds) {
      // Skip if the root itself is hidden (nested collapse)
      if (hiddenNodeIds.has(collapsedRootId)) continue;
      // Skip if the node doesn't exist in the API graph
      if (!apiGraph.nodes.find((n) => n.node_id === collapsedRootId)) continue;

      const descendantCount = descendantCountByRoot.get(collapsedRootId) ?? 0;
      if (descendantCount === 0) continue;

      // Position: centroid of direct children (their pre-collapse layout positions)
      const directChildren = parentToChildren.get(collapsedRootId) ?? [];
      let syntheticPos: { x: number; y: number };
      if (directChildren.length > 0) {
        const childPositions = directChildren.map(
          (c) => basePositions.get(c) ?? { x: 0, y: 0 },
        );
        const avgX = childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length;
        const avgY = childPositions.reduce((s, p) => s + p.y, 0) / childPositions.length;
        syntheticPos = {
          x: avgX + SPEC_NODE_WIDTH / 2 - COLLAPSED_SIZE / 2,
          y: avgY + SPEC_NODE_HEIGHT / 2 - COLLAPSED_SIZE / 2,
        };
      } else {
        // Fallback: place to the right of parent (tree LR assumption)
        const parentPos = basePositions.get(collapsedRootId) ?? { x: 0, y: 0 };
        syntheticPos = {
          x: parentPos.x + SPEC_NODE_WIDTH + 80,
          y: parentPos.y + (SPEC_NODE_HEIGHT - COLLAPSED_SIZE) / 2,
        };
      }

      const syntheticId = `__collapsed__${collapsedRootId}`;
      const syntheticData: CollapsedBranchNodeData = {
        collapsedRootId,
        count: descendantCount,
        onExpand: onToggleBranch,
      };
      allNodes.push({
        id: syntheticId,
        type: "collapsedBranch",
        position: syntheticPos,
        data: syntheticData,
        width: COLLAPSED_SIZE,
        height: COLLAPSED_SIZE,
        style: { width: COLLAPSED_SIZE, height: COLLAPSED_SIZE },
      });

      // Edge: direction matches the view mode
      // Tree / linear: parent → synthetic (parent is source, synthetic is child)
      // Canonical: refines go child→parent, so synthetic → parent
      const isCanonical = viewMode === "canonical";
      allEdges.push({
        id: `__collapsed_edge__${collapsedRootId}`,
        source: isCanonical ? syntheticId : collapsedRootId,
        target: isCanonical ? collapsedRootId : syntheticId,
        sourceHandle: isCanonical ? "src" : "src-refines",
        targetHandle: isCanonical ? "tgt-refines" : "tgt",
        type: "default",
        animated: false,
        zIndex: 1,
        style: {
          stroke: "#4e689b",
          strokeWidth: 1.5,
          strokeDasharray: "5 4",
          opacity: 0.7,
        },
      });
    }

    const visibleEdges = allEdges.filter(
      (e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target)
    );
    return { nodes: allNodes, edges: visibleEdges };
  }, [apiGraph, basePositions, viewMode, showCrossLinks, showBlocking, showDependsOn, overlayMap, expandedSpecIds, specDetails, onToggleExpand, collapsedBranchIds, onToggleBranch, changedNodeIds, autoCollapseExpanded]);

  return {
    nodes,
    edges,
    loading,
    error,
    refresh: fetchGraph,
    summary: apiGraph?.summary ?? null,
    rawGraph: apiGraph,
  };
}
