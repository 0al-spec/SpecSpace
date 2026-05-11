import {
  implementationWorkIndexSchema,
  type ImplementationWorkIndex,
} from "../schemas/implementation-work-index";
import { makeParser } from "./parse";

/**
 * Contract invariant: `entry_count === entries.length`. Unlike spec_activity_feed
 * this artifact has no `summary.entry_count`, so only the one-direction check
 * applies. The `implementation_backlog.entry_count` measures a different
 * collection (backlog items) and is independent.
 */
const counts: (data: ImplementationWorkIndex) => string | null = (data) => {
  if (data.entry_count !== data.entries.length) {
    return `entry count mismatch: entry_count=${data.entry_count}, entries.length=${data.entries.length}`;
  }
  return null;
};

export const parseImplementationWorkIndex = makeParser({
  kind: "implementation_work_index",
  schema: implementationWorkIndexSchema,
  invariants: [counts],
});
