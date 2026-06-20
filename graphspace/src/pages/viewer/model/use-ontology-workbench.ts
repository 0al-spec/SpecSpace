import { useEffect, useState } from "react";

export type OntologyWorkbenchSummary = {
  status: string;
  termCount: number;
  relationCount: number;
  domainCount: number;
  packageCount: number;
  gapCount: number;
  gapGroupCount: number;
  complianceSpecCount: number;
  complianceFindingCount: number;
  writeGateFindingCount: number;
  ownerDecisionReviewCount: number;
  ownerDecisionImportableCount: number;
  legacySpecCount: number;
  legacyReviewRequiredSpecCount: number;
  legacySmallPrBatchCount: number;
  missingArtifactCount: number;
  nextGap: string | null;
};

export type OntologyWorkbenchPackage = {
  packageId: string;
  namespace: string;
  version: string;
  packageRef: string;
  authorityClass: string;
  sourceRef: string | null;
  sourceUri: string | null;
  digest: string | null;
  materializedIr: string | null;
  acceptedByProposal: string | null;
};

export type OntologyWorkbenchIrClass = {
  id: string;
  fqid: string | null;
  uri: string | null;
  description: string | null;
};

export type OntologyWorkbenchIrRelation = {
  id: string;
  fqid: string | null;
  domain: string | null;
  range: string | null;
  uri: string | null;
  description: string | null;
};

export type OntologyWorkbenchGapGroup = {
  groupId: string;
  gapKind: string;
  gapKey: string | null;
  reviewState: string;
  recommendedOwnerAction: string | null;
  recommendedRoute: string | null;
  proposedTerm: string | null;
  proposedRelation: string | null;
  sourceSpecCount: number;
  affectedGeneratedArtifactCount: number;
  sourceSpecs: readonly {
    specId: string;
    path: string | null;
    source: string | null;
    term: string | null;
    classification: string | null;
  }[];
};

export type OntologyWorkbenchComplianceEntry = {
  specId: string;
  path: string | null;
  validationStatus: string;
  findingCount: number;
  terms: readonly string[];
  findings: readonly {
    findingId: string;
    severity: string;
    classification: string;
    term: string | null;
    gapRef: string | null;
    suggestedAction: string | null;
  }[];
};

export type OntologyWorkbenchWriteGateFinding = {
  findingId: string;
  severity: string;
  message: string;
  sourceRef: string | null;
};

export type OntologyWorkbenchOwnerDecisionReview = {
  reviewId: string;
  decisionId: string | null;
  decisionState: string;
  reviewState: string;
  candidateId: string | null;
  gapGroupId: string | null;
  matchedGapGroupId: string | null;
  importRecommended: boolean;
  requiredHumanAction: string | null;
  beforeSemanticStatus: string | null;
  afterSemanticStatus: string | null;
  evidenceRefs: readonly string[];
};

export type OntologyWorkbenchLegacyBatch = {
  batchId: string;
  reviewState: string;
  recommendedPrScope: string | null;
  specCount: number;
  findingCount: number;
  writesOntologyPackage: boolean;
  mutatesCanonicalSpecs: boolean;
  specs: readonly {
    specId: string;
    path: string | null;
    findingCount: number;
    unknownTerms: readonly string[];
  }[];
};

export type OntologyWorkbenchLayerRow = {
  layer: string;
  packageEntryCount: number;
  gapCount: number;
  diffChangeCount: number;
  totalCount: number;
};

export type OntologyWorkbenchLayerDiffRef = {
  changeType: string;
  ref: string;
};

export type OntologyWorkbenchLayers = {
  knownLayers: readonly string[];
  rows: readonly OntologyWorkbenchLayerRow[];
  summary: {
    knownLayerCount: number;
    usedLayerCount: number;
    packageLayeredEntryCount: number;
    packageUnlayeredEntryCount: number;
    gapUnassignedLayerCount: number;
    diffUnassignedChangeCount: number;
  };
  unassigned: {
    gapCount: number;
    diffChangeCount: number;
    diffRefs: readonly OntologyWorkbenchLayerDiffRef[];
  };
};

