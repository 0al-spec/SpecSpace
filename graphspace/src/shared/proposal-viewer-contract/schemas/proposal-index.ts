import { z } from "zod";

const nullableString = z.string().nullable();
const countMapSchema = z.record(z.string(), z.number().int().nonnegative());

const markdownSchema = z
  .object({
    available: z.boolean(),
    file_name: nullableString.optional(),
    relative_path: nullableString.optional(),
    mtime_iso: nullableString.optional(),
    content_excerpt: nullableString.optional(),
    content_preview: nullableString.optional(),
  })
  .passthrough();

const proposalSourceSchema = z
  .object({
    available: z.boolean(),
    artifact: z.string().optional(),
    path: z.string().nullable().optional(),
    entry_count: z.number().int().nonnegative(),
    reason: nullableString.optional(),
    artifact_kind: nullableString.optional(),
    generated_at: nullableString.optional(),
  })
  .passthrough();

export const proposalIndexEntrySchema = z
  .object({
    proposal_key: z.string(),
    proposal_id: z.string(),
    proposal_handle: nullableString,
    title: z.string(),
    status: z.string(),
    proposal_path: nullableString,
    markdown: markdownSchema,
    authority_state: nullableString,
    proposal_type: nullableString,
    runtime_state: nullableString,
    runtime_posture: nullableString,
    promotion_status: nullableString,
    trace_status: nullableString,
    next_gap: nullableString,
    affected_spec_ids: z.array(z.string()),
    source_kinds: z.array(z.string()),
  })
  .passthrough();

export const proposalIndexSchema = z
  .object({
    api_version: z.literal("v1"),
    artifact_kind: z.literal("specspace_proposal_index"),
    generated_at: z.string(),
    read_only: z.literal(true),
    source: z.object({
      provider: z.string(),
    }).passthrough(),
    entry_count: z.number().int().nonnegative(),
    entries: z.array(proposalIndexEntrySchema),
    filters: z
      .object({
        status_counts: countMapSchema,
        authority_state_counts: countMapSchema,
        runtime_state_counts: countMapSchema,
        runtime_posture_counts: countMapSchema,
        affected_spec_ids: z.array(z.string()),
      })
      .passthrough(),
    sources: z.record(z.string(), proposalSourceSchema),
  })
  .passthrough();

export type ProposalIndex = z.infer<typeof proposalIndexSchema>;
export type ProposalIndexEntry = z.infer<typeof proposalIndexEntrySchema>;
