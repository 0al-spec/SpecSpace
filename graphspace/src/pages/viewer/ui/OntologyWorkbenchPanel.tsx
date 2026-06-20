import type {
  OntologyWorkbench,
  OntologyWorkbenchArtifactStatus,
  OntologyWorkbenchComplianceEntry,
  OntologyWorkbenchGapGroup,
  OntologyWorkbenchLegacyBatch,
  OntologyWorkbenchOwnerDecisionReview,
  OntologyWorkbenchWriteGateFinding,
  UseOntologyWorkbenchState,
} from "../model/use-ontology-workbench";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseOntologyWorkbenchState;
};

function errorDetail(
  state: Exclude<UseOntologyWorkbenchState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Ontology workbench endpoint is unreachable from the browser.";
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

function sourceLabel(data: OntologyWorkbench): string {
  const provider = data.source.provider;
  return typeof provider === "string" && provider.length > 0 ? provider : "source";
}

export function OntologyWorkbenchPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Ontology workbench">
        <Status label="Loading ontology workbench" detail="Reading /api/v1/ontology-workbench" />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Ontology workbench">
        <Status label="Ontology workbench unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;

  return (
    <section className={styles.panel} aria-label="Ontology workbench">
      <div className={styles.summary}>
        <Metric label="Terms" value={data.summary.termCount} />
        <Metric label="Relations" value={data.summary.relationCount} />
        <Metric label="Gaps" value={data.summary.gapGroupCount} />
        <Metric label="Findings" value={data.summary.complianceFindingCount} />
        <Metric label="Write gate" value={data.summary.writeGateFindingCount} />
        <Metric label="Owner" value={data.summary.ownerDecisionReviewCount} />
        <Metric label="Backfill" value={data.summary.legacySmallPrBatchCount} />
        <Metric label="Missing" value={data.summary.missingArtifactCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>Ontology Workbench</span>
          <span className={styles.surfaceTitle}>
            {sourceLabel(data)} · readonly · {compact(data.package?.packageRef, "no package")}
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.summary.status} />
          <Pill value={data.normalizedIr.available ? "normalized ir" : "no normalized ir"} />
          <Pill value={compact(data.summary.nextGap, "no next gap")} />
        </div>
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.ontologyWorkbenchIsAuthority)}
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

      <div className={styles.entries}>
        <PackageSection data={data} />
        <ArtifactSection artifacts={data.artifacts} />
        <GapReviewSection groups={data.gapReview.groups} />
        <ComplianceSection entries={data.compliance.entries} />
        <WriteGateSection data={data} findings={data.writeGate.findings} />
        <OwnerDecisionSection reviews={data.ownerDecisions.reviews} />
        <LegacyBackfillSection batches={data.legacyBackfill.smallPrBatches} />
      </div>
    </section>
  );
}

