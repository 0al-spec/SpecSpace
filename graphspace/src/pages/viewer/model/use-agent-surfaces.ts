import { useEffect, useState } from "react";

export type AgentSurfaceGap = {
  gapId: string;
  gap: string;
  severity: string;
  reason: string;
  nextAction: string;
  sourceProposalIds: readonly string[];
};

export type AgentSurfaceEntry = {
  surfaceId: string;
  title: string;
  surfaceType: string;
  source: string;
  sourceProposalIds: readonly string[];
  requiresPassport: boolean;
  launchesAgents: boolean;
  preparesHandoffs: boolean;
  passportRef: string | null;
  verificationState: string;
  verificationStatus: string;
  verificationToolStatus: string;
  verificationValid: boolean;
  runtimeEnforcementState: string;
  runtimeEnforcementObserved: boolean;
  nextAction: string | null;
  executorBackendId: string | null;
  backendStatus: string | null;
  runtimeEnvironment: RuntimeEnvironment | null;
  gapCount: number;
  gaps: readonly AgentSurfaceGap[];
  runtimeEnforcementEvidenceCount: number;
  runtimeEnforcementEvidence: readonly AgentRuntimeEvidenceEntry[];
};

export type AgentRuntimeEvidenceEntry = {
  evidenceId: string;
  evidenceKind: string;
  status: string;
  runtimeEnforcementState: string;
  postureClaim: string;
  evidenceRef: string | null;
  resultStatus: string;
  sourceProposalIds: readonly string[];
  detailStatus: string;
  detailReason: string;
  detailMessage: string;
  checks: readonly AgentRuntimeEvidenceCheck[];
};

export type AgentRuntimeEvidenceCheck = {
  checkId: string;
  status: string;
  message: string;
};

export type ExecutorAdapterEntry = {
  backendId: string;
  displayName: string;
  backendStatus: string;
  authorityState: string;
  commandSurface: string;
  protocolContract: string;
  passportRef: string | null;
  smokeStatus: string;
  canonicalTrialAllowed: boolean;
  safeNextAction: string | null;
  capabilityGapCount: number;
  passportValidation: Record<string, unknown>;
  runtimeEnvironment: RuntimeEnvironment | null;
};

export type RuntimeEnvironment = {
  producerEnvironment: string | null;
  intendedEnvironment: string | null;
  executableProbeScope: string | null;
  backendStatusSemantics: string | null;
  staticPublishExecutableRequired: boolean | null;
  localOperatorExecutableRequired: boolean | null;
  producerEnvironmentExecutableRequired: boolean | null;
  producerEnvironmentExecutionSuppressed: boolean | null;
  missingExecutableIsStaticPublishGap: boolean | null;
  operatorNextAction: string | null;
};

export type AgentSurfaceSource = {
  available: boolean;
  artifact: string;
  entryCount: number;
  reason?: string;
  path?: string | null;
};

export type AgentSurfaceHandoff = {
  available: boolean;
  handoffId: string | null;
  handoffStatus: string;
  reviewState: string;
  nextGap: string | null;
  sourceGap: string | null;
  sourceProposalIds: readonly string[];
  artifactContract: Record<string, unknown>;
  expectedConsumerBehavior: readonly string[];
  evidenceContract: Record<string, unknown>;
  privacyBoundary: Record<string, unknown>;
};

