import type { z } from "zod";
import {
  specNodeDetailResponseSchema,
  type SpecNodeDetail,
  type SpecNodeDetailResponse,
} from "../schemas/spec-node-detail";
import type { ParseResult } from "./parse";

const parseIssues = (error: z.ZodError): z.ZodIssue[] => error.issues;

export const parseSpecNodeDetail = (
  raw: unknown,
): ParseResult<SpecNodeDetailResponse> => {
  const result = specNodeDetailResponseSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: parseIssues(result.error), raw };
  }

  if (result.data.node_id !== result.data.data.id) {
    return {
      kind: "invariant-violation",
      message: `spec-node response id mismatch: node_id='${result.data.node_id}', data.id='${result.data.data.id}'`,
      raw,
    };
  }

  return { kind: "ok", data: result.data };
};

export type { SpecNodeDetail, SpecNodeDetailResponse };
