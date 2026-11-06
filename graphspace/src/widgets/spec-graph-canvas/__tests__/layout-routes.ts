import { getBezierPath, getSmoothStepPath, Position } from "@xyflow/react";
import type { SpecEdge } from "@/entities/spec-edge";
import { samplePath, type Point } from "./layout-route-sampling";

type Route = { edge: SpecEdge; points: Point[] };
const orient = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Count strict edge-pair intersections, approximating curves with line segments. */
export function routeCrossings(
  edges: SpecEdge[],
  positions: Map<string, Point>,
  mode: "curved" | "orthogonal",
  steps = 16,
  heights?: ReadonlyMap<string, number>,
): number {
  const routes: Route[] = edges
    .filter(
      (edge) =>
        edge.status === "resolved" &&
        positions.has(edge.source_id) &&
        positions.has(edge.target_id),
    )
    .map((edge) => {
      const sourceId = edge.edge_kind === "refines" ? edge.target_id : edge.source_id;
      const targetId = edge.edge_kind === "refines" ? edge.source_id : edge.target_id;
      const source = positions.get(sourceId)!;
      const target = positions.get(targetId)!;
      const options = {
        sourceX: source.x + 220,
        sourceY: source.y + (heights?.get(sourceId) ?? 126) / 2,
        targetX: target.x,
        targetY: target.y + (heights?.get(targetId) ?? 126) / 2,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
      let curvature = 0.2;
      if (edge.edge_kind === "relates_to") curvature = 0.58;
      if (edge.edge_kind === "depends_on") curvature = 0.38;
      const [path] =
        mode === "curved" ? getBezierPath({ ...options, curvature }) : getSmoothStepPath(options);
      return { edge, points: samplePath(path, steps) };
    });
  let count = 0;
  for (const [index, a] of routes.entries())
    for (const b of routes.slice(index + 1)) {
      if (
        new Set([a.edge.source_id, a.edge.target_id, b.edge.source_id, b.edge.target_id]).size < 4
      )
        continue;
      if (pathsIntersect(a.points, b.points)) count++;
    }
  return count;
}

/** Count non-collinear contacts, including contacts at sampled segment endpoints. */
export function pathsIntersect(a: Point[], b: Point[]): boolean {
  for (const [i, p] of a.entries()) {
    const q = a.at(i + 1);
    if (!q) continue;
    for (const [j, r] of b.entries()) {
      const s = b.at(j + 1);
      if (!s) continue;
      if (segmentsIntersect(p, q, r, s)) return true;
    }
  }
  return false;
}

function segmentsIntersect(p: Point, q: Point, r: Point, s: Point): boolean {
  const one = orient(p, q, r),
    two = orient(p, q, s);
  const three = orient(r, s, p),
    four = orient(r, s, q);
  if (one === 0 && two === 0 && three === 0 && four === 0) return false;
  return one * two <= 0 && three * four <= 0;
}