function PackageSection({ data }: { data: OntologyWorkbench }) {
  const packageRef = data.package;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Package and normalized IR"
        count={data.normalizedIr.classes.length + data.normalizedIr.relations.length}
      />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>{compact(packageRef?.packageId, "no-package")}</span>
          <Pill value={compact(packageRef?.authorityClass, "no authority")} />
        </div>
        <h3 className={styles.title}>{compact(packageRef?.packageRef, "No package resolved")}</h3>
        <div className={styles.metaGrid}>
          <Meta label="Namespace" value={packageRef?.namespace} />
          <Meta label="Version" value={packageRef?.version} />
          <Meta label="Materialized IR" value={packageRef?.materializedIr} />
          <Meta label="Digest" value={packageRef?.digest} />
        </div>
      </div>
      {data.normalizedIr.classes.slice(0, 8).map((entry) => (
        <div key={entry.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{entry.id}</span>
            <Pill value={compact(entry.fqid, "class")} />
          </div>
          <h3 className={styles.title}>{compact(entry.description, "Ontology class")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="URI" value={entry.uri} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ArtifactSection({
  artifacts,
}: {
  artifacts: Record<string, OntologyWorkbenchArtifactStatus>;
}) {
  const entries = Object.entries(artifacts);
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Published artifacts" count={entries.length} />
      {entries.map(([name, artifact]) => (
        <div key={name} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{name.replace(/_/g, " ")}</span>
            <Pill value={artifact.available ? "available" : compact(artifact.reason, "missing")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Path" value={artifact.path} />
            <Meta label="Kind" value={artifact.artifactKind} />
            <Meta label="Status" value={artifact.status} />
            <Meta label="Schema" value={artifact.schemaVersion?.toString()} />
          </div>
        </div>
      ))}
    </section>
  );
}

function GapReviewSection({ groups }: { groups: readonly OntologyWorkbenchGapGroup[] }) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Gap review workflow" count={groups.length} />
      {groups.length === 0 ? (
        <Status label="No gap groups" detail="Artifact section is empty." />
      ) : null}
      {groups.map((group) => (
        <div key={group.groupId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{group.groupId}</span>
            <Pill value={group.reviewState} />
          </div>
          <h3 className={styles.title}>
            {compact(group.proposedTerm ?? group.proposedRelation ?? group.gapKey, "Ontology gap")}
          </h3>
          <div className={styles.metaGrid}>
            <Meta label="Kind" value={group.gapKind} />
            <Meta label="Owner action" value={group.recommendedOwnerAction} />
            <Meta label="Route" value={group.recommendedRoute} />
            <Meta label="Specs" value={group.sourceSpecCount.toString()} />
          </div>
        </div>
      ))}
    </section>
  );
}

function ComplianceSection({
  entries,
}: {
  entries: readonly OntologyWorkbenchComplianceEntry[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Spec ontology compliance" count={entries.length} />
      {entries.length === 0 ? (
        <Status label="No compliance findings" detail="Artifact section is empty." />
      ) : null}
      {entries.map((entry) => (
        <div key={entry.specId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{entry.specId}</span>
            <Pill value={entry.validationStatus} />
          </div>
          <h3 className={styles.title}>
            {entry.terms.length > 0 ? entry.terms.join(", ") : "Ontology findings"}
          </h3>
          <div className={styles.metaGrid}>
            <Meta label="Findings" value={entry.findingCount.toString()} />
            <Meta label="Path" value={entry.path} />
          </div>
        </div>
      ))}
    </section>
  );
}

function WriteGateSection({
  data,
  findings,
}: {
  data: OntologyWorkbench;
  findings: readonly OntologyWorkbenchWriteGateFinding[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="SpecAuthor write gate" count={findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Hard gate reject"
          value={boolText(data.writeGate.wouldRejectInHardGate)}
        />
        <PostureItem label="Write decision" value={compact(data.writeGate.writeDecision)} />
        <PostureItem label="Findings" value={findings.length.toString()} />
      </div>
      {findings.map((finding) => (
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

function OwnerDecisionSection({
  reviews,
}: {
  reviews: readonly OntologyWorkbenchOwnerDecisionReview[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Owner decision import v2" count={reviews.length} />
      {reviews.length === 0 ? (
        <Status label="No owner decisions" detail="Artifact section is empty." />
      ) : null}
      {reviews.map((review) => (
        <div key={review.reviewId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{review.reviewId}</span>
            <Pill value={review.decisionState} />
          </div>
          <h3 className={styles.title}>
            {compact(review.beforeSemanticStatus)} -&gt; {compact(review.afterSemanticStatus)}
          </h3>
          <div className={styles.metaGrid}>
            <Meta label="Decision" value={review.decisionId} />
            <Meta label="Gap group" value={review.matchedGapGroupId ?? review.gapGroupId} />
            <Meta label="Import recommended" value={boolText(review.importRecommended)} />
            <Meta label="Human action" value={review.requiredHumanAction} />
          </div>
        </div>
      ))}
    </section>
  );
}

function LegacyBackfillSection({
  batches,
}: {
  batches: readonly OntologyWorkbenchLegacyBatch[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Legacy spec backfill" count={batches.length} />
      {batches.length === 0 ? (
        <Status label="No backfill batches" detail="Artifact section is empty." />
      ) : null}
      {batches.map((batch) => (
        <div key={batch.batchId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{batch.batchId}</span>
            <Pill value={batch.reviewState} />
          </div>
          <h3 className={styles.title}>{compact(batch.recommendedPrScope, "Backfill batch")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Specs" value={batch.specCount.toString()} />
            <Meta label="Findings" value={batch.findingCount.toString()} />
            <Meta label="Ontology writes" value={boolText(batch.writesOntologyPackage)} />
            <Meta label="Spec mutations" value={boolText(batch.mutatesCanonicalSpecs)} />
          </div>
        </div>
      ))}
    </section>
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

function Pill({ value }: { value: string | null | undefined }) {
  return <span className={styles.pill}>{compact(value)}</span>;
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
      <span className={styles.metaValue}>{compact(value)}</span>
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
