import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  PracticalOntology,
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

type DemoNodeKind = "domain" | "term" | "spec" | "proposal" | "evidence";

type DemoNode = {
  id: string;
  label: string;
  shortLabel: string;
  kind: DemoNodeKind;
  domain: string;
  x: number;
  y: number;
  radius: number;
  description: string;
  evidenceCount: number;
  sourceRefs: readonly string[];
};

type DemoLink = {
  source: string;
  target: string;
  label: string;
};

type DemoGraph = {
  nodes: readonly DemoNode[];
  links: readonly DemoLink[];
};

const DEMO_NODE_SEEDS: readonly Omit<DemoNode, "evidenceCount" | "sourceRefs">[] = [
  {
    id: "domain.specgraph",
    label: "SpecGraph",
    shortLabel: "SpecGraph",
    kind: "domain",
    domain: "SpecGraph",
    x: 420,
    y: 260,
    radius: 29,
    description: "Main derived vocabulary domain for specifications and graph structure.",
  },
  {
    id: "domain.ontology",
    label: "Ontology",
    shortLabel: "Ontology",
    kind: "domain",
    domain: "Ontology",
    x: 260,
    y: 180,
    radius: 24,
    description: "Demo domain for canonical vocabulary, gaps, and owner decisions.",
  },
  {
    id: "domain.specspace",
    label: "SpecSpace",
    shortLabel: "SpecSpace",
    kind: "domain",
    domain: "SpecSpace",
    x: 600,
    y: 170,
    radius: 23,
    description: "Demo domain for review surfaces and visual inspection.",
  },
  {
    id: "domain.agent-layer",
    label: "Agent Layer",
    shortLabel: "Agents",
    kind: "domain",
    domain: "Agent Layer",
    x: 255,
    y: 360,
    radius: 22,
    description: "Demo domain for prompt and authoring behavior.",
  },
  {
    id: "domain.evidence",
    label: "Evidence",
    shortLabel: "Evidence",
    kind: "domain",
    domain: "Evidence",
    x: 610,
    y: 365,
    radius: 22,
    description: "Demo domain for source references and review evidence.",
  },
  {
    id: "term.spec-node",
    label: "Spec Node",
    shortLabel: "Spec Node",
    kind: "term",
    domain: "SpecGraph",
    x: 420,
    y: 110,
    radius: 18,
    description: "A canonical specification node in the graph.",
  },
  {
    id: "term.proposal",
    label: "Proposal",
    shortLabel: "Proposal",
    kind: "term",
    domain: "Proposal Workflow",
    x: 470,
    y: 150,
    radius: 17,
    description: "A proposed change or bounded design slice.",
  },
  {
    id: "term.ontology-binding",
    label: "Ontology Binding",
    shortLabel: "Binding",
    kind: "term",
    domain: "Ontology",
    x: 300,
    y: 255,
    radius: 18,
    description: "Demo concept for mapping generated vocabulary to accepted ontology terms.",
  },
  {
    id: "term.term-binding-policy",
    label: "Term Binding Policy",
    shortLabel: "Policy",
    kind: "term",
    domain: "Ontology",
    x: 185,
    y: 265,
    radius: 17,
    description: "Review-first policy for generated terms and ontology gaps.",
  },
  {
    id: "term.generated-term",
    label: "Generated Term",
    shortLabel: "Generated",
    kind: "term",
    domain: "Ontology",
    x: 185,
    y: 135,
    radius: 16,
    description: "A term introduced by an authoring or review workflow.",
  },
  {
    id: "term.ontology-gap",
    label: "Ontology Gap",
    shortLabel: "Gap",
    kind: "term",
    domain: "Ontology",
    x: 315,
    y: 110,
    radius: 16,
    description: "A missing or ambiguous vocabulary item requiring owner review.",
  },
  {
    id: "term.owner-decision",
    label: "Owner Decision",
    shortLabel: "Decision",
    kind: "term",
    domain: "Ontology",
    x: 135,
    y: 210,
    radius: 16,
    description: "Accepted or rejected ontology owner decision evidence.",
  },
  {
    id: "term.review-surface",
    label: "Review Surface",
    shortLabel: "Review",
    kind: "term",
    domain: "SpecSpace",
    x: 665,
    y: 250,
    radius: 18,
    description: "A readable UI/API artifact for inspecting ontology review items.",
  },
  {
    id: "term.practical-ontology",
    label: "Practical Ontology",
    shortLabel: "Practical",
    kind: "term",
    domain: "SpecSpace",
    x: 545,
    y: 250,
    radius: 18,
    description: "Derived read-only vocabulary extracted from existing specifications.",
  },
  {
    id: "term.semantic-gate",
    label: "Semantic Gate",
    shortLabel: "Gate",
    kind: "term",
    domain: "SpecGraph",
    x: 520,
    y: 320,
    radius: 17,
    description: "A review gate that blocks unsupported or unbound semantic changes.",
  },
  {
    id: "term.source-ref",
    label: "Source Ref",
    shortLabel: "Source",
    kind: "evidence",
    domain: "Evidence",
    x: 690,
    y: 430,
    radius: 15,
    description: "Traceable evidence pointing back to spec nodes or proposal markdown.",
  },
  {
    id: "term.evidence-ref",
    label: "Evidence Ref",
    shortLabel: "Evidence",
    kind: "evidence",
    domain: "Evidence",
    x: 555,
    y: 455,
    radius: 15,
    description: "Demo evidence handle for graph review and UI inspection.",
  },
  {
    id: "term.claim-calibration",
    label: "Claim Calibration",
    shortLabel: "Claims",
    kind: "term",
    domain: "Agent Layer",
    x: 315,
    y: 440,
    radius: 16,
    description: "F/G/R-style bounded calibration for strong claims.",
  },
  {
    id: "term.active-context",
    label: "Active Context",
    shortLabel: "Context",
    kind: "term",
    domain: "Agent Layer",
    x: 205,
    y: 445,
    radius: 16,
    description: "Resolved ontology/domain/context frame for spec authoring.",
  },
  {
    id: "term.spec-author-agent",
    label: "SpecAuthorAgent",
    shortLabel: "Author",
    kind: "term",
    domain: "Agent Layer",
    x: 130,
    y: 345,
    radius: 17,
    description: "Demo agent that writes specs under ontology and claim calibration rules.",
  },
  {
    id: "spec.0127",
    label: "0127 Ontology Stdlib Discipline",
    shortLabel: "0127",
    kind: "spec",
    domain: "Ontology",
    x: 95,
    y: 115,
    radius: 14,
    description: "Demo source slice for treating accepted ontology terms as base symbols.",
  },
  {
    id: "spec.0128",
    label: "0128 Term Binding Policy",
    shortLabel: "0128",
    kind: "spec",
    domain: "Ontology",
    x: 92,
    y: 285,
    radius: 14,
    description: "Demo source slice for generated-term binding policy.",
  },
  {
    id: "spec.0129",
    label: "0129 Term Binding Gate",
    shortLabel: "0129",
    kind: "spec",
    domain: "SpecGraph",
    x: 440,
    y: 410,
    radius: 14,
    description: "Demo source slice for executable review-warning gate behavior.",
  },
  {
    id: "proposal.0100",
    label: "0100 Ontology Grounding",
    shortLabel: "0100",
    kind: "proposal",
    domain: "Ontology",
    x: 735,
    y: 140,
    radius: 14,
    description: "Demo proposal source for ontology-grounded semantic control.",
  },
  {
    id: "proposal.0126",
    label: "0126 Claim Calibration Contract",
    shortLabel: "0126",
    kind: "proposal",
    domain: "Agent Layer",
    x: 390,
    y: 505,
    radius: 14,
    description: "Demo proposal source for calibrated spec-authoring claims.",
  },
];

