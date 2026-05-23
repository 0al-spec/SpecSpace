import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphCanvasLayoutPosition } from "./layout-overrides";

export const SPEC_GRAPH_CANVAS_LAYOUT_PRESETS = [
  "tree",
  "linear",
  "spine",
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
  spine: "Spine",
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
const LEGACY_PRESET_ALIASES = new Map<string, SpecGraphCanvasLayoutPreset>([
  ["refinement-ladder", "tree"],
]);

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

type SpineSubtreeExtent = {
  top: number;
  bottom: number;
};

export function normalizeSpecGraphCanvasLayoutPreset(
  value: unknown,
): SpecGraphCanvasLayoutPreset | null {
  if (typeof value !== "string") return null;
  const alias = LEGACY_PRESET_ALIASES.get(value);
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
  if (preset === "spine") return computeSpinePositions(nodes, edges);
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

function computeSpinePositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const nodeIds = sortedNodeIds(nodes);
  const tree = buildPrimaryTree(nodeIds, refinementHierarchyEdges(nodes, edges));
  const ranks = computeDirectedRanks(nodes, tree.primaryEdges);
  const extents = new Map<string, SpineSubtreeExtent>();
  const rowCenters = new Map<string, number>();
  const roots = nodeIds.filter((nodeId) => !tree.parentByChild.has(nodeId));
  let nextTopRow = 0;

  for (const root of roots) {
    const extent = computeRelativeSpineExtent(
      root,
      tree.childrenByParent,
      extents,
    );
    assignRelativeSpineRows(
      root,
      nextTopRow - extent.top,
      tree.childrenByParent,
      extents,
      rowCenters,
    );
    nextTopRow += extent.bottom - extent.top + 2;
  }

  for (const nodeId of nodeIds) {
    if (!rowCenters.has(nodeId)) {
      rowCenters.set(nodeId, nextTopRow);
      nextTopRow += 1;
    }
  }

  const positions = new Map<string, SpecGraphCanvasLayoutPosition>();
  for (const nodeId of nodeIds) {
    positions.set(nodeId, {
      x: (ranks.get(nodeId) ?? 0) * COLUMN_WIDTH,
      y: (rowCenters.get(nodeId) ?? 0) * ROW_HEIGHT,
    });
  }

  return positions;
}

function computeDirectedRanks(
  nodes: readonly SpecNode[],
  edges: readonly LayoutEdge[],
): Map<string, number> {
  const nodeIds = sortedNodeIds(nodes);
  const ranks = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  const acyclicEdges = acyclicLayoutEdges(nodes, edges);
  const adjacency = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));
  const inDegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const edge of acyclicEdges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  for (const targets of adjacency.values()) {
    targets.sort((a, b) => a.localeCompare(b));
  }

  const queue = nodeIds.filter((nodeId) => inDegree.get(nodeId) === 0);
  const visited = new Set<string>();
  let head = 0;

  while (head < queue.length) {
    const sourceId = queue[head++];
    visited.add(sourceId);
    const sourceRank = ranks.get(sourceId) ?? 0;

    for (const targetId of adjacency.get(sourceId) ?? []) {
      ranks.set(targetId, Math.max(ranks.get(targetId) ?? 0, sourceRank + 1));
      const nextDegree = (inDegree.get(targetId) ?? 0) - 1;
      inDegree.set(targetId, nextDegree);
      if (nextDegree === 0) queue.push(targetId);
    }
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) ranks.set(nodeId, ranks.get(nodeId) ?? 0);
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

function buildPrimaryTree(
  nodeIds: readonly string[],
  treeEdges: readonly LayoutEdge[],
): {
  childrenByParent: Map<string, string[]>;
  parentByChild: Map<string, string>;
  primaryEdges: LayoutEdge[];
} {
  const nodeIdSet = new Set(nodeIds);
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();
  const primaryEdges: LayoutEdge[] = [];

  for (const edge of acyclicLayoutEdgesFromIds(nodeIds, treeEdges)) {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    if (parentByChild.has(edge.target)) continue;
    parentByChild.set(edge.target, edge.source);
    primaryEdges.push(edge);
    childrenByParent.set(edge.source, [
      ...(childrenByParent.get(edge.source) ?? []),
      edge.target,
    ]);
  }

  for (const [parent, children] of childrenByParent) {
    childrenByParent.set(parent, children.sort((a, b) => a.localeCompare(b)));
  }

  return { childrenByParent, parentByChild, primaryEdges };
}

