import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import type { ParseResult } from "@/shared/spec-graph-contract";

export type OntologySemanticReviewSummary = {
  status: string;
  blockingCount: number;
  reviewRequiredCount: number;
  candidateCount: number;
  reviewItemCount: number;
  nextGap: string | null;
};

export type OntologySemanticReviewItem = {
  itemId: string;
  itemKind: string;
  reviewState: string;
  source: string;
  term: string | null;
  classification: string | null;
  suggestedAction: string | null;
  suggestedActions: readonly string[];
  payload: Record<string, unknown>;
};

export type OntologySemanticReviewAction = {
  action: string;
  source: string;
  effect: string | null;
  termCount: number | null;
  candidateCount: number | null;
  terms: readonly string[];
  writesOntologyPackage: boolean;
  mutatesCanonicalSpecs: boolean;
};

export type OntologySemanticReviewConsumerBoundary = {
  forSupervisorGateEvidence: boolean;
  forSpecspaceReviewSurface: boolean;
  mayExecutePromptAgent: boolean;
  mayWriteOntologyPackage: boolean;
  mayUpdateOntologyLockfile: boolean;
  mayMutateCanonicalSpecs: boolean;
  mayMarkCandidateAccepted: boolean;
};

export type OntologySemanticReviewSurface = {
  artifactKind: "ontology_semantic_review_surface";
  schemaVersion: 1;
  proposalId: "0108";
  policyBasis: readonly string[];
  sourcePolicy: string | null;
  sourceArtifacts: Record<string, string>;
  target: {
    targetKind: string | null;
    targetRef: string | null;
  };
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  groundingSummary: Record<string, string | number>;
  displaySections: readonly string[];
  blockingFindings: readonly Record<string, unknown>[];
  reviewRequiredFindings: readonly Record<string, unknown>[];
  deltaCandidates: readonly Record<string, unknown>[];
  reviewItems: readonly OntologySemanticReviewItem[];
  reviewActions: readonly OntologySemanticReviewAction[];
  consumerBoundary: OntologySemanticReviewConsumerBoundary;
  authorityBoundary: {
    semanticReviewSurfaceIsAuthority: false;
  };
  summary: OntologySemanticReviewSummary;
  outputArtifact: string | null;
};

export type UseOntologySemanticReviewSurfaceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<OntologySemanticReviewSurface>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

const FALSE_CONSUMER_BOUNDARY_FLAGS = [
  "may_execute_prompt_agent",
  "may_write_ontology_package",
  "may_update_ontology_lockfile",
  "may_mutate_canonical_specs",
  "may_mark_candidate_accepted",
] as const;

const TRUE_CONSUMER_BOUNDARY_FLAGS = [
  "for_supervisor_gate_evidence",
  "for_specspace_review_surface",
] as const;

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

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function boolValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.length > 0) out[key] = item;
  }
  return out;
}

function scalarMap(value: unknown): Record<string, string | number> {
  if (!isRecord(value)) return {};
  const out: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || (typeof item === "number" && Number.isFinite(item))) {
      out[key] = item;
    }
  }
  return out;
}

function invariantViolation(
  message: string,
  raw: unknown,
): ParseResult<OntologySemanticReviewSurface> {
  return { kind: "invariant-violation", message, raw };
}

function parseConsumerBoundary(raw: unknown): OntologySemanticReviewConsumerBoundary | null {
  if (!isRecord(raw)) return null;
  return {
    forSupervisorGateEvidence: boolValue(raw.for_supervisor_gate_evidence),
    forSpecspaceReviewSurface: boolValue(raw.for_specspace_review_surface),
    mayExecutePromptAgent: boolValue(raw.may_execute_prompt_agent),
    mayWriteOntologyPackage: boolValue(raw.may_write_ontology_package),
    mayUpdateOntologyLockfile: boolValue(raw.may_update_ontology_lockfile),
    mayMutateCanonicalSpecs: boolValue(raw.may_mutate_canonical_specs),
    mayMarkCandidateAccepted: boolValue(raw.may_mark_candidate_accepted),
  };
}

function parseReviewItem(raw: Record<string, unknown>): OntologySemanticReviewItem | null {
  const itemId = optionalString(raw.item_id);
  if (!itemId) return null;
  return {
    itemId,
    itemKind: stringValue(raw.item_kind, "unknown"),
    reviewState: stringValue(raw.review_state, "unknown"),
    source: stringValue(raw.source, "unknown"),
    term: optionalString(raw.term),
    classification: optionalString(raw.classification),
    suggestedAction: optionalString(raw.suggested_action),
    suggestedActions: stringList(raw.suggested_actions),
    payload: isRecord(raw.payload) ? raw.payload : {},
  };
}

function parseReviewAction(raw: Record<string, unknown>): OntologySemanticReviewAction | null {
  const action = optionalString(raw.action);
  if (!action) return null;
  return {
    action,
    source: stringValue(raw.source, "unknown"),
    effect: optionalString(raw.effect),
    termCount: optionalNumber(raw.term_count),
    candidateCount: optionalNumber(raw.candidate_count),
    terms: stringList(raw.terms),
    writesOntologyPackage: boolValue(raw.writes_ontology_package),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
  };
}

