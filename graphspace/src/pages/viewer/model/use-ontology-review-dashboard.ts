import { useEffect, useState } from "react";
import { fetchEnvelope, type EnvelopeResult } from "@/shared/api";
import type { ParseResult } from "@/shared/spec-graph-contract";

export type OntologyReviewDashboardSummary = {
  status: string;
  gateState: string;
  reviewSurfaceStatus: string;
  intakeStatus: string;
  closedLoopStatus: string;
  blockingCount: number;
  reviewRequiredCount: number;
  candidateCount: number;
  draftRequestCount: number;
  evidenceEntryCount: number;
  pendingDecisionCount: number;
  blockedEntryCount: number;
  requiredHumanAction: string;
  nextGap: string | null;
};

export type OntologyReviewDashboardItem = {
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

export type OntologyReviewDashboardAction = {
  action: string;
  source: string;
  effect: string | null;
  termCount: number | null;
  candidateCount: number | null;
  terms: readonly string[];
  writesOntologyPackage: boolean;
  mutatesCanonicalSpecs: boolean;
};

export type OntologyReviewDashboardDraftRequest = {
  intakeId: string;
  candidateId: string;
  term: string | null;
  reviewState: string;
  intakeState: string;
  requiredHumanAction: string;
  blockedByGateState: string | null;
  writesOntologyPackage: boolean;
  updatesOntologyLockfile: boolean;
  mutatesCanonicalSpecs: boolean;
  marksCandidateAccepted: boolean;
};

export type OntologyReviewDashboardClosedLoopEntry = {
  evidenceId: string;
  candidateId: string;
  intakeId: string;
  term: string | null;
  sourceIntakeState: string;
  evidenceState: string;
  specgraphReviewState: string;
  requiredHumanAction: string;
  ontologyDecisionRef: string | null;
  acceptedOntologyDelta: boolean;
  closesSemanticGate: boolean;
  mutatesCanonicalSpecs: boolean;
};

export type OntologyReviewDashboardConsumerBoundary = {
  forSpecgraphReviewDashboard: boolean;
  forSpecspaceReviewDashboard: boolean;
  mayExecutePromptAgent: boolean;
  mayWriteOntologyPackage: boolean;
  mayUpdateOntologyLockfile: boolean;
  mayMutateCanonicalSpecs: boolean;
  mayMarkCandidateAccepted: boolean;
  mayImportOwnerDecision: boolean;
  mayCloseSemanticGate: boolean;
};

export type OntologyReviewDashboard = {
  artifactKind: "ontology_review_dashboard";
  schemaVersion: 1;
  proposalId: "0113";
  policyBasis: readonly string[];
  sourcePolicy: string | null;
  sourceArtifacts: Record<string, string>;
  target: {
    targetKind: string | null;
    targetRef: string | null;
  };
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  dashboardSections: readonly string[];
  statusSummary: OntologyReviewDashboardSummary;
  gate: Record<string, unknown>;
  blockingItems: readonly OntologyReviewDashboardItem[];
  reviewRequiredItems: readonly OntologyReviewDashboardItem[];
  deltaCandidates: readonly Record<string, unknown>[];
  draftRequests: readonly OntologyReviewDashboardDraftRequest[];
  closedLoopEntries: readonly OntologyReviewDashboardClosedLoopEntry[];
  reviewActions: readonly OntologyReviewDashboardAction[];
  consumerBoundary: OntologyReviewDashboardConsumerBoundary;
  authorityBoundary: {
    ontologyReviewDashboardIsAuthority: false;
  };
  outputArtifact: string | null;
};

export type UseOntologyReviewDashboardState =
  | { kind: "idle" }
  | { kind: "loading" }
  | EnvelopeResult<OntologyReviewDashboard>;

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

const TRUE_CONSUMER_BOUNDARY_FLAGS = [
  "for_specgraph_review_dashboard",
  "for_specspace_review_dashboard",
] as const;

const FALSE_CONSUMER_BOUNDARY_FLAGS = [
  "may_execute_prompt_agent",
  "may_write_ontology_package",
  "may_update_ontology_lockfile",
  "may_mutate_canonical_specs",
  "may_mark_candidate_accepted",
  "may_import_owner_decision",
  "may_close_semantic_gate",
] as const;

const DASHBOARD_STATUSES = new Set([
  "blocked_by_semantic_gate",
  "pending_ontology_owner_decision",
  "review_pending",
  "clear",
  "no_candidates",
]);

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

function invariantViolation(message: string, raw: unknown): ParseResult<OntologyReviewDashboard> {
  return { kind: "invariant-violation", message, raw };
}

function parseConsumerBoundary(raw: Record<string, unknown>): OntologyReviewDashboardConsumerBoundary {
  return {
    forSpecgraphReviewDashboard: boolValue(raw.for_specgraph_review_dashboard),
    forSpecspaceReviewDashboard: boolValue(raw.for_specspace_review_dashboard),
    mayExecutePromptAgent: boolValue(raw.may_execute_prompt_agent),
    mayWriteOntologyPackage: boolValue(raw.may_write_ontology_package),
    mayUpdateOntologyLockfile: boolValue(raw.may_update_ontology_lockfile),
    mayMutateCanonicalSpecs: boolValue(raw.may_mutate_canonical_specs),
    mayMarkCandidateAccepted: boolValue(raw.may_mark_candidate_accepted),
    mayImportOwnerDecision: boolValue(raw.may_import_owner_decision),
    mayCloseSemanticGate: boolValue(raw.may_close_semantic_gate),
  };
}

function parseReviewItem(raw: Record<string, unknown>): OntologyReviewDashboardItem | null {
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

function parseReviewAction(raw: Record<string, unknown>): OntologyReviewDashboardAction | null {
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

function parseDraftRequest(raw: Record<string, unknown>): OntologyReviewDashboardDraftRequest | null {
  const intakeId = optionalString(raw.intake_id);
  const candidateId = optionalString(raw.candidate_id);
  if (!intakeId || !candidateId) return null;
  return {
    intakeId,
    candidateId,
    term: optionalString(raw.term),
    reviewState: stringValue(raw.review_state, "unknown"),
    intakeState: stringValue(raw.intake_state, "unknown"),
    requiredHumanAction: stringValue(raw.required_human_action, "unknown"),
    blockedByGateState: optionalString(raw.blocked_by_gate_state),
    writesOntologyPackage: boolValue(raw.writes_ontology_package),
    updatesOntologyLockfile: boolValue(raw.updates_ontology_lockfile),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
    marksCandidateAccepted: boolValue(raw.marks_candidate_accepted),
  };
}

function parseClosedLoopEntry(
  raw: Record<string, unknown>,
): OntologyReviewDashboardClosedLoopEntry | null {
  const evidenceId = optionalString(raw.evidence_id);
  const candidateId = optionalString(raw.candidate_id);
  const intakeId = optionalString(raw.intake_id);
  if (!evidenceId || !candidateId || !intakeId) return null;
  return {
    evidenceId,
    candidateId,
    intakeId,
    term: optionalString(raw.term),
    sourceIntakeState: stringValue(raw.source_intake_state, "unknown"),
    evidenceState: stringValue(raw.evidence_state, "unknown"),
    specgraphReviewState: stringValue(raw.specgraph_review_state, "unknown"),
    requiredHumanAction: stringValue(raw.required_human_action, "unknown"),
    ontologyDecisionRef: optionalString(raw.ontology_decision_ref),
    acceptedOntologyDelta: boolValue(raw.accepted_ontology_delta),
    closesSemanticGate: boolValue(raw.closes_semantic_gate),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
  };
}

export function parseOntologyReviewDashboard(
  raw: unknown,
): ParseResult<OntologyReviewDashboard> {
  if (!isRecord(raw)) return { kind: "parse-error", issues: [], raw };
  if (raw.artifact_kind !== "ontology_review_dashboard") {
    return {
      kind: "wrong-artifact-kind",
      expected: "ontology_review_dashboard",
      got: raw.artifact_kind,
    };
  }
  if (typeof raw.schema_version === "number" && raw.schema_version > 1) {
    return {
      kind: "version-not-supported",
      artifact_kind: "ontology_review_dashboard",
      schema_version: raw.schema_version,
      max_supported: 1,
    };
  }
  if (raw.schema_version !== 1) return { kind: "parse-error", issues: [], raw };
  if (raw.proposal_id !== "0113") {
    return invariantViolation("proposal_id must be 0113", raw);
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
  if (authorityBoundary.ontology_review_dashboard_is_authority !== false) {
    return invariantViolation(
      "authority_boundary.ontology_review_dashboard_is_authority must be false",
      raw,
    );
  }

  const statusSummary = isRecord(raw.status_summary) ? raw.status_summary : {};
  const status = stringValue(statusSummary.status, "unknown");
  if (!DASHBOARD_STATUSES.has(status)) {
    return invariantViolation("status_summary.status is not supported", raw);
  }
  const target = isRecord(raw.target) ? raw.target : {};
  const blockingItems = records(raw.blocking_items)
    .map(parseReviewItem)
    .filter((entry): entry is OntologyReviewDashboardItem => !!entry);
  const reviewRequiredItems = records(raw.review_required_items)
    .map(parseReviewItem)
    .filter((entry): entry is OntologyReviewDashboardItem => !!entry);
  const draftRequests = records(raw.draft_requests)
    .map(parseDraftRequest)
    .filter((entry): entry is OntologyReviewDashboardDraftRequest => !!entry);
  const closedLoopEntries = records(raw.closed_loop_entries)
    .map(parseClosedLoopEntry)
    .filter((entry): entry is OntologyReviewDashboardClosedLoopEntry => !!entry);
  const reviewActions = records(raw.review_actions)
    .map(parseReviewAction)
    .filter((entry): entry is OntologyReviewDashboardAction => !!entry);

  if (numberValue(statusSummary.draft_request_count) !== draftRequests.length) {
    return invariantViolation("status_summary.draft_request_count must match draft_requests length", raw);
  }
  if (numberValue(statusSummary.evidence_entry_count) !== closedLoopEntries.length) {
    return invariantViolation(
      "status_summary.evidence_entry_count must match closed_loop_entries length",
      raw,
    );
  }
  if (
    draftRequests.some(
      (entry) =>
        entry.writesOntologyPackage ||
        entry.updatesOntologyLockfile ||
        entry.mutatesCanonicalSpecs ||
        entry.marksCandidateAccepted,
    )
  ) {
    return invariantViolation("draft_requests must not declare write or mutation authority", raw);
  }
  if (
    closedLoopEntries.some(
      (entry) =>
        entry.acceptedOntologyDelta || entry.closesSemanticGate || entry.mutatesCanonicalSpecs,
    )
  ) {
    return invariantViolation("closed_loop_entries must not accept deltas or close gates", raw);
  }
  if (reviewActions.some((action) => action.writesOntologyPackage || action.mutatesCanonicalSpecs)) {
    return invariantViolation("review_actions must not write ontology packages or specs", raw);
  }

  return {
    kind: "ok",
    data: {
      artifactKind: "ontology_review_dashboard",
      schemaVersion: 1,
      proposalId: "0113",
      policyBasis: stringList(raw.policy_basis),
      sourcePolicy: optionalString(raw.source_policy),
      sourceArtifacts: stringMap(raw.source_artifacts),
      target: {
        targetKind: optionalString(target.target_kind),
        targetRef: optionalString(target.target_ref),
      },
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      dashboardSections: stringList(raw.dashboard_sections),
      statusSummary: {
        status,
        gateState: stringValue(statusSummary.gate_state, "unknown"),
        reviewSurfaceStatus: stringValue(statusSummary.review_surface_status, "unknown"),
        intakeStatus: stringValue(statusSummary.intake_status, "unknown"),
        closedLoopStatus: stringValue(statusSummary.closed_loop_status, "unknown"),
        blockingCount: numberValue(statusSummary.blocking_count),
        reviewRequiredCount: numberValue(statusSummary.review_required_count),
        candidateCount: numberValue(statusSummary.candidate_count),
        draftRequestCount: numberValue(statusSummary.draft_request_count),
        evidenceEntryCount: numberValue(statusSummary.evidence_entry_count),
        pendingDecisionCount: numberValue(statusSummary.pending_decision_count),
        blockedEntryCount: numberValue(statusSummary.blocked_entry_count),
        requiredHumanAction: stringValue(statusSummary.required_human_action, "unknown"),
        nextGap: optionalString(statusSummary.next_gap),
      },
      gate: isRecord(raw.gate) ? raw.gate : {},
      blockingItems,
      reviewRequiredItems,
      deltaCandidates: records(raw.delta_candidates),
      draftRequests,
      closedLoopEntries,
      reviewActions,
      consumerBoundary: parseConsumerBoundary(rawConsumerBoundary),
      authorityBoundary: {
        ontologyReviewDashboardIsAuthority: false,
      },
      outputArtifact: optionalString(raw.output_artifact),
    },
  };
}

export function useOntologyReviewDashboard(
  options: Options = {},
): UseOntologyReviewDashboardState {
  const {
    url = "/api/v1/ontology-review-dashboard",
    fetcher,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseOntologyReviewDashboardState>({
    kind: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchEnvelope({
      url,
      parse: parseOntologyReviewDashboard,
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
