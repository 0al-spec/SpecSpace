import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphCanvasLayoutPosition } from "./layout-overrides";

export const SPEC_GRAPH_CANVAS_LAYOUT_PRESETS = [
  "tree",
  "linear",
  "canonical",
  "status-columns",
] as const;

export type SpecGraphCanvasLayoutPreset =
  (typeof SPEC_GRAPH_CANVAS_LAYOUT_PRESETS)[number];

export const DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET: SpecGraphCanvasLayoutPreset =
  "tree";

export const SPEC_GRAPH_CANVAS_LAYOUT_PRESET_LABELS: Record<
  SpecGraphCanvasLayoutPreset,
  string
> = {
  tree: "Tree",
  linear: "Linear",
  canonical: "Canonical",
  "status-columns": "Status",
};

export type SpecGraphCanvasLayoutPresetStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 172;
const PRESET_STORAGE_KEY = "specspace:spec-graph-canvas-layout-preset:v1";
const LEGACY_PRESET_ALIASES: Record<string, SpecGraphCanvasLayoutPreset> = {
  "refinement-ladder": "tree",
};

const STATUS_ORDER = [
  "idea",
  "stub",
  "outlined",
  "specified",
  "linked",
  "reviewed",
  "frozen",
  "draft_preview_only",
  "draft",
  "proposed",
  "unknown",
] as const;

const byEdgeId = (a: SpecEdge, b: SpecEdge) =>
  a.edge_id.localeCompare(b.edge_id);

type LayoutEdge = {
  source: string;
  target: string;
};

export function normalizeSpecGraphCanvasLayoutPreset(
  value: unknown,
): SpecGraphCanvasLayoutPreset | null {
  if (typeof value !== "string") return null;
  const alias = LEGACY_PRESET_ALIASES[value];
  if (alias) return alias;
  return (SPEC_GRAPH_CANVAS_LAYOUT_PRESETS as readonly string[]).includes(value)
    ? (value as SpecGraphCanvasLayoutPreset)
    : null;
}

export function getSpecGraphCanvasLayoutPresetStorage():
  | SpecGraphCanvasLayoutPresetStorage
  | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSpecGraphCanvasLayoutPreset(
  storage: SpecGraphCanvasLayoutPresetStorage | null,
): SpecGraphCanvasLayoutPreset {
  if (!storage) return DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET;
  try {
    return (
      normalizeSpecGraphCanvasLayoutPreset(storage.getItem(PRESET_STORAGE_KEY)) ??
      DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET
    );
  } catch {
    return DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET;
  }
}

export function writeSpecGraphCanvasLayoutPreset(
  storage: SpecGraphCanvasLayoutPresetStorage | null,
  preset: SpecGraphCanvasLayoutPreset,
) {
  if (!storage) return;
  storage.setItem(PRESET_STORAGE_KEY, preset);
}

export function computeSpecGraphCanvasLayoutPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
  preset: SpecGraphCanvasLayoutPreset = DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
): Map<string, SpecGraphCanvasLayoutPosition> {
  if (preset === "status-columns") return computeStatusColumnPositions(nodes);
  if (preset === "linear") return computeLinearPositions(nodes, edges);
  if (preset === "canonical") return computeCanonicalPositions(nodes, edges);
  return computeTreePositions(nodes, edges);
}

function computeStatusColumnPositions(
  nodes: readonly SpecNode[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const statusRank = new Map<string, number>(
    STATUS_ORDER.map((status, index) => [status, index]),
  );
  const ordered = [...nodes].sort((a, b) => {
    const statusDelta = statusColumn(a.status, statusRank) - statusColumn(b.status, statusRank);
    if (statusDelta !== 0) return statusDelta;
    return a.node_id.localeCompare(b.node_id);
  });
  const perStatusCount = new Map<number, number>();
  const positions = new Map<string, SpecGraphCanvasLayoutPosition>();

  for (const node of ordered) {
    const column = statusColumn(node.status, statusRank);
    const row = perStatusCount.get(column) ?? 0;
    perStatusCount.set(column, row + 1);
    positions.set(node.node_id, {
      x: column * COLUMN_WIDTH,
      y: row * ROW_HEIGHT,
    });
  }

  return positions;
}

function statusColumn(status: string, statusRank: ReadonlyMap<string, number>) {
  return statusRank.get(status.toLowerCase()) ?? STATUS_ORDER.length;
}

function computeTreePositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const ranks = computeDirectedRanks(nodes, refinementHierarchyEdges(nodes, edges));
  return computeRankColumnPositions(nodes, ranks);
}

function computeCanonicalPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const ranks = computeDirectedRanks(nodes, canonicalLayoutEdges(nodes, edges));
  return computeRankColumnPositions(nodes, ranks);
}

