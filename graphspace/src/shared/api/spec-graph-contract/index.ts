// Public API for the SpecGraph contract slice.
// Internals (model/, lib/, fixtures/, __tests__/) are not exported.

export { parseSpecActivityFeed } from "./lib/parse-spec-activity-feed";
export type { ParseResult } from "./lib/parse";

export {
  KNOWN_EVENT_TYPES,
  isKnownEventType,
  type KnownEventType,
  type SpecActivityEntry,
  type SpecActivityFeed,
} from "./model/spec-activity-feed";

export {
  MAX_SUPPORTED_VERSION,
  type KnownArtifactKind,
} from "./model/envelope";
