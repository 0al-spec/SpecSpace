import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./GraphDashboard.css";

interface HeadlineCard {
  card_id: string;
  title: string;
  value: number;
  value_kind: string;
  section: string;
  status: "info" | "attention" | "healthy" | string;
  basis: string;
}

interface BacklogEntry {
  backlog_id?: string;
  subject_id: string;
  subject_kind?: string;
  title?: string;
  status?: string;
  review_state?: string;
  domain: string;
  priority: string;
  next_gap: string;
  source_artifact: string;
  source_artifact_path?: string;
  details?: Record<string, unknown>;
}

interface BacklogProjection {
  generated_at?: string;
  entry_count?: number;
  entries: BacklogEntry[];
  summary: {
    entry_count?: number;
    priority_counts: Record<string, number>;
    domain_counts: Record<string, number>;
    next_gap_counts: Record<string, number>;
  };
}

interface BacklogEnvelope {
  path: string;
  mtime: number;
  mtime_iso: string;
  data: BacklogProjection;
}

interface MetricsArtifactEnvelope<T> {
  path: string;
  mtime: number;
  mtime_iso: string;
  data: T;
}

interface SourcePromotionEntry {
  metric_id: string;
  promotion_status: string;
  review_state: string;
  next_gap: string;
  source_artifact: string;
  authority_state?: string;
  legacy_metric_ids?: string[];
  guardrails?: { requires_human_review?: boolean };
}

interface RepoSnapshot {
  current_branch?: string;
  upstream_branch?: string;
  ahead_count?: number;
  behind_count?: number;
  changed_paths?: string[];
  unrelated_changed_paths?: string[];
  handoff_changed_paths?: string[];
  has_unrelated_checkout_changes?: boolean;
  has_handoff_checkout_changes?: boolean;
}

interface DeliveryEntry {
  consumer_id: string;
  delivery_status: string;
  review_state: string;
  next_gap: string;
  source_artifact: string;
  repo_snapshot?: RepoSnapshot;
  source_handoff?: { generated_at?: string };
}

interface FeedbackEntry {
  consumer_id: string;
  feedback_status: string;
  review_state: string;
  next_gap: string;
  source_artifact: string;
}

interface MetricPackInput {
  input_id: string;
  computability: string;
  source_artifact?: string;
  source_field?: string;
  required_by_metric_ids?: string[];
  required_by_pack?: boolean;
  next_gap: string;
}

interface MetricPackAdapterEntry {
  metric_pack_id: string;
  title?: string;
  adapter_status: string;
  review_state: string;
  next_gap: string;
  input_count?: number;
  missing_input_count?: number;
  missing_inputs?: string[];
  inputs?: MetricPackInput[];
  adapter_execution?: {
    status?: string;
    next_gap?: string;
  };
}

interface MetricPackAdapterBacklogItem {
  adapter_backlog_id?: string;
  metric_pack_id: string;
  title?: string;
  input_id: string;
  computability: string;
  source_artifact?: string;
  review_state?: string;
  next_gap: string;
}

