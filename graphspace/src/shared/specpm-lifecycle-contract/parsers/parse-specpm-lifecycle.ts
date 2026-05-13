import type { z } from "zod";
import {
  specpmLifecycleSchema,
  type SpecPMLifecycle,
} from "../schemas/specpm-lifecycle";
import type { ParseResult } from "./parse";

const parseIssues = (error: z.ZodError): z.ZodIssue[] => error.issues;

export const parseSpecPMLifecycle = (
  raw: unknown,
): ParseResult<SpecPMLifecycle> => {
  const result = specpmLifecycleSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: parseIssues(result.error), raw };
  }

  if (result.data.package_count !== result.data.packages.length) {
    return {
      kind: "invariant-violation",
      message: `package_count mismatch: summary=${result.data.package_count}, actual=${result.data.packages.length}`,
      raw,
    };
  }

  return { kind: "ok", data: result.data };
};

export type { SpecPMLifecycle };
