import { z } from "zod";

/**
 * Fields shared by every SpecGraph artifact. Defined once and spread into each
 * artifact-specific schema so we don't duplicate `artifact_kind` /
 * `schema_version` checks per kind. Top-level shape derives directly from the
 * viewer contracts under SpecGraph/docs/*viewer_contract.md.
 */
/**
 * ISO 8601 timestamp with offset — e.g. `"2026-05-09T19:45:46.108441+00:00"`.
 * SpecGraph emits offsets like `+00:00` / `+03:00`, so we allow `offset: true`
 * instead of forcing a `Z` suffix. Strict parsing catches `"soon"`-style
 * garbage at parse time before downstream timeline/sort code sees it.
 */
export const isoDatetimeWithOffset = z.string().datetime({ offset: true });

export const baseArtifactShape = {
  artifact_kind: z.string(),
  schema_version: z.number().int().nonnegative(),
  generated_at: isoDatetimeWithOffset,
} as const;

export type BaseArtifact = z.infer<z.ZodObject<typeof baseArtifactShape>>;

/**
 * Highest schema_version we know how to parse for each artifact_kind. When a
 * runtime artifact reports a higher version we fall through to a
 * "version-not-supported" state instead of crashing — the project CLAUDE.md
 * requires a readable "not built / version not yet supported" UI surface.
 */
export const MAX_SUPPORTED_VERSION = {
  spec_activity_feed: 1,
  implementation_work_index: 1,
  proposal_spec_trace_index: 1,
} as const satisfies Record<string, number>;

export type KnownArtifactKind = keyof typeof MAX_SUPPORTED_VERSION;