export type OntologyWorkbenchApplicabilityScope = {
  domains: readonly string[];
  lifecyclePhases: readonly string[];
  agentTypes: readonly string[];
  subsystems: readonly string[];
  runtimes: readonly string[];
  platforms: readonly string[];
  contexts: readonly string[];
};

export type OntologyWorkbenchApplicabilityRecord = {
  id: string;
  layer: string | null;
  text: string;
};

export type OntologyWorkbenchApplicabilityProfile = {
  packageId: string;
  packageRef: string;
  status: string;
  appliesTo: OntologyWorkbenchApplicabilityScope;
  excludes: OntologyWorkbenchApplicabilityScope;
  assumptions: readonly OntologyWorkbenchApplicabilityRecord[];
  invalidationTriggers: readonly OntologyWorkbenchApplicabilityRecord[];
  summary: {
    assumptionCount: number;
    invalidationTriggerCount: number;
    usedLayers: readonly string[];
  };
};

export type OntologyWorkbenchApplicability = {
  summary: {
    profileCount: number;
    assumptionCount: number;
    invalidationTriggerCount: number;
    usedLayerCount: number;
    usedLayers: readonly string[];
    layerCounts: Record<string, number>;
  };
  profiles: readonly OntologyWorkbenchApplicabilityProfile[];
};

export type OntologyWorkbenchDiffClassificationChange = {
  kind: string;
  ref: string;
  targetKind: string | null;
  before: string | null;
  after: string | null;
  compatibility: string | null;
};

export type OntologyWorkbenchDiffClassification = {
  summary: {
    structuralChangeCount: number;
    annotationChangeCount: number;
    applicabilityChangeCount: number;
    totalChangeCount: number;
  };
  structuralChanges: readonly OntologyWorkbenchDiffClassificationChange[];
  annotationChanges: readonly OntologyWorkbenchDiffClassificationChange[];
  applicabilityChanges: readonly OntologyWorkbenchDiffClassificationChange[];
};

export type OntologyWorkbenchArtifactStatus = {
  available: boolean;
  path: string;
  reason: string | null;
  artifactKind: string | null;
  schemaVersion: number | null;
  status: string | null;
  summary: Record<string, unknown> | null;
};

export type OntologyWorkbench = {
  apiVersion: "v1";
  artifactKind: "specspace_ontology_workbench";
  schemaVersion: 1;
  generatedAt: string;
  readOnly: true;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  source: Record<string, unknown>;
  summary: OntologyWorkbenchSummary;
  package: OntologyWorkbenchPackage | null;
  normalizedIr: {
    available: boolean;
    id: string | null;
    namespace: string | null;
    version: string | null;
    classes: readonly OntologyWorkbenchIrClass[];
    relations: readonly OntologyWorkbenchIrRelation[];
  };
  domains: readonly Record<string, unknown>[];
  layers: OntologyWorkbenchLayers;
  applicability: OntologyWorkbenchApplicability;
  diffClassification: OntologyWorkbenchDiffClassification;
  gapReview: {
    summary: Record<string, unknown>;
    groups: readonly OntologyWorkbenchGapGroup[];
  };
  compliance: {
    summary: Record<string, unknown>;
    entries: readonly OntologyWorkbenchComplianceEntry[];
  };
  writeGate: {
    summary: Record<string, unknown>;
    findings: readonly OntologyWorkbenchWriteGateFinding[];
    wouldRejectInHardGate: boolean;
    writeDecision: string | null;
  };
  ownerDecisions: {
    summary: Record<string, unknown>;
    reviews: readonly OntologyWorkbenchOwnerDecisionReview[];
  };
  legacyBackfill: {
    summary: Record<string, unknown>;
    smallPrBatches: readonly OntologyWorkbenchLegacyBatch[];
  };
  artifacts: Record<string, OntologyWorkbenchArtifactStatus>;
  displayLimits: Record<string, number>;
  authorityBoundary: {
    ontologyWorkbenchIsAuthority: false;
    practicalOntologyIsAuthority: false;
    mayWriteOntologyPackage: false;
    mayUpdateOntologyLockfile: false;
    mayMutateCanonicalSpecs: false;
    mayMarkCandidateAccepted: false;
    mayImportOwnerDecision: false;
    mayCloseSemanticGate: false;
  };
};

