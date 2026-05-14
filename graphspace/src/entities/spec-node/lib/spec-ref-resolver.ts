import type { SpecNode } from "../model/types";

type SpecRefNode = Pick<SpecNode, "node_id">;
export type SpecNodeRefResolver = (token: string) => string | null;

const AMBIGUOUS_ALIAS = Symbol("ambiguous spec ref alias");
const SPEC_ALIAS_PATTERN = /^SPEC-[A-Z0-9_]+(?:-[A-Z0-9_]+)*$/;

type AliasResolution = string | typeof AMBIGUOUS_ALIAS;

function normalizeRef(value: string): string {
  return value.trim().toUpperCase();
}

function isSpecAlias(value: string): boolean {
  return SPEC_ALIAS_PATTERN.test(value);
}

function setAliasResolution(
  aliases: Map<string, AliasResolution>,
  alias: string,
  nodeId: string,
) {
  const existing = aliases.get(alias);
  if (!existing) {
    aliases.set(alias, nodeId);
    return;
  }
  if (existing !== nodeId) aliases.set(alias, AMBIGUOUS_ALIAS);
}

export function createSpecNodeRefResolver(
  nodes: readonly SpecRefNode[],
): SpecNodeRefResolver {
  const exactByNormalizedId = new Map<string, string>();
  const aliasByNormalizedId = new Map<string, AliasResolution>();

  for (const node of nodes) {
    const nodeId = node.node_id;
    const normalizedNodeId = normalizeRef(nodeId);
    const segments = normalizedNodeId.split("-");
    exactByNormalizedId.set(normalizedNodeId, nodeId);

    for (let index = 0; index < segments.length - 1; index += 1) {
      const alias = segments.slice(index).join("-");
      if (isSpecAlias(alias)) setAliasResolution(aliasByNormalizedId, alias, nodeId);
    }
  }

  return (token: string) => {
    const normalizedToken = normalizeRef(token);
    if (!normalizedToken) return null;

    const exact = exactByNormalizedId.get(normalizedToken);
    if (exact) return exact;
    if (!isSpecAlias(normalizedToken)) return null;

    const alias = aliasByNormalizedId.get(normalizedToken);
    return typeof alias === "string" ? alias : null;
  };
}
