import { z } from "zod";
import { MAX_SUPPORTED_VERSION, type KnownArtifactKind } from "../schemas/envelope";

/**
 * Discriminated union returned by every parser. The UI is required by
 * CLAUDE.md to render a readable "not built / version not yet supported"
 * state instead of crashing, so each non-ok variant carries enough info
 * to drive that surface.
 */
export type ParseResult<T> =
  | { kind: "ok"; data: T }
  | {
      kind: "version-not-supported";
      artifact_kind: string;
      schema_version: number;
      max_supported: number;
    }
  | {
      kind: "wrong-artifact-kind";
      expected: string;
      got: unknown;
    }
  | {
      kind: "parse-error";
      issues: z.ZodIssue[];
      raw: unknown;
    }
  | {
      kind: "invariant-violation";
      message: string;
      raw: unknown;
    };

type Invariant<T> = (data: T) => string | null;

type ArtifactDescriptor<K extends KnownArtifactKind, T> = {
  kind: K;
  schema: z.ZodType<T>;
  /**
   * Cross-field invariants the schema can't express on its own — e.g. the
   * spec_activity_feed contract requires entry_count, summary.entry_count
   * and entries.length to agree. CLAUDE.md explicitly calls these out as
   * test-worthy.
   */
  invariants?: Invariant<T>[];
};

export function makeParser<K extends KnownArtifactKind, T>(
  descriptor: ArtifactDescriptor<K, T>,
) {
  const max = MAX_SUPPORTED_VERSION[descriptor.kind];

  return function parse(raw: unknown): ParseResult<T> {
    if (!raw || typeof raw !== "object") {
      return { kind: "parse-error", issues: [], raw };
    }

    const obj = raw as Record<string, unknown>;
    const declaredKind = obj.artifact_kind;
    const declaredVersion = obj.schema_version;

    if (declaredKind !== descriptor.kind) {
      return {
        kind: "wrong-artifact-kind",
        expected: descriptor.kind,
        got: declaredKind,
      };
    }

    if (typeof declaredVersion === "number" && declaredVersion > max) {
      return {
        kind: "version-not-supported",
        artifact_kind: descriptor.kind,
        schema_version: declaredVersion,
        max_supported: max,
      };
    }

    const result = descriptor.schema.safeParse(raw);
    if (!result.success) {
      return { kind: "parse-error", issues: result.error.issues, raw };
    }

    for (const inv of descriptor.invariants ?? []) {
      const msg = inv(result.data);
      if (msg !== null) {
        return { kind: "invariant-violation", message: msg, raw };
      }
    }

    return { kind: "ok", data: result.data };
  };
}
