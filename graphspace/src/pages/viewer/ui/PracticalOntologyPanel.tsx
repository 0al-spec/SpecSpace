import { useMemo, useState } from "react";
import type {
  PracticalOntologyDomain,
  PracticalOntologyProposalReference,
  PracticalOntologyRelation,
  PracticalOntologyTerm,
  PracticalOntologyTopologyEdge,
  UsePracticalOntologyState,
} from "../model/use-practical-ontology";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UsePracticalOntologyState;
};

function errorDetail(
  state: Exclude<UsePracticalOntologyState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Practical ontology endpoint is unreachable from the browser.";
    case "response-error":
    case "parse-error":
      return state.reason;
  }
}

function compact(value: string | null | undefined, fallback = "unknown"): string {
  return value && value.length > 0 ? value : fallback;
}

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function sourceLabel(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "source";
  const record = value as Record<string, unknown>;
  if (typeof record.provider === "string") return record.provider;
  return "source";
}

export function PracticalOntologyPanel({ state }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (state.kind !== "ok") {
      return { terms: [], relations: [], topologyEdges: [], proposalReferences: [], domains: [] };
    }
    if (!normalizedQuery) {
      return {
        terms: state.data.terms,
        relations: state.data.relations,
        topologyEdges: state.data.topologyEdges,
        proposalReferences: state.data.proposalReferences,
        domains: state.data.domains,
      };
    }
    const matches = (value: string | null | undefined) =>
      compact(value, "").toLowerCase().includes(normalizedQuery);
    return {
      terms: state.data.terms.filter(
        (term) =>
          matches(term.label) ||
          matches(term.kind) ||
          matches(term.domain) ||
          matches(term.canonicalRef) ||
          term.sourceRefs.some(matches),
      ),
      relations: state.data.relations.filter(
        (relation) =>
          matches(relation.sourceTerm) ||
          matches(relation.relation) ||
          matches(relation.targetTerm) ||
          relation.sourceRefs.some(matches),
      ),
      topologyEdges: state.data.topologyEdges.filter(
        (edge) =>
          matches(edge.sourceId) ||
          matches(edge.sourceTitle) ||
          matches(edge.relation) ||
          matches(edge.targetId) ||
          matches(edge.targetTitle) ||
          matches(edge.displayLabel) ||
          edge.sourceRefs.some(matches),
      ),
      proposalReferences: state.data.proposalReferences.filter(
        (reference) =>
          matches(reference.proposalId) ||
          matches(reference.proposalTitle) ||
          matches(reference.relation) ||
          matches(reference.targetSpecId) ||
          matches(reference.displayLabel) ||
          reference.sourceRefs.some(matches),
      ),
      domains: state.data.domains.filter(
        (domain) =>
          matches(domain.label) ||
          domain.termKinds.some(matches) ||
          domain.sourceRefs.some(matches),
      ),
    };
  }, [normalizedQuery, state]);

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Practical ontology">
        <Status label="Loading ontology" detail="Reading /api/v1/practical-ontology" />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Practical ontology">
        <Status label="Practical ontology unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;

  return (
    <section className={styles.panel} aria-label="Practical ontology">
      <div className={styles.summary}>
        <Metric label="Terms" value={data.summary.termCount} />
        <Metric label="Semantic" value={data.summary.semanticRelationCount} />
        <Metric label="Topology" value={data.summary.topologyEdgeCount} />
        <Metric label="Refs" value={data.summary.proposalReferenceCount} />
        <Metric label="Domains" value={data.summary.domainCount} />
        <Metric label="Sources" value={data.summary.sourceCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>Derived ontology</span>
          <span className={styles.surfaceTitle}>{sourceLabel(data.source)} · readonly</span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value="derived" />
          <Pill value="not_authority" />
        </div>
      </div>

      <div className={styles.sourceStrip}>
        {Object.entries(data.sources).map(([name, source]) => (
          <span key={name} className={styles.source} title={JSON.stringify(source)}>
            {name.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.practicalOntologyIsAuthority)}
        />
        <PostureItem
          label="Ontology writes"
          value={boolText(data.authorityBoundary.mayWriteOntologyPackage)}
        />
        <PostureItem
          label="Spec mutations"
          value={boolText(data.authorityBoundary.mayMutateCanonicalSpecs)}
        />
      </div>

      <div className={styles.sourceStrip}>
        <label className={styles.source}>
          Search{" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ontology"
          />
        </label>
      </div>

      <div className={styles.entries}>
        <DomainSection domains={visible.domains} />
        <TermSection terms={visible.terms} />
        <RelationSection relations={visible.relations} />
        <TopologySection topologyEdges={visible.topologyEdges} />
        <ProposalReferenceSection proposalReferences={visible.proposalReferences} />
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function Pill({ value }: { value: string }) {
  return <span className={[styles.pill, styles.toneNeutral].join(" ")}>{value}</span>;
}

function PostureItem({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.postureItem}>
      <span className={styles.postureLabel}>{label}</span>
      <span className={[styles.postureValue, styles.toneNeutral].join(" ")}>{value}</span>
    </span>
  );
}

function DomainSection({ domains }: { domains: readonly PracticalOntologyDomain[] }) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Domains</span>
        <span className={styles.sectionCount}>{domains.length}</span>
      </div>
      {domains.length === 0 ? (
        <Status label="No domains" detail="No domain rows match the current filter." />
      ) : (
        domains.slice(0, 40).map((domain) => <DomainRow key={domain.domainId} domain={domain} />)
      )}
    </div>
  );
}

function TermSection({ terms }: { terms: readonly PracticalOntologyTerm[] }) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Terms</span>
        <span className={styles.sectionCount}>{terms.length}</span>
      </div>
      {terms.length === 0 ? (
        <Status label="No terms" detail="No term rows match the current filter." />
      ) : (
        terms.slice(0, 120).map((term) => <TermRow key={term.termId} term={term} />)
      )}
    </div>
  );
}