export function parseOntologySemanticReviewSurface(
  raw: unknown,
): ParseResult<OntologySemanticReviewSurface> {
  if (!isRecord(raw)) return { kind: "parse-error", issues: [], raw };
  if (raw.artifact_kind !== "ontology_semantic_review_surface") {
    return {
      kind: "wrong-artifact-kind",
      expected: "ontology_semantic_review_surface",
      got: raw.artifact_kind,
    };
  }
  if (typeof raw.schema_version === "number" && raw.schema_version > 1) {
    return {
      kind: "version-not-supported",
      artifact_kind: "ontology_semantic_review_surface",
      schema_version: raw.schema_version,
      max_supported: 1,
    };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", issues: [], raw };
  }
  if (raw.proposal_id !== "0108") {
    return invariantViolation("proposal_id must be 0108", raw);
  }
  if (raw.canonical_mutations_allowed !== false) {
    return invariantViolation("canonical_mutations_allowed must be false", raw);
  }
  if (raw.tracked_artifacts_written !== false) {
    return invariantViolation("tracked_artifacts_written must be false", raw);
  }

  const rawConsumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : null;
  if (!rawConsumerBoundary) return invariantViolation("consumer_boundary must be present", raw);
  for (const flag of TRUE_CONSUMER_BOUNDARY_FLAGS) {
    if (rawConsumerBoundary[flag] !== true) {
      return invariantViolation(`consumer_boundary.${flag} must be true`, raw);
    }
  }
  for (const flag of FALSE_CONSUMER_BOUNDARY_FLAGS) {
    if (rawConsumerBoundary[flag] !== false) {
      return invariantViolation(`consumer_boundary.${flag} must be false`, raw);
    }
  }

  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : null;
  if (!authorityBoundary) return invariantViolation("authority_boundary must be present", raw);
  if (authorityBoundary.semantic_review_surface_is_authority !== false) {
    return invariantViolation("authority_boundary.semantic_review_surface_is_authority must be false", raw);
  }

  const summary = isRecord(raw.summary) ? raw.summary : {};
  const target = isRecord(raw.target) ? raw.target : {};
  const consumerBoundary = parseConsumerBoundary(rawConsumerBoundary);
  if (!consumerBoundary) return invariantViolation("consumer_boundary must be an object", raw);
  const rawReviewItems = records(raw.review_items);
  const reviewItems = rawReviewItems
    .map(parseReviewItem)
    .filter((entry): entry is OntologySemanticReviewItem => !!entry);
  if (reviewItems.length !== rawReviewItems.length) {
    return invariantViolation("review_items entries must include item_id", raw);
  }
  const reviewItemCount = numberValue(summary.review_item_count);
  if (reviewItemCount !== reviewItems.length) {
    return invariantViolation("summary.review_item_count must match review_items length", raw);
  }
  const reviewActions = records(raw.review_actions)
    .map(parseReviewAction)
    .filter((entry): entry is OntologySemanticReviewAction => !!entry);
  const expandedAction = reviewActions.find(
    (action) => action.writesOntologyPackage || action.mutatesCanonicalSpecs,
  );
  if (expandedAction?.writesOntologyPackage) {
    return invariantViolation("review_actions[].writes_ontology_package must be false", raw);
  }
  if (expandedAction?.mutatesCanonicalSpecs) {
    return invariantViolation("review_actions[].mutates_canonical_specs must be false", raw);
  }

  return {
    kind: "ok",
    data: {
      artifactKind: "ontology_semantic_review_surface",
      schemaVersion: 1,
      proposalId: "0108",
      policyBasis: stringList(raw.policy_basis),
      sourcePolicy: optionalString(raw.source_policy),
      sourceArtifacts: stringMap(raw.source_artifacts),
      target: {
        targetKind: optionalString(target.target_kind),
        targetRef: optionalString(target.target_ref),
      },
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      groundingSummary: scalarMap(raw.grounding_summary),
      displaySections: stringList(raw.display_sections),
      blockingFindings: records(raw.blocking_findings),
      reviewRequiredFindings: records(raw.review_required_findings),
      deltaCandidates: records(raw.delta_candidates),
      reviewItems,
      reviewActions,
      consumerBoundary,
      authorityBoundary: {
        semanticReviewSurfaceIsAuthority: false,
      },
      summary: {
        status: stringValue(summary.status, "unknown"),
        blockingCount: numberValue(summary.blocking_count),
        reviewRequiredCount: numberValue(summary.review_required_count),
        candidateCount: numberValue(summary.candidate_count),
        reviewItemCount,
        nextGap: optionalString(summary.next_gap),
      },
      outputArtifact: optionalString(raw.output_artifact),
    },
  };
}

export function useOntologySemanticReviewSurface(
  options: Options = {},
): UseOntologySemanticReviewSurfaceState {
  const {
    url = "/api/v1/ontology-semantic-review-surface",
    fetcher,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseOntologySemanticReviewSurfaceState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseOntologySemanticReviewSurface,
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
