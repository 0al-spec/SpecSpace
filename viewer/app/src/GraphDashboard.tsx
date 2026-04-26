import { useEffect, useState } from "react";
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
    metrics?: {
      metric_count: number;
      metric_status_counts: Record<string, number>;
      metric_scores: Record<string, MetricScore>;
      below_threshold_metric_ids: string[];
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

function MetricBar({ id, m }: { id: string; m: MetricScore }) {
  const pct = Math.round(m.score * 100);
  const minPct = Math.round(m.minimum_score * 100);
  const healthy = m.status === "healthy";
  return (
    <div className="gd-metric-row">
      <div className="gd-metric-label">
        <span className="gd-metric-name">{formatKey(id)}</span>
        <span className={`gd-metric-badge ${healthy ? "gd-status-healthy" : "gd-status-attention"}`}>
          {pct}%
        </span>
      </div>
      <div className="gd-metric-track">
        <div
          className={`gd-metric-fill ${healthy ? "gd-fill-healthy" : "gd-fill-below"}`}
          style={{ width: `${pct}%` }}
        />
        <div className="gd-metric-threshold" style={{ left: `${minPct}%` }} />
      </div>
      <div className="gd-metric-sub">
        min {minPct}% · gap {healthy ? "+" : ""}{Math.round(-m.threshold_gap * 100)}pp
      </div>
    </div>
  );
}

export default function GraphDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/graph-dashboard")
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e.error ?? "Failed"));
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? e : String(e)));
  }, []);

  if (error) return <div className="gd-error">{error}</div>;
  if (!data) return <div className="gd-loading">Loading dashboard…</div>;

  const { headline_cards, sections } = data;
  const cardsBySection = headline_cards.reduce<Record<string, HeadlineCard[]>>((acc, c) => {
    (acc[c.section] ??= []).push(c);
    return acc;
  }, {});

  const generatedAt = new Date(data.generated_at).toLocaleString();

  return (
    <div className="gd-root">
      <div className="gd-header">
        <h1 className="gd-title">Graph Dashboard</h1>
        <span className="gd-ts">Generated {generatedAt}</span>
      </div>

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
              {Object.entries(sections.metrics.metric_scores).map(([id, m]) => (
                <MetricBar key={id} id={id} m={m} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