export type AgentSurfaceIndex = {
  apiVersion: "v1";
  artifactKind: "specspace_agent_surface_index";
  schemaVersion: number;
  entryCount: number;
  entries: readonly AgentSurfaceEntry[];
  executorAdapters: readonly ExecutorAdapterEntry[];
  handoff: AgentSurfaceHandoff;
  summary: {
    surfaceCount: number;
    executorBackendCount: number;
    missingPassportCount: number;
    verificationGapCount: number;
    verificationValidCount: number;
    verificationInvalidCount: number;
    verificationUnavailableCount: number;
    runtimeEnforcementUnknownCount: number;
    runtimeEnforcementPolicyOnlyCount: number;
    runtimeEnforcementBoundaryOnlyCount: number;
    runtimeEnforcementDeferredCount: number;
    runtimeEnforcementEvidenceCount: number;
    runtimeEnforcementEvidencePassedCount: number;
    runtimeEnforcementEvidenceFailedCount: number;
    runtimeEnforcementEvidenceMissingCount: number;
    agentPassportCliStatus: string;
    handoffStatus: string;
    nextGap: string | null;
  };
  sources: Record<string, AgentSurfaceSource>;
};

export type ParseAgentSurfaceIndexResult =
  | { kind: "ok"; data: AgentSurfaceIndex }
  | { kind: "parse-error"; reason: string; raw: unknown };

