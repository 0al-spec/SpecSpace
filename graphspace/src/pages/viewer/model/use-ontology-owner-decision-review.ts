import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import type { ParseResult } from "@/shared/spec-graph-contract";

export type OntologyOwnerDecisionReviewSummary = {
  status: string;
  previewCount: number;
  acceptedCount: number;
  rejectedCount: number;
  clarificationCount: number;
  importableCount: number;
  blockedCount: number;
  unmatchedCount: number;
  ignoredDecisionCount: number;
  nextGap: string | null;
};

export type OntologyOwnerDecisionPreview = {
  previewId: string;
  decisionId: string;
  candidateId: string;
  intakeId: string;
  decisionState: string;
  ontologyDecisionRef: string | null;
  decidedBy: string;
  decidedAt: string;
  reason: string | null;
  acceptedOntologyDelta: boolean;
  matchedClosedLoopEvidenceId: string | null;
  matchedSourceIntakeState: string | null;
  matchedEvidenceState: string | null;
  previewState: string;
  requiredHumanAction: string;
  importRecommended: boolean;
  importsIntoSpecgraph: boolean;
  closesSemanticGate: boolean;
  mutatesCanonicalSpecs: boolean;
  writesOntologyPackage: boolean;
  updatesOntologyLockfile: boolean;
};

export type OntologyIgnoredOwnerDecision = {
  decisionId: string;
  candidateId: string | null;
  intakeId: string | null;
  decisionState: string | null;
  reason: string | null;
  sourceEvidenceState: string | null;
  sourceIntakeState: string | null;
};

export type OntologyOwnerDecisionConsumerBoundary = {
  forSpecgraphDecisionImportPreview: boolean;
  forSpecspaceReviewDashboard: boolean;
  mayExecutePromptAgent: boolean;
  mayWriteOntologyPackage: boolean;
  mayUpdateOntologyLockfile: boolean;
  mayMutateCanonicalSpecs: boolean;
  mayMarkCandidateAccepted: boolean;
  mayApplyPreview: boolean;
  mayImportIntoSpecgraph: boolean;
  mayCloseSemanticGate: boolean;
};

export type OntologyOwnerDecisionAuthorityBoundary = {
  ontologyDecisionImportPreviewIsAuthority: boolean;
  promptAgentExecutionAllowed: boolean;
  automaticImportLockUpdate: boolean;
  automaticCanonicalNodeUpdate: boolean;
  canonicalMutationsAllowed: boolean;
};

export type OntologyOwnerDecisionReview = {
  artifactKind: "ontology_decision_import_preview";
  schemaVersion: 1;
  proposalId: "0115";
  policyBasis: readonly string[];
  sourcePolicy: string | null;
  sourceArtifacts: Record<string, string>;
  target: {
    targetKind: string | null;
    targetRef: string | null;
  };
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  decisionImportPreviews: readonly OntologyOwnerDecisionPreview[];
  ignoredOwnerDecisions: readonly OntologyIgnoredOwnerDecision[];
  consumerBoundary: OntologyOwnerDecisionConsumerBoundary;
  authorityBoundary: OntologyOwnerDecisionAuthorityBoundary;
  summary: OntologyOwnerDecisionReviewSummary;
  outputArtifact: string | null;
};

export type UseOntologyOwnerDecisionReviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<OntologyOwnerDecisionReview>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

const TRUE_CONSUMER_BOUNDARY_FLAGS = [
  "for_specgraph_decision_import_preview",
  "for_specspace_review_dashboard",
] as const;

const FALSE_CONSUMER_BOUNDARY_FLAGS = [
  "may_execute_prompt_agent",
  "may_write_ontology_package",
  "may_update_ontology_lockfile",
  "may_mutate_canonical_specs",
  "may_mark_candidate_accepted",
  "may_apply_preview",
  "may_import_into_specgraph",
  "may_close_semantic_gate",
] as const;

const FALSE_PREVIEW_FLAGS = [
  "imports_into_specgraph",
  "closes_semantic_gate",
  "mutates_canonical_specs",
  "writes_ontology_package",
  "updates_ontology_lockfile",
] as const;

const FALSE_AUTHORITY_FLAGS = [
  "ontology_decision_import_preview_is_authority",
  "prompt_agent_execution_allowed",
  "automatic_import_lock_update",
  "automatic_canonical_node_update",
  "canonical_mutations_allowed",
] as const;

const REVIEW_STATUSES = new Set([
  "blocked_by_semantic_gate",
  "ready_for_operator_review",
  "rejected_by_owner",
  "needs_clarification",
  "unmatched_decision",
  "no_decisions",
]);

const DECISION_STATES = new Set(["accepted", "rejected", "needs_clarification"]);

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

function invariantViolation(
  message: string,
  raw: unknown,
): ParseResult<OntologyOwnerDecisionReview> {
  return { kind: "invariant-violation", message, raw };
}

