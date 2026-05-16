import type { EnvelopeResult } from "@/shared/api";

export type LiveArtifactState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<unknown>;

export type ArtifactTone = "live" | "empty" | "fallback" | "loading";

export type ArtifactDiagnostic = {
  id: string;
  label: string;
  endpoint: string;
  tone: ArtifactTone;
  status: string;
  countLabel: string;
  detail: string;
};

type SourceDeltaSnapshot = {
  next_gap?: string;
  status?: string;
} | null | undefined;

type ArtifactInput = {
  id: string;
  label: string;
  endpoint: string;
  state: LiveArtifactState;
  liveCount: number;
  sampleCount: number;
  noun: { singular: string; plural: string };
  emptyDetail: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function describeHttpErrorDetail(state: {
  status: number;
  statusText: string;
  body?: unknown;
}): string {
  const base = `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
  const body = isRecord(state.body) ? state.body : null;
  const source = isRecord(body?.source) ? body.source : null;
  const parts = [
    stringField(body, "error"),
    stringField(body, "detail"),
    stringField(source, "detail"),
    stringField(body, "artifact") ? `artifact ${stringField(body, "artifact")}` : null,
    stringField(body, "reason") ? `reason ${stringField(body, "reason")}` : null,
    stringField(body, "path") ?? stringField(source, "path"),
  ].filter((part): part is string => !!part);
  return parts.length > 0 ? `${base}: ${parts.join("; ")}` : base;
}

function countLabel(count: number, noun: ArtifactInput["noun"]): string {
  return `${count} ${count === 1 ? noun.singular : noun.plural}`;
}

export function describeSourceDeltaSnapshot(snapshot: SourceDeltaSnapshot): string {
  const nextGap = snapshot?.next_gap ? ` (${snapshot.next_gap})` : "";
  if (!snapshot || !snapshot.status) {
    return `source delta status is missing${nextGap}`;
  }
  return `source delta is ${snapshot.status}${nextGap}`;
}

function fallbackDetail(state: Exclude<LiveArtifactState, { kind: "ok" }>): string {
  switch (state.kind) {
    case "idle":
    case "loading":
      return "Loading live artifact; sample data is displayed until the first response.";
    case "http-error":
      return `${describeHttpErrorDetail(state)}; sample data is displayed.`;
    case "network-error":
      return "Backend is unreachable; sample data is displayed.";
    case "envelope-error":
      return `${state.reason}; sample data is displayed.`;
    case "version-not-supported":
      return `schema_version ${state.schema_version} exceeds supported ${state.max_supported}; sample data is displayed.`;
    case "wrong-artifact-kind":
      return `Expected ${state.expected}; sample data is displayed.`;
    case "parse-error":
      return "Schema validation failed; sample data is displayed.";
    case "invariant-violation":
      return `${state.message}; sample data is displayed.`;
  }
}

export function describeArtifact(input: ArtifactInput): ArtifactDiagnostic {
  const { id, label, endpoint, state, liveCount, sampleCount, noun, emptyDetail } = input;

  if (state.kind === "ok") {
    const empty = liveCount === 0;
    return {
      id,
      label,
      endpoint,
      tone: empty ? "empty" : "live",
      status: empty ? "live empty" : "live",
      countLabel: countLabel(liveCount, noun),
      detail: empty ? emptyDetail : "Live artifact is parsed and driving this surface.",
    };
  }

  return {
    id,
    label,
    endpoint,
    tone: state.kind === "idle" || state.kind === "loading" ? "loading" : "fallback",
    status: state.kind === "idle" || state.kind === "loading" ? "loading" : "sample fallback",
    countLabel: countLabel(sampleCount, noun),
    detail: fallbackDetail(state),
  };
}
