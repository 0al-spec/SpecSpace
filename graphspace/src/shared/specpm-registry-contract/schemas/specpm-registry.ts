import { z } from "zod";

const sourceSchema = z.object({
  name: z.string(),
  path: z.string().nullable(),
  status: z.string(),
  item_count: z.number().int().nonnegative().optional(),
  detail: z.string().optional(),
}).passthrough();

const registryPayloadSchema = z.object({
  apiVersion: z.literal("specpm.registry/v0"),
  schemaVersion: z.number().int().nonnegative(),
  kind: z.string(),
  status: z.string().optional(),
}).passthrough();

const packageSummarySchema = z.object({
  package_id: z.string(),
  name: z.string().optional(),
  summary: z.string().optional(),
  license: z.string().optional(),
  latest_version: z.string().nullable().optional(),
  capabilities: z.array(z.string()).optional(),
  versions: z.array(z.object({
    version: z.string(),
    yanked: z.boolean().optional(),
    deprecated: z.boolean().optional(),
  }).passthrough()).optional(),
}).passthrough();

export const specPMRegistrySummarySchema = z.object({
  api_version: z.literal("v1"),
  source: sourceSchema,
  registry: registryPayloadSchema.extend({
    kind: z.literal("RemoteRegistryStatus"),
    registry: z.object({
      profile: z.string().optional(),
      api_version: z.string().optional(),
      read_only: z.boolean().optional(),
      authority: z.string().optional(),
      package_count: z.number().int().nonnegative().optional(),
      version_count: z.number().int().nonnegative().optional(),
      capability_count: z.number().int().nonnegative().optional(),
      intent_count: z.number().int().nonnegative().optional(),
    }).passthrough(),
  }),
  packages: registryPayloadSchema.extend({
    kind: z.literal("RemotePackageIndex"),
    package_count: z.number().int().nonnegative(),
    version_count: z.number().int().nonnegative().optional(),
    packages: z.array(packageSummarySchema),
  }),
}).passthrough();

export type SpecPMRegistrySummary = z.infer<typeof specPMRegistrySummarySchema>;
export type SpecPMRegistryPackageSummary = z.infer<typeof packageSummarySchema>;
