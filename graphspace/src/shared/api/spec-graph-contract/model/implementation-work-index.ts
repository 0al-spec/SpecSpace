import { z } from "zod";
import { baseArtifactShape } from "./envelope";

/**
 * Source: docs/implementation_work_viewer_contract.md §6–7 (SpecGraph repo).
 *
 * The Implementation Work layer sits between canonical specs and runtime
 * code. The viewer must NOT treat it as canonical graph truth — the
 * contract calls this out explicitly via `canonical_mutations_allowed`
 * and `runtime_code_mutations_allowed` flags (both false on this artifact).
 *
 * Forward-compat:
 * - `readiness` and `next_gap` are modeled as free-form strings; the
 *   contract §7 lists the initial vocabulary but new states must render
 *   as neutral, not crash. Mapping to a bounded tone vocabulary happens
 *   at the entity layer (entities/implementation-work/lib/readiness.ts).
 * - The artifact has no `summary` field (unlike spec_activity_feed), so
 *   the only count invariant is `entry_count === entries.length`.
 */

export const KNOWN_READINESS = [
  "ready_for_planning",
  "ready_for_coding_agent",
  "in_progress",
  "implemented_pending_evidence",
  "implemented",
  "blocked_by_trace_gap",
  "blocked_by_evidence_gap",
  "blocked_by_spec_quality",
  // Snapshot-only states (delta artifact, but contract calls them out for
  // viewer reuse — kept here so a future implementation_delta_snapshot
  // entity can share the vocabulary).
  "empty_delta",
  "invalid_target_scope",
] as const;

export type KnownReadiness = (typeof KNOWN_READINESS)[number];

export const isKnownReadiness = (s: string): s is KnownReadiness =>
  (KNOWN_READINESS as readonly string[]).includes(s);

const policyReferenceSchema = z
  .object({
    artifact_path: z.string(),
    artifact_sha256: z.string(),
    version: z.number().int().nonnegative(),
  })
  .passthrough();

const sourceDeltaSnapshotSchema = z
  .object({
    artifact_path: z.string(),
    generated_at: z.string(),
    next_gap: z.string().optional(),
    review_state: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const workItemSchema = z
  .object({
    work_item_id: z.string(),
    affected_spec_ids: z.array(z.string()),
    implementation_reason: z.string(),
    delta_refs: z.array(z.string()),
    required_tests: z.array(z.string()),
    expected_evidence: z.array(z.string()),
    likely_code_refs: z.array(z.string()),
    readiness: z.string(),
    blockers: z.array(z.string()),
    next_gap: z.string(),
  })
  .passthrough();

export type WorkItem = z.infer<typeof workItemSchema>;

const viewerProjectionSchema = z
  .object({
    readiness: z.record(z.string(), z.array(z.string())),
    next_gap: z.record(z.string(), z.array(z.string())),
    named_filters: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const implementationBacklogSchema = z
  .object({
    entry_count: z.number().int().nonnegative(),
    grouped_by_next_gap: z.record(z.string(), z.array(z.string())),
    items: z.array(z.unknown()),
  })
  .passthrough();

export const implementationWorkIndexSchema = z
  .object({
    ...baseArtifactShape,
    artifact_kind: z.literal("implementation_work_index"),
    policy_reference: policyReferenceSchema,
    source_delta_snapshot: sourceDeltaSnapshotSchema,
    entry_count: z.number().int().nonnegative(),
    entries: z.array(workItemSchema),
    viewer_projection: viewerProjectionSchema,
    implementation_backlog: implementationBacklogSchema,
    canonical_mutations_allowed: z.boolean(),
    runtime_code_mutations_allowed: z.boolean(),
  })
  .passthrough();

export type ImplementationWorkIndex = z.infer<typeof implementationWorkIndexSchema>;