export type UseOntologyWorkbenchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: OntologyWorkbench }
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

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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

function parsePackage(raw: unknown): OntologyWorkbenchPackage | null {
  if (!isRecord(raw)) return null;
  const packageId = optionalString(raw.package_id);
  if (!packageId) return null;
  return {
    packageId,
    namespace: stringValue(raw.namespace, "unknown"),
    version: stringValue(raw.version, "unknown"),
    packageRef: stringValue(raw.package_ref, packageId),
    authorityClass: stringValue(raw.authority_class, "unknown"),
    sourceRef: optionalString(raw.source_ref),
    sourceUri: optionalString(raw.source_uri),
    digest: optionalString(raw.digest),
    materializedIr: optionalString(raw.materialized_ir),
    acceptedByProposal: optionalString(raw.accepted_by_proposal),
  };
}

function parseIrClass(raw: Record<string, unknown>): OntologyWorkbenchIrClass | null {
  const id = optionalString(raw.id);
  if (!id) return null;
  return {
    id,
    fqid: optionalString(raw.fqid),
    uri: optionalString(raw.uri),
    description: optionalString(raw.description),
  };
}

function parseIrRelation(raw: Record<string, unknown>): OntologyWorkbenchIrRelation | null {
  const id = optionalString(raw.id);
  if (!id) return null;
  return {
    id,
    fqid: optionalString(raw.fqid),
    domain: optionalString(raw.domain),
    range: optionalString(raw.range),
    uri: optionalString(raw.uri),
    description: optionalString(raw.description),
  };
}

function parseGapGroup(raw: Record<string, unknown>): OntologyWorkbenchGapGroup | null {
  const groupId = optionalString(raw.group_id);
  if (!groupId) return null;
  return {
    groupId,
    gapKind: stringValue(raw.gap_kind, "unknown"),
    gapKey: optionalString(raw.gap_key),
    reviewState: stringValue(raw.review_state, "unknown"),
    recommendedOwnerAction: optionalString(raw.recommended_owner_action),
    recommendedRoute: optionalString(raw.recommended_route),
    proposedTerm: optionalString(raw.proposed_term),
    proposedRelation: optionalString(raw.proposed_relation),
    sourceSpecCount: numberValue(raw.source_spec_count),
    affectedGeneratedArtifactCount: numberValue(raw.affected_generated_artifact_count),
    sourceSpecs: records(raw.source_specs).flatMap((spec) => {
      const specId = optionalString(spec.spec_id);
      if (!specId) return [];
      return {
        specId,
        path: optionalString(spec.path),
        source: optionalString(spec.source),
        term: optionalString(spec.term),
        classification: optionalString(spec.classification),
      };
    }),
  };
}

function parseComplianceEntry(
  raw: Record<string, unknown>,
): OntologyWorkbenchComplianceEntry | null {
  const specId = optionalString(raw.spec_id);
  if (!specId) return null;
  return {
    specId,
    path: optionalString(raw.path),
    validationStatus: stringValue(raw.validation_status, "unknown"),
    findingCount: numberValue(raw.finding_count),
    terms: stringList(raw.terms),
    findings: records(raw.findings).flatMap((finding) => {
      const findingId = optionalString(finding.finding_id);
      if (!findingId) return [];
      return {
        findingId,
        severity: stringValue(finding.severity, "unknown"),
        classification: stringValue(finding.classification, "unknown"),
        term: optionalString(finding.term),
        gapRef: optionalString(finding.gap_ref),
        suggestedAction: optionalString(finding.suggested_action),
      };
    }),
  };
}

