import type { z } from "zod";
import {
  metricsIndexSchema,
  type MetricsIndex,
} from "../schemas/metrics-index";

export type MetricsIndexParseResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "parse-error"; issues: z.ZodIssue[]; raw: unknown };

export function parseMetricsIndex(
  raw: unknown,
): MetricsIndexParseResult<MetricsIndex> {
  const result = metricsIndexSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: result.error.issues, raw };
  }
  return { kind: "ok", data: result.data };
}
