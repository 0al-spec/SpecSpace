// Public API for the SpecGraph contract slice.
// Internals (model/, lib/, fixtures/, __tests__/) are not exported.

export { parseSpecActivityFeed } from "./lib/parse-spec-activity-feed";
export { parseImplementationWorkIndex } from "./lib/parse-implementation-work-index";
export type { ParseResult } from "./lib/parse";

export {
  KNOWN_EVENT_TYPES,
  isKnownEventType,
  type KnownEventType,
  type SpecActivityEntry,
  type SpecActivityFeed,
} from "./model/spec-activity-feed";

export {
  KNOWN_READINESS,
  isKnownReadiness,
  type KnownReadiness,
  type WorkItem,
  type ImplementationWorkIndex,
} from "./model/implementation-work-index";

export {
  MAX_SUPPORTED_VERSION,
  type KnownArtifactKind,
} from "./model/envelope";
