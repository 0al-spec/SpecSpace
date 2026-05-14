import { z } from "zod";

/**
 * Source: ContextBuilder `viewer/server.py` `/api/v1/spec-graph`.
 *
 * Unlike the runs artifacts in this slice, `/api/v1/spec-graph` is not a
 * versioned artifact envelope. It is a server API response shaped as
 * `{ spec_dir, graph, summary }`, where `summary` mirrors `graph.summary`.
 *
 * Unknown fields are intentionally preserved. The legacy viewer has gained
 * optional metadata over time (for example authority or presence hints), and
 * GraphSpace should not fail just because the server grows additive fields.
 */

export const SPEC_GRAPH_EDGE_KINDS = [
  "depends_on",
  "refines",
  "relates_to",
] as const;

export type SpecGraphEdgeKind = (typeof SPEC_GRAPH_EDGE_KINDS)[number];

export const SPEC_GRAPH_EDGE_STATUSES = ["resolved", "broken"] as const;

export type SpecGraphEdgeStatus = (typeof SPEC_GRAPH_EDGE_STATUSES)[number];

const stringListSchema = z.array(z.string());

export const specGraphDiagnosticSchema = z
  .object({
    scope: z.string(),
    message: z.string(),
  })
  .passthrough();

export type SpecGraphDiagnostic = z.infer<typeof specGraphDiagnosticSchema>;

export const specGraphNodeDiagnosticSchema = z
  .object({
    message: z.string(),
    edge_kind: z.enum(SPEC_GRAPH_EDGE_KINDS).optional(),
  })
  .passthrough();

export type SpecGraphNodeDiagnostic = z.infer<typeof specGraphNodeDiagnosticSchema>;

export const specGraphNodeSchema = z
  .object({
    node_id: z.string(),
    file_name: z.string(),
    title: z.string(),
    kind: z.string(),
    status: z.string(),
    maturity: z.number().nullable(),
    acceptance_count: z.number().int().nonnegative(),
    decisions_count: z.number().int().nonnegative(),
    evidence_gap: z.number().int().nonnegative(),
    input_gap: z.number().int().nonnegative(),
    execution_gap: z.number().int().nonnegative(),
    gap_count: z.number().int().nonnegative(),
    depends_on: stringListSchema,
    refines: stringListSchema,
    relates_to: stringListSchema,
    diagnostics: z.array(specGraphNodeDiagnosticSchema),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    presence_state: z.string().nullable().optional(),
    authority_class: z.string().nullable().optional(),
  })
  .passthrough();

export type SpecGraphNode = z.infer<typeof specGraphNodeSchema>;

export const specGraphEdgeSchema = z
  .object({
    edge_id: z.string(),
    edge_kind: z.enum(SPEC_GRAPH_EDGE_KINDS),
    source_id: z.string(),
    target_id: z.string(),
    status: z.enum(SPEC_GRAPH_EDGE_STATUSES),
  })
  .passthrough();

export type SpecGraphEdge = z.infer<typeof specGraphEdgeSchema>;

export const specGraphSummarySchema = z
  .object({
    node_count: z.number().int().nonnegative(),
    edge_count: z.number().int().nonnegative(),
    root_count: z.number().int().nonnegative(),
    blocked_file_count: z.number().int().nonnegative(),
    diagnostic_count: z.number().int().nonnegative(),
    broken_edge_count: z.number().int().nonnegative(),
  })
  .passthrough();

export type SpecGraphSummary = z.infer<typeof specGraphSummarySchema>;

export const specGraphSchema = z
  .object({
    nodes: z.array(specGraphNodeSchema),
    edges: z.array(specGraphEdgeSchema),
    roots: stringListSchema,
    blocked_files: z.array(z.record(z.string(), z.unknown())),
    diagnostics: z.array(specGraphDiagnosticSchema),
    summary: specGraphSummarySchema,
  })
  .passthrough();

export type SpecGraph = z.infer<typeof specGraphSchema>;

export const specGraphResponseSchema = z
  .object({
    spec_dir: z.string(),
    graph: specGraphSchema,
    summary: specGraphSummarySchema,
  })
  .passthrough();

export type SpecGraphResponse = z.infer<typeof specGraphResponseSchema>;