function parseWriteGateFinding(
  raw: Record<string, unknown>,
): OntologyWorkbenchWriteGateFinding | null {
  const findingId = optionalString(raw.finding_id);
  if (!findingId) return null;
  return {
    findingId,
    severity: stringValue(raw.severity, "unknown"),
    message: stringValue(raw.message, "Write gate finding."),
    sourceRef: optionalString(raw.source_ref),
  };
}

function parseOwnerDecisionReview(
  raw: Record<string, unknown>,
): OntologyWorkbenchOwnerDecisionReview | null {
  const reviewId = optionalString(raw.review_id);
  if (!reviewId) return null;
  return {
    reviewId,
    decisionId: optionalString(raw.decision_id),
    decisionState: stringValue(raw.decision_state, "unknown"),
    reviewState: stringValue(raw.review_state, "unknown"),
    candidateId: optionalString(raw.candidate_id),
    gapGroupId: optionalString(raw.gap_group_id),
    matchedGapGroupId: optionalString(raw.matched_gap_group_id),
    importRecommended: boolValue(raw.import_recommended),
    requiredHumanAction: optionalString(raw.required_human_action),
    beforeSemanticStatus: optionalString(raw.before_semantic_status),
    afterSemanticStatus: optionalString(raw.after_semantic_status),
    evidenceRefs: stringList(raw.evidence_refs),
  };
}

function parseLegacyBatch(raw: Record<string, unknown>): OntologyWorkbenchLegacyBatch | null {
  const batchId = optionalString(raw.batch_id);
  if (!batchId) return null;
  return {
    batchId,
    reviewState: stringValue(raw.review_state, "unknown"),
    recommendedPrScope: optionalString(raw.recommended_pr_scope),
    specCount: numberValue(raw.spec_count),
    findingCount: numberValue(raw.finding_count),
    writesOntologyPackage: boolValue(raw.writes_ontology_package),
    mutatesCanonicalSpecs: boolValue(raw.mutates_canonical_specs),
    specs: records(raw.specs).flatMap((spec) => {
      const specId = optionalString(spec.spec_id);
      if (!specId) return [];
      return {
        specId,
        path: optionalString(spec.path),
        findingCount: numberValue(spec.finding_count),
        unknownTerms: stringList(spec.unknown_terms),
      };
    }),
  };
}

function parseLayers(raw: unknown): OntologyWorkbenchLayers {
  const data = recordValue(raw);
  const summary = recordValue(data.summary);
  const unassigned = recordValue(data.unassigned);
  return {
    knownLayers: stringList(data.known_layers),
    rows: records(data.rows).flatMap((item) => {
      const layer = optionalString(item.layer);
      if (!layer) return [];
      return {
        layer,
        packageEntryCount: numberValue(item.package_entry_count),
        gapCount: numberValue(item.gap_count),
        diffChangeCount: numberValue(item.diff_change_count),
        totalCount: numberValue(item.total_count),
      };
    }),
    summary: {
      knownLayerCount: numberValue(summary.known_layer_count),
      usedLayerCount: numberValue(summary.used_layer_count),
      packageLayeredEntryCount: numberValue(summary.package_layered_entry_count),
      packageUnlayeredEntryCount: numberValue(summary.package_unlayered_entry_count),
      gapUnassignedLayerCount: numberValue(summary.gap_unassigned_layer_count),
      diffUnassignedChangeCount: numberValue(summary.diff_unassigned_change_count),
    },
    unassigned: {
      gapCount: numberValue(unassigned.gap_count),
      diffChangeCount: numberValue(unassigned.diff_change_count),
      diffRefs: records(unassigned.diff_refs).flatMap((item) => {
        const ref = optionalString(item.ref);
        if (!ref) return [];
        return {
          ref,
          changeType: stringValue(item.change_type, "unknown"),
        };
      }),
    },
  };
}

