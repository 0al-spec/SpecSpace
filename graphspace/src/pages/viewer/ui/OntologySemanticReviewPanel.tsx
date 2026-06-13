import type {
  OntologySemanticReviewAction,
  OntologySemanticReviewItem,
  UseOntologySemanticReviewSurfaceState,
} from "../model/use-ontology-semantic-review-surface";
import { agentSurfaceTone, type AgentSurfaceTone } from "../model/agent-surface-tones";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseOntologySemanticReviewSurfaceState;
};

function errorDetail(
  state: Exclude<UseOntologySemanticReviewSurfaceState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Ontology semantic review endpoint is unreachable from the browser.";
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

export function OntologySemanticReviewPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Ontology semantic review">
        <Status
          label="Loading ontology review"
          detail="Reading /api/v1/ontology-semantic-review-surface"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Ontology semantic review">
        <Status label="Ontology review unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data, meta } = state;
  const blockedItems = data.reviewItems.filter((item) => item.reviewState.includes("blocked"));
  const ownerReviewItems = data.reviewItems.filter(
    (item) => item.reviewState.includes("review") && !item.reviewState.includes("blocked"),
  );
  const remainingItems = data.reviewItems.filter(
    (item) => !blockedItems.includes(item) && !ownerReviewItems.includes(item),
  );

  return (
    <section className={styles.panel} aria-label="Ontology semantic review">
      <div className={styles.summary}>
        <Metric label="Blocking" value={data.summary.blockingCount} />
        <Metric label="Review" value={data.summary.reviewRequiredCount} />
        <Metric label="Candidates" value={data.summary.candidateCount} />
        <Metric label="Items" value={data.summary.reviewItemCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>SG-RFC-{data.proposalId}</span>
          <span className={styles.surfaceTitle}>{compact(data.target.targetRef, "ontology semantic review")}</span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.summary.status} />
          {data.summary.nextGap ? <Pill value={data.summary.nextGap} /> : null}
        </div>
      </div>

      <div className={styles.sourceStrip}>
        <span className={styles.source} title={meta.path}>
          surface: {compact(data.outputArtifact, meta.path)}
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
          label="Lockfile"
          value={boolText(data.consumerBoundary.mayUpdateOntologyLockfile)}
          danger={data.consumerBoundary.mayUpdateOntologyLockfile}
        />
        <PostureItem
          label="Accept term"
          value={boolText(data.consumerBoundary.mayMarkCandidateAccepted)}
          danger={data.consumerBoundary.mayMarkCandidateAccepted}
        />
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.semanticReviewSurfaceIsAuthority)}
          danger={data.authorityBoundary.semanticReviewSurfaceIsAuthority}
        />
      </div>

      <div className={styles.entries}>
        <Section title="Blocking findings" items={blockedItems} empty="No blocking findings" />
        <Section title="Owner review" items={ownerReviewItems} empty="No owner review items" />
        {remainingItems.length > 0 ? (
          <Section title="Other review items" items={remainingItems} empty="No other review items" />
        ) : null}

        <div className={styles.actionList}>
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}>Review actions</span>
            <span className={styles.sectionCount}>{data.reviewActions.length}</span>
          </div>
          {data.reviewActions.length === 0 ? (
            <Status label="No review actions" detail="The artifact did not declare actions." />
          ) : (
            data.reviewActions.map((action) => (
              <ReviewActionRow key={`${action.source}:${action.action}`} action={action} />
            ))
          )}
        </div>
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

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: readonly OntologySemanticReviewItem[];
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

function ReviewItemRow({ item }: { item: OntologySemanticReviewItem }) {
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

function ReviewActionRow({ action }: { action: OntologySemanticReviewAction }) {
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
