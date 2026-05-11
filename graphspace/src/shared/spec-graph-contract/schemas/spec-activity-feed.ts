import { z } from "zod";
import { baseArtifactShape, isoDatetimeWithOffset } from "./envelope";

/**
 * Source: docs/spec_activity_feed_viewer_contract.md (SpecGraph repo).
 *
 * Notes:
 * - `spec_id` is allowed to be the empty string for graph-level events that
 *   cannot be honestly attached to a single canonical node (e.g. some
 *   review-feedback records). The contract calls this out explicitly.
 * - Unknown future `event_type` values must NOT be parse failures. We model
 *   the type as a free-form string and surface the "known" vocabulary as a
 *   const for UI tone selection.
 * - Optional fields are validated as `optional()` not `nullable()` because
 *   the contract describes presence/absence, not nullability.
 */

export const KNOWN_EVENT_TYPES = [
  "canonical_spec_updated",
  "trace_baseline_attached",
  "evidence_baseline_attached",
  "proposal_emitted",
  "implementation_work_emitted",
  "review_feedback_applied",
  "stack_only_merge_observed",
] as const;

export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

export const isKnownEventType = (s: string): s is KnownEventType =>
  (KNOWN_EVENT_TYPES as readonly string[]).includes(s);

const sourceRefSchema = z.object({
  sha: z.string().optional(),
  short_sha: z.string().optional(),
  subject: z.string().optional(),
}).passthrough();

const viewerHintSchema = z.object({
  tone: z.string(),
  label: z.string(),
}).passthrough();

const mergeLandingSchema = z.object({
  status: z.literal("stack_only_merge_observed"),
  reachable_remote_branches: z.array(z.string()),
  main_contains_commit: z.boolean(),
}).passthrough();

export const specActivityEntrySchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  spec_id: z.string(),
  title: z.string(),
  occurred_at: isoDatetimeWithOffset,
  summary: z.string(),
  source_kind: z.string(),
  source_ref: sourceRefSchema.optional(),
  source_paths: z.array(z.string()),
  viewer: viewerHintSchema,
  merge_landing: mergeLandingSchema.optional(),
}).passthrough();

export type SpecActivityEntry = z.infer<typeof specActivityEntrySchema>;

const summarySchema = z.object({
  entry_count: z.number().int().nonnegative(),
  event_type_counts: z.record(z.string(), z.number().int().nonnegative()),
  spec_event_counts: z.record(z.string(), z.number().int().nonnegative()),
}).passthrough();

/**
 * Every projection bucket maps a key (event_type id, spec id, named filter
 * label) to a list of `event_id`s the UI uses for filtering. Previously
 * `named_filters` was modelled as `Record<string, unknown>` which let
 * numbers / nested objects pass as `kind: "ok"` and broke downstream
 * filtering. All three fields are now tightened to `Record<string, string[]>`.
 */
const projectionBucket = z.record(z.string(), z.array(z.string()));

const viewerProjectionSchema = z.object({
  event_type: projectionBucket,
  spec_id: projectionBucket,
  named_filters: projectionBucket,
}).passthrough();

const viewerContractSchema = z.object({
  contract_doc: z.string(),
  recommended_endpoint: z.string(),
  source_artifact: z.string(),
}).passthrough();

const sourceArtifactsSchema = z.object({
  policy: z.string().optional(),
  git_paths: z.array(z.string()).optional(),
}).passthrough();

export const specActivityFeedSchema = z.object({
  ...baseArtifactShape,
  artifact_kind: z.literal("spec_activity_feed"),
  source_artifacts: sourceArtifactsSchema,
  entry_count: z.number().int().nonnegative(),
  entries: z.array(specActivityEntrySchema),
  summary: summarySchema,
  viewer_projection: viewerProjectionSchema,
  viewer_contract: viewerContractSchema,
  canonical_mutations_allowed: z.boolean(),
  tracked_artifacts_written: z.boolean(),
}).passthrough();

export type SpecActivityFeed = z.infer<typeof specActivityFeedSchema>;
