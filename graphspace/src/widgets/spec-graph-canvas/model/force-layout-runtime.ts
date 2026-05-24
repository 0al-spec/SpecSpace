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
  if (guard.available) {
    return `Force active: ${guard.nodeCount}/${guard.nodeLimit} nodes, ${guard.edgeCount}/${guard.edgeLimit} edges`;
  }
  if (guard.reason === "node_limit_exceeded") {
    return `Force unavailable: ${guard.nodeCount}/${guard.nodeLimit} nodes`;
  }
  if (guard.reason === "edge_limit_exceeded") {
    return `Force unavailable: ${guard.edgeCount}/${guard.edgeLimit} edges`;
  }
  return `Force guarded: ${guard.nodeCount}/${guard.nodeLimit} nodes, ${guard.edgeCount}/${guard.edgeLimit} edges`;
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
  const nodeIds = new Set(sortedNodes.map((node) => node.node_id));
  const resolvedEdges = edges
    .filter(
      (edge) =>
        edge.status === "resolved" &&
        nodeIds.has(edge.source_id) &&
        nodeIds.has(edge.target_id),
    )
    .sort(byEdgeId);
  const positions = seedCircularPositions(sortedNodes);

  for (let iteration = 0; iteration < ITERATION_COUNT; iteration += 1) {
    const deltas = new Map<string, SpecGraphCanvasLayoutPosition>(
      sortedNodes.map((node) => [node.node_id, { x: 0, y: 0 }]),
    );

    applyRepulsion(sortedNodes, positions, deltas);
    applyEdgeSprings(resolvedEdges, positions, deltas);
    applyCentering(sortedNodes, positions, deltas);
    applyDeltas(sortedNodes, positions, deltas);
  }

  return normalizePositions(sortedNodes, positions);
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
) {
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    if (!position) continue;
    addDelta(
      deltas,
      node.node_id,
      -position.x * CENTERING_STRENGTH,
      -position.y * CENTERING_STRENGTH,
    );
  }
}

function applyDeltas(
  nodes: readonly SpecNode[],
  positions: Map<string, SpecGraphCanvasLayoutPosition>,
  deltas: ReadonlyMap<string, SpecGraphCanvasLayoutPosition>,
) {
  for (const node of nodes) {
    const position = positions.get(node.node_id);
    const delta = deltas.get(node.node_id);
    if (!position || !delta) continue;

    positions.set(node.node_id, {
      x: position.x + clamp(delta.x, -MAX_STEP, MAX_STEP),
      y: position.y + clamp(delta.y, -MAX_STEP, MAX_STEP),
    });
  }
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