function parseConsumerBoundary(raw: Record<string, unknown>): OntologyOwnerDecisionConsumerBoundary {
  return {
    forSpecgraphDecisionImportPreview: boolValue(raw.for_specgraph_decision_import_preview),
    forSpecspaceReviewDashboard: boolValue(raw.for_specspace_review_dashboard),
    mayExecutePromptAgent: boolValue(raw.may_execute_prompt_agent),
    mayWriteOntologyPackage: boolValue(raw.may_write_ontology_package),
    mayUpdateOntologyLockfile: boolValue(raw.may_update_ontology_lockfile),
    mayMutateCanonicalSpecs: boolValue(raw.may_mutate_canonical_specs),
    mayMarkCandidateAccepted: boolValue(raw.may_mark_candidate_accepted),
    mayApplyPreview: boolValue(raw.may_apply_preview),
    mayImportIntoSpecgraph: boolValue(raw.may_import_into_specgraph),
    mayCloseSemanticGate: boolValue(raw.may_close_semantic_gate),
  };
}

function parseAuthorityBoundary(raw: Record<string, unknown>): OntologyOwnerDecisionAuthorityBoundary {
  return {
    ontologyDecisionImportPreviewIsAuthority: boolValue(
      raw.ontology_decision_import_preview_is_authority,
    ),
    promptAgentExecutionAllowed: boolValue(raw.prompt_agent_execution_allowed),
    automaticImportLockUpdate: boolValue(raw.automatic_import_lock_update),
    automaticCanonicalNodeUpdate: boolValue(raw.automatic_canonical_node_update),
    canonicalMutationsAllowed: boolValue(raw.canonical_mutations_allowed),
  };
}

function parseDecisionPreview(raw: Record<string, unknown>): OntologyOwnerDecisionPreview | null {
  const previewId = optionalString(raw.preview_id);
  const decisionId = optionalString(raw.decision_id);
  const candidateId = optionalString(raw.candidate_id);
  const intakeId = optionalString(raw.intake_id);
  if (!previewId || !decisionId || !candidateId || !intakeId) return null;
  return {
    previewId,
    decisionId,
    candidateId,
    intakeId,
    decisionState: stringValue(raw.decision_state, "unknown"),
    ontologyDecisionRef: optionalString(raw.ontology_decision_ref),
    decidedBy: stringValue(raw.decided_by, "unknown"),
    decidedAt: stringValue(raw.decided_at, "unknown"),
    reason: optionalString(raw.reason),
    acceptedOntologyDelta: boolValue(raw.accepted_ontology_delta),
    matchedClosedLoopEvidenceId: optionalString(raw.matched_closed_loop_evidence_id),
    matchedSourceIntakeState: optionalString(raw.matched_source_intake_state),
    matchedEvidenceState: optionalString(raw.matched_evidence_state),
    previewState: stringValue(raw.preview_state, "unknown"),
    requiredHumanAction: stringValue(raw.required_human_action, "unknown"),
    importRecommended: boolValue(raw.import_recommended),
    importsIntoSpecgraph: boolValue(raw.imports_into_specgraph),
    closesSemanticGate: boolValue(raw.closes_semantic_gate),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
    writesOntologyPackage: boolValue(raw.writes_ontology_package),
    updatesOntologyLockfile: boolValue(raw.updates_ontology_lockfile),
  };
}

function parseIgnoredOwnerDecision(raw: Record<string, unknown>): OntologyIgnoredOwnerDecision | null {
  const decisionId = optionalString(raw.decision_id);
  if (!decisionId) return null;
  return {
    decisionId,
    candidateId: optionalString(raw.candidate_id),
    intakeId: optionalString(raw.intake_id),
    decisionState: optionalString(raw.decision_state),
    reason: optionalString(raw.reason),
    sourceEvidenceState: optionalString(raw.source_evidence_state),
    sourceIntakeState: optionalString(raw.source_intake_state),
  };
}

