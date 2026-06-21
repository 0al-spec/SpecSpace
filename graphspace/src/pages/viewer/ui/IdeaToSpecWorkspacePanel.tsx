import type {
  IdeaToSpecCandidateNode,
  IdeaToSpecMaterializedFile,
  IdeaToSpecRepairAction,
  IdeaToSpecWorkspace,
  UseIdeaToSpecWorkspaceState,
} from "../model/use-idea-to-spec-workspace";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseIdeaToSpecWorkspaceState;
};

function errorDetail(
  state: Exclude<UseIdeaToSpecWorkspaceState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Idea-to-spec workspace endpoint is unreachable from the browser.";
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

function joined(values: readonly string[], fallback = "none"): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function metricValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return boolText(value);
  return "n/a";
}

export function IdeaToSpecWorkspacePanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status
          label="Loading idea-to-spec workspace"
          detail="Reading /api/v1/idea-to-spec-workspace"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status label="Idea-to-spec workspace unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;
  const frame = data.candidateGraph.activeFrame.project
    ? data.candidateGraph.activeFrame
    : data.intake.activeFrame;

  return (
    <section className={styles.panel} aria-label="Idea-to-spec workspace">
      <div className={styles.summary}>
        <Metric label="Artifacts" value={data.summary.availableArtifactCount} />
        <Metric label="Nodes" value={data.summary.candidateNodeCount} />
        <Metric label="Edges" value={data.summary.candidateEdgeCount} />
        <Metric label="Findings" value={data.summary.preSibFindingCount} />
        <Metric label="Repairs" value={data.summary.repairActionCount} />
        <Metric label="Context" value={data.summary.repairContextRequiredCount} />
        <Metric label="Specs" value={data.summary.materializedFileCount} />
        <Metric label="Promote" value={data.summary.promotionPathCount} />
        <Metric label="Missing" value={data.summary.missingArtifactCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>Idea-to-Spec Workspace</span>
          <span className={styles.surfaceTitle}>
            {compact(frame.project, "no project")} · pre-SIB · readonly
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.summary.status} />
          <Pill value={compact(data.preSib.readiness.reviewState, "no pre-SIB")} />
          <Pill value={compact(data.repairLoop.readiness.reviewState, "no repair")} />
          <Pill
            value={compact(
              data.materialization.readiness.reviewState,
              "no materialization",
            )}
          />
        </div>
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.ideaToSpecWorkspaceIsAuthority)}
        />
        <PostureItem
          label="Spec mutations"
          value={boolText(data.authorityBoundary.mayMutateCanonicalSpecs)}
        />
        <PostureItem
          label="Git writes"
          value={boolText(data.authorityBoundary.mayCreateBranchOrCommit)}
        />
      </div>

      <div className={styles.entries}>
        <FrameSection project={frame.project} domains={frame.domainRefs} contexts={frame.contextRefs} />
        <ArtifactSection artifacts={data.artifacts} />
        <IntakeSection state={state} />
        <CandidateGraphSection nodes={data.candidateGraph.nodes} />
        <PreSibSection state={state} />
        <RepairSection actions={data.repairLoop.actions} />
        <MaterializationSection state={state} />
      </div>
    </section>
  );
}