const DEMO_LINKS: readonly DemoLink[] = [
  { source: "domain.specgraph", target: "term.spec-node", label: "contains" },
  { source: "domain.specgraph", target: "term.proposal", label: "contains" },
  { source: "domain.ontology", target: "term.ontology-binding", label: "focuses" },
  { source: "domain.ontology", target: "term.term-binding-policy", label: "governs" },
  { source: "domain.ontology", target: "term.generated-term", label: "reviews" },
  { source: "domain.ontology", target: "term.ontology-gap", label: "routes" },
  { source: "domain.ontology", target: "term.owner-decision", label: "accepts/rejects" },
  { source: "domain.specspace", target: "term.review-surface", label: "renders" },
  { source: "domain.specspace", target: "term.practical-ontology", label: "renders" },
  { source: "domain.evidence", target: "term.source-ref", label: "contains" },
  { source: "domain.evidence", target: "term.evidence-ref", label: "contains" },
  { source: "domain.agent-layer", target: "term.spec-author-agent", label: "hosts" },
  { source: "domain.agent-layer", target: "term.claim-calibration", label: "requires" },
  { source: "domain.agent-layer", target: "term.active-context", label: "requires" },
  { source: "term.spec-author-agent", target: "term.generated-term", label: "emits" },
  { source: "term.generated-term", target: "term.ontology-binding", label: "binds_to" },
  { source: "term.generated-term", target: "term.ontology-gap", label: "may_need" },
  { source: "term.ontology-gap", target: "term.owner-decision", label: "awaits" },
  { source: "term.owner-decision", target: "term.semantic-gate", label: "closes" },
  { source: "term.semantic-gate", target: "term.review-surface", label: "feeds" },
  { source: "term.practical-ontology", target: "term.review-surface", label: "supports" },
  { source: "term.source-ref", target: "term.evidence-ref", label: "backs" },
  { source: "term.evidence-ref", target: "term.review-surface", label: "explains" },
  { source: "term.claim-calibration", target: "term.active-context", label: "scopes" },
  { source: "term.active-context", target: "term.ontology-binding", label: "narrows" },
  { source: "spec.0127", target: "term.ontology-binding", label: "motivates" },
  { source: "spec.0128", target: "term.term-binding-policy", label: "defines" },
  { source: "spec.0129", target: "term.semantic-gate", label: "implements" },
  { source: "proposal.0100", target: "term.practical-ontology", label: "seeds" },
  { source: "proposal.0126", target: "term.claim-calibration", label: "defines" },
];