function parseApplicabilityScope(raw: unknown): OntologyWorkbenchApplicabilityScope {
  const data = recordValue(raw);
  return {
    domains: stringList(data.domains),
    lifecyclePhases: stringList(data.lifecycle_phases),
    agentTypes: stringList(data.agent_types),
    subsystems: stringList(data.subsystems),
    runtimes: stringList(data.runtimes),
    platforms: stringList(data.platforms),
    contexts: stringList(data.contexts),
  };
}

function parseApplicabilityRecord(
  raw: Record<string, unknown>,
): OntologyWorkbenchApplicabilityRecord | null {
  const id = optionalString(raw.id);
  if (!id) return null;
  return {
    id,
    layer: optionalString(raw.layer),
    text: stringValue(raw.text, "No text supplied."),
  };
}

function parseApplicability(raw: unknown): OntologyWorkbenchApplicability {
  const data = recordValue(raw);
  const summary = recordValue(data.summary);
  return {
    summary: {
      profileCount: numberValue(summary.profile_count),
      assumptionCount: numberValue(summary.assumption_count),
      invalidationTriggerCount: numberValue(summary.invalidation_trigger_count),
      usedLayerCount: numberValue(summary.used_layer_count),
      usedLayers: stringList(summary.used_layers),
      layerCounts: Object.fromEntries(
        Object.entries(recordValue(summary.layer_counts)).flatMap(([key, value]) =>
          typeof value === "number" && Number.isFinite(value) && value >= 0
            ? [[key, value]]
            : [],
        ),
      ),
    },
    profiles: records(data.profiles).flatMap((profile) => {
      const packageId = optionalString(profile.package_id);
      if (!packageId) return [];
      const profileSummary = recordValue(profile.summary);
      return {
        packageId,
        packageRef: stringValue(profile.package_ref, packageId),
        status: stringValue(profile.status, "unknown"),
        appliesTo: parseApplicabilityScope(profile.applies_to),
        excludes: parseApplicabilityScope(profile.excludes),
        assumptions: records(profile.assumptions).flatMap((item) => {
          const parsed = parseApplicabilityRecord(item);
          return parsed ? [parsed] : [];
        }),
        invalidationTriggers: records(profile.invalidation_triggers).flatMap((item) => {
          const parsed = parseApplicabilityRecord(item);
          return parsed ? [parsed] : [];
        }),
        summary: {
          assumptionCount: numberValue(profileSummary.assumption_count),
          invalidationTriggerCount: numberValue(
            profileSummary.invalidation_trigger_count,
          ),
          usedLayers: stringList(profileSummary.used_layers),
        },
      };
    }),
  };
}

function parseDiffClassificationChange(
  raw: Record<string, unknown>,
): OntologyWorkbenchDiffClassificationChange | null {
  const ref = optionalString(raw.ref);
  if (!ref) return null;
  return {
    kind: stringValue(raw.kind, "unknown"),
    ref,
    targetKind: optionalString(raw.target_kind),
    before: optionalString(raw.before),
    after: optionalString(raw.after),
    compatibility: optionalString(raw.compatibility),
  };
}

function parseDiffClassification(raw: unknown): OntologyWorkbenchDiffClassification {
  const data = recordValue(raw);
  const summary = recordValue(data.summary);
  const parseChanges = (value: unknown) =>
    records(value).flatMap((item) => {
      const parsed = parseDiffClassificationChange(item);
      return parsed ? [parsed] : [];
    });
  return {
    summary: {
      structuralChangeCount: numberValue(summary.structural_change_count),
      annotationChangeCount: numberValue(summary.annotation_change_count),
      applicabilityChangeCount: numberValue(summary.applicability_change_count),
      totalChangeCount: numberValue(summary.total_change_count),
    },
    structuralChanges: parseChanges(data.structural_changes),
    annotationChanges: parseChanges(data.annotation_changes),
    applicabilityChanges: parseChanges(data.applicability_changes),
  };
}

