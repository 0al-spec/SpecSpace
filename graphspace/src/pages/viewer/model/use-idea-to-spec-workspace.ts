import { useEffect, useState } from "react";

export type IdeaToSpecArtifactStatus = {
  available: boolean;
  path: string;
  reason: string | null;
  artifactKind: string | null;
  status: string | null;
  proposalId: string | null;
  contractRef: string | null;
};

export type IdeaToSpecActiveFrame = {
  project: string | null;
  subsystem: string | null;
  agentLayer: string | null;
  targetArtifact: string | null;
  lifecyclePhase: string | null;
  ontologyRefs: readonly string[];
  ontologyLayerRefs: readonly string[];
  modelApplicabilityRefs: readonly string[];
  domainRefs: readonly string[];
  contextRefs: readonly string[];
};

export type IdeaToSpecCandidateNode = {
  id: string;
  title: string | null;
  kind: string | null;
  ontologyRefs: readonly string[];
  requirementCount: number;
  acceptanceCriteriaCount: number;
  claimCount: number;
  gapCount: number;
};

export type IdeaToSpecFinding = {
  findingId: string;
  severity: string;
  message: string;
  sourceRef: string | null;
};

export type IdeaToSpecRepairAction = {
  id: string;
  kind: string;
  status: string;
  targetRef: string | null;
  rationale: string | null;
  sourceFindings: readonly string[];
};

export type IdeaToSpecWorkspace = {
  apiVersion: "v1";
  artifactKind: "specspace_idea_to_spec_workspace";
  schemaVersion: number;
  readOnly: true;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  source: Record<string, unknown>;
  summary: {
    status: string;
    availableArtifactCount: number;
    missingArtifactCount: number;
    candidateNodeCount: number;
    candidateEdgeCount: number;
    preSibFindingCount: number;
    repairActionCount: number;
    repairContextRequiredCount: number;
    nextArtifact: string | null;
  };
  intake: {
    available: boolean;
    activeFrame: IdeaToSpecActiveFrame;
    summary: {
      actorCount: number;
      domainEventCount: number;
      commandCount: number;
      policyCount: number;
      externalSystemCount: number;
      constraintCount: number;
      vocabularyQuestionCount: number;
      contextCompletionQuestionCount: number;
    };
  };
  candidateGraph: {
    available: boolean;
    activeFrame: IdeaToSpecActiveFrame;
    summary: {
      nodeCount: number;
      edgeCount: number;
      requirementCount: number;
      acceptanceCriteriaCount: number;
      claimCount: number;
      gapCount: number;
    };
    preSibReadiness: Record<string, unknown>;
    nodes: readonly IdeaToSpecCandidateNode[];
  };
  preSib: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    metrics: Record<string, unknown>;
    findings: readonly IdeaToSpecFinding[];
  };
  repairLoop: {
    available: boolean;
    readiness: {
      ready: boolean;
      reviewState: string | null;
      blockedBy: readonly string[];
      nextArtifact: string | null;
    };
    summary: Record<string, unknown>;
    metricDeltaProjection: Record<string, unknown>;
    actions: readonly IdeaToSpecRepairAction[];
  };
  artifacts: Record<string, IdeaToSpecArtifactStatus>;
  authorityBoundary: {
    ideaToSpecWorkspaceIsAuthority: false;
    mayExecutePromptAgent: false;
    mayMutateCandidateSourceArtifacts: false;
    mayMutateCanonicalSpecs: false;
    mayWriteOntologyPackage: false;
    mayCreateBranchOrCommit: false;
    mayMarkCandidateAccepted: false;
  };
};

export type UseIdeaToSpecWorkspaceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: IdeaToSpecWorkspace }
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseActiveFrame(raw: unknown): IdeaToSpecActiveFrame {
  const frame = recordValue(raw);
  return {
    project: optionalString(frame.project),
    subsystem: optionalString(frame.subsystem),
    agentLayer: optionalString(frame.agent_layer),
    targetArtifact: optionalString(frame.target_artifact),
    lifecyclePhase: optionalString(frame.lifecycle_phase),
    ontologyRefs: strings(frame.ontology_refs),
    ontologyLayerRefs: strings(frame.ontology_layer_refs),
    modelApplicabilityRefs: strings(frame.model_applicability_refs),
    domainRefs: strings(frame.domain_refs),
    contextRefs: strings(frame.context_refs),
  };
}