const NODE_TONE_CLASS: Record<DemoNodeKind, string> = {
  domain: styles.demoNodeDomain,
  term: styles.demoNodeTerm,
  spec: styles.demoNodeSpec,
  proposal: styles.demoNodeProposal,
  evidence: styles.demoNodeEvidence,
};

function findMatchingTerm(
  data: PracticalOntology,
  label: string,
): PracticalOntologyTerm | undefined {
  const normalized = label.toLowerCase();
  return data.terms.find((term) => term.label.toLowerCase() === normalized);
}

function findMatchingDomain(
  data: PracticalOntology,
  label: string,
): PracticalOntologyDomain | undefined {
  const normalized = label.toLowerCase();
  return data.domains.find((domain) => domain.label.toLowerCase() === normalized);
}

function buildDemoGraph(data: PracticalOntology): DemoGraph {
  return {
    nodes: DEMO_NODE_SEEDS.map((seed) => {
      const matchingTerm = findMatchingTerm(data, seed.label);
      const matchingDomain =
        seed.kind === "domain" ? findMatchingDomain(data, seed.label) : undefined;
      return {
        ...seed,
        evidenceCount: matchingTerm?.evidenceCount ?? matchingDomain?.termCount ?? 0,
        sourceRefs: matchingTerm?.sourceRefs ?? matchingDomain?.sourceRefs.slice(0, 6) ?? [],
      };
    }),
    links: DEMO_LINKS,
  };
}

export function PracticalOntologyPanel({ state }: Props) {
  const [query, setQuery] = useState("");
  const [demoLensOpen, setDemoLensOpen] = useState(false);
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
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => setDemoLensOpen(true)}
        >
          Open demo graph
        </button>
      </div>

      <div className={styles.entries}>
        <DomainSection domains={visible.domains} />
        <TermSection terms={visible.terms} />
        <RelationSection relations={visible.relations} />
        <TopologySection topologyEdges={visible.topologyEdges} />
        <ProposalReferenceSection proposalReferences={visible.proposalReferences} />
      </div>

      {demoLensOpen ? (
        <OntologyGraphDemoLens data={data} onClose={() => setDemoLensOpen(false)} />
      ) : null}
    </section>
  );
}

