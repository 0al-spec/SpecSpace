import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 148;
const HEADER_HEIGHT = 40;
const MSG_HEIGHT = 36;
const MSG_GAP = 16;
const SUBFLOW_PAD = 14;

export function expandedNodeHeight(checkpointCount: number): number {
  return (
    HEADER_HEIGHT +
    checkpointCount * (MSG_HEIGHT + MSG_GAP) -
    MSG_GAP +
    SUBFLOW_PAD * 2
  );
}

export interface LayoutOptions {
  direction?: "LR" | "TB";
  nodeSep?: number;
  rankSep?: number;
}

/**
 * Compute stable top-level positions using dagre, treating all nodes as
 * collapsed (NODE_WIDTH × NODE_HEIGHT). Call this only when the graph
 * topology changes — not when expand state changes.
 */
export function computeBasePositions(
  nodeIds: string[],
  edgePairs: { source: string; target: string }[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const { direction = "LR", nodeSep = 60, rankSep = 120 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const idSet = new Set(nodeIds);
  for (const { source, target } of edgePairs) {
    if (idSet.has(source) && idSet.has(target)) {
      g.setEdge(source, target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    const pos = g.node(id);
    positions.set(id, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 });
  }
  return positions;
}

/**
 * Compute linear left-to-right positions so that ALL forward edges
 * (refines children, depends_on, relates_to) point rightward.
 *
 * Algorithm:
 * 1. Build combined forward-edge graph from all edge types.
 * 2. DFS to detect & remove back-edges (cycle breakers).
 * 3. Kahn's topological sort on the resulting DAG.
 * 4. Assign rank = longest-path distance from roots (spreads nodes).
 * 5. Within each rank, assign vertical lanes via tree parentage.
 *
 * Returns positions + the set of back-edge keys ("src::tgt") so the
 * caller can style them differently.
 */
export interface LinearLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  backEdges: Set<string>;
}

export function computeLinearPositions(
  nodeIds: string[],
  allForwardEdges: { source: string; target: string }[],
  treeEdges: { source: string; target: string }[],
  options: { colGap?: number; rowGap?: number } = {},
): LinearLayoutResult {
  const { colGap = 300, rowGap = 180 } = options;

  const idSet = new Set(nodeIds);

  // --- 1. Build combined adjacency (deduped) ---
  const adj = new Map<string, Set<string>>();
  const incomingAll = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    adj.set(id, new Set());
    incomingAll.set(id, new Set());
  }
  for (const { source, target } of allForwardEdges) {
    if (!idSet.has(source) || !idSet.has(target)) continue;
    if (source === target) continue;
    adj.get(source)!.add(target);
    incomingAll.get(target)!.add(source);
  }

  // --- 2. DFS to find back-edges (cycle detection) ---
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const backEdges = new Set<string>();
  for (const id of nodeIds) color.set(id, WHITE);

  function dfsVisit(u: string): void {
    color.set(u, GRAY);
    for (const v of adj.get(u)!) {
      if (color.get(v) === GRAY) {
        // back-edge found → mark for removal
        backEdges.add(`${u}::${v}`);
      } else if (color.get(v) === WHITE) {
        dfsVisit(v);
      }
    }
    color.set(u, BLACK);
  }

  // Start DFS from tree roots first (gives them priority in ordering)
  const treeParent = new Set<string>();
  for (const { target } of treeEdges) {
    if (idSet.has(target)) treeParent.add(target);
  }
  const treeRoots = nodeIds.filter((id) => !treeParent.has(id));
  for (const root of treeRoots) {
    if (color.get(root) === WHITE) dfsVisit(root);
  }
  for (const id of nodeIds) {
    if (color.get(id) === WHITE) dfsVisit(id);
  }

  // --- 3. Remove back-edges → build clean DAG ---
  const dagAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    dagAdj.set(id, []);
    inDegree.set(id, 0);
  }
  for (const { source, target } of allForwardEdges) {
    if (!idSet.has(source) || !idSet.has(target)) continue;
    if (source === target) continue;
    if (backEdges.has(`${source}::${target}`)) continue;
    dagAdj.get(source)!.push(target);
    inDegree.set(target, inDegree.get(target)! + 1);
  }

  // --- 4. Kahn's topological sort ---
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDegree.get(id) === 0) queue.push(id);
  }
  const topoOrder: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    topoOrder.push(u);
    for (const v of dagAdj.get(u)!) {
      const d = inDegree.get(v)! - 1;
      inDegree.set(v, d);
      if (d === 0) queue.push(v);
    }
  }
  // Catch any remaining (shouldn't happen after cycle removal)
  for (const id of nodeIds) {
    if (!topoOrder.includes(id)) topoOrder.push(id);
  }

  // --- 5. Rank = longest path from any root in DAG ---
  const rank = new Map<string, number>();
  for (const id of nodeIds) rank.set(id, 0);
  for (const u of topoOrder) {
    const r = rank.get(u)!;
    for (const v of dagAdj.get(u)!) {
      if (r + 1 > rank.get(v)!) {
        rank.set(v, r + 1);
      }
    }
  }

  // --- 6. Lane assignment using tree parentage ---
  // Build tree children map
  const treeChildren = new Map<string, string[]>();
  for (const { source, target } of treeEdges) {
    if (!idSet.has(source) || !idSet.has(target)) continue;
    if (!treeChildren.has(source)) treeChildren.set(source, []);
    treeChildren.get(source)!.push(target);
  }

  const lane = new Map<string, number>();
  let nextLane = 0;

  function assignLanes(nodeId: string, parentLane: number): void {
    if (lane.has(nodeId)) return;
    lane.set(nodeId, parentLane);
    const kids = treeChildren.get(nodeId) ?? [];
    for (let i = 0; i < kids.length; i++) {
      assignLanes(kids[i], i === 0 ? parentLane : nextLane++);
    }
  }

  for (const root of treeRoots) {
    assignLanes(root, nextLane++);
  }
  for (const id of nodeIds) {
    if (!lane.has(id)) {
      lane.set(id, nextLane++);
    }
  }

  // --- 7. Build positions: x from rank, y from lane ---
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    positions.set(id, {
      x: rank.get(id)! * (NODE_WIDTH + colGap),
      y: lane.get(id)! * (NODE_HEIGHT + rowGap),
    });
  }

  return { positions, backEdges };
}

export function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node[] {
  const { direction = "LR", nodeSep = 60, rankSep = 120 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  // Only layout top-level nodes (no parentId)
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  const childNodes = nodes.filter((n) => n.parentId);

  for (const node of topLevelNodes) {
    const isGroup = node.type === "group";
    const w = isGroup
      ? (node.style?.width as number) || NODE_WIDTH
      : NODE_WIDTH;
    const h = isGroup
      ? (node.style?.height as number) || NODE_HEIGHT
      : NODE_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  // Only add edges between top-level nodes
  const topLevelIds = new Set(topLevelNodes.map((n) => n.id));
  for (const edge of edges) {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positionedNodes = topLevelNodes.map((node) => {
    const pos = g.node(node.id);
    const w = pos.width;
    const h = pos.height;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });

  return [...positionedNodes, ...childNodes];
}
