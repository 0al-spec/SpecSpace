import type { RecentChange } from "@/entities/recent-change";
import type { SpecGraphNode } from "@/shared/spec-graph-contract";

export type RecentTimelineField = "event" | "spec-updated" | "spec-created";
export type RecentTimelineRange = "all" | "24h" | "7d" | "30d";

export type RecentTimelineFilter = {
  field: RecentTimelineField;
  range: RecentTimelineRange;
  includeUnknown: boolean;
};

export type RecentTimelineFilterResult = {
  entries: readonly RecentChange[];
  knownCount: number;
  unknownCount: number;
  totalCount: number;
};

export const DEFAULT_RECENT_TIMELINE_FILTER: RecentTimelineFilter = {
  field: "event",
  range: "all",
  includeUnknown: true,
};

const RANGE_DURATION_MS: Record<Exclude<RecentTimelineRange, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function hasRecentTimelineFilter(filter: RecentTimelineFilter): boolean {
  return (
    filter.field !== DEFAULT_RECENT_TIMELINE_FILTER.field ||
    filter.range !== DEFAULT_RECENT_TIMELINE_FILTER.range ||
    filter.includeUnknown !== DEFAULT_RECENT_TIMELINE_FILTER.includeUnknown
  );
}

export function withRecentTimelineField(
  filter: RecentTimelineFilter,
  field: RecentTimelineField,
): RecentTimelineFilter {
  return {
    ...filter,
    field,
    includeUnknown: filter.range === "all" ? filter.includeUnknown : false,
  };
}

export function withRecentTimelineRange(
  filter: RecentTimelineFilter,
  range: RecentTimelineRange,
): RecentTimelineFilter {
  return {
    ...filter,
    range,
    includeUnknown: range === "all" ? filter.includeUnknown : false,
  };
}

export function filterRecentChangesByTimeline(
  entries: readonly RecentChange[],
  nodes: readonly SpecGraphNode[],
  filter: RecentTimelineFilter,
  now: Date = new Date(),
): RecentTimelineFilterResult {
  const nodesById = new Map(nodes.map((node) => [node.node_id, node]));
  const cutoff = rangeCutoff(filter.range, now);
  const result: RecentChange[] = [];
  let knownCount = 0;
  let unknownCount = 0;

  for (const entry of entries) {
    const timestamp = entryTimestamp(entry, nodesById, filter.field);
    if (timestamp === null) {
      unknownCount += 1;
      if (filter.includeUnknown) result.push(entry);
      continue;
    }

    knownCount += 1;
    if (cutoff === null || timestamp >= cutoff) {
      result.push(entry);
    }
  }

  return {
    entries: result,
    knownCount,
    unknownCount,
    totalCount: entries.length,
  };
}

function rangeCutoff(range: RecentTimelineRange, now: Date): number | null {
  if (range === "all") return null;
  return now.getTime() - RANGE_DURATION_MS[range];
}

function entryTimestamp(
  entry: RecentChange,
  nodesById: ReadonlyMap<string, SpecGraphNode>,
  field: RecentTimelineField,
): number | null {
  if (field === "event") return parseTimestamp(entry.occurred_at);

  const node = nodesById.get(entry.spec_id);
  if (!node) return null;

  return parseTimestamp(field === "spec-updated" ? node.updated_at : node.created_at);
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