export function OntologyGraphDemoLens({
  data,
  onClose,
}: {
  data: PracticalOntology;
  onClose: () => void;
}) {
  const graph = useMemo(() => buildDemoGraph(data), [data]);
  const [selectedNodeId, setSelectedNodeId] = useState(graph.nodes[0]?.id ?? "");
  const pointerDownRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const lens = (
    <div className={styles.demoGraphOverlay} role="dialog" aria-modal="true">
      <div className={styles.demoGraphShell}>
        <header className={styles.demoGraphHeader}>
          <div className={styles.surfaceMain}>
            <span className={styles.kicker}>Demo Ontology Graph Lens</span>
            <span className={styles.demoGraphTitle}>
              DEMO - curated mock ontology graph over extracted inventory
            </span>
          </div>
          <div className={styles.statusGroup}>
            <Pill value={`${graph.nodes.length} demo nodes`} />
            <Pill value={`${graph.links.length} demo links`} />
            <Pill value={`${data.summary.termCount} extracted`} />
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className={styles.demoGraphNotice}>
          Demo lens only. Links are curated/mock relationships for presentation; semantic relations in
          the derived source are {data.summary.semanticRelationCount}.
        </div>

        <div className={styles.demoGraphBody}>
          <div className={styles.demoGraphCanvas} aria-label="Demo ontology force graph">
            <svg viewBox="0 0 820 560" role="img" aria-label="Curated demo ontology graph">
              <defs>
                <filter id="demo-node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.16" />
                </filter>
              </defs>
              {graph.links.map((link) => {
                const source = nodeById.get(link.source);
                const target = nodeById.get(link.target);
                if (!source || !target) return null;
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                return (
                  <g key={`${link.source}-${link.target}-${link.label}`}>
                    <line
                      className={styles.demoEdge}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                    <text className={styles.demoEdgeLabel} x={midX} y={midY}>
                      {link.label}
                    </text>
                  </g>
                );
              })}
              {graph.nodes.map((node) => {
                const selected = node.id === selectedNode?.id;
                return (
                  <g
                    key={node.id}
                    className={[
                      styles.demoNodeGroup,
                      NODE_TONE_CLASS[node.kind],
                      selected ? styles.demoNodeSelected : "",
                    ].join(" ")}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pointerDownRef.current = { nodeId: node.id, x: event.clientX, y: event.clientY };
                      pointerMovedRef.current = false;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const pointerDown = pointerDownRef.current;
                      if (!pointerDown || pointerDown.nodeId !== node.id) return;
                      const moved =
                        Math.abs(event.clientX - pointerDown.x) > 4 ||
                        Math.abs(event.clientY - pointerDown.y) > 4;
                      if (moved) pointerMovedRef.current = true;
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      const pointerDown = pointerDownRef.current;
                      const moved =
                        pointerMovedRef.current ||
                        !pointerDown ||
                        Math.abs(event.clientX - pointerDown.x) > 4 ||
                        Math.abs(event.clientY - pointerDown.y) > 4;
                      pointerDownRef.current = null;
                      pointerMovedRef.current = false;
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      if (!moved) setSelectedNodeId(node.id);
                    }}
                    onPointerCancel={(event) => {
                      pointerDownRef.current = null;
                      pointerMovedRef.current = false;
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    onDragStart={(event) => {
                      event.preventDefault();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedNodeId(node.id);
                      }
                    }}
                  >
                    <title>{node.label}</title>
                    <circle
                      className={styles.demoNodeHalo}
                      cx={node.x}
                      cy={node.y}
                      r={node.radius + 7}
                    />
                    <circle
                      className={styles.demoNode}
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      filter="url(#demo-node-shadow)"
                    />
                    <text className={styles.demoNodeLabel} x={node.x} y={node.y + 3}>
                      {node.shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <aside className={styles.demoGraphInspector}>
            {selectedNode ? (
              <>
                <span className={styles.kicker}>Selected demo node</span>
                <h3 className={styles.demoInspectorTitle}>{selectedNode.label}</h3>
                <div className={styles.statusGroup}>
                  <Pill value={selectedNode.kind} />
                  <Pill value={selectedNode.domain} />
                  <Pill value={selectedNode.evidenceCount ? "has evidence" : "mock node"} />
                </div>
                <p className={styles.demoInspectorText}>{selectedNode.description}</p>
                <div className={styles.metaGrid}>
                  <Meta label="Evidence count" value={`${selectedNode.evidenceCount}`} />
                  <Meta
                    label="Source refs"
                    value={selectedNode.sourceRefs.slice(0, 3).join(", ") || "demo-only"}
                  />
                  <Meta label="Authority" value="demo_only_not_authority" />
                  <Meta label="Relation type" value="mock/demo links" />
                </div>
              </>
            ) : (
              <Status label="No node selected" detail="Select a demo node in the graph." />
            )}
          </aside>
        </div>

        <div className={styles.demoLegend}>
          <span className={styles.demoLegendItem}>Domain</span>
          <span className={styles.demoLegendItem}>Term</span>
          <span className={styles.demoLegendItem}>Spec slice</span>
          <span className={styles.demoLegendItem}>Proposal</span>
          <span className={styles.demoLegendItem}>Evidence</span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return lens;

  return createPortal(lens, document.body);
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
