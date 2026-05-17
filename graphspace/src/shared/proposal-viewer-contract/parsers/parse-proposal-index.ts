import type { z } from "zod";
import {
  proposalIndexSchema,
  type ProposalIndex,
} from "../schemas/proposal-index";

export type ProposalIndexParseResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "parse-error"; issues: z.ZodIssue[]; raw: unknown };

export function parseProposalIndex(
  raw: unknown,
): ProposalIndexParseResult<ProposalIndex> {
  const result = proposalIndexSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: result.error.issues, raw };
  }
  return { kind: "ok", data: result.data };
}
