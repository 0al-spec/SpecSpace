import type { SpecGraphResponse } from "@/shared/spec-graph-contract";

export type SpecGraphCanvasLayoutPosition = {
  x: number;
  y: number;
};

export type SpecGraphCanvasLayoutOverrides = Record<
  string,
  SpecGraphCanvasLayoutPosition
>;

export type SpecGraphCanvasLayoutStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

type StoredLayoutOverrides = {
  version: 1;
  overrides: SpecGraphCanvasLayoutOverrides;
};

type LayoutNode = {
  id: string;
  position: SpecGraphCanvasLayoutPosition;
};

const STORAGE_PREFIX = "specspace:spec-graph-canvas-layout:v1:";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFinitePosition = (value: unknown): value is SpecGraphCanvasLayoutPosition =>
  isRecord(value) &&
  typeof value.x === "number" &&
  Number.isFinite(value.x) &&
  typeof value.y === "number" &&
  Number.isFinite(value.y);

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readOptionalString(
  value: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

function graphLayoutSignature(response: SpecGraphResponse): string {
  const responseRecord = response as unknown as Record<string, unknown>;
  const revision = readOptionalString(responseRecord, [
    "graph_revision",
    "revision",
    "source_sha256",
    "artifact_sha256",
  ]);
  const nodes = response.graph.nodes.map((node) => node.node_id).sort();
  const edges = response.graph.edges
    .map((edge) => [
      edge.edge_id,
      edge.edge_kind,
      edge.status,
      edge.source_id,
      edge.target_id,
    ].join(":"))
    .sort();

  return JSON.stringify({
    spec_dir: response.spec_dir,
    revision,
    nodes,
    edges,
  });
}

function normalizeOverrides(
  overrides: SpecGraphCanvasLayoutOverrides,
): SpecGraphCanvasLayoutOverrides {
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(([, position]) => isFinitePosition(position))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([nodeId, position]) => [nodeId, { x: position.x, y: position.y }]),
  );
}

export function buildSpecGraphCanvasLayoutStorageKey(
  response: SpecGraphResponse,
): string {
  return `${STORAGE_PREFIX}${hashString(graphLayoutSignature(response))}`;
}

export function getSpecGraphCanvasLayoutStorage(): SpecGraphCanvasLayoutStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSpecGraphCanvasLayoutOverrides(
  storage: SpecGraphCanvasLayoutStorage | null,
  key: string,
  nodeIds: readonly string[],
): SpecGraphCanvasLayoutOverrides {
  if (!storage) return {};
  const currentNodeIds = new Set(nodeIds);

  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.overrides)) {
      return {};
    }

    const overrides: SpecGraphCanvasLayoutOverrides = {};
    for (const [nodeId, position] of Object.entries(parsed.overrides)) {
      if (!currentNodeIds.has(nodeId) || !isFinitePosition(position)) continue;
      overrides[nodeId] = position;
    }
    return normalizeOverrides(overrides);
  } catch {
    return {};
  }
}

export function writeSpecGraphCanvasLayoutOverrides(
  storage: SpecGraphCanvasLayoutStorage | null,
  key: string,
  overrides: SpecGraphCanvasLayoutOverrides,
) {
  if (!storage) return;
  const normalized = normalizeOverrides(overrides);
  if (Object.keys(normalized).length === 0) {
    storage.removeItem(key);
    return;
  }

  const payload: StoredLayoutOverrides = {
    version: 1,
    overrides: normalized,
  };
  storage.setItem(key, JSON.stringify(payload));
}

export function removeSpecGraphCanvasLayoutOverrides(
  storage: SpecGraphCanvasLayoutStorage | null,
  key: string,
) {
  storage?.removeItem(key);
}

export function upsertSpecGraphCanvasLayoutOverride(
  overrides: SpecGraphCanvasLayoutOverrides,
  nodeId: string,
  position: SpecGraphCanvasLayoutPosition,
): SpecGraphCanvasLayoutOverrides {
  if (!isFinitePosition(position)) return overrides;
  return normalizeOverrides({
    ...overrides,
    [nodeId]: { x: position.x, y: position.y },
  });
}

export function applySpecGraphCanvasLayoutOverrides<T extends LayoutNode>(
  nodes: readonly T[],
  overrides: SpecGraphCanvasLayoutOverrides,
): T[] {
  return nodes.map((node) => {
    const override = overrides[node.id];
    if (!override) return node;
    return {
      ...node,
      position: { x: override.x, y: override.y },
    } as T;
  });
}