interface MetricPackAdapterArtifact {
  artifact_kind: string;
  generated_at?: string;
  review_state?: string;
  next_gap?: string;
  summary?: {
    status_counts?: Record<string, number>;
    computability_counts?: Record<string, number>;
    missing_input_counts?: Record<string, number>;
  };
  entries?: MetricPackAdapterEntry[];
  adapter_backlog?: {
    entry_count?: number;
    items?: MetricPackAdapterBacklogItem[];
    grouped_by_next_gap?: Record<string, number>;
  };
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

interface MetricPackComputedValue {
  metric_id: string;
  label?: string;
  value_status: string;
  score?: number | null;
  minimum_score?: number | null;
  threshold_gap?: number | null;
  value?: number | string | null;
  unit?: string | null;
  value_kind?: string;
  derivation_mode?: string;
  price_status?: string;
  status?: string;
  input_summary?: Record<string, unknown>;
  threshold_authority_state?: string;
}

interface MetricPackRunGap {
  subject_kind?: string;
  input_id?: string;
  metric_id?: string;
  metric_pack_id?: string;
  next_gap?: string;
  source_artifact?: string;
}

interface MetricPackRunEntry {
  run_id: string;
  metric_pack_id: string;
  title?: string;
  run_status: string;
  review_state: string;
  next_gap: string;
  adapter_status?: string;
  computed_values?: MetricPackComputedValue[];
  gaps?: MetricPackRunGap[];
  finding_projection?: {
    status?: string;
    next_gap?: string;
  };
  threshold_authority_granted?: boolean;
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

interface MetricPackRunsArtifact {
  artifact_kind: string;
  generated_at?: string;
  review_state?: string;
  next_gap?: string;
  summary?: {
    run_status_counts?: Record<string, number>;
    computed_value_count?: number;
    gap_count?: number;
  };
  entries?: MetricPackRunEntry[];
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

interface MetricPricingSurface {
  pricing_surface_id: string;
  provider?: string;
  model?: string;
  tool?: string;
  execution_profile?: string;
  reasoning_effort?: string;
  unit_convention?: string;
  currency?: string;
  pricing_version?: string;
  observed_spend?: number | null;
  derived_proxy?: number | null;
  price_status: string;
  spend_status?: string;
  model_usage_binding?: {
    status?: string;
    artifact_path?: string;
    model_usage_surface_id?: string;
    run_count?: number;
    telemetry_status?: string;
    token_usage_status?: string;
  };
  missing_price_behavior?: string;
  review_state?: string;
  next_gap: string;
}

interface MetricPricingArtifact {
  artifact_kind: string;
  generated_at?: string;
  review_state?: string;
  next_gap?: string;
  summary?: {
    status_counts?: Record<string, number>;
    observed_spend_count?: number;
    derived_proxy_count?: number;
    model_usage_binding_counts?: Record<string, number>;
  };
  entry_count?: number;
  pricing_surfaces?: MetricPricingSurface[];
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

interface ModelUsageTelemetrySurface {
  model_usage_surface_id: string;
  provider?: string;
  model?: string;
  tool?: string;
  execution_profile?: string;
  reasoning_effort?: string;
  telemetry_status: string;
  run_count?: number;
  usage_proxy?: {
    status?: string;
    unit?: string;
    value?: number;
  };
  token_usage?: {
    status?: string;
    observed_record_count?: number;
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
    missing_behavior?: string;
  };
  review_state?: string;
  next_gap: string;
}

interface ModelUsageTelemetryArtifact {
  artifact_kind: string;
  generated_at?: string;
  review_state?: string;
  next_gap?: string;
  summary?: {
    model_usage_surface_count?: number;
    run_count?: number;
    telemetry_status_counts?: Record<string, number>;
    token_usage_status_counts?: Record<string, number>;
  };
  entry_count?: number;
  model_usage_surfaces?: ModelUsageTelemetrySurface[];
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

interface MetricSignal {
  metric_id?: string;
  title?: string;
  score?: number | null;
  minimum_score?: number | null;
  status: "healthy" | "below_threshold" | string;
  threshold_gap?: number | null;
  value?: number | string | null;
  unit?: string | null;
  value_kind?: string;
  derivation_mode?: string;
  price_status?: string;
  threshold_authority_state?: string;
  input_summary?: Record<string, unknown>;
  basis?: string;
}

interface MetricSignalArtifact {
  artifact_kind: string;
  generated_at?: string;
  metrics?: MetricSignal[];
  entries?: MetricSignal[];
  canonical_mutations_allowed?: boolean;
  tracked_artifacts_written?: boolean;
}

type MetricScore = MetricSignal;

type MetricLike = {
  score?: number | null;
  minimum_score?: number | null;
  status?: string;
  threshold_gap?: number | null;
  value?: number | string | null;
  unit?: string | null;
  value_kind?: string;
  derivation_mode?: string;
  price_status?: string;
  threshold_authority_state?: string;
  input_summary?: Record<string, unknown>;
};

interface DashboardData {
  generated_at: string;
  headline_cards: HeadlineCard[];
  sections: {
    graph?: {
      total_spec_count: number;
      active_spec_count: number;
      historical_spec_count: number;
      gate_state_counts: Record<string, number>;
    };
    health?: {
      signal_counts: Record<string, number>;
      recommended_action_counts: Record<string, number>;
      named_filter_counts: Record<string, number>;
      trend_named_filter_counts: Record<string, number>;
      structural_pressure_spec_ids: string[];
      hotspot_region_count: number;
    };
    proposals?: {
      refactor_queue_entry_count: number;
      refactor_queue_active_count: number;
      proposal_queue_entry_count: number;
      proposal_queue_active_count: number;
      retrospective_refactor_queue_count: number;
      retrospective_refactor_proposal_count: number;
      retrospective_refactor_queue_ids: string[];
      retrospective_refactor_proposal_ids: string[];
      proposal_runtime_entry_count: number;
      proposal_runtime_backlog_count: number;
      proposal_runtime_posture_counts?: Record<string, number>;
      proposal_runtime_next_gap_counts?: Record<string, number>;
      proposal_promotion_traceability_counts: Record<string, number>;
      proposal_lane_active_count: number;
    };
    implementation?: {
      trace_entry_count: number;
      implementation_state_counts: Record<string, number>;
      named_filter_counts: Record<string, number>;
      implementation_backlog_count: number;
    };
    evidence?: {
      chain_status_counts: Record<string, number>;
      named_filter_counts: Record<string, number>;
      evidence_backlog_count: number;
    };
    external_consumers?: {
      entry_count: number;
      available_count: number;
      bridge_state_counts: Record<string, number>;
      metric_pressure_counts: Record<string, number>;
      named_filter_counts: Record<string, number>;
      handoff_status_counts: Record<string, number>;
      handoff_review_state_counts: Record<string, number>;
      specpm_feedback_status_counts: Record<string, number>;
      specpm_feedback_review_state_counts: Record<string, number>;
      specpm_feedback_named_filter_counts: Record<string, number>;
      metrics_delivery_status_counts: Record<string, number>;
      metrics_delivery_review_state_counts: Record<string, number>;
      metrics_delivery_named_filter_counts: Record<string, number>;
      metrics_feedback_status_counts: Record<string, number>;
      metrics_feedback_review_state_counts: Record<string, number>;
      metrics_feedback_named_filter_counts: Record<string, number>;
      metrics_source_promotion_status_counts: Record<string, number>;
      metrics_source_promotion_authority_counts: Record<string, number>;
      metrics_source_promotion_named_filter_counts: Record<string, number>;
      external_consumer_backlog_count: number;
      handoff_backlog_count: number;
      specpm_feedback_entry_count: number;
      specpm_feedback_backlog_count: number;
      metrics_delivery_entry_count: number;
      metrics_delivery_backlog_count: number;
      metrics_feedback_entry_count: number;
      metrics_feedback_backlog_count: number;
      metrics_source_promotion_entry_count: number;
      metrics_source_promotion_backlog_count: number;
    };
    metrics?: {
      metric_count: number;
      metric_pack_entry_count?: number;
      metric_pack_status_counts?: Record<string, number>;
      metric_pack_review_state_counts?: Record<string, number>;
      metric_pack_authority_counts?: Record<string, number>;
      metric_pack_named_filter_counts?: Record<string, number>;
      metric_pack_adapter_entry_count?: number;
      metric_pack_adapter_status_counts?: Record<string, number>;
      metric_pack_adapter_computability_counts?: Record<string, number>;
      metric_pack_adapter_named_filter_counts?: Record<string, number>;
      metric_pack_adapter_backlog_count?: number;
      metric_status_counts: Record<string, number>;
      metric_scores: Record<string, MetricScore>;
      below_threshold_metric_ids: string[];
      below_threshold_authoritative_metric_ids?: string[];
      threshold_proposal_entry_count?: number;
      threshold_proposal_kind_counts?: Record<string, number>;
      threshold_proposal_severity_counts?: Record<string, number>;
    };
    backlog?: {
      backlog_entry_count: number;
      priority_counts: Record<string, number>;
      domain_counts: Record<string, number>;
      next_gap_counts: Record<string, number>;
    };
  };
  viewer_projection?: {
    named_filters: Record<string, number>;
  };
}

function statusClass(status: string) {
  if (status === "healthy") return "gd-status-healthy";
  if (status === "attention") return "gd-status-attention";
  return "gd-status-info";
}

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fixKnownMetricTitleTypo(value: string) {
  return value.replace(
    /Sibling Implementation Balance/g,
    "Specification-Implementation Balance"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasScoreMetric(metric: MetricLike): metric is MetricLike & { score: number; minimum_score: number } {
  return isFiniteNumber(metric.score) && isFiniteNumber(metric.minimum_score);
}

function hasValueMetric(metric: MetricLike) {
  return metric.value !== undefined
    || Boolean(metric.value_kind)
    || Boolean(metric.derivation_mode);
}

function isMetricNotObserved(metric: MetricLike) {
  return metric.status === "not_observed" || metric.status === "not_computable";
}

function formatMetricNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return value;
}

function formatMetricValue(metric: MetricLike) {
  if (isMetricNotObserved(metric) && (metric.value === null || metric.value === undefined)) {
    return "Not observed";
  }
  const value = formatMetricNumber(metric.value);
  if (value === "—") return "Observation gap";
  return metric.unit ? `${value} ${formatKey(metric.unit)}` : value;
}

function metricGuardrail(metric: MetricLike, id?: string) {
  const valueKind = metric.value_kind ?? "";
  const derivationMode = metric.derivation_mode ?? "";
  if (valueKind.includes("not_monetary") || valueKind.includes("proxy_not_monetary") || id?.includes("_cost")) {
    return "usage proxy, not monetary spend";
  }
  if (derivationMode === "draft_sib_full_proxy" || metric.threshold_authority_state === "not_threshold_authority") {
    return "draft proxy, not threshold authority";
  }
  if (metric.status === "not_observed") {
    return "observation gap";
  }
  return "";
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} field${Object.keys(value as Record<string, unknown>).length === 1 ? "" : "s"}`;
  if (typeof value === "number") return formatMetricNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function summarizeInputSummary(summary?: Record<string, unknown>, limit = 4) {
  if (!summary) return [];
  return Object.entries(summary)
    .filter(([, value]) => value !== undefined)
    .slice(0, limit)
    .map(([key, value]) => ({ key, value: compactValue(value) }));
}

function subjectKindLabel(entry: Pick<BacklogEntry, "subject_kind"> | MetricPackRunGap) {
  if ("subject_kind" in entry && entry.subject_kind) return formatKey(entry.subject_kind);
  if ("input_id" in entry && entry.input_id) return "Metric Pack Input";
  if ("metric_id" in entry && entry.metric_id) return "Metric";
  return "Metric Pack";
}

function metricRunGapSubject(gap: MetricPackRunGap, fallbackPackId: string) {
  return gap.metric_id ?? gap.input_id ?? gap.metric_pack_id ?? fallbackPackId;
}

function isMetricPackRunsSource(entry: Pick<BacklogEntry, "source_artifact" | "source_artifact_path">) {
  return `${entry.source_artifact} ${entry.source_artifact_path ?? ""}`.includes("metric_pack_runs");
}

function artifactGeneratedAt<T extends { generated_at?: string }>(envelope: MetricsArtifactEnvelope<T>) {
  return envelope.data.generated_at ?? envelope.mtime_iso;
}

function needsBoundaryWarning(data: { canonical_mutations_allowed?: boolean; tracked_artifacts_written?: boolean }) {
  return data.canonical_mutations_allowed !== false || data.tracked_artifacts_written !== false;
}

function pricingStatusLabel(status: string) {
  if (status === "missing_price_source") return "Pricing source missing / observation gap";
  return formatKey(status);
}

function findingProjectionLabel(status?: string) {
  if (status === "deferred") return "Deferred — no proposal pressure";
  return status ? formatKey(status) : "—";
}

function CountTable({ counts, emptyMessage }: { counts: Record<string, number>; emptyMessage?: string }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  if (!entries.length) return <span className="gd-empty">{emptyMessage ?? "—"}</span>;
  return (
    <table className="gd-count-table">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="gd-ct-key">{formatKey(k)}</td>
            <td className="gd-ct-val">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetricRow({ id, m, isAlias = false }: { id: string; m: MetricScore; isAlias?: boolean }) {
  if (hasValueMetric(m) && !hasScoreMetric(m)) {
    const guardrail = metricGuardrail(m, id);
    const summary = summarizeInputSummary(m.input_summary);
    const observed = !isMetricNotObserved(m);
    return (
      <div className={`gd-metric-row gd-metric-value-row${observed ? "" : " gd-metric-value-row--muted"}`}>
        <div className="gd-metric-label">
          <span className="gd-metric-name">{fixKnownMetricTitleTypo(m.title ?? formatKey(id))}</span>
          <span className={`gd-metric-badge ${observed ? "gd-status-info" : "gd-status-attention"}`}>
            {formatKey(m.status)}
          </span>
        </div>
        <div className="gd-metric-value-line">
          <span className="gd-metric-value-main">{formatMetricValue(m)}</span>
          {guardrail && <span className="gd-metric-guardrail">{guardrail}</span>}
        </div>
        <div className="gd-metric-proxy-meta">
          {m.value_kind && <span>{formatKey(m.value_kind)}</span>}
          {m.derivation_mode && <span>{formatKey(m.derivation_mode)}</span>}
          {m.price_status && <span>pricing: {formatKey(m.price_status)}</span>}
        </div>
        {summary.length > 0 && (
          <div className="gd-metric-input-summary">
            {summary.map((item) => (
              <span key={item.key}>{formatKey(item.key)} {item.value}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!hasScoreMetric(m)) {
    return (
      <div className="gd-metric-row gd-metric-value-row gd-metric-value-row--muted">
        <div className="gd-metric-label">
          <span className="gd-metric-name">{fixKnownMetricTitleTypo(m.title ?? formatKey(id))}</span>
          <span className="gd-metric-badge gd-status-attention">{formatKey(m.status ?? "not_observed")}</span>
        </div>
        <div className="gd-metric-value-line">
          <span className="gd-metric-value-main">Observation gap</span>
        </div>
      </div>
    );
  }

  const pct = Math.round(m.score * 100);
  const minPct = Math.round(m.minimum_score * 100);
  const healthy = m.status === "healthy";
  const gap = isFiniteNumber(m.threshold_gap) ? Math.round(-m.threshold_gap * 100) : 0;
  return (
    <div className={`gd-metric-row${isAlias ? " gd-metric-alias" : ""}`}>
      <div className="gd-metric-label">
        <span className="gd-metric-name">{fixKnownMetricTitleTypo(m.title ?? formatKey(id))}</span>
        {isAlias && <span className="gd-metric-alias-badge">alias</span>}
        {!isAlias && (
          <span className={`gd-metric-badge ${healthy ? "gd-status-healthy" : "gd-status-attention"}`}>
            {pct}%
          </span>
        )}
      </div>
      <div className="gd-metric-track">
        <div
          className={`gd-metric-fill ${healthy ? "gd-fill-healthy" : "gd-fill-below"}`}
          style={{ width: `${pct}%` }}
        />
        <div className="gd-metric-threshold" style={{ left: `${minPct}%` }} />
      </div>
      <div className="gd-metric-sub">
        {isAlias ? "compatibility alias · not counted in threshold score" : `min ${minPct}% · gap ${healthy ? "+" : ""}${gap}pp`}
      </div>
    </div>
  );
}

const PRIORITY_ORDER = ["high", "medium", "low", "info"];

function BacklogOverlay({ entries, summaryCount, generatedAt, onClose }: {
  entries: BacklogEntry[];
  summaryCount: number;
  generatedAt?: string;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = [...entries].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    const unknownA = pa === -1, unknownB = pb === -1;
    if (unknownA !== unknownB) return unknownA ? 1 : -1;
    if (!unknownA && !unknownB && pa !== pb) return pa - pb;
    if (unknownA && unknownB) {
      const pc = a.priority.localeCompare(b.priority);
      if (pc !== 0) return pc;
    }
    return a.domain.localeCompare(b.domain);
  });

  const groups = sorted.reduce<Record<string, BacklogEntry[]>>((acc, e) => {
    (acc[e.priority] ??= []).push(e);
    return acc;
  }, {});
  const hasMetricRuntimeRows = entries.some(isMetricPackRunsSource);

  return createPortal(
    <div
      className="gd-overlay-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="gd-overlay-panel" role="dialog" aria-modal="true">
        <div className="gd-overlay-header">
          <div>
            <span className="gd-overlay-title">Backlog Entries ({entries.length})</span>
            {generatedAt && (
              <span className="gd-overlay-ts">
                {" "}· snapshot {new Date(generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <button className="gd-overlay-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {summaryCount !== entries.length && (
          <div className="gd-overlay-warning">
            Warning: summary.entry_count={summaryCount} but entries.length={entries.length} — artifact may be partially truncated or stale.
          </div>
        )}
        {hasMetricRuntimeRows && (
          <div className="gd-sp-guardrail-note">
            Metric runtime backlog rows may target a metric, metric pack input, or whole metric pack; source_artifact=metric_pack_runs is a read-only runtime gap.
          </div>
        )}
        <div className="gd-overlay-body">
          <table className="gd-bl-table">
            <thead>
              <tr>
                <th className="gd-bl-th">Subject</th>
                <th className="gd-bl-th">Kind</th>
                <th className="gd-bl-th">Domain</th>
                <th className="gd-bl-th">Next Gap</th>
                <th className="gd-bl-th">Source</th>
              </tr>
            </thead>
            {Object.entries(groups).map(([priority, grpEntries]) => (
              <tbody key={priority}>
                <tr className="gd-bl-group-row">
                  <td colSpan={5} className="gd-bl-group-label">{formatKey(priority)} ({grpEntries.length})</td>
                </tr>
                {grpEntries.map((e) => (
                  <tr
                    key={e.backlog_id ?? `${e.source_artifact}:${e.domain}:${e.subject_id}:${e.next_gap}`}
                    className={`gd-bl-row${isMetricPackRunsSource(e) ? " gd-bl-row--metric-runtime" : ""}`}
                  >
                    <td className="gd-bl-td gd-bl-subject">
                      {e.subject_id}
                      {e.title && <span className="gd-mp-subtext">{fixKnownMetricTitleTypo(e.title)}</span>}
                      {isMetricPackRunsSource(e) && <span className="gd-sp-badge">metric runtime</span>}
                    </td>
                    <td className="gd-bl-td gd-bl-domain">{subjectKindLabel(e)}</td>
                    <td className="gd-bl-td gd-bl-domain">{e.domain}</td>
                    <td className="gd-bl-td gd-bl-gap">{formatKey(e.next_gap)}</td>
                    <td className="gd-bl-td gd-bl-src">{e.source_artifact_path ?? e.source_artifact}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SourcePromotionOverlay({ entries, generatedAt, onClose }: {
  entries: SourcePromotionEntry[];
  generatedAt?: string;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasGuardrail = entries.some((e) => e.guardrails?.requires_human_review);

  return createPortal(
    <div
      className="gd-overlay-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="gd-overlay-panel" role="dialog" aria-modal="true">
        <div className="gd-overlay-header">
          <div>
            <span className="gd-overlay-title">Source Promotion Candidates ({entries.length})</span>
            {generatedAt && (
              <span className="gd-overlay-ts">
                {" "}· snapshot {new Date(generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <button className="gd-overlay-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {hasGuardrail && (
          <div className="gd-sp-guardrail-note">
            Source promotion requires human review — metrics do not become threshold authority automatically.
          </div>
        )}
        <div className="gd-overlay-body">
          <table className="gd-bl-table">
            <thead>
              <tr>
                <th className="gd-bl-th">Metric</th>
                <th className="gd-bl-th">Status</th>
                <th className="gd-bl-th">Authority</th>
                <th className="gd-bl-th">Review</th>
                <th className="gd-bl-th">Next Gap</th>
                <th className="gd-bl-th">Legacy</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.metric_id} className="gd-bl-row">
                  <td className="gd-bl-td gd-bl-subject">
                    {e.metric_id}
                    {e.guardrails?.requires_human_review && (
                      <span className="gd-sp-badge">review required</span>
                    )}
                  </td>
                  <td className="gd-bl-td gd-bl-gap">{formatKey(e.promotion_status)}</td>
                  <td className="gd-bl-td gd-bl-authority">{e.authority_state ? formatKey(e.authority_state) : "—"}</td>
                  <td className="gd-bl-td gd-bl-domain">{formatKey(e.review_state)}</td>
                  <td className="gd-bl-td gd-bl-gap">{formatKey(e.next_gap)}</td>
                  <td className="gd-bl-td gd-bl-legacy">
                    {e.legacy_metric_ids?.length ? e.legacy_metric_ids.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface MetricsRowEntry {
  id: string;
  status: string;
  reviewState: string;
  nextGap: string;
  source: string;
  sourceHandoffAt?: string;
  repoSnapshot?: RepoSnapshot;
}

interface MetricsRowOverlayProps {
  title: string;
  entries: MetricsRowEntry[];
  generatedAt?: string;
  onClose: () => void;
}

function RepoSnapshotRow({ snap }: { snap: RepoSnapshot }) {
  const branch = snap.current_branch ?? "?";
  const upstream = snap.upstream_branch ?? "?";
  const ahead = snap.ahead_count ?? 0;
  const behind = snap.behind_count ?? 0;
  const changedCount = snap.changed_paths?.length ?? 0;
  const unrelatedCount = snap.unrelated_changed_paths?.length ?? 0;
  const handoffCount = snap.handoff_changed_paths?.length ?? 0;

  return (
    <tr className="gd-checkout-row">
      <td colSpan={5} className="gd-checkout-td">
        <span className="gd-checkout-branch">{branch} → {upstream}</span>
        <span className="gd-checkout-sync"> ↑{ahead} ↓{behind}</span>
        {changedCount > 0 && (
          <span className="gd-checkout-changed"> · {changedCount} changed</span>
        )}
        {snap.has_unrelated_checkout_changes && (
          <span className="gd-checkout-chip gd-checkout-chip--warn">⚠ {unrelatedCount} unrelated</span>
        )}
        {snap.has_handoff_checkout_changes && (
          <span className="gd-checkout-chip gd-checkout-chip--info">{handoffCount} handoff</span>
        )}
      </td>
    </tr>
  );
}

function MetricsRowOverlay({ title, entries, generatedAt, onClose }: MetricsRowOverlayProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="gd-overlay-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="gd-overlay-panel" role="dialog" aria-modal="true">
        <div className="gd-overlay-header">
          <div>
            <span className="gd-overlay-title">{title} ({entries.length})</span>
            {generatedAt && (
              <span className="gd-overlay-ts">
                {" "}· snapshot {new Date(generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <button className="gd-overlay-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gd-overlay-body">
          <table className="gd-bl-table">
            <thead>
              <tr>
                <th className="gd-bl-th">ID</th>
                <th className="gd-bl-th">Status</th>
                <th className="gd-bl-th">Review State</th>
                <th className="gd-bl-th">Next Gap</th>
                <th className="gd-bl-th">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Fragment key={e.id}>
                  <tr className="gd-bl-row">
                    <td className="gd-bl-td gd-bl-subject">{e.id}</td>
                    <td className="gd-bl-td gd-bl-gap">{formatKey(e.status)}</td>
                    <td className="gd-bl-td gd-bl-domain">{formatKey(e.reviewState)}</td>
                    <td className="gd-bl-td gd-bl-gap">{formatKey(e.nextGap)}</td>
                    <td className="gd-bl-td gd-bl-src">
                      {e.source}
                      {e.sourceHandoffAt && (
                        <span className="gd-checkout-ts"> · {new Date(e.sourceHandoffAt).toLocaleString()}</span>
                      )}
                    </td>
                  </tr>
                  {e.repoSnapshot && <RepoSnapshotRow snap={e.repoSnapshot} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MetricsArtifactOverlayShell({
  title,
  generatedAt,
  note,
  onClose,
  children,
}: {
  title: string;
  generatedAt?: string;
  note?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="gd-overlay-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="gd-overlay-panel gd-overlay-panel--wide" role="dialog" aria-modal="true">
        <div className="gd-overlay-header">
          <div>
            <span className="gd-overlay-title">{title}</span>
            {generatedAt && (
              <span className="gd-overlay-ts">
                {" "}· snapshot {new Date(generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <button className="gd-overlay-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {note && <div className="gd-sp-guardrail-note">{note}</div>}
        <div className="gd-overlay-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function MetricPackAdaptersOverlay({
  envelope,
  onClose,
}: {
  envelope: MetricsArtifactEnvelope<MetricPackAdapterArtifact>;
  onClose: () => void;
}) {
  const data = envelope.data;
  const entries = data.entries ?? [];
  const backlogItems = data.adapter_backlog?.items ?? [];
  const rows = backlogItems.length > 0
    ? backlogItems
    : entries.flatMap((entry) => (entry.inputs ?? []).map((input) => ({
        adapter_backlog_id: `${entry.metric_pack_id}:${input.input_id}`,
        metric_pack_id: entry.metric_pack_id,
        title: entry.title,
        input_id: input.input_id,
        computability: input.computability,
        source_artifact: input.source_artifact,
        review_state: entry.review_state,
        next_gap: input.next_gap,
      })));

  return (
    <MetricsArtifactOverlayShell
      title={`Metric Pack Adapter Gaps (${rows.length})`}
      generatedAt={artifactGeneratedAt(envelope)}
      note="Adapter inputs are read-only computability observations; execution stays deferred."
      onClose={onClose}
    >
      {needsBoundaryWarning(data) && (
        <div className="gd-overlay-warning">
          Boundary warning: adapter artifact does not explicitly disable canonical mutations and tracked writes.
        </div>
      )}
      <div className="gd-mp-summary-row">
        <div className="gd-detail-block">
          <div className="gd-detail-label">Adapter Status</div>
          <CountTable counts={data.summary?.status_counts ?? {}} emptyMessage="No entries" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Computability</div>
          <CountTable counts={data.summary?.computability_counts ?? {}} emptyMessage="—" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Missing Inputs</div>
          <CountTable counts={data.summary?.missing_input_counts ?? {}} emptyMessage="No missing inputs" />
        </div>
      </div>
      <table className="gd-bl-table">
        <thead>
          <tr>
            <th className="gd-bl-th">Metric Pack</th>
            <th className="gd-bl-th">Input</th>
            <th className="gd-bl-th">Computability</th>
            <th className="gd-bl-th">Next Gap</th>
            <th className="gd-bl-th">Source Artifact</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="gd-bl-td gd-empty" colSpan={5}>No adapter gaps</td>
            </tr>
          ) : rows.map((row) => (
            <tr key={row.adapter_backlog_id ?? `${row.metric_pack_id}:${row.input_id}`} className="gd-bl-row">
              <td className="gd-bl-td gd-bl-subject">
                {row.metric_pack_id}
                {row.title && <span className="gd-mp-subtext">{row.title}</span>}
              </td>
              <td className="gd-bl-td gd-bl-subject">{row.input_id}</td>
              <td className="gd-bl-td gd-bl-gap">{formatKey(row.computability)}</td>
              <td className="gd-bl-td gd-bl-gap">{formatKey(row.next_gap)}</td>
              <td className="gd-bl-td gd-bl-src">{row.source_artifact || "missing source artifact"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MetricsArtifactOverlayShell>
  );
}

function ComputedValueRows({ values }: { values: MetricPackComputedValue[] }) {
  if (values.length === 0) {
    return <div className="gd-empty">No computed values</div>;
  }

  return (
    <table className="gd-mp-nested-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value / Score</th>
          <th>Status</th>
          <th>Derivation</th>
          <th>Input Summary</th>
        </tr>
      </thead>
      <tbody>
        {values.map((value) => {
          const scoreLike = hasScoreMetric(value);
          const metricText = scoreLike
            ? `${Math.round((value.score ?? 0) * 100)}% / min ${Math.round((value.minimum_score ?? 0) * 100)}%`
            : formatMetricValue(value);
          const guardrail = metricGuardrail(value, value.metric_id);
          const summary = summarizeInputSummary(value.input_summary, 3);
          return (
            <tr key={`${value.metric_id}:${value.value_status}:${value.derivation_mode ?? ""}`}>
              <td className="gd-bl-subject">
                {value.metric_id}
                {value.label && <span className="gd-mp-subtext">{fixKnownMetricTitleTypo(value.label)}</span>}
              </td>
              <td className="gd-bl-gap">
                {metricText}
                {guardrail && <span className="gd-metric-guardrail">{guardrail}</span>}
              </td>
              <td className="gd-bl-domain">
                {formatKey(value.status ?? value.value_status)}
                <span className="gd-mp-subtext">{formatKey(value.value_status)}</span>
              </td>
              <td className="gd-bl-src">
                {value.value_kind ? formatKey(value.value_kind) : "—"}
                {value.derivation_mode && <span className="gd-mp-subtext">{formatKey(value.derivation_mode)}</span>}
                {value.price_status && <span className="gd-mp-subtext">pricing: {formatKey(value.price_status)}</span>}
              </td>
              <td className="gd-bl-src">
                {summary.length > 0 ? summary.map((item) => (
                  <span key={item.key} className="gd-mp-summary-chip">{formatKey(item.key)} {item.value}</span>
                )) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MetricRunGapRows({ gaps, fallbackPackId }: { gaps: MetricPackRunGap[]; fallbackPackId: string }) {
  if (gaps.length === 0) {
    return <div className="gd-empty">No runtime gaps</div>;
  }

  return (
    <table className="gd-mp-nested-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Kind</th>
          <th>Next Gap</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {gaps.map((gap, index) => (
          <tr key={`${metricRunGapSubject(gap, fallbackPackId)}:${gap.next_gap ?? "gap"}:${index}`}>
            <td className="gd-bl-subject">{metricRunGapSubject(gap, fallbackPackId)}</td>
            <td className="gd-bl-domain">{subjectKindLabel(gap)}</td>
            <td className="gd-bl-gap">{formatKey(gap.next_gap ?? "unknown_gap")}</td>
            <td className="gd-bl-src">{gap.source_artifact ?? "metric_pack_runs"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetricPackRunsOverlay({
  envelope,
  onClose,
}: {
  envelope: MetricsArtifactEnvelope<MetricPackRunsArtifact>;
  onClose: () => void;
}) {
  const data = envelope.data;
  const entries = data.entries ?? [];

  return (
      <MetricsArtifactOverlayShell
        title={`Metric Pack Run Snapshot (${entries.length})`}
        generatedAt={artifactGeneratedAt(envelope)}
        note="Read-only computed preview; computed_values and gaps do not execute metrics or grant threshold authority."
        onClose={onClose}
      >
      {needsBoundaryWarning(data) && (
        <div className="gd-overlay-warning">
          Boundary warning: run artifact does not explicitly disable canonical mutations and tracked writes.
        </div>
      )}
      <div className="gd-mp-summary-row">
        <div className="gd-detail-block">
          <div className="gd-detail-label">Run Status</div>
          <CountTable counts={data.summary?.run_status_counts ?? {}} emptyMessage="No runs" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Computed Values</div>
          <span className="gd-mp-count">{data.summary?.computed_value_count ?? 0}</span>
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Gaps</div>
          <span className="gd-mp-count">{data.summary?.gap_count ?? 0}</span>
        </div>
      </div>
      <table className="gd-bl-table">
        <thead>
          <tr>
            <th className="gd-bl-th">Pack</th>
            <th className="gd-bl-th">Run Status</th>
            <th className="gd-bl-th">Values</th>
            <th className="gd-bl-th">Gaps</th>
            <th className="gd-bl-th">Finding Projection</th>
            <th className="gd-bl-th">Next Gap</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td className="gd-bl-td gd-empty" colSpan={6}>No metric pack runs</td>
            </tr>
          ) : entries.map((entry) => (
            <Fragment key={entry.run_id}>
              <tr className="gd-bl-row">
                <td className="gd-bl-td gd-bl-subject">
                  {entry.metric_pack_id}
                  {entry.title && <span className="gd-mp-subtext">{entry.title}</span>}
                </td>
                <td className="gd-bl-td gd-bl-gap">{formatKey(entry.run_status)}</td>
                <td className="gd-bl-td gd-bl-domain">{entry.computed_values?.length ?? 0}</td>
                <td className="gd-bl-td gd-bl-domain">{entry.gaps?.length ?? 0}</td>
                <td className="gd-bl-td gd-bl-gap">{findingProjectionLabel(entry.finding_projection?.status)}</td>
                <td className="gd-bl-td gd-bl-gap">{formatKey(entry.next_gap)}</td>
              </tr>
              <tr className="gd-mp-nested-row">
                <td className="gd-bl-td" colSpan={6}>
                  <div className="gd-mp-nested-grid">
                    <div className="gd-mp-nested-panel">
                      <div className="gd-detail-label">Computed Values</div>
                      <ComputedValueRows values={entry.computed_values ?? []} />
                    </div>
                    <div className="gd-mp-nested-panel">
                      <div className="gd-detail-label">Runtime Gaps</div>
                      <MetricRunGapRows gaps={entry.gaps ?? []} fallbackPackId={entry.metric_pack_id} />
                    </div>
                  </div>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </MetricsArtifactOverlayShell>
  );
}

function MetricPricingOverlay({
  envelope,
  onClose,
}: {
  envelope: MetricsArtifactEnvelope<MetricPricingArtifact>;
  onClose: () => void;
}) {
  const data = envelope.data;
  const pricingSurfaces = data.pricing_surfaces ?? [];

  return (
    <MetricsArtifactOverlayShell
      title={`Metric Pricing Provenance (${pricingSurfaces.length})`}
      generatedAt={artifactGeneratedAt(envelope)}
      note="Pricing provenance is a guardrail surface; missing prices are observation gaps, not crashes."
      onClose={onClose}
    >
      {needsBoundaryWarning(data) && (
        <div className="gd-overlay-warning">
          Boundary warning: pricing artifact does not explicitly disable canonical mutations and tracked writes.
        </div>
      )}
      <div className="gd-mp-summary-row">
        <div className="gd-detail-block">
          <div className="gd-detail-label">Price Status</div>
          <CountTable counts={data.summary?.status_counts ?? {}} emptyMessage="No pricing surfaces" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Observed Spend</div>
          <span className="gd-mp-count">{data.summary?.observed_spend_count ?? 0}</span>
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Derived Proxies</div>
          <span className="gd-mp-count">{data.summary?.derived_proxy_count ?? 0}</span>
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Model Usage Binding</div>
          <CountTable counts={data.summary?.model_usage_binding_counts ?? {}} emptyMessage="No binding" />
        </div>
      </div>
      <table className="gd-bl-table">
        <thead>
          <tr>
            <th className="gd-bl-th">Pricing Surface</th>
            <th className="gd-bl-th">Provider / Model</th>
            <th className="gd-bl-th">Tool</th>
            <th className="gd-bl-th">Price Status</th>
            <th className="gd-bl-th">Model Usage Binding</th>
            <th className="gd-bl-th">Spend</th>
            <th className="gd-bl-th">Next Gap</th>
          </tr>
        </thead>
        <tbody>
          {pricingSurfaces.map((surface) => (
            <tr key={surface.pricing_surface_id} className="gd-bl-row">
              <td className="gd-bl-td gd-bl-subject">{surface.pricing_surface_id}</td>
              <td className="gd-bl-td gd-bl-domain">
                {surface.provider ?? "—"} / {surface.model ?? "—"}
                <span className="gd-mp-subtext">{surface.pricing_version ?? "—"}</span>
              </td>
              <td className="gd-bl-td gd-bl-domain">{surface.tool ?? "—"}</td>
              <td className="gd-bl-td gd-bl-gap">{pricingStatusLabel(surface.price_status)}</td>
              <td className="gd-bl-td gd-bl-src">
                {surface.model_usage_binding?.status ?? "—"}
                {surface.model_usage_binding?.token_usage_status && (
                  <span className="gd-mp-subtext">token usage {surface.model_usage_binding.token_usage_status}</span>
                )}
              </td>
              <td className="gd-bl-td gd-bl-domain">{formatKey(surface.spend_status ?? "unknown")}</td>
              <td className="gd-bl-td gd-bl-gap">{formatKey(surface.next_gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MetricsArtifactOverlayShell>
  );
}

function ModelUsageTelemetryOverlay({
  envelope,
  onClose,
}: {
  envelope: MetricsArtifactEnvelope<ModelUsageTelemetryArtifact>;
  onClose: () => void;
}) {
  const data = envelope.data;
  const surfaces = data.model_usage_surfaces ?? [];

  return (
    <MetricsArtifactOverlayShell
      title={`Model Usage Telemetry (${surfaces.length})`}
      generatedAt={artifactGeneratedAt(envelope)}
      note="Usage proxy is not spend; missing token usage is an observation gap, not an error."
      onClose={onClose}
    >
      {needsBoundaryWarning(data) && (
        <div className="gd-overlay-warning">
          Boundary warning: telemetry artifact does not explicitly disable canonical mutations and tracked writes.
        </div>
      )}
      <div className="gd-mp-summary-row">
        <div className="gd-detail-block">
          <div className="gd-detail-label">Telemetry Status</div>
          <CountTable counts={data.summary?.telemetry_status_counts ?? {}} emptyMessage="No telemetry" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Token Usage</div>
          <CountTable counts={data.summary?.token_usage_status_counts ?? {}} emptyMessage="No token records" />
        </div>
        <div className="gd-detail-block">
          <div className="gd-detail-label">Runs</div>
          <span className="gd-mp-count">{data.summary?.run_count ?? 0}</span>
        </div>
      </div>
      <table className="gd-bl-table">
        <thead>
          <tr>
            <th className="gd-bl-th">Profile</th>
            <th className="gd-bl-th">Model</th>
            <th className="gd-bl-th">Runs</th>
            <th className="gd-bl-th">Telemetry</th>
            <th className="gd-bl-th">Token Usage</th>
            <th className="gd-bl-th">Next Gap</th>
          </tr>
        </thead>
        <tbody>
          {surfaces.map((surface) => (
            <tr key={surface.model_usage_surface_id} className="gd-bl-row">
              <td className="gd-bl-td gd-bl-subject">
                {surface.execution_profile ?? surface.model_usage_surface_id}
                <span className="gd-mp-subtext">{surface.model_usage_surface_id}</span>
              </td>
              <td className="gd-bl-td gd-bl-domain">
                {surface.provider ?? "—"} / {surface.model ?? "—"}
                <span className="gd-mp-subtext">{surface.reasoning_effort ?? "—"}</span>
              </td>
              <td className="gd-bl-td gd-bl-domain">{surface.run_count ?? 0}</td>
              <td className="gd-bl-td gd-bl-gap">{formatKey(surface.telemetry_status)}</td>
              <td className="gd-bl-td gd-bl-gap">
                {formatKey(surface.token_usage?.status ?? "unknown")}
                {surface.usage_proxy?.status === "usage_proxy_available" && (
                  <span className="gd-mp-subtext">usage proxy available, not spend</span>
                )}
              </td>
              <td className="gd-bl-td gd-bl-gap">{formatKey(surface.next_gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MetricsArtifactOverlayShell>
  );
}

export default function GraphDashboard({ buildAvailable = false }: { buildAvailable?: boolean }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [backlogEnvelope, setBacklogEnvelope] = useState<BacklogEnvelope | null>(null);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [sourcePromotionEnvelope, setSourcePromotionEnvelope] = useState<MetricsArtifactEnvelope<{ entries: SourcePromotionEntry[] }> | null>(null);
  const [sourcePromotionOpen, setSourcePromotionOpen] = useState(false);
  const [deliveryEnvelope, setDeliveryEnvelope] = useState<MetricsArtifactEnvelope<{ entries: DeliveryEntry[] }> | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [feedbackEnvelope, setFeedbackEnvelope] = useState<MetricsArtifactEnvelope<{ entries: FeedbackEntry[] }> | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [metricPackAdaptersEnvelope, setMetricPackAdaptersEnvelope] = useState<MetricsArtifactEnvelope<MetricPackAdapterArtifact> | null>(null);
  const [metricPackAdaptersOpen, setMetricPackAdaptersOpen] = useState(false);
  const [metricPackRunsEnvelope, setMetricPackRunsEnvelope] = useState<MetricsArtifactEnvelope<MetricPackRunsArtifact> | null>(null);
  const [metricPackRunsOpen, setMetricPackRunsOpen] = useState(false);
  const [metricPricingEnvelope, setMetricPricingEnvelope] = useState<MetricsArtifactEnvelope<MetricPricingArtifact> | null>(null);
  const [metricPricingOpen, setMetricPricingOpen] = useState(false);
  const [modelUsageTelemetryEnvelope, setModelUsageTelemetryEnvelope] = useState<MetricsArtifactEnvelope<ModelUsageTelemetryArtifact> | null>(null);
  const [modelUsageTelemetryOpen, setModelUsageTelemetryOpen] = useState(false);
  const [metricSignalsEnvelope, setMetricSignalsEnvelope] = useState<MetricsArtifactEnvelope<MetricSignalArtifact> | null>(null);

  const loadDashboard = useCallback(() => {
    fetch("/api/graph-dashboard")
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e.error ?? "Failed"));
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? e : String(e)));
    fetch("/api/graph-backlog-projection")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBacklogEnvelope(d ?? null))
      .catch(() => setBacklogEnvelope(null));
    fetch("/api/metrics-source-promotion")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSourcePromotionEnvelope(d ?? null))
      .catch(() => setSourcePromotionEnvelope(null));
    fetch("/api/metrics-delivery")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDeliveryEnvelope(d ?? null))
      .catch(() => setDeliveryEnvelope(null));
    fetch("/api/metrics-feedback")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFeedbackEnvelope(d ?? null))
      .catch(() => setFeedbackEnvelope(null));
    fetch("/api/metric-pack-adapters")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetricPackAdaptersEnvelope(d ?? null))
      .catch(() => setMetricPackAdaptersEnvelope(null));
    fetch("/api/metric-pack-runs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetricPackRunsEnvelope(d ?? null))
      .catch(() => setMetricPackRunsEnvelope(null));
    fetch("/api/metric-pricing-provenance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetricPricingEnvelope(d ?? null))
      .catch(() => setMetricPricingEnvelope(null));
    fetch("/api/model-usage-telemetry")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setModelUsageTelemetryEnvelope(d ?? null))
      .catch(() => setModelUsageTelemetryEnvelope(null));
    fetch("/api/metric-signals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetricSignalsEnvelope(d ?? null))
      .catch(() => setMetricSignalsEnvelope(null));
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRebuild = useCallback(async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch("/api/viewer-surfaces/build", { method: "POST" });
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setBuildError(typeof body.error === "string" ? body.error : `Build failed: HTTP ${res.status}`);
      } else {
        loadDashboard();
      }
    } catch (err) {
      setBuildError(String(err));
    } finally {
      setBuilding(false);
    }
  }, [loadDashboard]);

  if (error) return <div className="gd-error">{error}</div>;
  if (!data) return <div className="gd-loading">Loading dashboard…</div>;

  const { headline_cards, sections } = data;
  const cardsBySection = headline_cards.reduce<Record<string, HeadlineCard[]>>((acc, c) => {
    (acc[c.section] ??= []).push(c);
    return acc;
  }, {});
  const metricSignalEntries = metricSignalsEnvelope?.data.metrics ?? metricSignalsEnvelope?.data.entries ?? [];
  const metricSignalsById = new Map(
    metricSignalEntries
      .filter((metric): metric is MetricSignal & { metric_id: string } => Boolean(metric.metric_id))
      .map((metric) => [metric.metric_id, metric])
  );

  const generatedAt = new Date(data.generated_at).toLocaleString();

  return (
    <>
    <div className="gd-root">
      <div className="gd-header">
        <h1 className="gd-title">Graph Dashboard</h1>
        <span className="gd-ts">Generated {generatedAt}</span>
        {buildAvailable && (
          <button
            className="gd-rebuild-btn"
            disabled={building}
            onClick={handleRebuild}
            title="Rebuild viewer surfaces (graph_dashboard + graph_backlog_projection)"
          >
            {building ? "Rebuilding…" : "Rebuild"}
          </button>
        )}
      </div>
      {buildError && (
        <div className="gd-build-error"><strong>Build failed:</strong> {buildError}</div>
      )}

      {/* ── Headline cards ─────────────────────────────────────────────── */}
      <div className="gd-cards">
        {headline_cards.map((c) => (
          <div key={c.card_id} className={`gd-card ${statusClass(c.status)}`} title={c.basis}>
            <div className="gd-card-value">{c.value}</div>
            <div className="gd-card-title">{c.title}</div>
          </div>
        ))}
      </div>

      {/* ── Sections ───────────────────────────────────────────────────── */}
      <div className="gd-sections">

        {/* Graph */}
        {sections.graph && (
          <div className="gd-section">
            <h2 className="gd-section-title">Graph</h2>
            <div className="gd-section-cards">
              {(cardsBySection["graph"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Gate States</div>
                <CountTable counts={sections.graph.gate_state_counts} />
              </div>
            </div>
          </div>
        )}

        {/* Health */}
        {sections.health && (
          <div className="gd-section">
            <h2 className="gd-section-title">Health</h2>
            <div className="gd-section-cards">
              {(cardsBySection["health"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Signals</div>
                <CountTable counts={sections.health.signal_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Recommended Actions</div>
                <CountTable counts={sections.health.recommended_action_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Trend Recurrence</div>
                <CountTable counts={sections.health.trend_named_filter_counts} />
              </div>
            </div>
            {sections.health.structural_pressure_spec_ids.length > 0 && (
              <div className="gd-detail-row">
                <div className="gd-detail-block gd-detail-block--wide">
                  <div className="gd-detail-label">Structural Pressure Specs</div>
                  <div className="gd-tag-list">
                    {sections.health.structural_pressure_spec_ids.map((id) => (
                      <span key={id} className="gd-tag">{id}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Proposals */}
        {sections.proposals && (
          <div className="gd-section">
            <h2 className="gd-section-title">Proposals</h2>
            <div className="gd-section-cards">
              {(cardsBySection["proposals"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Promotion Traceability</div>
                <CountTable counts={sections.proposals.proposal_promotion_traceability_counts} />
              </div>
              {sections.proposals.proposal_runtime_posture_counts && (
                <div className="gd-detail-block">
                  <div className="gd-detail-label">Runtime Posture</div>
                  <CountTable counts={sections.proposals.proposal_runtime_posture_counts} />
                </div>
              )}
              {sections.proposals.proposal_runtime_next_gap_counts && (
                <div className="gd-detail-block">
                  <div className="gd-detail-label">Next Gap</div>
                  <CountTable counts={sections.proposals.proposal_runtime_next_gap_counts} />
                </div>
              )}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Queue Posture</div>
                <CountTable
                  counts={{
                    refactor_queue_active: sections.proposals.refactor_queue_active_count ?? 0,
                    refactor_queue_total: sections.proposals.refactor_queue_entry_count ?? 0,
                    proposal_queue_active: sections.proposals.proposal_queue_active_count ?? 0,
                    proposal_queue_total: sections.proposals.proposal_queue_entry_count ?? 0,
                  }}
                  emptyMessage="All queues clear"
                />
              </div>
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block gd-detail-block--wide">
                <div className="gd-detail-label">
                  Retrospective Refactor Queue ({sections.proposals.retrospective_refactor_queue_count ?? 0})
                </div>
                {(sections.proposals.retrospective_refactor_queue_ids ?? []).length > 0 ? (
                  <div className="gd-tag-list">
                    {sections.proposals.retrospective_refactor_queue_ids.map((id) => (
                      <span key={id} className="gd-tag gd-tag--attention">{id}</span>
                    ))}
                  </div>
                ) : (
                  <span className="gd-empty">No retrospective refactor candidates</span>
                )}
              </div>
              <div className="gd-detail-block gd-detail-block--wide">
                <div className="gd-detail-label">
                  Retrospective Proposal Queue ({sections.proposals.retrospective_refactor_proposal_count ?? 0})
                </div>
                {(sections.proposals.retrospective_refactor_proposal_ids ?? []).length > 0 ? (
                  <div className="gd-tag-list">
                    {sections.proposals.retrospective_refactor_proposal_ids.map((id) => (
                      <span key={id} className="gd-tag gd-tag--attention">{id}</span>
                    ))}
                  </div>
                ) : (
                  <span className="gd-empty">No retrospective proposals</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Implementation */}
        {sections.implementation && (
          <div className="gd-section">
            <h2 className="gd-section-title">Implementation</h2>
            <div className="gd-section-cards">
              {(cardsBySection["implementation"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">States</div>
                <CountTable counts={sections.implementation.implementation_state_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Filters</div>
                <CountTable counts={sections.implementation.named_filter_counts} />
              </div>
            </div>
          </div>
        )}

        {/* Evidence */}
        {sections.evidence && (
          <div className="gd-section">
            <h2 className="gd-section-title">Evidence</h2>
            <div className="gd-section-cards">
              {(cardsBySection["evidence"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Chain Status</div>
                <CountTable counts={sections.evidence.chain_status_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Filters</div>
                <CountTable counts={sections.evidence.named_filter_counts} />
              </div>
            </div>
          </div>
        )}

        {/* External Consumers */}
        {sections.external_consumers && (
          <div className="gd-section">
            <h2 className="gd-section-title">External Consumers</h2>
            <div className="gd-section-cards">
              {(cardsBySection["external_consumers"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-subsection-label">Handoffs</div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Status</div>
                <CountTable counts={sections.external_consumers.handoff_status_counts} emptyMessage="No handoffs" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Review State</div>
                <CountTable counts={sections.external_consumers.handoff_review_state_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Bridge States</div>
                <CountTable counts={sections.external_consumers.bridge_state_counts} />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Metric Pressure</div>
                <CountTable counts={sections.external_consumers.metric_pressure_counts} emptyMessage="No pressure" />
              </div>
            </div>
            <div className="gd-subsection-label">Metrics Delivery</div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Status</div>
                <CountTable counts={sections.external_consumers.metrics_delivery_status_counts} emptyMessage="No entries" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Review State</div>
                <CountTable counts={sections.external_consumers.metrics_delivery_review_state_counts} emptyMessage="—" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Filters</div>
                <CountTable counts={sections.external_consumers.metrics_delivery_named_filter_counts} emptyMessage="All clear" />
              </div>
            </div>
            {deliveryEnvelope && deliveryEnvelope.data.entries.length > 0 && (
              <div className="gd-detail-row">
                <button className="gd-backlog-browse-btn" onClick={() => setDeliveryOpen(true)}>
                  Browse entries ({deliveryEnvelope.data.entries.length})
                </button>
              </div>
            )}
            <div className="gd-subsection-label">Metrics Feedback</div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Status</div>
                <CountTable counts={sections.external_consumers.metrics_feedback_status_counts} emptyMessage="No entries" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Review State</div>
                <CountTable counts={sections.external_consumers.metrics_feedback_review_state_counts} emptyMessage="—" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Filters</div>
                <CountTable counts={sections.external_consumers.metrics_feedback_named_filter_counts} emptyMessage="All clear" />
              </div>
            </div>
            {feedbackEnvelope && feedbackEnvelope.data.entries.length > 0 && (
              <div className="gd-detail-row">
                <button className="gd-backlog-browse-btn" onClick={() => setFeedbackOpen(true)}>
                  Browse entries ({feedbackEnvelope.data.entries.length})
                </button>
              </div>
            )}
            <div className="gd-subsection-label">Source Promotion</div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Status</div>
                <CountTable counts={sections.external_consumers.metrics_source_promotion_status_counts} emptyMessage="No candidates" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Authority State</div>
                <CountTable counts={sections.external_consumers.metrics_source_promotion_authority_counts} emptyMessage="—" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Filters</div>
                <CountTable counts={sections.external_consumers.metrics_source_promotion_named_filter_counts} emptyMessage="All clear" />
              </div>
            </div>
            {sourcePromotionEnvelope && sourcePromotionEnvelope.data.entries.length > 0 && (
              <div className="gd-detail-row">
                <button className="gd-backlog-browse-btn" onClick={() => setSourcePromotionOpen(true)}>
                  Browse candidates ({sourcePromotionEnvelope.data.entries.length})
                </button>
              </div>
            )}
            {sections.external_consumers.specpm_feedback_entry_count > 0 && (
              <>
                <div className="gd-subsection-label">SpecPM Feedback</div>
                <div className="gd-detail-row">
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Status</div>
                    <CountTable counts={sections.external_consumers.specpm_feedback_status_counts} emptyMessage="No entries" />
                  </div>
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Review State</div>
                    <CountTable counts={sections.external_consumers.specpm_feedback_review_state_counts} emptyMessage="—" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Metrics */}
        {sections.metrics && (
          <div className="gd-section">
            <h2 className="gd-section-title">Metrics</h2>
            <div className="gd-section-cards">
              {(cardsBySection["metrics"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-metrics-bars">
              {(() => {
                const authoritativeIds = new Set(sections.metrics!.below_threshold_authoritative_metric_ids ?? sections.metrics!.below_threshold_metric_ids);
                const nonAuthoritativeIds = new Set(sections.metrics!.below_threshold_metric_ids.filter(id => !authoritativeIds.has(id)));
                const metricIds = Array.from(new Set([
                  ...Object.keys(sections.metrics!.metric_scores),
                  ...metricSignalsById.keys(),
                ]));
                return metricIds.map((id) => {
                  const dashboardMetric = sections.metrics!.metric_scores[id] ?? { status: "not_observed" };
                  const signalMetric = metricSignalsById.get(id);
                  const metric = signalMetric ? { ...dashboardMetric, ...signalMetric } : dashboardMetric;
                  return (
                    <MetricRow key={id} id={id} m={metric} isAlias={nonAuthoritativeIds.has(id)} />
                  );
                });
              })()}
            </div>
            {(sections.metrics.metric_pack_entry_count !== undefined ||
              metricPackAdaptersEnvelope ||
              metricPackRunsEnvelope ||
              metricPricingEnvelope ||
              modelUsageTelemetryEnvelope) && (
              <>
                <div className="gd-subsection-label">Metric Packs</div>
                <div className="gd-mp-guardrail">
                  Metric packs are diagnostic lenses; run snapshots and pricing provenance are read-only.
                </div>
                <div className="gd-detail-row">
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Pack Status</div>
                    <CountTable counts={sections.metrics.metric_pack_status_counts ?? {}} emptyMessage="No packs" />
                  </div>
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Pack Authority</div>
                    <CountTable counts={sections.metrics.metric_pack_authority_counts ?? {}} emptyMessage="—" />
                  </div>
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Adapter Status</div>
                    <CountTable counts={sections.metrics.metric_pack_adapter_status_counts ?? {}} emptyMessage="No adapters" />
                  </div>
                  <div className="gd-detail-block">
                    <div className="gd-detail-label">Computability</div>
                    <CountTable counts={sections.metrics.metric_pack_adapter_computability_counts ?? {}} emptyMessage="—" />
                  </div>
                </div>
                <div className="gd-detail-row gd-mp-actions">
                  {metricPackAdaptersEnvelope && (
                    <button className="gd-backlog-browse-btn" onClick={() => setMetricPackAdaptersOpen(true)}>
                      Browse adapter gaps ({metricPackAdaptersEnvelope.data.adapter_backlog?.entry_count ?? metricPackAdaptersEnvelope.data.adapter_backlog?.items?.length ?? 0})
                    </button>
                  )}
                  {metricPackRunsEnvelope && (
                    <button className="gd-backlog-browse-btn" onClick={() => setMetricPackRunsOpen(true)}>
                      View run snapshot ({metricPackRunsEnvelope.data.entries?.length ?? 0})
                    </button>
                  )}
                  {metricPricingEnvelope && (
                    <button className="gd-backlog-browse-btn" onClick={() => setMetricPricingOpen(true)}>
                      Pricing provenance ({metricPricingEnvelope.data.pricing_surfaces?.length ?? 0})
                    </button>
                  )}
                  {modelUsageTelemetryEnvelope && (
                    <button className="gd-backlog-browse-btn" onClick={() => setModelUsageTelemetryOpen(true)}>
                      Model usage telemetry ({modelUsageTelemetryEnvelope.data.model_usage_surfaces?.length ?? 0})
                    </button>
                  )}
                </div>
              </>
            )}
            {sections.metrics.threshold_proposal_entry_count !== undefined &&
             sections.metrics.threshold_proposal_entry_count > 0 && (
              <div className="gd-detail-row">
                <div className="gd-detail-block">
                  <div className="gd-detail-label">Threshold Proposals ({sections.metrics.threshold_proposal_entry_count})</div>
                  <CountTable counts={sections.metrics.threshold_proposal_severity_counts ?? {}} />
                </div>
                <div className="gd-detail-block">
                  <div className="gd-detail-label">Proposal Kinds</div>
                  <CountTable counts={sections.metrics.threshold_proposal_kind_counts ?? {}} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backlog */}
        {sections.backlog && (
          <div className="gd-section">
            <h2 className="gd-section-title">Backlog</h2>
            <div className="gd-section-cards">
              {(cardsBySection["backlog"] ?? []).map((c) => (
                <div key={c.card_id} className={`gd-mini-card ${statusClass(c.status)}`} title={c.basis}>
                  <span className="gd-mc-val">{c.value}</span>
                  <span className="gd-mc-lbl">{c.title}</span>
                </div>
              ))}
            </div>
            <div className="gd-detail-row">
              <div className="gd-detail-block">
                <div className="gd-detail-label">Priority</div>
                <CountTable counts={sections.backlog.priority_counts} emptyMessage="Backlog clear" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Domain</div>
                <CountTable counts={sections.backlog.domain_counts} emptyMessage="—" />
              </div>
              <div className="gd-detail-block">
                <div className="gd-detail-label">Next Gap</div>
                <CountTable counts={sections.backlog.next_gap_counts} emptyMessage="—" />
              </div>
            </div>
            {backlogEnvelope && backlogEnvelope.data.entries.length > 0 && (
              <div className="gd-detail-row">
                <button className="gd-backlog-browse-btn" onClick={() => setBacklogOpen(true)}>
                  Browse entries ({backlogEnvelope.data.entries.length})
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    {backlogOpen && backlogEnvelope && (
      <BacklogOverlay
        entries={backlogEnvelope.data.entries}
        summaryCount={
          backlogEnvelope.data.entry_count
          ?? backlogEnvelope.data.summary.entry_count
          ?? backlogEnvelope.data.entries.length
        }
        generatedAt={backlogEnvelope.mtime_iso ?? backlogEnvelope.data.generated_at}
        onClose={() => setBacklogOpen(false)}
      />
    )}
    {deliveryOpen && deliveryEnvelope && (
      <MetricsRowOverlay
        title="Metrics Delivery"
        entries={deliveryEnvelope.data.entries.map((e) => ({
          id: e.consumer_id,
          status: e.delivery_status,
          reviewState: e.review_state,
          nextGap: e.next_gap,
          source: e.source_artifact,
          sourceHandoffAt: e.source_handoff?.generated_at,
          repoSnapshot: e.repo_snapshot,
        }))}
        generatedAt={deliveryEnvelope.mtime_iso}
        onClose={() => setDeliveryOpen(false)}
      />
    )}
    {feedbackOpen && feedbackEnvelope && (
      <MetricsRowOverlay
        title="Metrics Feedback"
        entries={feedbackEnvelope.data.entries.map((e) => ({
          id: e.consumer_id,
          status: e.feedback_status,
          reviewState: e.review_state,
          nextGap: e.next_gap,
          source: e.source_artifact,
        }))}
        generatedAt={feedbackEnvelope.mtime_iso}
        onClose={() => setFeedbackOpen(false)}
      />
    )}
    {sourcePromotionOpen && sourcePromotionEnvelope && (
      <SourcePromotionOverlay
        entries={sourcePromotionEnvelope.data.entries}
        generatedAt={sourcePromotionEnvelope.mtime_iso}
        onClose={() => setSourcePromotionOpen(false)}
      />
    )}
    {metricPackAdaptersOpen && metricPackAdaptersEnvelope && (
      <MetricPackAdaptersOverlay
        envelope={metricPackAdaptersEnvelope}
        onClose={() => setMetricPackAdaptersOpen(false)}
      />
    )}
    {metricPackRunsOpen && metricPackRunsEnvelope && (
      <MetricPackRunsOverlay
        envelope={metricPackRunsEnvelope}
        onClose={() => setMetricPackRunsOpen(false)}
      />
    )}
    {metricPricingOpen && metricPricingEnvelope && (
      <MetricPricingOverlay
        envelope={metricPricingEnvelope}
        onClose={() => setMetricPricingOpen(false)}
      />
    )}
    {modelUsageTelemetryOpen && modelUsageTelemetryEnvelope && (
      <ModelUsageTelemetryOverlay
        envelope={modelUsageTelemetryEnvelope}
        onClose={() => setModelUsageTelemetryOpen(false)}
      />
    )}
    </>
  );
}
