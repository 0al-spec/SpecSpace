/** Sample the absolute M/L/Q/C SVG commands emitted by React Flow's path helpers. */
export type Point = { x: number; y: number };

export function samplePath(path: string, subdivisions = 16): Point[] {
  const commands = path.match(/[MLQC][^MLQC]*/g);
  if (!commands || commands.join("") !== path) throw new Error(`Unsupported path: ${path}`);
  let current: Point = { x: 0, y: 0 };
  const points: Point[] = [];
  for (const command of commands) {
    const kind = command[0];
    const tokens = command
      .slice(1)
      .trim()
      .split(/[\s,]+/);
    const values = tokens.map(Number);
    const expected = new Map([
      ["M", 2],
      ["L", 2],
      ["Q", 4],
      ["C", 6],
    ]).get(kind);
    if (values.length !== expected || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Unsupported command: ${command}`);
    }
    if (kind === "M" || kind === "L") {
      current = { x: values[0], y: values[1] };
      points.push(current);
      continue;
    }
    const start = current;
    for (let i = 1; i <= subdivisions; i++) {
      const t = i / subdivisions,
        u = 1 - t;
      if (kind === "Q")
        points.push({
          x: u * u * start.x + 2 * u * t * values[0] + t * t * values[2],
          y: u * u * start.y + 2 * u * t * values[1] + t * t * values[3],
        });
      else
        points.push({
          x:
            u * u * u * start.x +
            3 * u * u * t * values[0] +
            3 * u * t * t * values[2] +
            t * t * t * values[4],
          y:
            u * u * u * start.y +
            3 * u * u * t * values[1] +
            3 * u * t * t * values[3] +
            t * t * t * values[5],
        });
    }
    current = points.at(-1)!;
  }
  return points;
}