export type UseAgentSurfacesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: AgentSurfaceIndex }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | { kind: "parse-error"; reason: string; raw: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function optionalBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function parseGap(raw: Record<string, unknown>): AgentSurfaceGap {
  return {
    gapId: stringValue(raw.gap_id, ""),
    gap: stringValue(raw.gap, "unknown"),
    severity: stringValue(raw.severity, "unknown"),
    reason: stringValue(raw.reason, ""),
    nextAction: stringValue(raw.next_action, ""),
    sourceProposalIds: stringList(raw.source_proposal_ids),
  };
}

function parseRuntimeEvidenceCheck(raw: Record<string, unknown>): AgentRuntimeEvidenceCheck | null {
  const checkId = optionalString(raw.check_id);
  if (!checkId) return null;
  return {
    checkId,
    status: stringValue(raw.status, "unknown"),
    message: stringValue(raw.message, ""),
  };
}

function parseRuntimeEvidence(raw: Record<string, unknown>): AgentRuntimeEvidenceEntry {
  return {
    evidenceId: stringValue(raw.evidence_id, ""),
    evidenceKind: stringValue(raw.evidence_kind, "unknown"),
    status: stringValue(raw.status, "missing"),
    runtimeEnforcementState: stringValue(raw.runtime_enforcement_state, "unknown"),
    postureClaim: stringValue(raw.posture_claim, ""),
    evidenceRef: optionalString(raw.evidence_ref),
    resultStatus: stringValue(raw.result_status, "unknown"),
    sourceProposalIds: stringList(raw.source_proposal_ids),
    detailStatus: stringValue(raw.detail_status, "missing"),
    detailReason: stringValue(raw.detail_reason, ""),
    detailMessage: stringValue(raw.detail_message, ""),
    checks: records(raw.checks)
      .map(parseRuntimeEvidenceCheck)
      .filter((check): check is AgentRuntimeEvidenceCheck => !!check),
  };
}

function parseRuntimeEnvironment(raw: unknown): RuntimeEnvironment | null {
  if (!isRecord(raw)) return null;
  const parsed = {
    producerEnvironment: optionalString(raw.producer_environment),
    intendedEnvironment: optionalString(raw.intended_environment),
    executableProbeScope: optionalString(raw.executable_probe_scope),
    backendStatusSemantics: optionalString(raw.backend_status_semantics),
    staticPublishExecutableRequired: optionalBool(raw.static_publish_executable_required),
    localOperatorExecutableRequired: optionalBool(raw.local_operator_executable_required),
    producerEnvironmentExecutableRequired: optionalBool(raw.producer_environment_executable_required),
    producerEnvironmentExecutionSuppressed: optionalBool(raw.producer_environment_execution_suppressed),
    missingExecutableIsStaticPublishGap: optionalBool(raw.missing_executable_is_static_publish_gap),
    operatorNextAction: optionalString(raw.operator_next_action),
  };
  if (Object.values(parsed).every((value) => value === null)) return null;
  return {
    ...parsed,
  };
}

function parseSurface(raw: Record<string, unknown>): AgentSurfaceEntry | null {
  const surfaceId = optionalString(raw.surface_id);
  if (!surfaceId) return null;
  return {
    surfaceId,
    title: stringValue(raw.title, surfaceId),
    surfaceType: stringValue(raw.surface_type, "unknown"),
    source: stringValue(raw.source, "unknown"),
    sourceProposalIds: stringList(raw.source_proposal_ids),
    requiresPassport: boolValue(raw.requires_passport),
    launchesAgents: boolValue(raw.launches_agents),
    preparesHandoffs: boolValue(raw.prepares_handoffs),
    passportRef: optionalString(raw.passport_ref),
    verificationState: stringValue(raw.verification_state, "unknown"),
    verificationStatus: stringValue(raw.verification_status, "unknown"),
    verificationToolStatus: stringValue(raw.verification_tool_status, "unknown"),
    verificationValid: boolValue(raw.verification_valid),
    runtimeEnforcementState: stringValue(raw.runtime_enforcement_state, "unknown"),
    runtimeEnforcementObserved: boolValue(raw.runtime_enforcement_observed),
    nextAction: optionalString(raw.next_action),
    executorBackendId: optionalString(raw.executor_backend_id),
    backendStatus: optionalString(raw.backend_status),
    runtimeEnvironment: parseRuntimeEnvironment(raw.runtime_environment),
    gapCount: numberValue(raw.gap_count),
    gaps: records(raw.gaps).map(parseGap),
    runtimeEnforcementEvidenceCount: numberValue(raw.runtime_enforcement_evidence_count),
    runtimeEnforcementEvidence: records(raw.runtime_enforcement_evidence).map(parseRuntimeEvidence),
  };
}

function parseExecutor(raw: Record<string, unknown>): ExecutorAdapterEntry | null {
  const backendId = optionalString(raw.backend_id);
  if (!backendId) return null;
  return {
    backendId,
    displayName: stringValue(raw.display_name, backendId),
    backendStatus: stringValue(raw.backend_status, "unknown"),
    authorityState: stringValue(raw.authority_state, "unknown"),
    commandSurface: stringValue(raw.command_surface, "unknown"),
    protocolContract: stringValue(raw.protocol_contract, "unknown"),
    passportRef: optionalString(raw.passport_ref),
    smokeStatus: stringValue(raw.smoke_status, "unknown"),
    canonicalTrialAllowed: boolValue(raw.canonical_trial_allowed),
    safeNextAction: optionalString(raw.safe_next_action),
    capabilityGapCount: numberValue(raw.capability_gap_count),
    passportValidation: isRecord(raw.passport_validation) ? raw.passport_validation : {},
    runtimeEnvironment: parseRuntimeEnvironment(raw.runtime_environment),
  };
}

function parseSource(raw: Record<string, unknown>): AgentSurfaceSource | null {
  const artifact = optionalString(raw.artifact);
  if (!artifact || typeof raw.available !== "boolean") return null;
  return {
    available: raw.available,
    artifact,
    entryCount: numberValue(raw.entry_count),
    reason: optionalString(raw.reason) ?? undefined,
    path: optionalString(raw.path),
  };
}

function parseSources(raw: unknown): Record<string, AgentSurfaceSource> {
  if (!isRecord(raw)) return {};
  const out: Record<string, AgentSurfaceSource> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const source = parseSource(value);
    if (source) out[key] = source;
  }
  return out;
}

function parseHandoff(raw: unknown): AgentSurfaceHandoff {
  const value = isRecord(raw) ? raw : {};
  return {
    available: boolValue(value.available),
    handoffId: optionalString(value.handoff_id),
    handoffStatus: stringValue(value.handoff_status, "unknown"),
    reviewState: stringValue(value.review_state, "unknown"),
    nextGap: optionalString(value.next_gap),
    sourceGap: optionalString(value.source_gap),
    sourceProposalIds: stringList(value.source_proposal_ids),
    artifactContract: isRecord(value.artifact_contract) ? value.artifact_contract : {},
    expectedConsumerBehavior: stringList(value.expected_consumer_behavior),
    evidenceContract: isRecord(value.evidence_contract) ? value.evidence_contract : {},
    privacyBoundary: isRecord(value.privacy_boundary) ? value.privacy_boundary : {},
  };
}

