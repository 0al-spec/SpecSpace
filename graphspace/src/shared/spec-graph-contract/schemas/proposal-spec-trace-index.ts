import { z } from "zod";
import { baseArtifactShape } from "./envelope";

/**
 * Source: docs/proposal_spec_trace_viewer_contract.md (SpecGraph repo).
 *
 * This is a read-only pre-canonical proposal-to-spec trace surface. The
 * viewer renders trace posture and next gaps, but must not treat proposal
 * mentions as canonical graph edges.
 */

const countMapSchema = z.record(z.string(), z.number().int().nonnegative());
const projectionBucket = z.record(z.string(), z.array(z.string()));

const specRefSchema = z
  .object({
    proposal_id: z.string(),
    proposal_path: z.string(),
    spec_id: z.string(),
    relation_kind: z.string(),
    authority: z.string(),
    trace_status: z.string(),
    next_gap: z.string(),
    source_refs: z.array(z.string()),
  })
  .passthrough();

const promotionTraceSchema = z
  .object({
    status: z.string(),
    trace_status: z.string().optional(),
    next_gap: z.string().optional(),
    source_refs: z.array(z.string()).optional(),
  })
  .passthrough();

export const proposalTraceEntrySchema = z
  .object({
    trace_entry_id: z.string(),
    proposal_id: z.string(),
    proposal_path: z.string(),
    title: z.string(),
    status: z.string(),
    spec_refs: z.array(specRefSchema),
    mentioned_spec_ids: z.array(z.string()),
    promotion_trace: promotionTraceSchema,
    next_gap: z.string(),
  })
  .passthrough();

export type ProposalTraceEntry = z.infer<typeof proposalTraceEntrySchema>;

const laneRefSchema = z
  .object({
    lane_ref_id: z.string(),
    proposal_handle: z.string(),
    target_spec_id: z.string(),
    target_reference: z.string(),
    relation_kind: z.string(),
    authority: z.string(),
    trace_status: z.string(),
    source_refs: z.array(z.string()),
    next_gap: z.string(),
  })
  .passthrough();

const summarySchema = z
  .object({
    entry_count: z.number().int().nonnegative(),
    lane_ref_count: z.number().int().nonnegative(),
    spec_ref_count: z.number().int().nonnegative(),
    authority_counts: countMapSchema,
    trace_status_counts: countMapSchema,
  })
  .passthrough();

const viewerProjectionSchema = z
  .object({
    spec_id: projectionBucket,
    authority: projectionBucket,
    trace_status: projectionBucket,
    named_filters: projectionBucket,
  })
  .passthrough();

const viewerContractSchema = z
  .object({
    contract_doc: z.string(),
    read_only: z.boolean(),
  })
  .passthrough();

export const proposalSpecTraceIndexSchema = z
  .object({
    ...baseArtifactShape,
    artifact_kind: z.literal("proposal_spec_trace_index"),
    source_artifacts: z.record(z.string(), z.unknown()).optional(),
    entry_count: z.number().int().nonnegative(),
    entries: z.array(proposalTraceEntrySchema),
    lane_ref_count: z.number().int().nonnegative(),
    lane_refs: z.array(laneRefSchema),
    summary: summarySchema,
    viewer_projection: viewerProjectionSchema,
    viewer_contract: viewerContractSchema,
    canonical_mutations_allowed: z.boolean(),
    tracked_artifacts_written: z.boolean(),
  })
  .passthrough();

export type ProposalSpecTraceIndex = z.infer<typeof proposalSpecTraceIndexSchema>;
