import type { z } from "zod";
import {
  specPMRegistrySummarySchema,
  type SpecPMRegistrySummary,
} from "../schemas/specpm-registry";

export type SpecPMRegistryParseResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "parse-error"; issues: z.ZodIssue[]; raw: unknown };

export function parseSpecPMRegistrySummary(
  raw: unknown,
): SpecPMRegistryParseResult<SpecPMRegistrySummary> {
  const result = specPMRegistrySummarySchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: result.error.issues, raw };
  }
  return { kind: "ok", data: result.data };
}
