export function isHierarchyEdge(kind: string | undefined): boolean {
  return kind === "extends" || kind === "implements";
}

/** An edge from source to target is cyclic when target already reaches source. */
export function wouldCreateCycle(
  source: string,
  target: string,
  successors: (id: string) => Iterable<string>,
): boolean {
  const pending = [target];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...successors(current));
  }
  return false;
}
