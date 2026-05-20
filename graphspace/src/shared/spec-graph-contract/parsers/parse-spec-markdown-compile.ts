import type { z } from "zod";
import {
  specMarkdownCompileResponseSchema,
  type SpecMarkdownCompileResponse,
} from "../schemas/spec-markdown-export";
import type { ParseResult } from "./parse";

const parseIssues = (error: z.ZodError): z.ZodIssue[] => error.issues;

export const parseSpecMarkdownCompile = (
  raw: unknown,
): ParseResult<SpecMarkdownCompileResponse> => {
  const result = specMarkdownCompileResponseSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: parseIssues(result.error), raw };
  }

  if (result.data.root_id !== result.data.export.manifest.root_id) {
    return {
      kind: "invariant-violation",
      message: `spec-markdown compile root mismatch: root_id='${result.data.root_id}', export.manifest.root_id='${result.data.export.manifest.root_id}'`,
      raw,
    };
  }

  if (result.data.scope !== result.data.export.manifest.scope) {
    return {
      kind: "invariant-violation",
      message: `spec-markdown compile scope mismatch: scope='${result.data.scope}', export.manifest.scope='${result.data.export.manifest.scope}'`,
      raw,
    };
  }

  if (!result.data.export.download_filename.endsWith(".md")) {
    return {
      kind: "invariant-violation",
      message: "spec-markdown compile download_filename must end with .md",
      raw,
    };
  }

  if (result.data.compile.exit_code === 0 && typeof result.data.compile.compiled_markdown !== "string") {
    return {
      kind: "invariant-violation",
      message: "spec-markdown compile success must include compiled_markdown",
      raw,
    };
  }

  return { kind: "ok", data: result.data };
};

export type { SpecMarkdownCompileResponse };