export function parseOntologyOwnerDecisionReview(
  raw: unknown,
): ParseResult<OntologyOwnerDecisionReview> {
  if (!isRecord(raw)) return { kind: "parse-error", issues: [], raw };
  if (raw.artifact_kind !== "ontology_decision_import_preview") {
    return {
      kind: "wrong-artifact-kind",
      expected: "ontology_decision_import_preview",
      got: raw.artifact_kind,
    };
  }
  if (typeof raw.schema_version === "number" && raw.schema_version > 1) {
    return {
      kind: "version-not-supported",
      artifact_kind: "ontology_decision_import_preview",
      schema_version: raw.schema_version,
      max_supported: 1,
    };
  }
  if (raw.schema_version !== 1) return { kind: "parse-error", issues: [], raw };
  if (raw.proposal_id !== "0115") {
    return invariantViolation("proposal_id must be 0115", raw);
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

  const rawAuthorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : null;
  if (!rawAuthorityBoundary) return invariantViolation("authority_boundary must be present", raw);
  for (const flag of FALSE_AUTHORITY_FLAGS) {
    if (rawAuthorityBoundary[flag] !== false) {
      return invariantViolation(`authority_boundary.${flag} must be false`, raw);
    }
  }

  const summary = isRecord(raw.summary) ? raw.summary : {};
  const status = stringValue(summary.status, "unknown");
  if (!REVIEW_STATUSES.has(status)) {
    return invariantViolation("summary.status is not supported", raw);
  }
  const target = isRecord(raw.target) ? raw.target : {};
  const decisionImportPreviews = records(raw.decision_import_previews)
    .map(parseDecisionPreview)
    .filter((entry): entry is OntologyOwnerDecisionPreview => !!entry);
  const ignoredOwnerDecisions = records(raw.ignored_owner_decisions)
    .map(parseIgnoredOwnerDecision)
    .filter((entry): entry is OntologyIgnoredOwnerDecision => !!entry);

  if (numberValue(summary.preview_count) !== decisionImportPreviews.length) {
    return invariantViolation("summary.preview_count must match decision_import_previews length", raw);
  }
  if (numberValue(summary.ignored_decision_count) !== ignoredOwnerDecisions.length) {
    return invariantViolation(
      "summary.ignored_decision_count must match ignored_owner_decisions length",
      raw,
    );
  }
  if (
    numberValue(summary.accepted_count) !==
    decisionImportPreviews.filter((entry) => entry.decisionState === "accepted").length
  ) {
    return invariantViolation("summary.accepted_count must match accepted decisions", raw);
  }
  if (
    numberValue(summary.rejected_count) !==
    decisionImportPreviews.filter((entry) => entry.decisionState === "rejected").length
  ) {
    return invariantViolation("summary.rejected_count must match rejected decisions", raw);
  }
  if (
    numberValue(summary.importable_count) !==
    decisionImportPreviews.filter((entry) => entry.importRecommended).length
  ) {
    return invariantViolation("summary.importable_count must match import recommendations", raw);
  }
  for (const entry of decisionImportPreviews) {
    if (!DECISION_STATES.has(entry.decisionState)) {
      return invariantViolation("decision_import_previews.decision_state is not supported", raw);
    }
    if (!REVIEW_STATUSES.has(entry.previewState) || entry.previewState === "no_decisions") {
      return invariantViolation("decision_import_previews.preview_state is not supported", raw);
    }
    if (entry.importRecommended !== (entry.previewState === "ready_for_operator_review")) {
      return invariantViolation(
        "decision_import_previews.import_recommended must match ready state",
        raw,
      );
    }
    if (entry.previewState === "ready_for_operator_review") {
      if (entry.decisionState !== "accepted" || !entry.acceptedOntologyDelta) {
        return invariantViolation("ready preview requires an accepted decision", raw);
      }
      if (
        !entry.matchedClosedLoopEvidenceId ||
        !entry.matchedSourceIntakeState ||
        !entry.matchedEvidenceState
      ) {
        return invariantViolation("ready preview requires matched closed-loop evidence", raw);
      }
    }
    for (const flag of FALSE_PREVIEW_FLAGS) {
      if ((rawDecisionPreviewFlag(entry, flag))) {
        return invariantViolation(`decision_import_previews.${flag} must be false`, raw);
      }
    }
  }

  return {
    kind: "ok",
    data: {
      artifactKind: "ontology_decision_import_preview",
      schemaVersion: 1,
      proposalId: "0115",
      policyBasis: stringList(raw.policy_basis),
      sourcePolicy: optionalString(raw.source_policy),
      sourceArtifacts: stringMap(raw.source_artifacts),
      target: {
        targetKind: optionalString(target.target_kind),
        targetRef: optionalString(target.target_ref),
      },
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      decisionImportPreviews,
      ignoredOwnerDecisions,
      consumerBoundary: parseConsumerBoundary(rawConsumerBoundary),
      authorityBoundary: parseAuthorityBoundary(rawAuthorityBoundary),
      summary: {
        status,
        previewCount: numberValue(summary.preview_count),
        acceptedCount: numberValue(summary.accepted_count),
        rejectedCount: numberValue(summary.rejected_count),
        clarificationCount: numberValue(summary.clarification_count),
        importableCount: numberValue(summary.importable_count),
        blockedCount: numberValue(summary.blocked_count),
        unmatchedCount: numberValue(summary.unmatched_count),
        ignoredDecisionCount: numberValue(summary.ignored_decision_count),
        nextGap: optionalString(summary.next_gap),
      },
      outputArtifact: optionalString(raw.output_artifact),
    },
  };
}

function rawDecisionPreviewFlag(
  entry: OntologyOwnerDecisionPreview,
  flag: (typeof FALSE_PREVIEW_FLAGS)[number],
): boolean {
  switch (flag) {
    case "imports_into_specgraph":
      return entry.importsIntoSpecgraph;
    case "closes_semantic_gate":
      return entry.closesSemanticGate;
    case "mutates_canonical_specs":
      return entry.mutatesCanonicalSpecs;
    case "writes_ontology_package":
      return entry.writesOntologyPackage;
    case "updates_ontology_lockfile":
      return entry.updatesOntologyLockfile;
  }
}

export function useOntologyOwnerDecisionReview(
  options: Options = {},
): UseOntologyOwnerDecisionReviewState {
  const {
    url = "/api/v1/ontology-owner-decision-review",
    fetcher,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseOntologyOwnerDecisionReviewState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseOntologyOwnerDecisionReview,
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
