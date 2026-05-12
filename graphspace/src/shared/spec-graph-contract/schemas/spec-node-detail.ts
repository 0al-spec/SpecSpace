import { z } from "zod";

/**
 * Source: ContextBuilder `viewer/server.py` `/api/spec-node`.
 *
 * The endpoint returns the raw YAML payload for one SpecGraph node in
 * `{ node_id, data }`. The raw payload is intentionally permissive because
 * individual specs evolve their own nested vocabulary over time.
 */

export const specNodeDetailSchema = z
  .object({
    id: z.string(),
    title: z.unknown().nullable().optional(),
    kind: z.unknown().nullable().optional(),
    status: z.unknown().nullable().optional(),
    maturity: z.unknown().nullable().optional(),
    created_at: z.unknown().nullable().optional(),
    updated_at: z.unknown().nullable().optional(),
    depends_on: z.unknown().nullable().optional(),
    refines: z.unknown().nullable().optional(),
    relates_to: z.unknown().nullable().optional(),
    inputs: z.unknown().nullable().optional(),
    outputs: z.unknown().nullable().optional(),
    allowed_paths: z.unknown().nullable().optional(),
    acceptance: z.unknown().nullable().optional(),
    acceptance_evidence: z.unknown().nullable().optional(),
    prompt: z.unknown().nullable().optional(),
    specification: z.unknown().nullable().optional(),
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
