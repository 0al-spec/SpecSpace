import { useEffect, useState } from "react";

export type PracticalOntologyTerm = {
  termId: string;
  label: string;
  kind: string;
  domain: string;
  canonicalRef: string | null;
  description: string | null;
  sourceRefs: readonly string[];
  evidenceCount: number;
};

export type PracticalOntologyRelation = {
  relationId: string;
  sourceTerm: string;
  relation: string;
  targetTerm: string;
  sourceRefs: readonly string[];
  evidenceCount: number;
};

export type PracticalOntologyTopologyEdge = {
  edgeId: string;
  sourceId: string;
  sourceTitle: string;
  relation: string;
  targetId: string;
  targetTitle: string;
  displayLabel: string;
  sourceRefs: readonly string[];
  evidenceCount: number;
  authorityClass: string;
};

export type PracticalOntologyProposalReference = {
  referenceId: string;
  proposalId: string;
  proposalTitle: string;
  relation: string;
  targetSpecId: string;
  displayLabel: string;
  sourceRefs: readonly string[];
  evidenceCount: number;
  authorityClass: string;
};

export type PracticalOntologyDomain = {
  domainId: string;
  label: string;
  termCount: number;
  termKinds: readonly string[];
  sourceRefs: readonly string[];
};

export type PracticalOntology = {
  apiVersion: "v1";
  artifactKind: "specspace_practical_ontology";
  schemaVersion: 1;
  generatedAt: string;
  readOnly: true;
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  source: Record<string, unknown>;
  sources: Record<string, unknown>;
  summary: {
    termCount: number;
    relationCount: number;
    semanticRelationCount: number;
    topologyEdgeCount: number;
    proposalReferenceCount: number;
    domainCount: number;
    sourceCount: number;
  };
  domains: readonly PracticalOntologyDomain[];
  terms: readonly PracticalOntologyTerm[];
  relations: readonly PracticalOntologyRelation[];
  topologyEdges: readonly PracticalOntologyTopologyEdge[];
  proposalReferences: readonly PracticalOntologyProposalReference[];
  relationTaxonomy: Record<string, unknown>;
  authorityBoundary: {
    practicalOntologyIsAuthority: false;
    derivedFromSpecgraphSources: boolean;
    mayWriteOntologyPackage: false;
    mayMutateCanonicalSpecs: false;
    mayMarkCandidateAccepted: false;
  };
};

export type UsePracticalOntologyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: PracticalOntology }
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

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function parseTerm(raw: unknown): PracticalOntologyTerm | null {
  if (!isRecord(raw)) return null;
  const termId = optionalString(raw.term_id);
  const label = optionalString(raw.label);
  if (!termId || !label) return null;
  return {
    termId,
    label,
    kind: stringValue(raw.kind, "unknown"),
    domain: stringValue(raw.domain, "SpecGraph"),
    canonicalRef: optionalString(raw.canonical_ref),
    description: optionalString(raw.description),
    sourceRefs: stringList(raw.source_refs),
    evidenceCount: numberValue(raw.evidence_count),
  };
}

function parseRelation(raw: unknown): PracticalOntologyRelation | null {
  if (!isRecord(raw)) return null;
  const relationId = optionalString(raw.relation_id);
  const sourceTerm = optionalString(raw.source_term);
  const relation = optionalString(raw.relation);
  const targetTerm = optionalString(raw.target_term);
  if (!relationId || !sourceTerm || !relation || !targetTerm) return null;
  return {
    relationId,
    sourceTerm,
    relation,
    targetTerm,
    sourceRefs: stringList(raw.source_refs),
    evidenceCount: numberValue(raw.evidence_count),
  };
}

function parseTopologyEdge(raw: unknown): PracticalOntologyTopologyEdge | null {
  if (!isRecord(raw)) return null;
  const edgeId = optionalString(raw.edge_id);
  const sourceId = optionalString(raw.source_id);
  const relation = optionalString(raw.relation);
  const targetId = optionalString(raw.target_id);
  if (!edgeId || !sourceId || !relation || !targetId) return null;
  return {
    edgeId,
    sourceId,
    sourceTitle: stringValue(raw.source_title, sourceId),
    relation,
    targetId,
    targetTitle: stringValue(raw.target_title, targetId),
    displayLabel: stringValue(raw.display_label, `${sourceId} ${relation} ${targetId}`),
    sourceRefs: stringList(raw.source_refs),
    evidenceCount: numberValue(raw.evidence_count),
    authorityClass: stringValue(raw.authority_class, "specgraph_topology"),
  };
}

