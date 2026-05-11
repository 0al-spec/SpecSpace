import type { RecentChange } from "@/entities/recent-change";

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesQuery(value: string, query: string, compactQuery: string): boolean {
  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.includes(query) ||
    (compactQuery.length > 0 && compact(value).includes(compactQuery))
  );
}

/**
 * Search is intentionally spec-scoped: it matches canonical spec ids and
 * source paths, but does not become generic title/summary full-text search.
 */
export function filterBySpecQuery(
  entries: readonly RecentChange[],
  query: string,
): readonly RecentChange[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries;

  const compactQuery = compact(normalizedQuery);
  return entries.filter((entry) => {
    if (entry.spec_id && matchesQuery(entry.spec_id, normalizedQuery, compactQuery)) {
      return true;
    }
    return entry.source_paths.some((path) =>
      matchesQuery(path, normalizedQuery, compactQuery),
    );
  });
}
