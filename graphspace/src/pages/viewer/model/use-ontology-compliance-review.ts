import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import type { ParseResult } from "@/shared/spec-graph-contract";

export type OntologyComplianceSummary = {
  specCount: number;
  findingCount: number;
  warningCount: number;
  passedCheckCount: number;
  nextGap: string | null;
};

export type OntologyComplianceCheck = {
  checkId: string;
  status: string;
  ontologyRef: string | null;
  relationRef: string | null;
};

export type OntologyComplianceFinding = {
  findingId: string;
  severity: string;
  classification: string;
  term: string | null;
  gapRef: string | null;
  suggestedAction: string | null;
};

export type OntologyComplianceEntry = {
  specId: string;
  path: string;
  validationStatus: string;
  checks: readonly OntologyComplianceCheck[];
  findings: readonly OntologyComplianceFinding[];
};

export type OntologyComplianceReview = {
  artifactKind: "spec_ontology_validation_report";
  schemaVersion: 1;
  proposalId: "0135";
  status: string;
  reviewState: string;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  ontologyIrRef: string | null;
  sourceBindingIndexKind: string | null;
  validationModes: {
    legacySpecs: "report_only";
    generatedArtifacts: string;
    hardGateEnabled: false;
  };
  summary: OntologyComplianceSummary;
  entries: readonly OntologyComplianceEntry[];
};

export type UseOntologyComplianceReviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<OntologyComplianceReview>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return optionalString(value) ?? fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function invariantViolation(message: string, raw: unknown): ParseResult<OntologyComplianceReview> {
  return { kind: "invariant-violation", message, raw };
}

function parseCheck(raw: Record<string, unknown>): OntologyComplianceCheck | null {
  const checkId = optionalString(raw.check_id);
  if (!checkId) return null;
  return {
    checkId,
    status: stringValue(raw.status, "unknown"),
    ontologyRef: optionalString(raw.ontology_ref),
    relationRef: optionalString(raw.relation_ref),
  };
}

function parseFinding(raw: Record<string, unknown>): OntologyComplianceFinding | null {
  const findingId = optionalString(raw.finding_id);
  if (!findingId) return null;
  return {
    findingId,
    severity: stringValue(raw.severity, "unknown"),
    classification: stringValue(raw.classification, "unknown"),
    term: optionalString(raw.term),
    gapRef: optionalString(raw.gap_ref),
    suggestedAction: optionalString(raw.suggested_action),
  };
}

function parseEntry(raw: Record<string, unknown>): OntologyComplianceEntry | null {
  const specId = optionalString(raw.spec_id);
  const path = optionalString(raw.path);
  if (!specId || !path) return null;
  return {
    specId,
    path,
    validationStatus: stringValue(raw.validation_status, "unknown"),
    checks: records(raw.checks)
      .map(parseCheck)
      .filter((entry): entry is OntologyComplianceCheck => !!entry),
    findings: records(raw.findings)
      .map(parseFinding)
      .filter((entry): entry is OntologyComplianceFinding => !!entry),
  };
}

export function parseOntologyComplianceReview(
  raw: unknown,
): ParseResult<OntologyComplianceReview> {
  if (!isRecord(raw)) return { kind: "parse-error", issues: [], raw };
  if (raw.artifact_kind !== "spec_ontology_validation_report") {
    return {
      kind: "wrong-artifact-kind",
      expected: "spec_ontology_validation_report",
      got: raw.artifact_kind,
    };
  }
  if (typeof raw.schema_version === "number" && raw.schema_version > 1) {
    return {
      kind: "version-not-supported",
      artifact_kind: "spec_ontology_validation_report",
      schema_version: raw.schema_version,
      max_supported: 1,
    };
  }
  if (raw.schema_version !== 1) return { kind: "parse-error", issues: [], raw };
  if (raw.proposal_id !== "0135") return invariantViolation("proposal_id must be 0135", raw);
  if (raw.canonical_mutations_allowed !== false) {
    return invariantViolation("canonical_mutations_allowed must be false", raw);
  }
  if (raw.tracked_artifacts_written !== false) {
    return invariantViolation("tracked_artifacts_written must be false", raw);
  }
  const validationModes = isRecord(raw.validation_modes) ? raw.validation_modes : null;
  if (!validationModes) return invariantViolation("validation_modes must be present", raw);
  if (validationModes.legacy_specs !== "report_only") {
    return invariantViolation("validation_modes.legacy_specs must be report_only", raw);
  }
  if (validationModes.generated_artifacts !== "review_required") {
    return invariantViolation("validation_modes.generated_artifacts must be review_required", raw);
  }
  if (validationModes.hard_gate_enabled !== false) {
    return invariantViolation("validation_modes.hard_gate_enabled must be false", raw);
  }

  const summary = isRecord(raw.summary) ? raw.summary : {};
  const entries = records(raw.entries)
    .map(parseEntry)
    .filter((entry): entry is OntologyComplianceEntry => !!entry);
  if (numberValue(summary.spec_count) !== entries.length) {
    return invariantViolation("summary.spec_count must match entries length", raw);
  }

  return {
    kind: "ok",
    data: {
      artifactKind: "spec_ontology_validation_report",
      schemaVersion: 1,
      proposalId: "0135",
      status: stringValue(raw.status, "unknown"),
      reviewState: stringValue(raw.review_state, "unknown"),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      ontologyIrRef: optionalString(raw.ontology_ir_ref),
      sourceBindingIndexKind: optionalString(raw.source_binding_index_kind),
      validationModes: {
        legacySpecs: "report_only",
        generatedArtifacts: stringValue(validationModes.generated_artifacts, "unknown"),
        hardGateEnabled: false,
      },
      summary: {
        specCount: numberValue(summary.spec_count),
        findingCount: numberValue(summary.finding_count),
        warningCount: numberValue(summary.warning_count),
        passedCheckCount: numberValue(summary.passed_check_count),
        nextGap: optionalString(summary.next_gap),
      },
      entries,
    },
  };
}

export function useOntologyComplianceReview(
  options: Options = {},
): UseOntologyComplianceReviewState {
  const {
    url = "/api/v1/ontology-compliance-review",
    fetcher,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseOntologyComplianceReviewState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseOntologyComplianceReview,
      fetcher,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, refreshKey, url]);

  return state;
}
