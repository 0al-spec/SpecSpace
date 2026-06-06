import type {
  AgentSurfaceEntry,
  ExecutorAdapterEntry,
  UseAgentSurfacesState,
} from "../model/use-agent-surfaces";
import { agentSurfaceTone, type AgentSurfaceTone } from "../model/agent-surface-tones";
import styles from "./AgentSurfacesPanel.module.css";

type Props = {
  state: UseAgentSurfacesState;
};

function errorDetail(state: Exclude<UseAgentSurfacesState, { kind: "ok" | "idle" | "loading" }>): string {
  switch (state.kind) {
    case "http-error":
      return `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
    case "network-error":
      return "Agent surface endpoint is unreachable from the browser.";
    case "response-error":
      return state.reason;
    case "parse-error":
      return state.reason;
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

export function AgentSurfacesPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Agent surfaces">
        <Status label="Loading agent surfaces" detail="Reading /api/v1/agent-surfaces" />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Agent surfaces">
        <Status label="Agent surfaces unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;

  return (
    <section className={styles.panel} aria-label="Agent surfaces">
      <div className={styles.summary}>
        <Metric label="Surfaces" value={data.summary.surfaceCount} />
        <Metric label="Executors" value={data.summary.executorBackendCount} />
        <Metric label="Gaps" value={data.summary.verificationGapCount} />
        <Metric label="Passports missing" value={data.summary.missingPassportCount} />
      </div>

      <div className={styles.handoff}>
        <div className={styles.handoffMain}>
          <span className={styles.kicker}>SpecSpace handoff</span>
          <span className={styles.handoffId}>
            {compact(data.handoff.handoffId, "external_consumer_handoff::specspace")}
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={data.handoff.handoffStatus} />
          <Pill value={data.handoff.reviewState} />
          {data.handoff.nextGap ? <Pill value={data.handoff.nextGap} /> : null}
        </div>
      </div>

      <div className={styles.sourceStrip}>
        {Object.entries(data.sources).map(([name, source]) => (
          <span
            key={name}
            className={[
              styles.source,
              source.available ? styles.sourceOk : styles.sourceMuted,
            ].join(" ")}
            title={source.path ?? source.reason ?? name}
          >
            {name.replace(/_/g, " ")}: {source.available ? source.entryCount : "missing"}
          </span>
        ))}
      </div>

      {data.executorAdapters.length > 0 ? (
        <div className={styles.executorList}>
          {data.executorAdapters.map((entry) => (
            <ExecutorRow key={entry.backendId} entry={entry} />
          ))}
        </div>
      ) : null}

      <div className={styles.entries}>
        {data.entries.length === 0 ? (
          <Status label="No agent surfaces" detail="No stable agent surface entries are available." />
        ) : (
          data.entries.map((entry) => (
            <SurfaceRow key={entry.surfaceId} entry={entry} />
          ))
        )}
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

function ExecutorRow({ entry }: { entry: ExecutorAdapterEntry }) {
  const validationState =
    typeof entry.passportValidation.validation_state === "string"
      ? entry.passportValidation.validation_state
      : null;
  const toolStatus =
    typeof entry.passportValidation.tool_status === "string"
      ? entry.passportValidation.tool_status
      : null;
  return (
    <div className={styles.executorRow}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{entry.backendId}</span>
        <div className={styles.statusGroup}>
          <Pill value={entry.backendStatus} />
          <Pill value={entry.smokeStatus} />
        </div>
      </div>
      <h3 className={styles.title}>{entry.displayName}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Surface" value={entry.commandSurface} />
        <Meta label="Protocol" value={entry.protocolContract} />
        <Meta label="Passport tool" value={toolStatus ?? validationState ?? "unknown"} />
        <Meta label="Next" value={entry.safeNextAction ?? "none"} />
      </div>
      {entry.passportRef ? <p className={styles.passportRef}>{entry.passportRef}</p> : null}
    </div>
  );
}

function SurfaceRow({ entry }: { entry: AgentSurfaceEntry }) {
  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{entry.surfaceId}</span>
        <div className={styles.statusGroup}>
          <Pill value={entry.verificationState} />
          <Pill value={entry.runtimeEnforcementState} />
        </div>
      </div>
      <h3 className={styles.title}>{entry.title}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Type" value={entry.surfaceType} />
        <Meta label="Source" value={entry.source} />
        <Meta label="Backend" value={entry.executorBackendId ?? entry.backendStatus ?? "none"} />
        <Meta label="Gaps" value={String(entry.gapCount)} />
      </div>
      <p className={styles.passportRef}>
        {entry.passportRef ?? (entry.requiresPassport ? "missing passport" : "passport optional")}
      </p>
      {entry.gaps.length > 0 ? (
        <div className={styles.gaps}>
          {entry.gaps.map((gap) => (
            <div key={gap.gapId || `${entry.surfaceId}:${gap.gap}`} className={styles.gapRow}>
              <span className={[styles.gapSeverity, toneClass(agentSurfaceTone(gap.severity))].join(" ")}>
                {gap.severity}
              </span>
              <span className={styles.gapText}>{gap.gap}</span>
              <span className={styles.gapAction}>{gap.nextAction || gap.reason}</span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.statusNotice}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
