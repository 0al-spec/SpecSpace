import { useCallback, useEffect, useRef, useState } from "react";
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
  domain: string;
  priority: string;
  next_gap: string;
  source_artifact: string;
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

interface MetricScore {
  score: number;
  minimum_score: number;
  status: "healthy" | "below_threshold" | string;
  threshold_gap: number;
}

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

function MetricBar({ id, m, isAlias = false }: { id: string; m: MetricScore; isAlias?: boolean }) {
  const pct = Math.round(m.score * 100);
  const minPct = Math.round(m.minimum_score * 100);
  const healthy = m.status === "healthy";
  return (
    <div className={`gd-metric-row${isAlias ? " gd-metric-alias" : ""}`}>
      <div className="gd-metric-label">
        <span className="gd-metric-name">{formatKey(id)}</span>
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
        {isAlias ? "compatibility alias · not counted in threshold score" : `min ${minPct}% · gap ${healthy ? "+" : ""}${Math.round(-m.threshold_gap * 100)}pp`}
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
        <div className="gd-overlay-body">
          <table className="gd-bl-table">
            <thead>
              <tr>
                <th className="gd-bl-th">Subject</th>
                <th className="gd-bl-th">Domain</th>
                <th className="gd-bl-th">Next Gap</th>
                <th className="gd-bl-th">Source</th>
              </tr>
            </thead>
            {Object.entries(groups).map(([priority, grpEntries]) => (
              <tbody key={priority}>
                <tr className="gd-bl-group-row">
                  <td colSpan={4} className="gd-bl-group-label">{formatKey(priority)} ({grpEntries.length})</td>
                </tr>
                {grpEntries.map((e) => (
                  <tr key={e.backlog_id ?? `${e.source_artifact}:${e.domain}:${e.subject_id}:${e.next_gap}`} className="gd-bl-row">
                    <td className="gd-bl-td gd-bl-subject">{e.subject_id}</td>
                    <td className="gd-bl-td gd-bl-domain">{e.domain}</td>
                    <td className="gd-bl-td gd-bl-gap">{formatKey(e.next_gap)}</td>
                    <td className="gd-bl-td gd-bl-src">{e.source_artifact}</td>
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
                <>
                  <tr key={e.id} className="gd-bl-row">
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
                  {e.repoSnapshot && <RepoSnapshotRow key={`${e.id}-snap`} snap={e.repoSnapshot} />}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
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
                return Object.entries(sections.metrics!.metric_scores).map(([id, m]) => (
                  <MetricBar key={id} id={id} m={m} isAlias={nonAuthoritativeIds.has(id)} />
                ));
              })()}
            </div>
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
    </>
  );
}