function parseReadiness(raw: unknown) {
  const readiness = recordValue(raw);
  return {
    ready: readiness.ready === true,
    reviewState: optionalString(readiness.review_state),
    blockedBy: strings(readiness.blocked_by),
    nextArtifact: optionalString(readiness.next_artifact),
  };
}

function parseArtifactStatus(raw: unknown): IdeaToSpecArtifactStatus {
  const status = recordValue(raw);
  return {
    available: status.available === true,
    path: stringValue(status.path, "runs/unknown.json"),
    reason: optionalString(status.reason),
    artifactKind: optionalString(status.artifact_kind),
    status: optionalString(status.status),
    proposalId: optionalString(status.proposal_id),
    contractRef: optionalString(status.contract_ref),
  };
}

function parseCandidateNode(raw: unknown): IdeaToSpecCandidateNode | null {
  const node = recordValue(raw);
  const id = optionalString(node.id);
  if (!id) return null;
  return {
    id,
    title: optionalString(node.title),
    kind: optionalString(node.kind),
    ontologyRefs: strings(node.ontology_refs),
    requirementCount: numberValue(node.requirement_count),
    acceptanceCriteriaCount: numberValue(node.acceptance_criteria_count),
    claimCount: numberValue(node.claim_count),
    gapCount: numberValue(node.gap_count),
  };
}

function parseFinding(raw: unknown): IdeaToSpecFinding | null {
  const finding = recordValue(raw);
  const findingId = optionalString(finding.finding_id);
  if (!findingId) return null;
  return {
    findingId,
    severity: stringValue(finding.severity, "unknown"),
    message: stringValue(finding.message, "No message supplied."),
    sourceRef: optionalString(finding.source_ref),
  };
}

function parseRepairAction(raw: unknown): IdeaToSpecRepairAction | null {
  const action = recordValue(raw);
  const id = optionalString(action.id);
  if (!id) return null;
  return {
    id,
    kind: stringValue(action.kind, "unknown"),
    status: stringValue(action.status, "unknown"),
    targetRef: optionalString(action.target_ref),
    rationale: optionalString(action.rationale),
    sourceFindings: strings(action.source_findings),
  };
}

