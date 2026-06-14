import { useCallback, useEffect, useMemo, useState } from "react";
import type { OntologyOwnerDecisionPreview } from "./use-ontology-owner-decision-review";

export type OntologyOwnerDecisionAcknowledgement = {
  acknowledgementId: string;
  previewId: string;
  decisionId: string;
  candidateId: string;
  intakeId: string | null;
  decisionState: string | null;
  previewState: string | null;
  requiredHumanAction: string | null;
  acknowledgedBy: string;
  acknowledgedAt: string;
  sourceArtifact: string | null;
  sourceMtimeIso: string | null;
  importsIntoSpecgraph: boolean;
  closesSemanticGate: boolean;
  mutatesCanonicalSpecs: boolean;
  writesOntologyPackage: boolean;
  updatesOntologyLockfile: boolean;
};

export type OntologyOwnerDecisionAcknowledgementState = {
  artifactKind: "specspace_ontology_owner_decision_acknowledgement_state";
  schemaVersion: 1;
  stateOwner: "SpecSpace";
  statePath: string | null;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  sourceArtifacts: Record<string, string>;
  acknowledgements: readonly OntologyOwnerDecisionAcknowledgement[];
  summary: {
    status: string;
    acknowledgementCount: number;
    nextGap: string | null;
  };
  consumerBoundary: {
    specspaceOwnedState: boolean;
    forOperatorReviewWorkflow: boolean;
    mayExecutePromptAgent: boolean;
    mayWriteOntologyPackage: boolean;
    mayUpdateOntologyLockfile: boolean;
    mayMutateCanonicalSpecs: boolean;
    mayApplyPreview: boolean;
    mayImportIntoSpecgraph: boolean;
    mayCloseSemanticGate: boolean;
  };
  authorityBoundary: {
    acknowledgementStateIsAuthority: boolean;
    ontologyPackageAuthority: boolean;
    specgraphImportAuthority: boolean;
    semanticGateAuthority: boolean;
    canonicalMutationsAllowed: boolean;
  };
};

export type UseOntologyOwnerDecisionAcknowledgementsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: OntologyOwnerDecisionAcknowledgementState }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; message: string; raw: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
  enabled?: boolean;
  refreshKey?: number;
};

const consumerMutationFields = [
  "may_execute_prompt_agent",
  "may_write_ontology_package",
  "may_update_ontology_lockfile",
  "may_mutate_canonical_specs",
  "may_apply_preview",
  "may_import_into_specgraph",
  "may_close_semantic_gate",
] as const;

const authorityMutationFields = [
  "acknowledgement_state_is_authority",
  "ontology_package_authority",
  "specgraph_import_authority",
  "semantic_gate_authority",
  "canonical_mutations_allowed",
] as const;

const acknowledgementMutationFields = [
  "canonical_mutations_allowed",
  "imports_into_specgraph",
  "closes_semantic_gate",
  "mutates_canonical_specs",
  "writes_ontology_package",
  "updates_ontology_lockfile",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return optionalString(value) ?? fallback;
}

function boolValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.length > 0) out[key] = item;
  }
  return out;
}

function acknowledgement(raw: Record<string, unknown>): OntologyOwnerDecisionAcknowledgement | null {
  const previewId = optionalString(raw.preview_id);
  const decisionId = optionalString(raw.decision_id);
  const candidateId = optionalString(raw.candidate_id);
  if (!previewId || !decisionId || !candidateId) return null;
  return {
    acknowledgementId: stringValue(raw.acknowledgement_id, `specspace-ack::${previewId}`),
    previewId,
    decisionId,
    candidateId,
    intakeId: optionalString(raw.intake_id),
    decisionState: optionalString(raw.decision_state),
    previewState: optionalString(raw.preview_state),
    requiredHumanAction: optionalString(raw.required_human_action),
    acknowledgedBy: stringValue(raw.acknowledged_by, "local_operator"),
    acknowledgedAt: stringValue(raw.acknowledged_at, "unknown"),
    sourceArtifact: optionalString(raw.source_artifact),
    sourceMtimeIso: optionalString(raw.source_mtime_iso),
    importsIntoSpecgraph: boolValue(raw.imports_into_specgraph),
    closesSemanticGate: boolValue(raw.closes_semantic_gate),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
    writesOntologyPackage: boolValue(raw.writes_ontology_package),
    updatesOntologyLockfile: boolValue(raw.updates_ontology_lockfile),
  };
}

function firstTrue(
  raw: Record<string, unknown>,
  fields: readonly string[],
): string | null {
  return fields.find((field) => raw[field] === true) ?? null;
}