function FrameSection({
  project,
  domains,
  contexts,
}: {
  project: string | null;
  domains: readonly string[];
  contexts: readonly string[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Active frame" count={domains.length + contexts.length} />
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          <Meta label="Project" value={project} />
          <Meta label="Domains" value={joined(domains)} />
          <Meta label="Contexts" value={joined(contexts)} />
        </div>
      </div>
    </section>
  );
}

function ArtifactSection({
  artifacts,
}: {
  artifacts: IdeaToSpecWorkspace["artifacts"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Source artifacts" count={Object.keys(artifacts).length} />
      {Object.entries(artifacts).map(([name, artifact]) => (
        <div key={name} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{name.replace(/_/g, " ")}</span>
            <Pill value={artifact.available ? "available" : compact(artifact.reason, "missing")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Path" value={artifact.path} />
            <Meta label="Status" value={artifact.status} />
            <Meta label="Proposal" value={artifact.proposalId} />
            <Meta label="Kind" value={artifact.artifactKind} />
          </div>
        </div>
      ))}
    </section>
  );
}

function IntakeSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const summary = state.data.intake.summary;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Event-storming intake" count={summary.domainEventCount} />
      <div className={styles.postureStrip}>
        <PostureItem label="Actors" value={String(summary.actorCount)} />
        <PostureItem label="Events" value={String(summary.domainEventCount)} />
        <PostureItem label="Commands" value={String(summary.commandCount)} />
        <PostureItem label="Policies" value={String(summary.policyCount)} />
        <PostureItem label="Constraints" value={String(summary.constraintCount)} />
        <PostureItem
          label="Vocabulary"
          value={String(summary.vocabularyQuestionCount)}
        />
      </div>
    </section>
  );
}

function CandidateGraphSection({
  nodes,
}: {
  nodes: readonly IdeaToSpecCandidateNode[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Candidate graph" count={nodes.length} />
      {nodes.length === 0 ? (
        <Status label="No candidate nodes" detail="Candidate graph artifact is empty." />
      ) : null}
      {nodes.map((node) => (
        <div key={node.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{node.id}</span>
            <Pill value={compact(node.kind, "node")} />
          </div>
          <h3 className={styles.title}>{compact(node.title, "Candidate node")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Requirements" value={String(node.requirementCount)} />
            <Meta label="Acceptance" value={String(node.acceptanceCriteriaCount)} />
            <Meta label="Claims" value={String(node.claimCount)} />
            <Meta label="Gaps" value={String(node.gapCount)} />
            <Meta label="Ontology refs" value={joined(node.ontologyRefs)} />
          </div>
        </div>
      ))}
    </section>
  );
}

function PreSibSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const data = state.data;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Pre-SIB coherence" count={data.preSib.findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(data.preSib.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(data.preSib.readiness.reviewState)}
        />
        <PostureItem
          label="Blocked by"
          value={joined(data.preSib.readiness.blockedBy)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          {Object.entries(data.preSib.metrics).map(([key, value]) => (
            <Meta key={key} label={key.replace(/_/g, " ")} value={metricValue(value)} />
          ))}
        </div>
      </div>
      {data.preSib.findings.map((finding) => (
        <div key={finding.findingId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function RepairSection({
  actions,
}: {
  actions: readonly IdeaToSpecRepairAction[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Repair loop" count={actions.length} />
      {actions.length === 0 ? (
        <Status label="No repair actions" detail="Repair loop artifact is empty." />
      ) : null}
      {actions.map((action) => (
        <div key={action.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{action.id}</span>
            <Pill value={action.status} />
          </div>
          <h3 className={styles.title}>{action.kind.replace(/_/g, " ")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Target" value={action.targetRef} />
            <Meta label="Findings" value={joined(action.sourceFindings)} />
            <Meta label="Rationale" value={action.rationale} />
          </div>
        </div>
      ))}
    </section>
  );
}

function MaterializationSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const materialization = state.data.materialization;
  const request = materialization.promotionRequest;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Promotion preview"
        count={materialization.files.length}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Ready"
          value={boolText(materialization.readiness.ready)}
        />
        <PostureItem
          label="Review state"
          value={compact(materialization.readiness.reviewState)}
        />
        <PostureItem
          label="Source"
          value={compact(materialization.materializationSource)}
        />
        <PostureItem
          label="Platform request"
          value={compact(request.platformArtifactKind)}
        />
      </div>
      {materialization.files.length === 0 ? (
        <Status
          label="No materialized candidate specs"
          detail="Candidate materialization report is missing or empty."
        />
      ) : null}
      {materialization.files.map((file) => (
        <MaterializedFileRow key={file.path} file={file} />
      ))}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Platform handoff</span>
          <Pill value={compact(request.pathArgument, "--path")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Promotion paths" value={joined(request.paths)} />
          <Meta label="Next" value={materialization.readiness.nextArtifact} />
        </div>
      </div>
    </section>
  );
}

function MaterializedFileRow({ file }: { file: IdeaToSpecMaterializedFile }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{file.materializedId}</span>
        <Pill value="review-only" />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Candidate node" value={file.candidateNodeId} />
        <Meta label="Preview path" value={file.path} />
        <Meta label="Promotion path" value={file.promotionPath} />
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.kicker}>{title}</span>
      <span className={styles.sectionCount}>{count}</span>
    </div>
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
  return <span className={styles.pill}>{value}</span>;
}

function PostureItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.postureItem}>
      <span className={styles.postureLabel}>{label}</span>
      <span className={styles.postureValue}>{value}</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{compact(value, "none")}</span>
    </div>
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