export function parseIdeaToSpecWorkspace(
  raw: unknown,
): UseIdeaToSpecWorkspaceState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", reason: "response root is not an object", raw };
  }
  if (
    raw.api_version !== "v1" ||
    raw.artifact_kind !== "specspace_idea_to_spec_workspace"
  ) {
    return { kind: "parse-error", reason: "unexpected idea-to-spec artifact", raw };
  }
  if (
    raw.read_only !== true ||
    raw.canonical_mutations_allowed !== false ||
    raw.tracked_artifacts_written !== false
  ) {
    return { kind: "parse-error", reason: "idea-to-spec workspace must be read-only", raw };
  }
  const boundary = recordValue(raw.authority_boundary);
  const falseFlags = [
    "idea_to_spec_workspace_is_authority",
    "may_execute_prompt_agent",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_create_branch_or_commit",
    "may_mark_candidate_accepted",
  ];
  for (const flag of falseFlags) {
    if (boundary[flag] !== false) {
      return { kind: "parse-error", reason: `authority boundary expanded: ${flag}`, raw };
    }
  }
  const summary = recordValue(raw.summary);
  const intake = recordValue(raw.intake);
  const intakeSummary = recordValue(intake.summary);
  const candidateGraph = recordValue(raw.candidate_graph);
  const candidateSummary = recordValue(candidateGraph.summary);
  const preSib = recordValue(raw.pre_sib);
  const repairLoop = recordValue(raw.repair_loop);
  const artifacts = Object.fromEntries(
    Object.entries(recordValue(raw.artifacts)).map(([key, value]) => [
      key,
      parseArtifactStatus(value),
    ]),
  );
  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_idea_to_spec_workspace",
      schemaVersion: numberValue(raw.schema_version),
      readOnly: true,
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      source: recordValue(raw.source),
      summary: {
        status: stringValue(summary.status, "unknown"),
        availableArtifactCount: numberValue(summary.available_artifact_count),
        missingArtifactCount: numberValue(summary.missing_artifact_count),
        candidateNodeCount: numberValue(summary.candidate_node_count),
        candidateEdgeCount: numberValue(summary.candidate_edge_count),
        preSibFindingCount: numberValue(summary.pre_sib_finding_count),
        repairActionCount: numberValue(summary.repair_action_count),
        repairContextRequiredCount: numberValue(
          summary.repair_context_required_count,
        ),
        nextArtifact: optionalString(summary.next_artifact),
      },
      intake: {
        available: intake.available === true,
        activeFrame: parseActiveFrame(intake.active_frame),
        summary: {
          actorCount: numberValue(intakeSummary.actor_count),
          domainEventCount: numberValue(intakeSummary.domain_event_count),
          commandCount: numberValue(intakeSummary.command_count),
          policyCount: numberValue(intakeSummary.policy_count),
          externalSystemCount: numberValue(intakeSummary.external_system_count),
          constraintCount: numberValue(intakeSummary.constraint_count),
          vocabularyQuestionCount: numberValue(
            intakeSummary.vocabulary_question_count,
          ),
          contextCompletionQuestionCount: numberValue(
            intakeSummary.context_completion_question_count,
          ),
        },
      },
      candidateGraph: {
        available: candidateGraph.available === true,
        activeFrame: parseActiveFrame(candidateGraph.active_frame),
        summary: {
          nodeCount: numberValue(candidateSummary.node_count),
          edgeCount: numberValue(candidateSummary.edge_count),
          requirementCount: numberValue(candidateSummary.requirement_count),
          acceptanceCriteriaCount: numberValue(
            candidateSummary.acceptance_criteria_count,
          ),
          claimCount: numberValue(candidateSummary.claim_count),
          gapCount: numberValue(candidateSummary.gap_count),
        },
        preSibReadiness: recordValue(candidateGraph.pre_sib_readiness),
        nodes: records(candidateGraph.nodes).flatMap((item) => {
          const parsed = parseCandidateNode(item);
          return parsed ? [parsed] : [];
        }),
      },
      preSib: {
        available: preSib.available === true,
        readiness: parseReadiness(preSib.readiness),
        metrics: recordValue(preSib.metrics),
        findings: records(preSib.findings).flatMap((item) => {
          const parsed = parseFinding(item);
          return parsed ? [parsed] : [];
        }),
      },
      repairLoop: {
        available: repairLoop.available === true,
        readiness: parseReadiness(repairLoop.readiness),
        summary: recordValue(repairLoop.summary),
        metricDeltaProjection: recordValue(repairLoop.metric_delta_projection),
        actions: records(repairLoop.actions).flatMap((item) => {
          const parsed = parseRepairAction(item);
          return parsed ? [parsed] : [];
        }),
      },
      artifacts,
      authorityBoundary: {
        ideaToSpecWorkspaceIsAuthority: false,
        mayExecutePromptAgent: false,
        mayMutateCandidateSourceArtifacts: false,
        mayMutateCanonicalSpecs: false,
        mayWriteOntologyPackage: false,
        mayCreateBranchOrCommit: false,
        mayMarkCandidateAccepted: false,
      },
    },
  };
}

export function useIdeaToSpecWorkspace(
  options: Options = {},
): UseIdeaToSpecWorkspaceState {
  const {
    url = "/api/v1/idea-to-spec-workspace",
    fetcher = fetch,
    refreshKey = 0,
  } = options;
  const [state, setState] = useState<UseIdeaToSpecWorkspaceState>({
    kind: "idle",
  });

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
            setState({
              kind: "response-error",
              reason: "response was not valid JSON",
              raw: error,
            });
          }
          return;
        }

        if (!cancelled) setState(parseIdeaToSpecWorkspace(payload));
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