export function parseOntologyOwnerDecisionAcknowledgementState(
  raw: unknown,
): UseOntologyOwnerDecisionAcknowledgementsState {
  if (!isRecord(raw)) return { kind: "parse-error", message: "State root must be an object.", raw };
  if (raw.artifact_kind !== "specspace_ontology_owner_decision_acknowledgement_state") {
    return { kind: "parse-error", message: "Unexpected acknowledgement artifact kind.", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", message: "Unsupported acknowledgement schema version.", raw };
  }
  if (raw.state_owner !== "SpecSpace") {
    return { kind: "parse-error", message: "Acknowledgement state must be owned by SpecSpace.", raw };
  }
  if (raw.canonical_mutations_allowed !== false || raw.tracked_artifacts_written !== false) {
    return { kind: "parse-error", message: "Acknowledgement state cannot claim mutations.", raw };
  }

  const consumerBoundary = isRecord(raw.consumer_boundary) ? raw.consumer_boundary : {};
  const authorityBoundary = isRecord(raw.authority_boundary) ? raw.authority_boundary : {};
  const consumerMutation = firstTrue(consumerBoundary, consumerMutationFields);
  if (consumerMutation) {
    return { kind: "parse-error", message: `Acknowledgement consumer boundary cannot claim ${consumerMutation}.`, raw };
  }
  const authorityMutation = firstTrue(authorityBoundary, authorityMutationFields);
  if (authorityMutation) {
    return { kind: "parse-error", message: `Acknowledgement authority boundary cannot claim ${authorityMutation}.`, raw };
  }
  const acknowledgementRows = Array.isArray(raw.acknowledgements)
    ? raw.acknowledgements.filter(isRecord)
    : [];
  for (const row of acknowledgementRows) {
    const recordMutation = firstTrue(row, acknowledgementMutationFields);
    if (recordMutation) {
      return { kind: "parse-error", message: `Acknowledgement record cannot claim ${recordMutation}.`, raw };
    }
  }
  const acknowledgements = Array.isArray(raw.acknowledgements)
    ? acknowledgementRows
      .map(acknowledgement)
      .filter((entry): entry is OntologyOwnerDecisionAcknowledgement => !!entry)
    : [];
  const summary = isRecord(raw.summary) ? raw.summary : {};

  return {
    kind: "ok",
    data: {
      artifactKind: "specspace_ontology_owner_decision_acknowledgement_state",
      schemaVersion: 1,
      stateOwner: "SpecSpace",
      statePath: optionalString(raw.state_path),
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      sourceArtifacts: stringMap(raw.source_artifacts),
      acknowledgements,
      summary: {
        status: stringValue(summary.status, acknowledgements.length > 0 ? "acknowledgements_recorded" : "no_acknowledgements"),
        acknowledgementCount: typeof summary.acknowledgement_count === "number"
          ? summary.acknowledgement_count
          : acknowledgements.length,
        nextGap: optionalString(summary.next_gap),
      },
      consumerBoundary: {
        specspaceOwnedState: boolValue(consumerBoundary.specspace_owned_state),
        forOperatorReviewWorkflow: boolValue(consumerBoundary.for_operator_review_workflow),
        mayExecutePromptAgent: boolValue(consumerBoundary.may_execute_prompt_agent),
        mayWriteOntologyPackage: boolValue(consumerBoundary.may_write_ontology_package),
        mayUpdateOntologyLockfile: boolValue(consumerBoundary.may_update_ontology_lockfile),
        mayMutateCanonicalSpecs: boolValue(consumerBoundary.may_mutate_canonical_specs),
        mayApplyPreview: boolValue(consumerBoundary.may_apply_preview),
        mayImportIntoSpecgraph: boolValue(consumerBoundary.may_import_into_specgraph),
        mayCloseSemanticGate: boolValue(consumerBoundary.may_close_semantic_gate),
      },
      authorityBoundary: {
        acknowledgementStateIsAuthority: boolValue(authorityBoundary.acknowledgement_state_is_authority),
        ontologyPackageAuthority: boolValue(authorityBoundary.ontology_package_authority),
        specgraphImportAuthority: boolValue(authorityBoundary.specgraph_import_authority),
        semanticGateAuthority: boolValue(authorityBoundary.semantic_gate_authority),
        canonicalMutationsAllowed: boolValue(authorityBoundary.canonical_mutations_allowed),
      },
    },
  };
}

export function useOntologyOwnerDecisionAcknowledgements(options: Options = {}) {
  const {
    url = "/api/v1/ontology-owner-decision-acknowledgements",
    fetcher = fetch,
    enabled = true,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseOntologyOwnerDecisionAcknowledgementsState>({ kind: "idle" });
  const [pendingPreviewId, setPendingPreviewId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    let response: Response;
    try {
      response = await fetcher(url, { signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      setState({ kind: "network-error", error });
      return;
    }
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      setState({ kind: "http-error", status: response.status, statusText: response.statusText, body });
      return;
    }
    setState(parseOntologyOwnerDecisionAcknowledgementState(await response.json()));
  }, [fetcher, url]);

  useEffect(() => {
    if (!enabled) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));
    load(controller.signal).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      setState({ kind: "network-error", error });
    });
    return () => controller.abort();
  }, [enabled, load, refreshKey]);

  const acknowledge = useCallback(async (preview: OntologyOwnerDecisionPreview) => {
    setPendingPreviewId(preview.previewId);
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_id: preview.previewId }),
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = undefined;
        }
        setState({ kind: "http-error", status: response.status, statusText: response.statusText, body });
        return;
      }
      setState(parseOntologyOwnerDecisionAcknowledgementState(await response.json()));
    } catch (error) {
      setState({ kind: "network-error", error });
    } finally {
      setPendingPreviewId(null);
    }
  }, [fetcher, url]);

  const acknowledgedPreviewIds = useMemo(() => {
    if (state.kind !== "ok") return new Set<string>();
    return new Set(state.data.acknowledgements.map((entry) => entry.previewId));
  }, [state]);

  return { state, acknowledgedPreviewIds, pendingPreviewId, acknowledge };
}
