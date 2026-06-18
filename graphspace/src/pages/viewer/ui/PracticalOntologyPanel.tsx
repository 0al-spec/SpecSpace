import { type PointerEvent, useMemo, useRef, useState } from "react";
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

type DemoNodeKind = "domain" | "term" | "evidence";

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

type DemoNodePosition = Pick<DemoNode, "x" | "y">;

type DemoPointerState = {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  offsetX: number;
  offsetY: number;
};

const NODE_TONE_CLASS: Record<DemoNodeKind, string> = {
  domain: styles.demoNodeDomain,
  term: styles.demoNodeTerm,
  evidence: styles.demoNodeEvidence,
};

const DEMO_GRAPH_VIEWBOX = {
  width: 820,
  height: 560,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const CORE_GRAPH_LAYOUT: Record<string, DemoNodePosition & { radius: number; shortLabel: string }> =
  {
    SpecGraph: { x: 410, y: 265, radius: 31, shortLabel: "SpecGraph" },
    Intent: { x: 170, y: 115, radius: 19, shortLabel: "Intent" },
    Spec: { x: 305, y: 185, radius: 22, shortLabel: "Spec" },
    Requirement: { x: 455, y: 125, radius: 20, shortLabel: "Req" },
    AcceptanceCriterion: { x: 610, y: 160, radius: 20, shortLabel: "AC" },
    Evidence: { x: 710, y: 265, radius: 18, shortLabel: "Evidence" },
    Node: { x: 305, y: 350, radius: 21, shortLabel: "Node" },
    Edge: { x: 510, y: 350, radius: 20, shortLabel: "Edge" },
    Decision: { x: 185, y: 265, radius: 18, shortLabel: "Decision" },
    Constraint: { x: 160, y: 420, radius: 18, shortLabel: "Constraint" },
    Invariant: { x: 350, y: 485, radius: 18, shortLabel: "Invariant" },
    CodeSurface: { x: 535, y: 455, radius: 19, shortLabel: "Code" },
    Test: { x: 650, y: 420, radius: 17, shortLabel: "Test" },
    Release: { x: 720, y: 505, radius: 17, shortLabel: "Release" },
  };

function fallbackNodePosition(index: number): DemoNodePosition {
  const angle = (index / 12) * Math.PI * 2;
  return {
    x: 410 + Math.cos(angle) * 255,
    y: 280 + Math.sin(angle) * 170,
  };
}

function nodeKindForTerm(term: PracticalOntologyTerm): DemoNodeKind {
  if (term.kind === "ontology") return "domain";
  if (term.kind === "evidence") return "evidence";
  return "term";
}

function buildDemoGraph(data: PracticalOntology): DemoGraph {
  const nodeIdByLabel = new Map(data.terms.map((term) => [term.label, term.termId]));
  return {
    nodes: data.terms.map((term, index) => {
      const layout = CORE_GRAPH_LAYOUT[term.label];
      const fallback = fallbackNodePosition(index);
      return {
        id: term.termId,
        label: term.label,
        shortLabel: layout?.shortLabel ?? term.label,
        kind: nodeKindForTerm(term),
        domain: term.domain,
        x: layout?.x ?? fallback.x,
        y: layout?.y ?? fallback.y,
        radius: layout?.radius ?? 17,
        description: compact(term.description, "Curated ontology term."),
        evidenceCount: term.evidenceCount,
        sourceRefs: term.sourceRefs,
      };
    }),
    links: data.relations.flatMap((relation) => {
      const source = nodeIdByLabel.get(relation.sourceTerm);
      const target = nodeIdByLabel.get(relation.targetTerm);
      if (!source || !target) return [];
      return [{ source, target, label: relation.relation }];
    }),
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
          <span className={styles.kicker}>Curated ontology</span>
          <span className={styles.surfaceTitle}>{sourceLabel(data.source)} · readonly</span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value="curated_core_seed" />
          <Pill value="working_draft" />
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
          Open ontology graph
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(graph.nodes[0]?.id ?? "");
  const [nodePositions, setNodePositions] = useState<Record<string, DemoNodePosition>>({});
  const [draggingNodeId, setDraggingNodeId] = useState("");
  const pointerDownRef = useRef<DemoPointerState | null>(null);
  const pointerMovedRef = useRef(false);
  const graphNodes = useMemo(
    () =>
      graph.nodes.map((node) => {
        const position = nodePositions[node.id];
        return position ? { ...node, ...position } : node;
      }),
    [graph.nodes, nodePositions],
  );
  const selectedNode = graphNodes.find((node) => node.id === selectedNodeId) ?? graphNodes[0];
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));

  function pointerPoint(event: PointerEvent<SVGGElement>): DemoNodePosition | null {
    const svg = svgRef.current;
    const transform = svg?.getScreenCTM();
    if (!svg || !transform) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(transform.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  }

  function updateNodePosition(node: DemoNode, event: PointerEvent<SVGGElement>): void {
    const pointerDown = pointerDownRef.current;
    const point = pointerPoint(event);
    if (!pointerDown || !point) return;
    const nextX = clamp(
      point.x - pointerDown.offsetX,
      node.radius,
      DEMO_GRAPH_VIEWBOX.width - node.radius,
    );
    const nextY = clamp(
      point.y - pointerDown.offsetY,
      node.radius,
      DEMO_GRAPH_VIEWBOX.height - node.radius,
    );
    setNodePositions((current) => ({
      ...current,
      [node.id]: { x: nextX, y: nextY },
    }));
  }

  const lens = (
    <div className={styles.demoGraphOverlay} role="dialog" aria-modal="true">
      <div className={styles.demoGraphShell}>
        <header className={styles.demoGraphHeader}>
          <div className={styles.surfaceMain}>
            <span className={styles.kicker}>Ontology Graph Lens</span>
            <span className={styles.demoGraphTitle}>
              SpecGraph Core Ontology v0
            </span>
          </div>
          <div className={styles.statusGroup}>
            <Pill value={`${graph.nodes.length} curated nodes`} />
            <Pill value={`${graph.links.length} curated links`} />
            <Pill value="session layout" />
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setNodePositions({})}
            >
              Reset layout
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className={styles.demoGraphNotice}>
          Curated working ontology only. Layout changes are local to this session; source terms and
          relations come from the SpecGraph Core Ontology v0 seed.
        </div>

        <div className={styles.demoGraphBody}>
          <div className={styles.demoGraphCanvas} aria-label="Curated ontology graph">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${DEMO_GRAPH_VIEWBOX.width} ${DEMO_GRAPH_VIEWBOX.height}`}
              role="img"
              aria-label="Curated SpecGraph core ontology graph"
            >
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
              {graphNodes.map((node) => {
                const selected = node.id === selectedNode?.id;
                return (
                  <g
                    key={node.id}
                    className={[
                      styles.demoNodeGroup,
                      NODE_TONE_CLASS[node.kind],
                      selected ? styles.demoNodeSelected : "",
                      draggingNodeId === node.id ? styles.demoNodeDragging : "",
                    ].join(" ")}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      const point = pointerPoint(event);
                      pointerDownRef.current = {
                        nodeId: node.id,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        offsetX: point ? point.x - node.x : 0,
                        offsetY: point ? point.y - node.y : 0,
                      };
                      pointerMovedRef.current = false;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const pointerDown = pointerDownRef.current;
                      if (!pointerDown || pointerDown.nodeId !== node.id) return;
                      const moved =
                        Math.abs(event.clientX - pointerDown.startClientX) > 4 ||
                        Math.abs(event.clientY - pointerDown.startClientY) > 4;
                      if (moved) {
                        pointerMovedRef.current = true;
                        setDraggingNodeId(node.id);
                        updateNodePosition(node, event);
                      }
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      const pointerDown = pointerDownRef.current;
                      const moved =
                        pointerMovedRef.current ||
                        !pointerDown ||
                        Math.abs(event.clientX - pointerDown.startClientX) > 4 ||
                        Math.abs(event.clientY - pointerDown.startClientY) > 4;
                      pointerDownRef.current = null;
                      pointerMovedRef.current = false;
                      setDraggingNodeId("");
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      if (!moved) setSelectedNodeId(node.id);
                    }}
                    onPointerCancel={(event) => {
                      pointerDownRef.current = null;
                      pointerMovedRef.current = false;
                      setDraggingNodeId("");
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
                <span className={styles.kicker}>Selected ontology node</span>
                <h3 className={styles.demoInspectorTitle}>{selectedNode.label}</h3>
                <div className={styles.statusGroup}>
                  <Pill value={selectedNode.kind} />
                  <Pill value={selectedNode.domain} />
                  <Pill value={selectedNode.evidenceCount ? "has evidence" : "draft term"} />
                </div>
                <p className={styles.demoInspectorText}>{selectedNode.description}</p>
                <div className={styles.metaGrid}>
                  <Meta label="Evidence count" value={`${selectedNode.evidenceCount}`} />
                  <Meta
                    label="Source refs"
                    value={selectedNode.sourceRefs.slice(0, 3).join(", ") || "curated-seed"}
                  />
                  <Meta label="Authority" value="working_draft" />
                  <Meta label="Relation type" value="curated seed links" />
                </div>
              </>
            ) : (
              <Status label="No node selected" detail="Select a curated node in the graph." />
            )}
          </aside>
        </div>

        <div className={styles.demoLegend}>
          <span className={styles.demoLegendItem}>Domain</span>
          <span className={styles.demoLegendItem}>Term</span>
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
        <Meta label="Ref" value={compact(term.canonicalRef, "curated")} />
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
