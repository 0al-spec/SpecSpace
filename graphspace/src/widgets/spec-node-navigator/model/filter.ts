import type { SpecNode } from "@/entities/spec-node";

export type SpecNodeNavigatorSignalFilter = "all" | "gaps" | "diagnostics";

const normalize = (value: string) => value.trim().toLowerCase();

function matchesSignalFilter(
  node: SpecNode,
  signalFilter: SpecNodeNavigatorSignalFilter,
) {
  if (signalFilter === "gaps") return node.gap_count > 0;
  if (signalFilter === "diagnostics") return node.diagnostics.length > 0;
  return true;
}

export function filterSpecNodeNavigatorNodes(
  nodes: readonly SpecNode[],
  query: string,
  signalFilter: SpecNodeNavigatorSignalFilter = "all",
): SpecNode[] {
  const sorted = [...nodes].sort((a, b) => a.node_id.localeCompare(b.node_id));
  const normalizedQuery = normalize(query);

  return sorted.filter((node) => {
    if (!matchesSignalFilter(node, signalFilter)) return false;
    if (!normalizedQuery) return true;

    return [
      node.node_id,
      node.title,
      node.file_name,
    ].some((value) => normalize(value).includes(normalizedQuery));
  });
}
