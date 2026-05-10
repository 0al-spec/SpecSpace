import { specActivityFeedSchema, type SpecActivityFeed } from "../model/spec-activity-feed";
import { makeParser } from "./parse";

/**
 * Contract invariant from spec_activity_feed_viewer_contract.md §3:
 * `entry_count`, `summary.entry_count` and `entries.length` must agree.
 * CLAUDE.md (project) requires tests that catch this exact contradiction.
 */
const counts: (data: SpecActivityFeed) => string | null = (data) => {
  const a = data.entry_count;
  const b = data.summary.entry_count;
  const c = data.entries.length;
  if (a === b && b === c) return null;
  return `entry count mismatch: entry_count=${a}, summary.entry_count=${b}, entries.length=${c}`;
};

export const parseSpecActivityFeed = makeParser({
  kind: "spec_activity_feed",
  schema: specActivityFeedSchema,
  invariants: [counts],
});
