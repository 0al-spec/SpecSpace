import { z } from "zod";

/**
 * Source: ContextBuilder `viewer/server.py` `/api/specpm/lifecycle`.
 *
 * This is a server read-model, not a versioned runs artifact envelope. It joins
 * SpecPM export, handoff, materialization, import, and import_handoff artifacts
 * by package key and preserves the SpecGraph node anchors that let GraphSpace
 * project package lifecycle status back onto canvas nodes.
 */

export const specpmLifecycleArtifactMetaSchema = z
  .object({
    available: z.boolean(),
    generated_at: z.string().nullable(),
    entry_count: z.number().int().nonnegative(),
  })
  .passthrough();

export type SpecPMLifecycleArtifactMeta = z.infer<
  typeof specpmLifecycleArtifactMetaSchema
>;

export const specpmLifecycleStageSchema = z
  .object({
    status: z.string().nullable(),
    review_state: z.string().nullable(),
    next_gap: z.string().nullable(),
    bundle_root: z.string().nullable().optional(),
    suggested_target_kind: z.string().nullable().optional(),
    route_kind: z.string().nullable().optional(),
  })
  .passthrough();

export type SpecPMLifecycleStage = z.infer<typeof specpmLifecycleStageSchema>;

export const specpmLifecyclePackageSchema = z
  .object({
    package_key: z.string(),
    root_spec_id: z.string().nullable().optional(),
    source_spec_ids: z.array(z.string()).optional().default([]),
    export: specpmLifecycleStageSchema.optional(),
    handoff: specpmLifecycleStageSchema.optional(),
    materialization: specpmLifecycleStageSchema.optional(),
    import: specpmLifecycleStageSchema.optional(),
    import_handoff: specpmLifecycleStageSchema.optional(),
  })
  .passthrough();

export type SpecPMLifecyclePackage = z.infer<
  typeof specpmLifecyclePackageSchema
>;

export const specpmLifecycleSchema = z
  .object({
    packages: z.array(specpmLifecyclePackageSchema),
    package_count: z.number().int().nonnegative(),
    import_source: z.unknown().nullable(),
    artifacts: z
      .object({
        export_preview: specpmLifecycleArtifactMetaSchema,
        handoff_packets: specpmLifecycleArtifactMetaSchema,
        materialization_report: specpmLifecycleArtifactMetaSchema,
        import_preview: specpmLifecycleArtifactMetaSchema,
        import_handoff_packets: specpmLifecycleArtifactMetaSchema,
      })
      .passthrough(),
  })
  .passthrough();

export type SpecPMLifecycle = z.infer<typeof specpmLifecycleSchema>;
