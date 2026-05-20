import { z } from "zod";

export const specMarkdownExportScopes = ["node", "subtree"] as const;
export type SpecMarkdownExportScope = (typeof specMarkdownExportScopes)[number];

const specMarkdownSourceSchema = z
  .object({
    provider: z.string(),
    read_only: z.boolean(),
  })
  .passthrough();

const loadErrorSchema = z
  .object({
    file_name: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const specMarkdownManifestSchema = z
  .object({
    root_id: z.string(),
    node_count: z.number(),
    max_depth_reached: z.number(),
    nodes_included: z.array(z.string()),
    cycles_skipped: z.array(z.string()),
    missing_skipped: z.array(z.string()),
    load_errors: z.array(loadErrorSchema).default([]),
    scope: z.enum(specMarkdownExportScopes),
  })
  .passthrough();

export type SpecMarkdownManifest = z.infer<typeof specMarkdownManifestSchema>;

export const specMarkdownExportResponseSchema = z
  .object({
    api_version: z.string().optional(),
    root_id: z.string(),
    scope: z.enum(specMarkdownExportScopes),
    markdown: z.string(),
    manifest: specMarkdownManifestSchema,
    source: specMarkdownSourceSchema,
    download_filename: z.string(),
  })
  .passthrough();

export type SpecMarkdownExportResponse = z.infer<
  typeof specMarkdownExportResponseSchema
>;

const specMarkdownCompilePayloadSchema = z
  .object({
    exit_code: z.number(),
    compiled_markdown: z.string().optional(),
    compiler_manifest: z.unknown().optional(),
    export_dir: z.string().optional(),
    root_hc: z.string().optional(),
    markdown_file: z.string().optional(),
    export_manifest: z.string().optional(),
    compiled_md: z.string().optional(),
    manifest_json: z.string().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
  })
  .passthrough();

export const specMarkdownCompileResponseSchema = z
  .object({
    api_version: z.string().optional(),
    artifact_kind: z.literal("specspace_hyperprompt_compile"),
    root_id: z.string(),
    scope: z.enum(specMarkdownExportScopes),
    source: specMarkdownSourceSchema,
    export: z
      .object({
        download_filename: z.string(),
        manifest: specMarkdownManifestSchema,
      })
      .passthrough(),
    compile: specMarkdownCompilePayloadSchema,
  })
  .passthrough();

export type SpecMarkdownCompileResponse = z.infer<
  typeof specMarkdownCompileResponseSchema
>;