function parseArtifactStatus(raw: unknown): OntologyWorkbenchArtifactStatus | null {
  if (!isRecord(raw)) return null;
  const path = optionalString(raw.path);
  if (!path) return null;
  return {
    available: raw.available === true,
    path,
    reason: optionalString(raw.reason),
    artifactKind: optionalString(raw.artifact_kind),
    schemaVersion:
      typeof raw.schema_version === "number" && Number.isFinite(raw.schema_version)
        ? raw.schema_version
        : null,
    status: optionalString(raw.status),
    summary: isRecord(raw.summary) ? raw.summary : null,
  };
}

function parseArtifacts(raw: unknown): Record<string, OntologyWorkbenchArtifactStatus> {
  if (!isRecord(raw)) return {};
  const entries: Record<string, OntologyWorkbenchArtifactStatus> = {};
  for (const [key, value] of Object.entries(raw)) {
    const parsed = parseArtifactStatus(value);
    if (parsed) entries[key] = parsed;
  }
  return entries;
}

export function parseOntologyWorkbench(raw: unknown): UseOntologyWorkbenchState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", reason: "response root is not an object", raw };
  }
  if (raw.api_version !== "v1" || raw.artifact_kind !== "specspace_ontology_workbench") {
    return { kind: "parse-error", reason: "response is not an ontology workbench artifact", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", reason: "unsupported ontology workbench schema_version", raw };
  }
  if (
    raw.read_only !== true ||
    raw.canonical_mutations_allowed !== false ||
    raw.tracked_artifacts_written !== false
  ) {
    return { kind: "parse-error", reason: "ontology workbench must be read-only", raw };
  }
  const boundary = recordValue(raw.authority_boundary);
  const falseBoundaryFlags = [
    "ontology_workbench_is_authority",
    "practical_ontology_is_authority",
    "may_write_ontology_package",
    "may_update_ontology_lockfile",
    "may_mutate_canonical_specs",
    "may_mark_candidate_accepted",
    "may_import_owner_decision",
    "may_close_semantic_gate",
  ];
  for (const flag of falseBoundaryFlags) {
    if (boundary[flag] !== false) {
      return { kind: "parse-error", reason: `authority boundary expanded: ${flag}`, raw };
    }
  }

  const summary = recordValue(raw.summary);
  const normalizedIr = recordValue(raw.normalized_ir);
  const gapReview = recordValue(raw.gap_review);
  const compliance = recordValue(raw.compliance);
  const writeGate = recordValue(raw.write_gate);
  const ownerDecisions = recordValue(raw.owner_decisions);
  const legacyBackfill = recordValue(raw.legacy_backfill);

  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_ontology_workbench",
      schemaVersion: 1,
      generatedAt: stringValue(raw.generated_at, ""),
      readOnly: true,
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      source: recordValue(raw.source),
      summary: {
        status: stringValue(summary.status, "unknown"),
        termCount: numberValue(summary.term_count),
        relationCount: numberValue(summary.relation_count),
        domainCount: numberValue(summary.domain_count),
        packageCount: numberValue(summary.package_count),
        gapCount: numberValue(summary.gap_count),
        gapGroupCount: numberValue(summary.gap_group_count),
        complianceSpecCount: numberValue(summary.compliance_spec_count),
        complianceFindingCount: numberValue(summary.compliance_finding_count),
        writeGateFindingCount: numberValue(summary.write_gate_finding_count),
        ownerDecisionReviewCount: numberValue(summary.owner_decision_review_count),
        ownerDecisionImportableCount: numberValue(summary.owner_decision_importable_count),
        legacySpecCount: numberValue(summary.legacy_spec_count),
        legacyReviewRequiredSpecCount: numberValue(summary.legacy_review_required_spec_count),
        legacySmallPrBatchCount: numberValue(summary.legacy_small_pr_batch_count),
        missingArtifactCount: numberValue(summary.missing_artifact_count),
        nextGap: optionalString(summary.next_gap),
      },
      package: parsePackage(raw.package),
      normalizedIr: {
        available: normalizedIr.available === true,
        id: optionalString(normalizedIr.id),
        namespace: optionalString(normalizedIr.namespace),
        version: optionalString(normalizedIr.version),
        classes: records(normalizedIr.classes).flatMap((item) => {
          const parsed = parseIrClass(item);
          return parsed ? [parsed] : [];
        }),
        relations: records(normalizedIr.relations).flatMap((item) => {
          const parsed = parseIrRelation(item);
          return parsed ? [parsed] : [];
        }),
      },
      domains: records(raw.domains),
      layers: parseLayers(raw.layers),
      applicability: parseApplicability(raw.applicability),
      diffClassification: parseDiffClassification(raw.diff_classification),
      gapReview: {
        summary: recordValue(gapReview.summary),
        groups: records(gapReview.groups).flatMap((item) => {
          const parsed = parseGapGroup(item);
          return parsed ? [parsed] : [];
        }),
      },
      compliance: {
        summary: recordValue(compliance.summary),
        entries: records(compliance.entries).flatMap((item) => {
          const parsed = parseComplianceEntry(item);
          return parsed ? [parsed] : [];
        }),
      },
      writeGate: {
        summary: recordValue(writeGate.summary),
        findings: records(writeGate.findings).flatMap((item) => {
          const parsed = parseWriteGateFinding(item);
          return parsed ? [parsed] : [];
        }),
        wouldRejectInHardGate: writeGate.would_reject_in_hard_gate === true,
        writeDecision: optionalString(writeGate.write_decision),
      },
      ownerDecisions: {
        summary: recordValue(ownerDecisions.summary),
        reviews: records(ownerDecisions.reviews).flatMap((item) => {
          const parsed = parseOwnerDecisionReview(item);
          return parsed ? [parsed] : [];
        }),
      },
      legacyBackfill: {
        summary: recordValue(legacyBackfill.summary),
        smallPrBatches: records(legacyBackfill.small_pr_batches).flatMap((item) => {
          const parsed = parseLegacyBatch(item);
          return parsed ? [parsed] : [];
        }),
      },
      artifacts: parseArtifacts(raw.artifacts),
      displayLimits: Object.fromEntries(
        Object.entries(recordValue(raw.display_limits)).flatMap(([key, value]) =>
          typeof value === "number" && Number.isFinite(value) ? [[key, value]] : [],
        ),
      ),
      authorityBoundary: {
        ontologyWorkbenchIsAuthority: false,
        practicalOntologyIsAuthority: false,
        mayWriteOntologyPackage: false,
        mayUpdateOntologyLockfile: false,
        mayMutateCanonicalSpecs: false,
        mayMarkCandidateAccepted: false,
        mayImportOwnerDecision: false,
        mayCloseSemanticGate: false,
      },
    },
  };
}

export function useOntologyWorkbench(options: Options = {}): UseOntologyWorkbenchState {
  const { url = "/api/v1/ontology-workbench", fetcher = fetch, refreshKey = 0 } = options;
  const [state, setState] = useState<UseOntologyWorkbenchState>({ kind: "idle" });

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
            // Non-JSON proxy failures are possible in production deploys.
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
            setState({ kind: "response-error", reason: "response was not valid JSON", raw: error });
          }
          return;
        }

        if (!cancelled) setState(parseOntologyWorkbench(payload));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, fetcher, refreshKey]);

  return state;
}
