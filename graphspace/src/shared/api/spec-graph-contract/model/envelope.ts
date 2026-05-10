import { z } from "zod";

/**
 * Fields shared by every SpecGraph artifact. Defined once and spread into each
 * artifact-specific schema so we don't duplicate `artifact_kind` /
 * `schema_version` checks per kind. Top-level shape derives directly from the
 * viewer contracts under SpecGraph/docs/*viewer_contract.md.
 */
export const baseArtifactShape = {
  artifact_kind: z.string(),
  schema_version: z.number().int().nonnegative(),
  generated_at: z.string(),
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
} as const satisfies Record<string, number>;

export type KnownArtifactKind = keyof typeof MAX_SUPPORTED_VERSION;