function computeRelativeSpineExtent(
  nodeId: string,
  childrenByParent: ReadonlyMap<string, readonly string[]>,
  extents: Map<string, SpineSubtreeExtent>,
  visiting: Set<string> = new Set<string>(),
): SpineSubtreeExtent {
  const cached = extents.get(nodeId);
  if (cached) return cached;
  if (visiting.has(nodeId)) {
    return { top: 0, bottom: 0 };
  }
  visiting.add(nodeId);
  const children = childrenByParent.get(nodeId) ?? [];
  if (children.length === 0) {
    visiting.delete(nodeId);
    const extent = { top: 0, bottom: 0 };
    extents.set(nodeId, extent);
    return extent;
  }

  const childExtents = children.map((childId) =>
    computeRelativeSpineExtent(
      childId,
      childrenByParent,
      extents,
      visiting,
    ),
  );
  const childOffsets = spineChildOffsets(childExtents);
  let top = 0;
  let bottom = 0;

  for (let index = 0; index < children.length; index += 1) {
    const childOffset = childOffsets[index] ?? 0;
    const childExtent = childExtents[index];
    top = Math.min(top, childOffset + childExtent.top);
    bottom = Math.max(bottom, childOffset + childExtent.bottom);
  }

  visiting.delete(nodeId);
  const extent = { top, bottom };
  extents.set(nodeId, extent);
  return extent;
}

function assignRelativeSpineRows(
  nodeId: string,
  rowCenter: number,
  childrenByParent: ReadonlyMap<string, readonly string[]>,
  extents: ReadonlyMap<string, SpineSubtreeExtent>,
  rowCenters: Map<string, number>,
  visiting: Set<string> = new Set<string>(),
): void {
  if (visiting.has(nodeId) || rowCenters.has(nodeId)) return;
  visiting.add(nodeId);
  rowCenters.set(nodeId, rowCenter);
  const children = childrenByParent.get(nodeId) ?? [];
  const childExtents = children.map(
    (childId) => extents.get(childId) ?? { top: 0, bottom: 0 },
  );
  const childOffsets = spineChildOffsets(childExtents);

  for (let index = 0; index < children.length; index += 1) {
    assignRelativeSpineRows(
      children[index],
      rowCenter + (childOffsets[index] ?? 0),
      childrenByParent,
      extents,
      rowCenters,
      visiting,
    );
  }

  visiting.delete(nodeId);
}

function spineChildOffsets(
  childExtents: readonly SpineSubtreeExtent[],
): number[] {
  if (childExtents.length === 0) return [];
  if (childExtents.length === 1) return [0];
  if (childExtents.length === 2) return symmetricTwoChildOffsets(childExtents);

  return relaxedSpineChildOffsets(childExtents);
}

function symmetricTwoChildOffsets(
  childExtents: readonly SpineSubtreeExtent[],
): [number, number] {
  const upper = childExtents[0];
  const lower = childExtents[1];
  const halfDistance = Math.max(1, (upper.bottom - lower.top + 1) / 2);
  return [-halfDistance, halfDistance];
}

function relaxedSpineChildOffsets(
  childExtents: readonly SpineSubtreeExtent[],
): number[] {
  const offsets = symmetricRowOffsets(childExtents.length);

  for (let index = 1; index < childExtents.length; index += 1) {
    const previousBottom =
      offsets[index - 1] + childExtents[index - 1].bottom;
    const currentTop = offsets[index] + childExtents[index].top;
    const overlap = previousBottom + 1 - currentTop;
    if (overlap > 0) {
      for (let shifted = index; shifted < offsets.length; shifted += 1) {
        offsets[shifted] += overlap;
      }
    }
  }

  const top = Math.min(
    ...offsets.map((offset, index) => offset + childExtents[index].top),
  );
  const bottom = Math.max(
    ...offsets.map((offset, index) => offset + childExtents[index].bottom),
  );
  const centerOffset = (top + bottom) / 2;
  return offsets.map((offset) => offset - centerOffset);
}

function symmetricRowOffsets(count: number): number[] {
  const offsets: number[] = [];
  const sideCount = Math.floor(count / 2);

  for (let index = 0; index < count; index += 1) {
    if (count % 2 === 1) {
      offsets.push(index - sideCount);
    } else if (index < sideCount) {
      offsets.push(index - sideCount);
    } else {
      offsets.push(index - sideCount + 1);
    }
  }

  return offsets;
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
  return acyclicLayoutEdgesFromIds(
    nodes.map((node) => node.node_id),
    edges,
  );
}

function acyclicLayoutEdgesFromIds(
  nodeIds: readonly string[],
  edges: readonly LayoutEdge[],
): LayoutEdge[] {
  const nodeIdSet = new Set(nodeIds);
  const adjacency = new Map<string, string[]>();
  const acceptedKeys = new Set<string>();
  const accepted: LayoutEdge[] = [];

  for (const edge of edges) {
    const edgeKey = `${edge.source}\u0000${edge.target}`;
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    if (acceptedKeys.has(edgeKey)) continue;
    if (wouldCreateCycle(adjacency, edge.source, edge.target)) continue;
    accepted.push(edge);
    acceptedKeys.add(edgeKey);
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
