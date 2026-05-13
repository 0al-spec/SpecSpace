import type { z } from "zod";

export type SpecPMLifecycleParseResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "parse-error"; issues: z.ZodIssue[]; raw: unknown }
  | { kind: "invariant-violation"; message: string; raw: unknown };
