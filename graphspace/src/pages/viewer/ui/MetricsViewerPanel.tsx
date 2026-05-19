import { useMemo, useState } from "react";
import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import {
  filterMetricsEntries,
  filterMetricsEntriesByContext,
  sortedFilterOptions,
  type MetricsViewerContextFilter,
  type MetricsViewerFilters,
} from "../model/metrics-filters";
import type { UseMetricsIndexState } from "../model/use-metrics-index";
import styles from "./MetricsViewerPanel.module.css";

type Props = {
  state: UseMetricsIndexState;
  resolveSpecRef?: SpecRefResolver;
  contextFilter?: MetricsViewerContextFilter | null;
  onSpecIdClick?: (nodeId: string) => void;
  onClearContextFilter?: () => void;
  onAddMetricToAgentContext?: (entry: MetricsIndexEntry) => void;
  onStartConversationFromMetric?: (entry: MetricsIndexEntry) => void;
};

function errorDetail(state: Exclude<UseMetricsIndexState, { kind: "ok" | "idle" | "loading" }>): string {
  switch (state.kind) {
    case "http-error":
      return `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
    case "network-error":
      return "Metrics index endpoint is unreachable from the browser.";
    case "response-error":
      return state.reason;
    case "parse-error":
      return state.issues[0]?.message ?? "Metrics index response did not match the expected shape.";
  }
}

export function MetricsViewerPanel({
  state,
  resolveSpecRef,
  contextFilter = null,
  onSpecIdClick,
  onClearContextFilter,
  onAddMetricToAgentContext,
  onStartConversationFromMetric,
}: Props) {
  const [filters, setFilters] = useState<MetricsViewerFilters>({
    category: "",
    status: "",
    sourceKind: "",
    referenceQuery: "",
  });

  const updateFilter = (patch: Partial<MetricsViewerFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const metricsData = state.kind === "ok" ? state.data : null;
  const contextEntries = useMemo(
    () =>
      metricsData
        ? filterMetricsEntriesByContext(metricsData.entries, contextFilter)
        : [],
    [contextFilter, metricsData],
  );
  const filtered = useMemo(
    () => filterMetricsEntries(contextEntries, filters),
    [contextEntries, filters],
  );

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Metrics viewer">
        <Status label="Loading metrics" detail="Reading /api/v1/metrics" />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Metrics viewer">
        <Status label="Metrics index unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;
  const categoryOptions = sortedFilterOptions(data.filters.category_counts);
  const statusOptions = sortedFilterOptions(data.filters.status_counts);
  const sourceKindOptions = sortedFilterOptions(data.filters.source_kind_counts);

  return (
    <section className={styles.panel} aria-label="Metrics viewer">
      <div className={styles.summary}>
        <Metric label="Metrics" value={data.entry_count} />
        <Metric label="Visible" value={filtered.length} />
        <Metric label="Refs" value={data.filters.reference_texts.length} />
      </div>

      {contextFilter ? (
        <ContextFilterNotice
          value={
            contextFilter.kind === "node"
              ? `Node ${contextFilter.nodeId}`
              : `Edge ${contextFilter.edgeId}`
          }
          onClear={onClearContextFilter}
        />
      ) : null}

      <div className={styles.filters} role="group" aria-label="Metrics filters">
        <FilterSelect
          label="Category"
          value={filters.category}
          options={categoryOptions}
          onChange={(category) => updateFilter({ category })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => updateFilter({ status })}
        />
        <FilterSelect
          label="Source"
          value={filters.sourceKind}
          options={sourceKindOptions}
          onChange={(sourceKind) => updateFilter({ sourceKind })}
        />
        <label className={styles.filterField}>
          <span>Reference</span>
          <input
            value={filters.referenceQuery}
            onChange={(event) => updateFilter({ referenceQuery: event.target.value })}
            placeholder="Spec ID or metric"
          />
        </label>
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
            {name.replace(/^metrics?_/, "")}: {source.available ? source.entry_count : "missing"}
          </span>
        ))}
      </div>

      <div className={styles.entries}>
        {filtered.length === 0 ? (
          <Status label="No metrics" detail="No metric entries match the current filters." />
        ) : (
          filtered.map((entry) => (
            <MetricsRow
              key={entry.metric_key}
              entry={entry}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              onAddMetricToAgentContext={onAddMetricToAgentContext}
              onStartConversationFromMetric={onStartConversationFromMetric}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ContextFilterNotice({
  value,
  onClear,
}: {
  value: string;
  onClear?: () => void;
}) {
  return (
    <div className={styles.contextFilter} role="status">
      <div className={styles.contextFilterText}>
        <span className={styles.contextFilterLabel}>Canvas filter</span>
        <span className={styles.contextFilterValue}>{value}</span>
      </div>
      <button
        type="button"
        className={styles.contextFilterClear}
        onClick={onClear}
        disabled={!onClear}
      >
        Clear
      </button>
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

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricsRow({
  entry,
  resolveSpecRef,
  onSpecIdClick,
  onAddMetricToAgentContext,
  onStartConversationFromMetric,
}: {
  entry: MetricsIndexEntry;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  onAddMetricToAgentContext?: (entry: MetricsIndexEntry) => void;
  onStartConversationFromMetric?: (entry: MetricsIndexEntry) => void;
}) {
  const secondary = [
    entry.secondary_status,
    entry.value,
    entry.next_gap ? `next ${entry.next_gap}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.metricId}>{entry.item_id}</span>
        <span className={styles.status}>{entry.status}</span>
      </div>
      <h3 className={styles.title}>
        <SpecIdText
          text={entry.title}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />
      </h3>
      <div className={styles.scoreLine}>
        <span>{entry.category}</span>
        <ScoreBar score={entry.score} minimumScore={entry.minimum_score} />
      </div>
      {secondary.length > 0 ? (
        <div className={styles.meta}>
          {secondary.map((item) => (
            <span key={item} className={styles.chip}>
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.specRefs}>
        {entry.reference_texts.length > 0 ? (
          entry.reference_texts.slice(0, 8).map((reference) => (
            <span key={reference} className={styles.referenceChip}>
              <SpecIdText
                text={reference}
                resolveSpecRef={resolveSpecRef}
                onSpecIdClick={onSpecIdClick}
                variant="bare"
              />
            </span>
          ))
        ) : (
          <span className={styles.emptyRefs}>No references</span>
        )}
      </div>
      <div className={styles.path}>source · {entry.source_kind}</div>
      <div className={styles.contextActions}>
        <button
          type="button"
          className={styles.contextAction}
          onClick={() => onAddMetricToAgentContext?.(entry)}
          disabled={!onAddMetricToAgentContext}
        >
          Add to Agent Context
        </button>
        <button
          type="button"
          className={styles.contextAction}
          onClick={() => onStartConversationFromMetric?.(entry)}
          disabled={!onStartConversationFromMetric}
        >
          Start Conversation
        </button>
      </div>
    </article>
  );
}

function ScoreBar({
  score,
  minimumScore,
}: {
  score: number | null;
  minimumScore: number | null;
}) {
  const percent = score === null ? null : Math.round(Math.max(0, Math.min(1, score)) * 100);
  const threshold = minimumScore === null ? null : Math.round(Math.max(0, Math.min(1, minimumScore)) * 100);

  return (
    <span className={styles.scoreBar} aria-label={percent === null ? "No score" : `Score ${percent}%`}>
      <span
        className={styles.scoreFill}
        style={{ width: `${percent ?? 0}%` }}
      />
      <span className={styles.scoreText}>
        {percent === null ? "n/a" : `${percent}%`}
        {threshold === null ? "" : ` / ${threshold}%`}
      </span>
    </span>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.statusBox}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
