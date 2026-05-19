import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphCanvasLayoutPosition } from "./layout-overrides";

export const SPEC_GRAPH_CANVAS_LAYOUT_PRESETS = [
  "refinement-ladder",
  "status-columns",
] as const;

export type SpecGraphCanvasLayoutPreset =
  (typeof SPEC_GRAPH_CANVAS_LAYOUT_PRESETS)[number];

export const DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET: SpecGraphCanvasLayoutPreset =
  "refinement-ladder";

export const SPEC_GRAPH_CANVAS_LAYOUT_PRESET_LABELS: Record<
  SpecGraphCanvasLayoutPreset,
  string
> = {
  "refinement-ladder": "Ladder",
  "status-columns": "Status",
};

export type SpecGraphCanvasLayoutPresetStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 172;
const PRESET_STORAGE_KEY = "specspace:spec-graph-canvas-layout-preset:v1";

const STATUS_ORDER = [
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

export function normalizeSpecGraphCanvasLayoutPreset(
  value: unknown,
): SpecGraphCanvasLayoutPreset | null {
  return typeof value === "string" &&
    (SPEC_GRAPH_CANVAS_LAYOUT_PRESETS as readonly string[]).includes(value)
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
  return computeRefinementLadderPositions(nodes, edges);
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

function computeRefinementLadderPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const ranks = computeHierarchyRanks(nodes, edges);
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

function computeHierarchyRanks(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, number> {
  const ranks = new Map(nodes.map((node) => [node.node_id, 0]));
  const refines = acyclicRefines(nodes, edges);

  // SpecGraph stores `child refines parent` as source -> target. For layout,
  // rank children to the right of their parent while keeping raw edge data.
  for (let i = 0; i < nodes.length; i += 1) {
    let changed = false;
    for (const edge of refines) {
      const parentRank = ranks.get(edge.target_id);
      const childRank = ranks.get(edge.source_id);
      if (parentRank === undefined || childRank === undefined) continue;
      const nextRank = parentRank + 1;
      if (childRank < nextRank) {
        ranks.set(edge.source_id, nextRank);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return ranks;
}

function acyclicRefines(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): SpecEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const adjacency = new Map<string, string[]>();
  const accepted: SpecEdge[] = [];

  for (const edge of edges
    .filter((candidate) =>
      candidate.status === "resolved" && candidate.edge_kind === "refines"
    )
    .sort(byEdgeId)) {
    const parentId = edge.target_id;
    const childId = edge.source_id;
    if (!nodeIds.has(parentId) || !nodeIds.has(childId)) continue;
    if (wouldCreateCycle(adjacency, parentId, childId)) continue;

    accepted.push(edge);
    adjacency.set(parentId, [...(adjacency.get(parentId) ?? []), childId]);
  }

  return accepted;
}

function wouldCreateCycle(
  adjacency: Map<string, string[]>,
  parentId: string,
  childId: string,
): boolean {
  if (parentId === childId) return true;

  const seen = new Set<string>();
  const stack = [childId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === parentId) return true;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }

  return false;
}
