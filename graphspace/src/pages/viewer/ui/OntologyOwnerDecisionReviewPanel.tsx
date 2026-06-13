import { useState } from "react";
import type {
  OntologyIgnoredOwnerDecision,
  OntologyOwnerDecisionPreview,
  UseOntologyOwnerDecisionReviewState,
} from "../model/use-ontology-owner-decision-review";
import { agentSurfaceTone, type AgentSurfaceTone } from "../model/agent-surface-tones";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseOntologyOwnerDecisionReviewState;
};

function errorDetail(
  state: Exclude<UseOntologyOwnerDecisionReviewState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Ontology owner decision review endpoint is unreachable from the browser.";
    case "envelope-error":
      return state.reason;
    case "version-not-supported":
      return `schema_version ${state.schema_version} exceeds supported ${state.max_supported}`;
    case "wrong-artifact-kind":
      return `Expected ${state.expected}`;
    case "parse-error":
      return state.issues.length > 0 ? state.issues[0].message : "Schema validation failed.";
    case "invariant-violation":
      return state.message;
  }
}

function toneClass(tone: AgentSurfaceTone): string {
  switch (tone) {
    case "ok":
      return styles.toneOk;
    case "warn":
      return styles.toneWarn;
    case "danger":
      return styles.toneDanger;
    case "neutral":
      return styles.toneNeutral;
  }
}

function compact(value: string | null | undefined, fallback = "unknown"): string {
  return value && value.length > 0 ? value : fallback;
}

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function afterSemanticStatus(entry: OntologyOwnerDecisionPreview): string {
  switch (entry.previewState) {
    case "ready_for_operator_review":
      return "operator_review_pending";
    case "rejected_by_owner":
      return "owner_rejected_no_import";
    case "needs_clarification":
      return "owner_clarification_required";
    case "blocked_by_semantic_gate":
      return "blocked_by_semantic_gate";
    case "unmatched_decision":
      return "unmatched_owner_decision";
    default:
      return entry.previewState;
  }
}

export function OntologyOwnerDecisionReviewPanel({ state }: Props) {
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(() => new Set());

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Ontology owner decision review">
        <Status
          label="Loading owner decisions"
          detail="Reading /api/v1/ontology-owner-decision-review"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Ontology owner decision review">
        <Status label="Owner decisions unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data, meta } = state;
  const acknowledgedCount = data.decisionImportPreviews.filter((entry) =>
    acknowledged.has(entry.previewId),
  ).length;

  return (
    <section className={styles.panel} aria-label="Ontology owner decision review">
      <div className={styles.summary}>
        <Metric label="Accepted" value={data.summary.acceptedCount} />
        <Metric label="Rejected" value={data.summary.rejectedCount} />
        <Metric label="Ready" value={data.summary.importableCount} />
        <Metric label="Ack" value={acknowledgedCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>SG-RFC-{data.proposalId}</span>
          <span className={styles.surfaceTitle}>
            {compact(data.target.targetRef, "ontology owner decision review")}
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.summary.status} />
          {data.summary.nextGap ? <Pill value={data.summary.nextGap} /> : null}
        </div>
      </div>

      <div className={styles.sourceStrip}>
        <span className={styles.source} title={meta.path}>
          preview: {compact(data.outputArtifact, meta.path)}
        </span>
        {Object.entries(data.sourceArtifacts).map(([name, artifact]) => (
          <span key={name} className={styles.source} title={artifact}>
            {name.replace(/_/g, " ")}: {artifact}
          </span>
        ))}
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Apply preview"
          value={boolText(data.consumerBoundary.mayApplyPreview)}
          danger={data.consumerBoundary.mayApplyPreview}
        />
        <PostureItem
          label="SpecGraph import"
          value={boolText(data.consumerBoundary.mayImportIntoSpecgraph)}
          danger={data.consumerBoundary.mayImportIntoSpecgraph}
        />
        <PostureItem
          label="Gate close"
          value={boolText(data.consumerBoundary.mayCloseSemanticGate)}
          danger={data.consumerBoundary.mayCloseSemanticGate}
        />
        <PostureItem
          label="Ontology writes"
          value={boolText(data.consumerBoundary.mayWriteOntologyPackage)}
          danger={data.consumerBoundary.mayWriteOntologyPackage}
        />
        <PostureItem
          label="Spec mutations"
          value={boolText(data.consumerBoundary.mayMutateCanonicalSpecs)}
          danger={data.consumerBoundary.mayMutateCanonicalSpecs}
        />
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.ontologyDecisionImportPreviewIsAuthority)}
          danger={data.authorityBoundary.ontologyDecisionImportPreviewIsAuthority}
        />
      </div>

      <div className={styles.entries}>
        <DecisionSection
          decisions={data.decisionImportPreviews}
          acknowledged={acknowledged}
          onAcknowledge={(previewId) =>
            setAcknowledged((current) => new Set([...current, previewId]))
          }
        />
        <IgnoredDecisionSection decisions={data.ignoredOwnerDecisions} />
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

