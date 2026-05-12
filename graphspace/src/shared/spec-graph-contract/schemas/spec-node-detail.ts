import { z } from "zod";

/**
 * Source: ContextBuilder `viewer/server.py` `/api/spec-node`.
 *
 * The endpoint returns the raw YAML payload for one SpecGraph node in
 * `{ node_id, data }`. The raw payload is intentionally permissive because
 * individual specs evolve their own nested vocabulary over time.
 */

const stringListSchema = z.array(z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

export const specNodeDetailSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    kind: z.string().optional(),
    status: z.string().optional(),
    maturity: z.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    depends_on: stringListSchema.optional(),
    refines: stringListSchema.optional(),
    relates_to: stringListSchema.optional(),
    inputs: stringListSchema.optional(),
    outputs: stringListSchema.optional(),
    allowed_paths: stringListSchema.optional(),
    acceptance: z.array(z.unknown()).optional(),
    acceptance_evidence: z.array(unknownRecordSchema).optional(),
    prompt: z.string().optional(),
    specification: unknownRecordSchema.optional(),
    last_outcome: z.unknown().optional(),
    last_blocker: z.unknown().optional(),
    last_run_at: z.unknown().optional(),
    gate_state: z.unknown().optional(),
    proposed_status: z.unknown().optional(),
    required_human_action: z.unknown().optional(),
  })
  .passthrough();

export type SpecNodeDetail = z.infer<typeof specNodeDetailSchema>;

export const specNodeDetailResponseSchema = z
  .object({
    node_id: z.string(),
    data: specNodeDetailSchema,
  })
  .passthrough();

export type SpecNodeDetailResponse = z.infer<
  typeof specNodeDetailResponseSchema
>;