function parseProposalReference(raw: unknown): PracticalOntologyProposalReference | null {
  if (!isRecord(raw)) return null;
  const referenceId = optionalString(raw.reference_id);
  const proposalId = optionalString(raw.proposal_id);
  const relation = optionalString(raw.relation);
  const targetSpecId = optionalString(raw.target_spec_id);
  if (!referenceId || !proposalId || !relation || !targetSpecId) return null;
  return {
    referenceId,
    proposalId,
    proposalTitle: stringValue(raw.proposal_title, proposalId),
    relation,
    targetSpecId,
    displayLabel: stringValue(raw.display_label, `${proposalId} ${relation} ${targetSpecId}`),
    sourceRefs: stringList(raw.source_refs),
    evidenceCount: numberValue(raw.evidence_count),
    authorityClass: stringValue(raw.authority_class, "proposal_reference"),
  };
}

function parseDomain(raw: unknown): PracticalOntologyDomain | null {
  if (!isRecord(raw)) return null;
  const domainId = optionalString(raw.domain_id);
  const label = optionalString(raw.label);
  if (!domainId || !label) return null;
  return {
    domainId,
    label,
    termCount: numberValue(raw.term_count),
    termKinds: stringList(raw.term_kinds),
    sourceRefs: stringList(raw.source_refs),
  };
}

function parsePracticalOntology(raw: unknown): UsePracticalOntologyState {
  if (!isRecord(raw)) {
    return { kind: "parse-error", reason: "response root is not an object", raw };
  }
  if (raw.api_version !== "v1" || raw.artifact_kind !== "specspace_practical_ontology") {
    return { kind: "parse-error", reason: "response is not a practical ontology artifact", raw };
  }
  if (raw.schema_version !== 1) {
    return { kind: "parse-error", reason: "unsupported practical ontology schema_version", raw };
  }
  if (
    raw.read_only !== true ||
    raw.canonical_mutations_allowed !== false ||
    raw.tracked_artifacts_written !== false
  ) {
    return { kind: "parse-error", reason: "practical ontology must be read-only", raw };
  }
  const boundary = recordValue(raw.authority_boundary);
  if (
    boundary.practical_ontology_is_authority !== false ||
    boundary.may_write_ontology_package !== false ||
    boundary.may_mutate_canonical_specs !== false ||
    boundary.may_mark_candidate_accepted !== false
  ) {
    return { kind: "parse-error", reason: "practical ontology authority boundary expanded", raw };
  }

  const terms = Array.isArray(raw.terms) ? raw.terms.map(parseTerm).filter(isPresent) : [];
  const relations = Array.isArray(raw.relations)
    ? raw.relations.map(parseRelation).filter(isPresent)
    : [];
  const topologyEdges = Array.isArray(raw.topology_edges)
    ? raw.topology_edges.map(parseTopologyEdge).filter(isPresent)
    : [];
  const proposalReferences = Array.isArray(raw.proposal_references)
    ? raw.proposal_references.map(parseProposalReference).filter(isPresent)
    : [];
  const domains = Array.isArray(raw.domains) ? raw.domains.map(parseDomain).filter(isPresent) : [];
  const summary = recordValue(raw.summary);

  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_practical_ontology",
      schemaVersion: 1,
      generatedAt: stringValue(raw.generated_at, ""),
      readOnly: true,
      canonicalMutationsAllowed: false,
      trackedArtifactsWritten: false,
      source: recordValue(raw.source),
      sources: recordValue(raw.sources),
      summary: {
        termCount: numberValue(summary.term_count),
        relationCount: numberValue(summary.relation_count),
        semanticRelationCount: numberValue(summary.semantic_relation_count),
        topologyEdgeCount: numberValue(summary.topology_edge_count),
        proposalReferenceCount: numberValue(summary.proposal_reference_count),
        domainCount: numberValue(summary.domain_count),
        sourceCount: numberValue(summary.source_count),
      },
      domains,
      terms,
      relations,
      topologyEdges,
      proposalReferences,
      relationTaxonomy: recordValue(raw.relation_taxonomy),
      authorityBoundary: {
        practicalOntologyIsAuthority: false,
        derivedFromSpecgraphSources: boundary.derived_from_specgraph_sources === true,
        mayWriteOntologyPackage: false,
        mayMutateCanonicalSpecs: false,
        mayMarkCandidateAccepted: false,
      },
    },
  };
}

export function usePracticalOntology(options: Options = {}): UsePracticalOntologyState {
  const { url = "/api/v1/practical-ontology", fetcher = fetch, refreshKey = 0 } = options;
  const [state, setState] = useState<UsePracticalOntologyState>({ kind: "idle" });

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

        if (!cancelled) setState(parsePracticalOntology(payload));
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