function computeRankColumnPositions(
  nodes: readonly SpecNode[],
  ranks: ReadonlyMap<string, number>,
): Map<string, SpecGraphCanvasLayoutPosition> {
  const ordered = [...nodes].sort((a, b) => {
    const rankDelta = (ranks.get(a.node_id) ?? 0) - (ranks.get(b.node_id) ?? 0);
    if (rankDelta !== 0) return rankDelta;
    return a.node_id.localeCompare(b.node_id);
  });
  const perRankCount = new Map<number, number>();
  const positions = new Map<string, SpecGraphCanvasLayoutPosition>();

  for (const node of ordered) {
    const rank = ranks.get(node.node_id) ?? 0;
    const row = perRankCount.get(rank) ?? 0;
    perRankCount.set(rank, row + 1);
    positions.set(node.node_id, {
      x: rank * COLUMN_WIDTH,
      y: row * ROW_HEIGHT,
    });
  }

  return positions;
}

function computeLinearPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const nodeIds = sortedNodeIds(nodes);
  const ranks = computeDirectedRanks(nodes, linearForwardEdges(nodes, edges));
  const lanes = computeTreeLanes(nodeIds, refinementHierarchyEdges(nodes, edges));
  const positions = new Map<string, SpecGraphCanvasLayoutPosition>();

  for (const nodeId of nodeIds) {
    positions.set(nodeId, {
      x: (ranks.get(nodeId) ?? 0) * COLUMN_WIDTH,
      y: (lanes.get(nodeId) ?? 0) * ROW_HEIGHT,
    });
  }

  return positions;
}

function computeDirectedRanks(
  nodes: readonly SpecNode[],
  edges: readonly LayoutEdge[],
): Map<string, number> {
  const ranks = new Map(sortedNodeIds(nodes).map((nodeId) => [nodeId, 0]));
  const acyclicEdges = acyclicLayoutEdges(nodes, edges);

  for (let i = 0; i < ranks.size; i += 1) {
    let changed = false;
    for (const edge of acyclicEdges) {
      const sourceRank = ranks.get(edge.source);
      const targetRank = ranks.get(edge.target);
      if (sourceRank === undefined || targetRank === undefined) continue;
      const nextRank = sourceRank + 1;
      if (targetRank < nextRank) {
        ranks.set(edge.target, nextRank);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return ranks;
}

function computeTreeLanes(
  nodeIds: readonly string[],
  treeEdges: readonly LayoutEdge[],
): Map<string, number> {
  const nodeIdSet = new Set(nodeIds);
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();

  for (const edge of treeEdges) {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    if (!parentByChild.has(edge.target)) parentByChild.set(edge.target, edge.source);
    childrenByParent.set(edge.source, [
      ...(childrenByParent.get(edge.source) ?? []),
      edge.target,
    ]);
  }

  for (const [parent, children] of childrenByParent) {
    childrenByParent.set(parent, children.sort((a, b) => a.localeCompare(b)));
  }

  const lanes = new Map<string, number>();
  const treeRoots = nodeIds.filter((nodeId) => !parentByChild.has(nodeId));
  let nextLane = 0;

  function assignLanes(nodeId: string, parentLane: number): void {
    if (lanes.has(nodeId)) return;
    lanes.set(nodeId, parentLane);
    const children = childrenByParent.get(nodeId) ?? [];
    children.forEach((childId, index) => {
      assignLanes(childId, index === 0 ? parentLane : nextLane++);
    });
  }

  for (const root of treeRoots) {
    assignLanes(root, nextLane++);
  }
  for (const nodeId of nodeIds) {
    if (!lanes.has(nodeId)) lanes.set(nodeId, nextLane++);
  }

  return lanes;
}

function refinementHierarchyEdges(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): LayoutEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  return edges
    .filter((candidate) =>
      candidate.status === "resolved" && candidate.edge_kind === "refines"
    )
    .sort(byEdgeId)
    .flatMap((edge) =>
      nodeIds.has(edge.target_id) && nodeIds.has(edge.source_id)
        ? [{ source: edge.target_id, target: edge.source_id }]
        : [],
    );
}

function linearForwardEdges(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): LayoutEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  return edges
    .filter((edge) => edge.status === "resolved")
    .sort(byEdgeId)
    .flatMap((edge) => {
      if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) return [];
      if (edge.edge_kind === "refines") {
        return [{ source: edge.target_id, target: edge.source_id }];
      }
      return [{ source: edge.source_id, target: edge.target_id }];
    });
}

function canonicalLayoutEdges(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): LayoutEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  return edges
    .filter((edge) => edge.status === "resolved")
    .sort(byEdgeId)
    .flatMap((edge) =>
      nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id)
        ? [{ source: edge.source_id, target: edge.target_id }]
        : [],
    );
}

function acyclicLayoutEdges(
  nodes: readonly SpecNode[],
  edges: readonly LayoutEdge[],
): LayoutEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const adjacency = new Map<string, string[]>();
  const accepted: LayoutEdge[] = [];

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (wouldCreateCycle(adjacency, edge.source, edge.target)) continue;
    accepted.push(edge);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }

  return accepted;
}

function sortedNodeIds(nodes: readonly SpecNode[]): string[] {
  return nodes.map((node) => node.node_id).sort((a, b) => a.localeCompare(b));
}

function wouldCreateCycle(
  adjacency: Map<string, string[]>,
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return true;

  const seen = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === sourceId) return true;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }

  return false;
}
