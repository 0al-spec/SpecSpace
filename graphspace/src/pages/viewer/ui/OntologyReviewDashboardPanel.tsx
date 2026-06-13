import type {
  OntologyReviewDashboardAction,
  OntologyReviewDashboardClosedLoopEntry,
  OntologyReviewDashboardDraftRequest,
  OntologyReviewDashboardItem,
  UseOntologyReviewDashboardState,
} from "../model/use-ontology-review-dashboard";
import { agentSurfaceTone, type AgentSurfaceTone } from "../model/agent-surface-tones";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseOntologyReviewDashboardState;
};

function errorDetail(
  state: Exclude<UseOntologyReviewDashboardState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Ontology review dashboard endpoint is unreachable from the browser.";
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

export function OntologyReviewDashboardPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Ontology review dashboard">
        <Status
          label="Loading ontology review"
          detail="Reading /api/v1/ontology-review-dashboard"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Ontology review dashboard">
        <Status label="Ontology review unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data, meta } = state;

  return (
    <section className={styles.panel} aria-label="Ontology review dashboard">
      <div className={styles.summary}>
        <Metric label="Blocking" value={data.statusSummary.blockingCount} />
        <Metric label="Owner" value={data.statusSummary.reviewRequiredCount} />
        <Metric label="Pending" value={data.statusSummary.pendingDecisionCount} />
        <Metric label="Evidence" value={data.statusSummary.evidenceEntryCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>SG-RFC-{data.proposalId}</span>
          <span className={styles.surfaceTitle}>{compact(data.target.targetRef, "ontology review dashboard")}</span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.statusSummary.status} />
          <Pill value={data.statusSummary.gateState} />
          {data.statusSummary.nextGap ? <Pill value={data.statusSummary.nextGap} /> : null}
        </div>
      </div>

      <div className={styles.sourceStrip}>
        <span className={styles.source} title={meta.path}>
          dashboard: {compact(data.outputArtifact, meta.path)}
        </span>
        {Object.entries(data.sourceArtifacts).map(([name, artifact]) => (
          <span key={name} className={styles.source} title={artifact}>
            {name.replace(/_/g, " ")}: {artifact}
          </span>
        ))}
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Prompt agent"
          value={boolText(data.consumerBoundary.mayExecutePromptAgent)}
          danger={data.consumerBoundary.mayExecutePromptAgent}
        />
        <PostureItem
          label="Owner import"
          value={boolText(data.consumerBoundary.mayImportOwnerDecision)}
          danger={data.consumerBoundary.mayImportOwnerDecision}
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
          value={boolText(data.authorityBoundary.ontologyReviewDashboardIsAuthority)}
          danger={data.authorityBoundary.ontologyReviewDashboardIsAuthority}
        />
      </div>

      <div className={styles.entries}>
        <ReviewItemSection
          title="Blocking findings"
          items={data.blockingItems}
          empty="No blocking findings"
        />
        <ReviewItemSection
          title="Owner review"
          items={data.reviewRequiredItems}
          empty="No owner review items"
        />
        <DraftRequestSection requests={data.draftRequests} />
        <ClosedLoopSection entries={data.closedLoopEntries} />
        <ReviewActionSection actions={data.reviewActions} />
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

function ReviewItemSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: readonly OntologyReviewDashboardItem[];
  empty: string;
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>{title}</span>
        <span className={styles.sectionCount}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <Status label={empty} detail="Artifact section is empty." />
      ) : (
        items.map((item) => <ReviewItemRow key={item.itemId} item={item} />)
      )}
    </div>
  );
}

function DraftRequestSection({
  requests,
}: {
  requests: readonly OntologyReviewDashboardDraftRequest[];
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Draft intake</span>
        <span className={styles.sectionCount}>{requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <Status label="No draft requests" detail="Artifact section is empty." />
      ) : (
        requests.map((request) => <DraftRequestRow key={request.intakeId} request={request} />)
      )}
    </div>
  );
}

function ClosedLoopSection({
  entries,
}: {
  entries: readonly OntologyReviewDashboardClosedLoopEntry[];
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Closed loop evidence</span>
        <span className={styles.sectionCount}>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <Status label="No evidence entries" detail="Artifact section is empty." />
      ) : (
        entries.map((entry) => <ClosedLoopRow key={entry.evidenceId} entry={entry} />)
      )}
    </div>
  );
}

function ReviewActionSection({ actions }: { actions: readonly OntologyReviewDashboardAction[] }) {
  return (
    <div className={styles.actionList}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>Review actions</span>
        <span className={styles.sectionCount}>{actions.length}</span>
      </div>
      {actions.length === 0 ? (
        <Status label="No review actions" detail="The artifact did not declare actions." />
      ) : (
        actions.map((action) => (
          <ReviewActionRow key={`${action.source}:${action.action}`} action={action} />
        ))
      )}
    </div>
  );
}

function ReviewItemRow({ item }: { item: OntologyReviewDashboardItem }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{item.itemId}</span>
        <div className={styles.statusGroup}>
          <Pill value={item.reviewState} />
          <Pill value={item.itemKind} />
        </div>
      </div>
      <h3 className={styles.title}>{compact(item.term, item.itemId)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Source" value={item.source} />
        <Meta label="Classification" value={item.classification ?? "unknown"} />
        <Meta
          label="Suggested"
          value={
            item.suggestedActions.length > 0
              ? item.suggestedActions.join(", ")
              : compact(item.suggestedAction, "none")
          }
        />
      </div>
    </article>
  );
}

function DraftRequestRow({ request }: { request: OntologyReviewDashboardDraftRequest }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{request.intakeId}</span>
        <div className={styles.statusGroup}>
          <Pill value={request.intakeState} />
          <Pill value={request.reviewState} />
        </div>
      </div>
      <h3 className={styles.title}>{compact(request.term, request.candidateId)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Candidate" value={request.candidateId} />
        <Meta label="Required action" value={request.requiredHumanAction} />
        <Meta label="Blocked by" value={compact(request.blockedByGateState, "none")} />
      </div>
    </article>
  );
}

function ClosedLoopRow({ entry }: { entry: OntologyReviewDashboardClosedLoopEntry }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{entry.evidenceId}</span>
        <div className={styles.statusGroup}>
          <Pill value={entry.evidenceState} />
          <Pill value={entry.specgraphReviewState} />
        </div>
      </div>
      <h3 className={styles.title}>{compact(entry.term, entry.candidateId)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Intake" value={entry.intakeId} />
        <Meta label="Decision ref" value={compact(entry.ontologyDecisionRef, "pending")} />
        <Meta label="Required action" value={entry.requiredHumanAction} />
      </div>
    </article>
  );
}

function ReviewActionRow({ action }: { action: OntologyReviewDashboardAction }) {
  const counts = [
    action.termCount !== null ? `${action.termCount} terms` : null,
    action.candidateCount !== null ? `${action.candidateCount} candidates` : null,
  ].filter((item): item is string => !!item);
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{action.source}</span>
        <div className={styles.statusGroup}>
          <Pill value={action.writesOntologyPackage ? "writes_ontology_package" : "no_ontology_write"} />
          <Pill value={action.mutatesCanonicalSpecs ? "mutates_specs" : "no_spec_mutation"} />
        </div>
      </div>
      <h3 className={styles.title}>{action.action}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Effect" value={action.effect ?? "declared"} />
        <Meta label="Count" value={counts.length > 0 ? counts.join(", ") : "not specified"} />
        <Meta label="Terms" value={action.terms.length > 0 ? action.terms.join(", ") : "none"} />
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