export function parseAgentSurfaceIndex(raw: unknown): ParseAgentSurfaceIndexResult {
  if (!isRecord(raw)) return { kind: "parse-error", reason: "agent surfaces response is not an object", raw };
  if (raw.artifact_kind !== "specspace_agent_surface_index") {
    return { kind: "parse-error", reason: "unexpected agent surfaces artifact_kind", raw };
  }
  const schemaVersion = numberValue(raw.schema_version);
  if (schemaVersion < 1 || schemaVersion > 1) {
    return { kind: "parse-error", reason: "unsupported agent surfaces schema_version", raw };
  }
  const summary = isRecord(raw.summary) ? raw.summary : {};
  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_agent_surface_index",
      schemaVersion,
      entryCount: numberValue(raw.entry_count),
      entries: records(raw.entries).map(parseSurface).filter((entry): entry is AgentSurfaceEntry => !!entry),
      executorAdapters: records(raw.executor_adapters)
        .map(parseExecutor)
        .filter((entry): entry is ExecutorAdapterEntry => !!entry),
      handoff: parseHandoff(raw.handoff),
      summary: {
        surfaceCount: numberValue(summary.surface_count),
        executorBackendCount: numberValue(summary.executor_backend_count),
        missingPassportCount: numberValue(summary.missing_passport_count),
        verificationGapCount: numberValue(summary.verification_gap_count),
        verificationValidCount: numberValue(summary.verification_valid_count),
        verificationInvalidCount: numberValue(summary.verification_invalid_count),
        verificationUnavailableCount: numberValue(summary.verification_unavailable_count),
        runtimeEnforcementUnknownCount: numberValue(summary.runtime_enforcement_unknown_count),
        runtimeEnforcementPolicyOnlyCount: numberValue(summary.runtime_enforcement_policy_only_count),
        runtimeEnforcementBoundaryOnlyCount: numberValue(summary.runtime_enforcement_boundary_only_count),
        runtimeEnforcementDeferredCount: numberValue(summary.runtime_enforcement_deferred_count),
        runtimeEnforcementEvidenceCount: numberValue(summary.runtime_enforcement_evidence_count),
        runtimeEnforcementEvidencePassedCount: numberValue(summary.runtime_enforcement_evidence_passed_count),
        runtimeEnforcementEvidenceFailedCount: numberValue(summary.runtime_enforcement_evidence_failed_count),
        runtimeEnforcementEvidenceMissingCount: numberValue(summary.runtime_enforcement_evidence_missing_count),
        agentPassportCliStatus: stringValue(summary.agent_passport_cli_status, "unknown"),
        handoffStatus: stringValue(summary.handoff_status, "unknown"),
        nextGap: optionalString(summary.next_gap),
      },
      sources: parseSources(raw.sources),
    },
  };
}

export function useAgentSurfaces(options: Options = {}): UseAgentSurfacesState {
  const { url = "/api/v1/agent-surfaces", fetcher = fetch, refreshKey = 0 } = options;
  const [state, setState] = useState<UseAgentSurfacesState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON proxy failures are still useful as HTTP diagnostics.
          }
          if (!cancelled) {
            setState({
              kind: "http-error",
              status: response.status,
              statusText: response.statusText,
              body,
            });
          }
          return;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (!cancelled) {
            setState({
              kind: "response-error",
              reason: "response was not valid JSON",
              raw: error,
            });
          }
          return;
        }

        const parsed = parseAgentSurfaceIndex(payload);
        if (!cancelled) setState(parsed.kind === "ok" ? { kind: "ok", data: parsed.data } : parsed);
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