function RelationSection({ relations }: { relations: readonly PracticalOntologyRelation[] }) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Semantic Relations</span>
        <span className={styles.sectionCount}>{relations.length}</span>
      </div>
      {relations.length === 0 ? (
        <Status
          label="No semantic relations"
          detail="No accepted or candidate semantic relation rows match the current filter."
        />
      ) : (
        relations.slice(0, 120).map((relation) => (
          <RelationRow key={relation.relationId} relation={relation} />
        ))
      )}
    </div>
  );
}

function TopologySection({
  topologyEdges,
}: {
  topologyEdges: readonly PracticalOntologyTopologyEdge[];
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>SpecGraph Topology</span>
        <span className={styles.sectionCount}>{topologyEdges.length}</span>
      </div>
      {topologyEdges.length === 0 ? (
        <Status label="No topology edges" detail="No topology rows match the current filter." />
      ) : (
        topologyEdges
          .slice(0, 120)
          .map((edge) => <TopologyRow key={edge.edgeId} edge={edge} />)
      )}
    </div>
  );
}

function ProposalReferenceSection({
  proposalReferences,
}: {
  proposalReferences: readonly PracticalOntologyProposalReference[];
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Proposal References</span>
        <span className={styles.sectionCount}>{proposalReferences.length}</span>
      </div>
      {proposalReferences.length === 0 ? (
        <Status label="No proposal refs" detail="No proposal reference rows match the filter." />
      ) : (
        proposalReferences
          .slice(0, 120)
          .map((reference) => (
            <ProposalReferenceRow key={reference.referenceId} reference={reference} />
          ))
      )}
    </div>
  );
}

function DomainRow({ domain }: { domain: PracticalOntologyDomain }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{domain.domainId}</span>
        <div className={styles.statusGroup}>
          <Pill value={`${domain.termCount} terms`} />
        </div>
      </div>
      <h3 className={styles.title}>{domain.label}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Kinds" value={domain.termKinds.join(", ") || "unknown"} />
        <Meta label="Sources" value={domain.sourceRefs.slice(0, 4).join(", ") || "unknown"} />
      </div>
    </article>
  );
}

function TermRow({ term }: { term: PracticalOntologyTerm }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{term.termId}</span>
        <div className={styles.statusGroup}>
          <Pill value={term.kind} />
          <Pill value={term.domain} />
        </div>
      </div>
      <h3 className={styles.title}>{term.label}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Ref" value={compact(term.canonicalRef, "derived")} />
        <Meta label="Evidence" value={`${term.evidenceCount}`} />
        <Meta label="Description" value={compact(term.description, "none")} />
        <Meta label="Sources" value={term.sourceRefs.slice(0, 4).join(", ") || "unknown"} />
      </div>
    </article>
  );
}

function RelationRow({ relation }: { relation: PracticalOntologyRelation }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{relation.relationId}</span>
        <div className={styles.statusGroup}>
          <Pill value={relation.relation} />
        </div>
      </div>
      <h3 className={styles.title}>
        {relation.sourceTerm} → {relation.targetTerm}
      </h3>
      <div className={styles.metaGrid}>
        <Meta label="Evidence" value={`${relation.evidenceCount}`} />
        <Meta label="Sources" value={relation.sourceRefs.slice(0, 4).join(", ") || "unknown"} />
      </div>
    </article>
  );
}

function TopologyRow({ edge }: { edge: PracticalOntologyTopologyEdge }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{edge.displayLabel}</span>
        <div className={styles.statusGroup}>
          <Pill value={edge.relation} />
          <Pill value={edge.authorityClass} />
        </div>
      </div>
      <h3 className={styles.title}>
        {edge.sourceId} → {edge.targetId}
      </h3>
      <div className={styles.metaGrid}>
        <Meta label="Source title" value={edge.sourceTitle} />
        <Meta label="Target title" value={edge.targetTitle} />
        <Meta label="Evidence" value={`${edge.evidenceCount}`} />
        <Meta label="Sources" value={edge.sourceRefs.slice(0, 4).join(", ") || "unknown"} />
      </div>
    </article>
  );
}

function ProposalReferenceRow({
  reference,
}: {
  reference: PracticalOntologyProposalReference;
}) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{reference.displayLabel}</span>
        <div className={styles.statusGroup}>
          <Pill value={reference.relation} />
          <Pill value={reference.authorityClass} />
        </div>
      </div>
      <h3 className={styles.title}>
        {reference.proposalId} → {reference.targetSpecId}
      </h3>
      <div className={styles.metaGrid}>
        <Meta label="Proposal" value={reference.proposalTitle} />
        <Meta label="Evidence" value={`${reference.evidenceCount}`} />
        <Meta label="Sources" value={reference.sourceRefs.slice(0, 4).join(", ") || "unknown"} />
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </span>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.status}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
