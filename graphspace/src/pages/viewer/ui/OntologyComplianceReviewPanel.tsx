import type {
  OntologyComplianceCheck,
  OntologyComplianceEntry,
  OntologyComplianceFinding,
  UseOntologyComplianceReviewState,
} from "../model/use-ontology-compliance-review";
import { agentSurfaceTone, type AgentSurfaceTone } from "../model/agent-surface-tones";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseOntologyComplianceReviewState;
};

function errorDetail(
  state: Exclude<UseOntologyComplianceReviewState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Ontology compliance endpoint is unreachable from the browser.";
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

export function OntologyComplianceReviewPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Ontology compliance review">
        <Status
          label="Loading ontology compliance"
          detail="Reading /api/v1/ontology-compliance-review"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Ontology compliance review">
        <Status label="Ontology compliance unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data, meta } = state;
  const entriesWithFindings = data.entries.filter((entry) => entry.findings.length > 0);
  const passingEntries = data.entries.filter((entry) => entry.findings.length === 0);

  return (
    <section className={styles.panel} aria-label="Ontology compliance review">
      <div className={styles.summary}>
        <Metric label="Specs" value={data.summary.specCount} />
        <Metric label="Findings" value={data.summary.findingCount} />
        <Metric label="Warnings" value={data.summary.warningCount} />
        <Metric label="Checks" value={data.summary.passedCheckCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>SG-RFC-{data.proposalId}</span>
          <span className={styles.surfaceTitle}>spec ontology validation report</span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.status} />
          <Pill value={data.reviewState} />
          {data.summary.nextGap ? <Pill value={data.summary.nextGap} /> : null}
        </div>
      </div>

      <div className={styles.sourceStrip}>
        <span className={styles.source} title={meta.path}>
          validation: {meta.path}
        </span>
        {data.ontologyIrRef ? (
          <span className={styles.source} title={data.ontologyIrRef}>
            ontology ir: {data.ontologyIrRef}
          </span>
        ) : null}
        {data.sourceBindingIndexKind ? (
          <span className={styles.source}>
            binding index: {data.sourceBindingIndexKind}
          </span>
        ) : null}
      </div>

      <div className={styles.postureStrip}>
        <PostureItem label="Legacy specs" value={data.validationModes.legacySpecs} />
        <PostureItem label="Generated artifacts" value={data.validationModes.generatedArtifacts} />
        <PostureItem
          label="Hard gate"
          value={boolText(data.validationModes.hardGateEnabled)}
          danger={data.validationModes.hardGateEnabled}
        />
        <PostureItem
          label="Canonical mutations"
          value={boolText(data.canonicalMutationsAllowed)}
          danger={data.canonicalMutationsAllowed}
        />
        <PostureItem
          label="Tracked writes"
          value={boolText(data.trackedArtifactsWritten)}
          danger={data.trackedArtifactsWritten}
        />
        <PostureItem label="Review mode" value="readonly" />
      </div>

      <div className={styles.entries}>
        <SpecSection
          title="Specs with findings"
          entries={entriesWithFindings}
          empty="No ontology compliance findings"
        />
        {passingEntries.length > 0 ? (
          <SpecSection
            title="Passing specs"
            entries={passingEntries}
            empty="No passing specs"
            compactRows
          />
        ) : null}
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

function SpecSection({
  title,
  entries,
  empty,
  compactRows = false,
}: {
  title: string;
  entries: readonly OntologyComplianceEntry[];
  empty: string;
  compactRows?: boolean;
}) {
  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionHeader}>
        <span className={styles.kicker}>{title}</span>
        <span className={styles.sectionCount}>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <Status label={empty} detail="Artifact section is empty." />
      ) : (
        entries.map((entry) => (
          <SpecRow key={entry.specId} entry={entry} compactRows={compactRows} />
        ))
      )}
    </div>
  );
}

function SpecRow({
  entry,
  compactRows,
}: {
  entry: OntologyComplianceEntry;
  compactRows: boolean;
}) {
  const checks = compactRows ? entry.checks.slice(0, 3) : entry.checks;
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{entry.specId}</span>
        <div className={styles.statusGroup}>
          <Pill value={entry.validationStatus} />
          <Pill value={`${entry.findings.length} findings`} />
          <Pill value={`${entry.checks.length} checks`} />
        </div>
      </div>
      <h3 className={styles.title}>{entry.path}</h3>
      <div className={styles.metaGrid}>
        {entry.findings.length === 0 ? (
          <Meta label="Findings" value="none" />
        ) : (
          entry.findings.map((finding) => (
            <FindingMeta key={finding.findingId} finding={finding} />
          ))
        )}
        {checks.map((check) => (
          <CheckMeta key={check.checkId} check={check} />
        ))}
        {compactRows && entry.checks.length > checks.length ? (
          <Meta label="Checks omitted" value={`${entry.checks.length - checks.length}`} />
        ) : null}
      </div>
    </article>
  );
}

function FindingMeta({ finding }: { finding: OntologyComplianceFinding }) {
  const value = [
    compact(finding.term, "no term"),
    compact(finding.severity),
    compact(finding.suggestedAction, "review"),
  ].join(" · ");
  return <Meta label={finding.classification} value={value} />;
}

function CheckMeta({ check }: { check: OntologyComplianceCheck }) {
  return (
    <Meta
      label={check.checkId}
      value={[compact(check.status), compact(check.ontologyRef ?? check.relationRef, "no ref")].join(" · ")}
    />
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
