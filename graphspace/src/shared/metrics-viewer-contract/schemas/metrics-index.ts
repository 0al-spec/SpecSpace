import { z } from "zod";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const countMapSchema = z.record(z.string(), z.number().int().nonnegative());

const metricSourceSchema = z
  .object({
    available: z.boolean(),
    artifact: z.string(),
    path: z.string().nullable().optional(),
    entry_count: z.number().int().nonnegative(),
    reason: z.string().optional(),
    artifact_kind: z.string().optional(),
    generated_at: z.string().optional(),
  })
  .passthrough();

export const metricsIndexEntrySchema = z
  .object({
    metric_key: z.string(),
    category: z.string(),
    item_id: z.string(),
    title: z.string(),
    status: z.string(),
    secondary_status: nullableString,
    score: nullableNumber,
    minimum_score: nullableNumber,
    value: nullableString,
    next_gap: nullableString,
    source_kind: z.string(),
    reference_texts: z.array(z.string()),
    summary: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const metricsIndexSchema = z
  .object({
    api_version: z.literal("v1"),
    artifact_kind: z.literal("specspace_metrics_index"),
    generated_at: z.string(),
    read_only: z.literal(true),
    source: z
      .object({
        provider: z.string(),
      })
      .passthrough(),
    entry_count: z.number().int().nonnegative(),
    entries: z.array(metricsIndexEntrySchema),
    filters: z
      .object({
        category_counts: countMapSchema,
        status_counts: countMapSchema,
        source_kind_counts: countMapSchema,
        reference_texts: z.array(z.string()),
      })
      .passthrough(),
    dashboard: z.record(z.string(), z.unknown()),
    sources: z.record(z.string(), metricSourceSchema),
  })
  .passthrough();

export type MetricsIndex = z.infer<typeof metricsIndexSchema>;
export type MetricsIndexEntry = z.infer<typeof metricsIndexEntrySchema>;
