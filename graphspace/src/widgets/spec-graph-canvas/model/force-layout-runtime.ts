import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphCanvasLayoutPosition } from "./layout-overrides";
import {
  evaluateSpecGraphForceLayoutGuard,
  type SpecGraphForceLayoutGuardFailureReason,
  type SpecGraphForceLayoutGuardInput,
  type SpecGraphForceLayoutGuardResult,
} from "./force-layout-guard";

export type SpecGraphForceLayoutRuntimeModel = {
  active: boolean;
  guard: SpecGraphForceLayoutGuardResult;
  message: string;
};

export type SpecGraphForceLayoutTickResult = {
  positions: Map<string, SpecGraphCanvasLayoutPosition>;
  maxMovement: number;
};

const INITIAL_RADIUS_MIN = 240;
const INITIAL_RADIUS_PER_NODE = 16;
const IDEAL_EDGE_LENGTH = 185;
const REPULSION_STRENGTH = 24000;
const SPRING_STRENGTH = 0.038;
const CENTERING_STRENGTH = 0.0024;
const MAX_STEP = 22;
const ITERATION_COUNT = 92;
const CANVAS_MARGIN = 120;

const byNodeId = (left: SpecNode, right: SpecNode) =>
  left.node_id.localeCompare(right.node_id);
const byEdgeId = (left: SpecEdge, right: SpecEdge) =>
  left.edge_id.localeCompare(right.edge_id);

export function buildSpecGraphForceLayoutRuntimeModel(
  input: SpecGraphForceLayoutGuardInput,
): SpecGraphForceLayoutRuntimeModel {
  const guard = evaluateSpecGraphForceLayoutGuard(input);
  return {
    active: guard.available,
    guard,
    message: forceLayoutGuardMessage(guard),
  };
}

export function forceLayoutGuardMessage(
  guard: SpecGraphForceLayoutGuardResult,
): string {
  const nodeBudget = Number.isFinite(guard.nodeLimit)
    ? `${guard.nodeCount}/${guard.nodeLimit} nodes`
    : `${guard.nodeCount} nodes`;
  const edgeBudget = Number.isFinite(guard.edgeLimit)
    ? `${guard.edgeCount}/${guard.edgeLimit} edges`
    : `${guard.edgeCount} edges`;

  if (guard.available) {
    return `Force active: ${nodeBudget}, ${edgeBudget}`;
  }
  if (guard.reason === "node_limit_exceeded") {
    return `Force unavailable: ${nodeBudget}`;
  }
  if (guard.reason === "edge_limit_exceeded") {
    return `Force unavailable: ${edgeBudget}`;
  }
  return `Force guarded: ${nodeBudget}, ${edgeBudget}`;
}

export function forceLayoutGuardDiagnosticState(
  runtimeGuard: SpecGraphForceLayoutGuardResult,
  budgetGuard: SpecGraphForceLayoutGuardResult,
): "available" | SpecGraphForceLayoutGuardFailureReason {
  if (runtimeGuard.available) return "available";
  if (!budgetGuard.available) return budgetGuard.reason;
  return runtimeGuard.reason;
}

export function computeSpecGraphForceLayoutPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const sortedNodes = [...nodes].sort(byNodeId);
  const resolvedEdges = resolvedForceLayoutEdges(sortedNodes, edges);
  const positions = seedCircularPositions(sortedNodes);

  for (let iteration = 0; iteration < ITERATION_COUNT; iteration += 1) {
    const tick = advanceSpecGraphForceLayoutPositions(
      sortedNodes,
      resolvedEdges,
      positions,
      1,
      { x: 0, y: 0 },
    );
    positions.clear();
    for (const [nodeId, position] of tick.positions) positions.set(nodeId, position);
  }

  return normalizePositions(sortedNodes, positions);
}

export function advanceSpecGraphForceLayoutPositions(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
  currentPositions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
  alpha: number,
  center = currentForceLayoutCenter(nodes, currentPositions),
): SpecGraphForceLayoutTickResult {
  const sortedNodes = [...nodes].sort(byNodeId);
  const resolvedEdges = resolvedForceLayoutEdges(sortedNodes, edges);
  const positions = seedMissingPositions(sortedNodes, currentPositions);
  const deltas = new Map<string, SpecGraphCanvasLayoutPosition>(
    sortedNodes.map((node) => [node.node_id, { x: 0, y: 0 }]),
  );

  applyRepulsion(sortedNodes, positions, deltas);
  applyEdgeSprings(resolvedEdges, positions, deltas);
  applyCentering(sortedNodes, positions, deltas, center);

  return applyDeltas(sortedNodes, positions, deltas, alpha);
}

