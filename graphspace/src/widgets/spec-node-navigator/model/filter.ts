import type { SpecNode } from "@/entities/spec-node";

const normalize = (value: string) => value.trim().toLowerCase();

export function filterSpecNodeNavigatorNodes(
  nodes: readonly SpecNode[],
  query: string,
): SpecNode[] {
  const sorted = [...nodes].sort((a, b) => a.node_id.localeCompare(b.node_id));
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return sorted;

  return sorted.filter((node) =>
    [
      node.node_id,
      node.title,
      node.file_name,
    ].some((value) => normalize(value).includes(normalizedQuery)),
  );
}