function Pill({ value }: { value: string | null | undefined }) {
  return <span className={[styles.pill, toneClass(agentSurfaceTone(value))].join(" ")}>{compact(value)}</span>;
}

function PostureItem({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <span className={styles.postureItem}>
      <span className={styles.postureLabel}>{label}</span>
      <span className={[styles.postureValue, danger ? styles.toneDanger : styles.toneNeutral].join(" ")}>
        {value}
      </span>
    </span>
  );
}

function DecisionSection({
  decisions,
  acknowledged,
  onAcknowledge,
}: {
  decisions: readonly OntologyOwnerDecisionPreview[];
  acknowledged: ReadonlySet<string>;
  onAcknowledge: (previewId: string) => void;
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Owner decisions</span>
        <span className={styles.sectionCount}>{decisions.length}</span>
      </div>
      {decisions.length === 0 ? (
        <Status label="No owner decisions" detail="Artifact section is empty." />
      ) : (
        decisions.map((decision) => (
          <DecisionRow
            key={decision.previewId}
            decision={decision}
            acknowledged={acknowledged.has(decision.previewId)}
            onAcknowledge={() => onAcknowledge(decision.previewId)}
          />
        ))
      )}
    </div>
  );
}

function IgnoredDecisionSection({
  decisions,
}: {
  decisions: readonly OntologyIgnoredOwnerDecision[];
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Ignored decisions</span>
        <span className={styles.sectionCount}>{decisions.length}</span>
      </div>
      {decisions.length === 0 ? (
        <Status label="No ignored decisions" detail="Artifact section is empty." />
      ) : (
        decisions.map((decision) => (
          <IgnoredDecisionRow key={decision.decisionId} decision={decision} />
        ))
      )}
    </div>
  );
}

function DecisionRow({
  decision,
  acknowledged,
  onAcknowledge,
}: {
  decision: OntologyOwnerDecisionPreview;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  const before = compact(
    decision.matchedEvidenceState ?? decision.matchedSourceIntakeState,
    "unmatched",
  );
  const after = afterSemanticStatus(decision);
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{decision.decisionId}</span>
        <div className={styles.statusGroup}>
          <Pill value={decision.decisionState} />
          <Pill value={decision.previewState} />
          {acknowledged ? <Pill value="acknowledged" /> : null}
        </div>
      </div>
      <h3 className={styles.title}>{compact(decision.ontologyDecisionRef, decision.candidateId)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Candidate" value={decision.candidateId} />
        <Meta label="Intake" value={decision.intakeId} />
        <Meta label="Evidence" value={compact(decision.matchedClosedLoopEvidenceId, "unmatched")} />
        <Meta label="Owner" value={`${decision.decidedBy} · ${decision.decidedAt}`} />
        <Meta label="Before" value={before} />
        <Meta label="After" value={after} />
        <Meta label="Action" value={decision.requiredHumanAction} />
        <Meta label="Reason" value={compact(decision.reason, "none")} />
      </div>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.ackButton}
          disabled={acknowledged}
          onClick={onAcknowledge}
        >
          {acknowledged ? "Acknowledged" : "Acknowledge"}
        </button>
      </div>
    </article>
  );
}

function IgnoredDecisionRow({ decision }: { decision: OntologyIgnoredOwnerDecision }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{decision.decisionId}</span>
        <div className={styles.statusGroup}>
          <Pill value={decision.decisionState} />
          <Pill value={decision.reason} />
        </div>
      </div>
      <h3 className={styles.title}>{compact(decision.candidateId, decision.decisionId)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Intake" value={compact(decision.intakeId, "unknown")} />
        <Meta label="Evidence" value={compact(decision.sourceEvidenceState, "unmatched")} />
        <Meta label="Source intake" value={compact(decision.sourceIntakeState, "unknown")} />
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
