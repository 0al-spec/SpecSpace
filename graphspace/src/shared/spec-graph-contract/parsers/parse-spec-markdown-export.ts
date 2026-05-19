import type { z } from "zod";
import {
  specMarkdownExportResponseSchema,
  type SpecMarkdownExportResponse,
} from "../schemas/spec-markdown-export";
import type { ParseResult } from "./parse";

const parseIssues = (error: z.ZodError): z.ZodIssue[] => error.issues;

export const parseSpecMarkdownExport = (
  raw: unknown,
): ParseResult<SpecMarkdownExportResponse> => {
  const result = specMarkdownExportResponseSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: parseIssues(result.error), raw };
  }

  if (result.data.root_id !== result.data.manifest.root_id) {
    return {
      kind: "invariant-violation",
      message: `spec-markdown root mismatch: root_id='${result.data.root_id}', manifest.root_id='${result.data.manifest.root_id}'`,
      raw,
    };
  }

  if (result.data.scope !== result.data.manifest.scope) {
    return {
      kind: "invariant-violation",
      message: `spec-markdown scope mismatch: scope='${result.data.scope}', manifest.scope='${result.data.manifest.scope}'`,
      raw,
    };
  }

  if (!result.data.download_filename.endsWith(".md")) {
    return {
      kind: "invariant-violation",
      message: "spec-markdown download_filename must end with .md",
      raw,
    };
  }

  return { kind: "ok", data: result.data };
};

export type { SpecMarkdownExportResponse };
