// Public API for the SpecGraph contract slice.
// Internals (model/, lib/, fixtures/, __tests__/) are not exported.

export { parseSpecActivityFeed } from "./parsers/parse-spec-activity-feed";
export { parseImplementationWorkIndex } from "./parsers/parse-implementation-work-index";
export { parseProposalSpecTraceIndex } from "./parsers/parse-proposal-spec-trace-index";
export type { ParseResult } from "./parsers/parse";

export {
  KNOWN_EVENT_TYPES,
  isKnownEventType,
  type KnownEventType,
  type SpecActivityEntry,
  type SpecActivityFeed,
} from "./schemas/spec-activity-feed";

export {
  KNOWN_READINESS,
  isKnownReadiness,
  type KnownReadiness,
  type WorkItem,
  type ImplementationWorkIndex,
} from "./schemas/implementation-work-index";

export {
  MAX_SUPPORTED_VERSION,
  type KnownArtifactKind,
} from "./schemas/envelope";

export type {
  ProposalTraceEntry,
  ProposalSpecTraceIndex,
} from "./schemas/proposal-spec-trace-index";