function seedCircularPositions(
  nodes: readonly SpecNode[],
): Map<string, SpecGraphCanvasLayoutPosition> {
  const radius = Math.max(INITIAL_RADIUS_MIN, nodes.length * INITIAL_RADIUS_PER_NODE);
  const positions = new Map<string, SpecGraphCanvasLayoutPosition>();

  nodes.forEach((node, index) => {
    const angle = nodes.length === 0 ? 0 : (Math.PI * 2 * index) / nodes.length;
    positions.set(node.node_id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  return positions;
}

function seedMissingPositions(
  nodes: readonly SpecNode[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
): Map<string, SpecGraphCanvasLayoutPosition> {
  const seeded = seedCircularPositions(nodes);
  for (const node of nodes) {
    const current = positions.get(node.node_id);
    if (current) seeded.set(node.node_id, current);
  }
  return seeded;
}

function resolvedForceLayoutEdges(
  nodes: readonly SpecNode[],
  edges: readonly SpecEdge[],
): SpecEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  return edges
    .filter(
      (edge) =>
        edge.status === "resolved" &&
        nodeIds.has(edge.source_id) &&
        nodeIds.has(edge.target_id),
    )
    .sort(byEdgeId);
}

function applyRepulsion(
  nodes: readonly SpecNode[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
  deltas: Map<string, SpecGraphCanvasLayoutPosition>,
) {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      const leftPosition = positions.get(left.node_id);
      const rightPosition = positions.get(right.node_id);
      if (!leftPosition || !rightPosition) continue;

      const vector = normalizeVector(
        leftPosition.x - rightPosition.x,
        leftPosition.y - rightPosition.y,
      );
      const force = REPULSION_STRENGTH / Math.max(vector.distance ** 2, 1200);
      addDelta(deltas, left.node_id, vector.x * force, vector.y * force);
      addDelta(deltas, right.node_id, -vector.x * force, -vector.y * force);
    }
  }
}

function applyEdgeSprings(
  edges: readonly SpecEdge[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
  deltas: Map<string, SpecGraphCanvasLayoutPosition>,
) {
  for (const edge of edges) {
    const source = positions.get(edge.source_id);
    const target = positions.get(edge.target_id);
    if (!source || !target) continue;

    const vector = normalizeVector(target.x - source.x, target.y - source.y);
    const desiredLength = idealEdgeLength(edge.edge_kind);
    const force = (vector.distance - desiredLength) * SPRING_STRENGTH;
    addDelta(deltas, edge.source_id, vector.x * force, vector.y * force);
    addDelta(deltas, edge.target_id, -vector.x * force, -vector.y * force);
  }
}

function applyCentering(
  nodes: readonly SpecNode[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
  deltas: Map<string, SpecGraphCanvasLayoutPosition>,
  center: SpecGraphCanvasLayoutPosition,
) {
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    if (!position) continue;
    addDelta(
      deltas,
      node.node_id,
      (center.x - position.x) * CENTERING_STRENGTH,
      (center.y - position.y) * CENTERING_STRENGTH,
    );
  }
}

function applyDeltas(
  nodes: readonly SpecNode[],
  positions: Map<string, SpecGraphCanvasLayoutPosition>,
  deltas: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
  alpha: number,
): SpecGraphForceLayoutTickResult {
  let maxMovement = 0;
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    const delta = deltas.get(node.node_id);
    if (!position || !delta) continue;

    const x = clamp(delta.x * alpha, -MAX_STEP, MAX_STEP);
    const y = clamp(delta.y * alpha, -MAX_STEP, MAX_STEP);
    maxMovement = Math.max(maxMovement, Math.hypot(x, y));
    positions.set(node.node_id, {
      x: position.x + x,
      y: position.y + y,
    });
  }

  return {
    positions,
    maxMovement,
  };
}

function normalizePositions(
  nodes: readonly SpecNode[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
): Map<string, SpecGraphCanvasLayoutPosition> {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const position of positions.values()) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }

  const normalized = new Map<string, SpecGraphCanvasLayoutPosition>();
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    if (!position) continue;
    normalized.set(node.node_id, {
      x: Math.round(position.x - minX + CANVAS_MARGIN),
      y: Math.round(position.y - minY + CANVAS_MARGIN),
    });
  }

  return normalized;
}

function idealEdgeLength(edgeKind: SpecEdge["edge_kind"]): number {
  if (edgeKind === "relates_to") return IDEAL_EDGE_LENGTH * 1.22;
  if (edgeKind === "depends_on") return IDEAL_EDGE_LENGTH * 1.08;
  return IDEAL_EDGE_LENGTH;
}

function normalizeVector(x: number, y: number) {
  const distance = Math.max(Math.hypot(x, y), 0.001);
  return {
    x: x / distance,
    y: y / distance,
    distance,
  };
}

function addDelta(
  deltas: Map<string, SpecGraphCanvasLayoutPosition>,
  nodeId: string,
  x: number,
  y: number,
) {
  const delta = deltas.get(nodeId);
  if (!delta) return;
  delta.x += x;
  delta.y += y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function currentForceLayoutCenter(
  nodes: readonly SpecNode[],
  positions: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
): SpecGraphCanvasLayoutPosition {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    if (!position) continue;
    x += position.x;
    y += position.y;
    count += 1;
  }

  if (count === 0) return { x: 0, y: 0 };
  return {
    x: x / count,
    y: y / count,
  };
}
