import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import "./SpecPMExportPreview.css";
import "./ExplorationPreviewPanel.css";
import "./ExplorationSurfacesPanel.css";
import PanelActions from "./PanelActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";

const ReactMarkdown = lazy(() => import("react-markdown"));
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface Props {
  onClose: () => void;
}

interface ProposalEntry {
  proposal_id: string;
  title: string;
  status: string;
  file_name: string;
  relative_path: string;
  mtime_iso?: string;
  content?: string;
}

interface ProposalsEnvelope {
  available: boolean;
  path: string;
  count: number;
  entries: ProposalEntry[];
  error?: string;
}

interface ArtifactEnvelope {
  available: boolean;
  filename: string;
  path: string;
  expected_kind?: string | null;
  not_built?: boolean;
  error?: string;
  generated_at?: string | null;
  artifact_kind?: string | null;
  data?: Record<string, unknown> | null;
}

interface PressureSummary {
  available: boolean;
  generated_at?: string | null;
  entry_count: number;
  proposal_ids?: string[];
  proposal_handles?: string[];
  reflective_backlog_count?: number;
  under_review_count?: number;
  policy_finding_count?: number;
  posture_counts?: Record<string, number>;
  next_gap_counts?: Record<string, number>;
  traceability_counts?: Record<string, number>;
  authority_state_counts?: Record<string, number>;
  proposal_type_counts?: Record<string, number>;
}

interface ExplorationSurfacesData {
  specgraph_dir: string;
  boundary_label: string;
  read_only: boolean;
  proposals: ProposalsEnvelope;
  artifacts: {
    conversation_memory: ArtifactEnvelope;
    exploration_preview: ArtifactEnvelope;
    graph_next_moves: ArtifactEnvelope;
    proposal_lane_overlay: ArtifactEnvelope;
    proposal_runtime_index: ArtifactEnvelope;
    proposal_promotion_index: ArtifactEnvelope;
    proposal_spec_trace_index: ArtifactEnvelope;
  };
  proposal_pressure: {
    runtime: PressureSummary;
    promotion: PressureSummary;
    lane: PressureSummary;
  };
}

type PanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: ExplorationSurfacesData };

type ProposalContentState =
  | { kind: "idle" }
  | { kind: "loading"; fileName: string }
  | { kind: "error"; fileName: string; message: string }
  | { kind: "ok"; fileName: string; content: string };

const NODE_KIND_LABEL: Record<string, string> = {
  intent: "Intent",
  assumption_cluster: "Assumptions",
  hypothesis_cluster: "Hypotheses",
  proposal_cluster: "Proposals",
  review_gate: "Review Gate",
};

const EDGE_KIND_LABEL: Record<string, string> = {
  structures_assumptions: "structures assumptions",
  raises_hypotheses: "raises hypotheses",
  suggests_proposals: "suggests proposals",
  requires_human_review: "requires human review",
};

const WARNING_TRACE_STATES = new Set(["missing_trace", "incomplete", "invalid", "ambiguous"]);
const HEALTHY_TRACE_STATES = new Set(["bounded", "declared"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}

function text(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function count(value: unknown): string {
  return typeof value === "number" ? String(value) : "0";
}

function formatKey(value: string): string {
  return value.replace(/_/g, " ");
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function boundaryViolation(data: Record<string, unknown>): boolean {
  return (
    data.canonical_mutations_allowed !== false ||
    data.tracked_artifacts_written !== false
  );
}

function proposalIdsFromMove(move: Record<string, unknown>): string[] {
  const subject = asRecord(move.subject);
  const ids = new Set<string>();
  const direct = subject.proposal_id;
  if (typeof direct === "string" && direct) ids.add(direct);
  for (const id of stringList(subject.candidate_proposal_ids)) ids.add(id);
  return [...ids].sort();
}

function isMetricRuntimeMove(move: Record<string, unknown>): boolean {
  const subject = asRecord(move.subject);
  const sourceText = [
    text(subject.source_artifact, ""),
    text(subject.source_artifact_path, ""),
    ...stringList(move.source_artifacts),
  ].join(" ");
  const nextGap = text(move.next_gap ?? subject.next_gap, "");
  return sourceText.includes("metric_pack_runs") || nextGap === "define_metric_value_adapter";
}

function moveSubjectLabel(move: Record<string, unknown>): string {
  const subject = asRecord(move.subject);
  const subjectId = text(subject.subject_id, "unknown subject");
  const subjectKind = text(subject.subject_kind, "subject");
  return `${formatKey(subjectKind)} · ${subjectId}`;
}

function traceState(record: Record<string, unknown>): string {
  return text(record.trace_status ?? record.status, "unknown");
}

function traceTone(record: Record<string, unknown>): "warning" | "healthy" | "weak" | "neutral" {
  const state = traceState(record);
  if (WARNING_TRACE_STATES.has(state)) return "warning";
  if (text(record.authority, "") === "textual_reference" && state === "inferred") return "weak";
  if (HEALTHY_TRACE_STATES.has(state)) return "healthy";
  return "neutral";
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => (
    !el.hasAttribute("disabled") &&
    el.getAttribute("aria-hidden") !== "true" &&
    el.getClientRects().length > 0
  ));
}

export default function ExplorationSurfacesPanel({ onClose }: Props) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [proposalContent, setProposalContent] = useState<ProposalContentState>({ kind: "idle" });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/exploration-surfaces");
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setState({
          kind: "error",
          message: typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        });
        return;
      }
      setState({ kind: "ok", data: body as unknown as ExplorationSurfacesData });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handlePanelKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = getFocusableElements(panel);
    if (focusable.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const focusOutsidePanel = !(active instanceof Node) || !panel.contains(active);

    if (e.shiftKey) {
      if (active === first || active === panel || focusOutsidePanel) {
        e.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || active === panel || focusOutsidePanel) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (state.kind !== "ok") return;
    const entries = state.data.proposals.entries;
    if (entries.length === 0) return;
    if (!selectedProposalId || !entries.some((entry) => entry.proposal_id === selectedProposalId)) {
      setSelectedProposalId(entries[0].proposal_id);
    }
  }, [selectedProposalId, state]);

  const selectedProposal = useMemo(() => {
    if (state.kind !== "ok" || !selectedProposalId) return null;
    return state.data.proposals.entries.find((entry) => entry.proposal_id === selectedProposalId) ?? null;
  }, [selectedProposalId, state]);

  const selectProposalForPreview = useCallback((id: string) => {
    setSelectedProposalId(id);
    window.requestAnimationFrame(() => {
      document.querySelector(".exploration-proposal-preview")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    if (!selectedProposal) {
      setProposalContent({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    const fileName = selectedProposal.file_name;
    setProposalContent({ kind: "loading", fileName });
    fetch(`/api/exploration-proposal?file=${encodeURIComponent(fileName)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
        }
        const content = typeof body.content === "string" ? body.content : "";
        setProposalContent({ kind: "ok", fileName, content });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setProposalContent({ kind: "error", fileName, message: String(err) });
      });

    return () => controller.abort();
  }, [selectedProposal]);

  return (
    <div className="specpm-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="specpm-panel exploration-surfaces-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exploration-surfaces-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="specpm-titlebar">
          <div className="specpm-title">
            <span id="exploration-surfaces-title" className="specpm-title-main">Exploration / Proposals</span>
            <span className="specpm-title-sub">Pre-canonical surfaces · read-only</span>
          </div>
          <PanelActions
            extra={[
              {
                icon: <FontAwesomeIcon icon={faRotate} spin={state.kind === "loading"} />,
                title: state.kind === "loading" ? "Loading…" : "Reload surfaces",
                onClick: state.kind === "loading" ? undefined : load,
              },
            ]}
            onClose={onClose}
          />
        </div>

        {state.kind === "error" && (
          <div className="specpm-build-error">
            <strong>Error:</strong>
            <pre>{state.message}</pre>
          </div>
        )}

        <div className="specpm-body exploration-surfaces-body">
          {state.kind === "loading" && <div className="specpm-info">Loading exploration surfaces…</div>}
          {state.kind === "ok" && (
            <>
              <div className="exploration-boundary-banner">
                {state.data.boundary_label}
                <span> No direct promote, edit, import, or canonical graph mutation action is exposed here.</span>
              </div>
              <div className="exploration-surfaces-grid">
                <ProposalsBrowser
                  proposals={state.data.proposals}
                  selectedId={selectedProposalId}
                  onSelect={setSelectedProposalId}
                />
                <div className="exploration-surfaces-stack">
                  <ProposalPreview proposal={selectedProposal} contentState={proposalContent} />
                  <ProposalSpecTracePanel
                    artifact={state.data.artifacts.proposal_spec_trace_index}
                    selectedProposal={selectedProposal}
                  />
                  <ConversationMemoryPanel artifact={state.data.artifacts.conversation_memory} />
                  <ExplorationPreviewReadOnly artifact={state.data.artifacts.exploration_preview} />
                  <NextMovesPanel
                    artifact={state.data.artifacts.graph_next_moves}
                    pressure={state.data.proposal_pressure}
                    proposalsById={new Map(state.data.proposals.entries.map((p) => [p.proposal_id, p]))}
                    onSelectProposal={selectProposalForPreview}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function proposalMatchesQuery(proposal: ProposalEntry, query: string): boolean {
  const q = query.toLowerCase();
  return (
    proposal.proposal_id.toLowerCase().includes(q) ||
    proposal.title.toLowerCase().includes(q) ||
    proposal.status.toLowerCase().includes(q) ||
    proposal.file_name.toLowerCase().includes(q)
  );
}

function ProposalsBrowser({
  proposals,
  selectedId,
  onSelect,
}: {
  proposals: ProposalsEnvelope;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return proposals.entries;
    return proposals.entries.filter((p) => proposalMatchesQuery(p, searchQuery.trim()));
  }, [proposals.entries, searchQuery]);

  const selectedIndex = filtered.findIndex((p) => p.proposal_id === selectedId);
  const tabbableId = selectedId ?? filtered[0]?.proposal_id ?? null;

  const focusProposalRow = useCallback((proposalId: string) => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-proposal-id]") ?? []);
    const row = rows.find((item) => item.dataset.proposalId === proposalId);
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }, []);

  const selectByIndex = useCallback((index: number) => {
    const proposal = filtered[index];
    if (!proposal) return;
    onSelect(proposal.proposal_id);
    window.requestAnimationFrame(() => focusProposalRow(proposal.proposal_id));
  }, [filtered, focusProposalRow, onSelect]);

  const handleListKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(e.key)) return;
    if (filtered.length === 0) return;

    e.preventDefault();
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    if (e.key === "Home") {
      selectByIndex(0);
      return;
    }
    if (e.key === "End") {
      selectByIndex(filtered.length - 1);
      return;
    }
    if (e.key === "PageDown") {
      selectByIndex(Math.min(filtered.length - 1, currentIndex + 6));
      return;
    }
    if (e.key === "PageUp") {
      selectByIndex(Math.max(0, currentIndex - 6));
      return;
    }
    selectByIndex(
      e.key === "ArrowDown"
        ? Math.min(filtered.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1),
    );
  }, [filtered, selectByIndex, selectedIndex]);

  const handleSearchKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault();
      const target = selectedId && filtered.some((p) => p.proposal_id === selectedId)
        ? selectedId
        : filtered[0].proposal_id;
      focusProposalRow(target);
    }
    if (e.key === "Escape" && searchQuery) {
      e.preventDefault();
      e.stopPropagation();
      setSearchQuery("");
    }
  }, [filtered, selectedId, searchQuery, focusProposalRow]);

  return (
    <section className="exploration-surface-section exploration-proposals-browser">
      <div className="exploration-section-head">
        <div>
          <h3>Proposals Browser</h3>
          <p>{proposals.available ? `${proposals.count} markdown proposals` : "docs/proposals not available"}</p>
        </div>
      </div>
      {proposals.available && proposals.entries.length > 0 && (
        <div className="exploration-search-wrap">
          <input
            ref={searchRef}
            type="text"
            className="exploration-search-input"
            placeholder="Search proposals…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search proposals"
          />
          {searchQuery && (
            <span className="exploration-search-count">
              {filtered.length}/{proposals.entries.length}
            </span>
          )}
        </div>
      )}
      {!proposals.available ? (
        <ArtifactEmpty label={proposals.error ?? "docs/proposals not found"} />
      ) : proposals.entries.length === 0 ? (
        <ArtifactEmpty label="No proposal markdown files found" />
      ) : filtered.length === 0 ? (
        <ArtifactEmpty label={`No proposals matching "${searchQuery}"`} />
      ) : (
        <div
          ref={listRef}
          className="exploration-proposal-list"
          aria-label="Proposal markdown files"
          onKeyDown={handleListKeyDown}
        >
          {filtered.map((proposal) => (
            <button
              type="button"
              key={proposal.file_name}
              data-proposal-id={proposal.proposal_id}
              className={`exploration-proposal-row ${selectedId === proposal.proposal_id ? "selected" : ""}`}
              aria-current={selectedId === proposal.proposal_id ? "true" : undefined}
              tabIndex={tabbableId === proposal.proposal_id ? 0 : -1}
              onClick={() => onSelect(proposal.proposal_id)}
            >
              <span className="exploration-proposal-id">{proposal.proposal_id}</span>
              <span className="exploration-proposal-title">{proposal.title}</span>
              <span className="exploration-proposal-meta">
                <span className="exploration-chip">{proposal.status}</span>
                <span>{proposal.file_name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProposalPreview({
  proposal,
  contentState,
}: {
  proposal: ProposalEntry | null;
  contentState: ProposalContentState;
}) {
  const contentReady = proposal && contentState.kind === "ok" && contentState.fileName === proposal.file_name;
  const contentLoading = proposal && (
    contentState.kind === "loading" ||
    (contentState.kind !== "error" && contentState.kind !== "ok") ||
    ("fileName" in contentState && contentState.fileName !== proposal.file_name)
  );
  const contentError = proposal && contentState.kind === "error" && contentState.fileName === proposal.file_name;

  return (
    <section className="exploration-surface-section exploration-proposal-preview">
      <div className="exploration-section-head">
        <div>
          <h3>Proposal Markdown Preview</h3>
          <p>{proposal ? proposal.relative_path : "Select a proposal"}</p>
        </div>
        {proposal && <span className="exploration-chip tone-draft">{proposal.status}</span>}
      </div>
      {!proposal ? (
        <ArtifactEmpty label="Select a proposal to preview its markdown content" />
      ) : contentLoading ? (
        <div className="specpm-info exploration-preview-loading">Loading proposal markdown…</div>
      ) : contentError ? (
        <div className="exploration-empty exploration-empty-error">
          <strong>{proposal.file_name} could not be read</strong>
          <span>{contentState.message}</span>
        </div>
      ) : contentReady ? (
        <article className="exploration-md-preview">
          <Suspense fallback={<div className="specpm-info exploration-preview-loading">Rendering markdown…</div>}>
            <ReactMarkdown>{contentState.content}</ReactMarkdown>
          </Suspense>
        </article>
      ) : (
        <ArtifactEmpty label="Proposal markdown content is unavailable" />
      )}
    </section>
  );
}

function ProposalSpecTracePanel({
  artifact,
  selectedProposal,
}: {
  artifact: ArtifactEnvelope;
  selectedProposal: ProposalEntry | null;
}) {
  const data = asRecord(artifact.data);
  const entries = recordList(data.entries);
  const laneRefs = recordList(data.lane_refs);
  const entry = selectedProposal
    ? entries.find((candidate) => text(candidate.proposal_id, "") === selectedProposal.proposal_id) ?? null
    : null;
  const specRefs = entry ? recordList(entry.spec_refs) : [];
  const mentionedSpecIds = entry ? stringList(entry.mentioned_spec_ids) : [];
  const promotionTrace = entry ? asRecord(entry.promotion_trace) : {};
  const hasPromotionTrace = Object.keys(promotionTrace).length > 0;

  return (
    <section className="exploration-surface-section">
      <div className="exploration-section-head">
        <div>
          <h3>Proposal Spec Trace</h3>
          <p>Read-only proposal-to-spec trace surface; not canonical graph edges</p>
        </div>
        <ArtifactStatus artifact={artifact} />
      </div>
      {!artifact.available ? (
        <ArtifactUnavailable artifact={artifact} fallbackLabel="proposal_spec_trace_index.json not built yet" />
      ) : (
        <>
          {artifact.artifact_kind !== "proposal_spec_trace_index" && (
            <div className="exploration-warning">Unexpected artifact kind: {text(artifact.artifact_kind)}</div>
          )}
          {boundaryViolation(data) && (
            <div className="exploration-warning">
              Boundary warning: trace artifact does not explicitly disable canonical mutations and tracked writes.
            </div>
          )}
          <div className="exploration-trace-body">
            {!selectedProposal ? (
              <ArtifactEmpty label="Select a proposal to inspect its trace record" />
            ) : !entry ? (
              <ArtifactEmpty label={`No trace entry for proposal ${selectedProposal.proposal_id}`} />
            ) : (
              <>
                <div className="exploration-summary-chips">
                  <SummaryChip label="proposal" value={text(entry.proposal_id)} />
                  <SummaryChip label="status" value={text(entry.status)} />
                  <SummaryChip label="mentioned" value={String(mentionedSpecIds.length)} />
                  <SummaryChip label="spec refs" value={String(specRefs.length)} />
                  <SummaryChip label="next gap" value={text(entry.next_gap)} tone="tone-draft" />
                </div>

                <div className="exploration-trace-section">
                  <div className="exploration-table-title">Mentioned specs</div>
                  {mentionedSpecIds.length === 0 ? (
                    <div className="exploration-mini-empty">No mentioned spec ids</div>
                  ) : (
                    <div className="exploration-trace-chip-list">
                      {mentionedSpecIds.map((specId) => (
                        <span key={specId} className="exploration-chip exploration-code-chip">{specId}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="exploration-trace-section">
                  <div className="exploration-table-title">Promotion trace</div>
                  {!hasPromotionTrace ? (
                    <div className="exploration-mini-empty">No promotion trace record</div>
                  ) : (
                    <TraceRow
                      title={traceState(promotionTrace)}
                      subtitle="promotion_trace · provenance/status only"
                      record={promotionTrace}
                      fields={[
                        ["next gap", text(promotionTrace.next_gap)],
                        ["sources", String(stringList(promotionTrace.source_refs).length)],
                      ]}
                    />
                  )}
                </div>

                <div className="exploration-trace-section">
                  <div className="exploration-table-title">Spec refs</div>
                  {specRefs.length === 0 ? (
                    <div className="exploration-mini-empty">No spec refs</div>
                  ) : (
                    <div className="exploration-trace-rows">
                      {specRefs.map((ref, index) => (
                        <TraceRow
                          key={`${text(ref.spec_id, "spec")}-${index}`}
                          title={text(ref.spec_id)}
                          subtitle={`${formatKey(text(ref.relation_kind, "relation"))} · ${formatKey(text(ref.authority, "authority"))}`}
                          record={ref}
                          fields={[
                            ["trace", traceState(ref)],
                            ["next gap", text(ref.next_gap)],
                          ]}
                          sourceRefs={stringList(ref.source_refs)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="exploration-trace-section">
              <div className="exploration-table-title">Lane targets ({laneRefs.length})</div>
              <p className="exploration-trace-note">
                Lane overlay is keyed by proposal_handle and stays separate from markdown proposal id.
              </p>
              {laneRefs.length === 0 ? (
                <div className="exploration-mini-empty">No lane targets</div>
              ) : (
                <div className="exploration-trace-rows">
                  {laneRefs.map((laneRef, index) => (
                    <TraceRow
                      key={`${text(laneRef.proposal_handle, "lane")}-${index}`}
                      title={text(laneRef.target_spec_id)}
                      subtitle={text(laneRef.proposal_handle)}
                      record={laneRef}
                      fields={[
                        ["relation", text(laneRef.relation_kind)],
                        ["authority", text(laneRef.authority)],
                        ["state", text(laneRef.authority_state)],
                        ["trace", traceState(laneRef)],
                        ["next gap", text(laneRef.next_gap)],
                      ]}
                      sourceRefs={stringList(laneRef.source_refs)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function TraceRow({
  title,
  subtitle,
  record,
  fields,
  sourceRefs = [],
}: {
  title: string;
  subtitle: string;
  record: Record<string, unknown>;
  fields: [string, string][];
  sourceRefs?: string[];
}) {
  const tone = traceTone(record);
  return (
    <div className={`exploration-trace-row ${tone}`}>
      <div className="exploration-trace-main">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="exploration-trace-fields">
        {fields.map(([label, value]) => (
          <span key={label} className="exploration-trace-field">
            <span>{label}</span>
            <strong>{value}</strong>
          </span>
        ))}
      </div>
      {sourceRefs.length > 0 && (
        <div className="exploration-source-refs">
          {sourceRefs.slice(0, 4).map((sourceRef) => (
            <span key={sourceRef} className="exploration-source-ref">{sourceRef}</span>
          ))}
          {sourceRefs.length > 4 && (
            <span className="exploration-source-ref">+{sourceRefs.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationMemoryPanel({ artifact }: { artifact: ArtifactEnvelope }) {
  const data = asRecord(artifact.data);
  const sources = recordList(data.sources);
  const entries = recordList(data.entries);
  const projection = asRecord(data.viewer_projection);
  const filters = asRecord(projection.named_filters);
  const warningFilters = ["missing_attribution", "stale_notes", "invalid_notes"]
    .map((name) => ({ name, size: stringList(filters[name]).length }))
    .filter((item) => item.size > 0);

  return (
    <section className="exploration-surface-section">
      <div className="exploration-section-head">
        <div>
          <h3>Conversation Memory</h3>
          <p>Structured exploration memory, not canonical</p>
        </div>
        <ArtifactStatus artifact={artifact} />
      </div>
      {!artifact.available ? (
        <ArtifactUnavailable artifact={artifact} fallbackLabel="conversation_memory_index.json not built yet" />
      ) : (
        <>
          {artifact.artifact_kind !== "conversation_memory_index" && (
            <div className="exploration-warning">Unexpected artifact kind: {text(artifact.artifact_kind)}</div>
          )}
          {boundaryViolation(data) && (
            <div className="exploration-warning">
              Boundary warning: canonical mutations or tracked artifact writes are not explicitly disabled.
            </div>
          )}
          <div className="exploration-summary-chips">
            <SummaryChip label="sources" value={count(data.source_count)} />
            <SummaryChip label="notes" value={count(data.structured_note_count)} />
            <SummaryChip label="review" value={text(data.review_state)} />
            <SummaryChip label="next gap" value={text(data.next_gap)} tone="tone-draft" />
          </div>
          {warningFilters.length > 0 && (
            <div className="exploration-warning-row">
              {warningFilters.map((item) => (
                <span key={item.name} className="exploration-chip tone-blocked">
                  {formatKey(item.name)}: {item.size}
                </span>
              ))}
            </div>
          )}
          {sources.length === 0 && entries.length === 0 ? (
            <ArtifactEmpty label="No conversation sources or structured memory notes yet" />
          ) : (
            <div className="exploration-table-pair">
              <MemorySourcesTable sources={sources} />
              <MemoryEntriesTable entries={entries} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MemorySourcesTable({ sources }: { sources: Record<string, unknown>[] }) {
  return (
    <div className="exploration-table-wrap">
      <div className="exploration-table-title">Sources ({sources.length})</div>
      {sources.length === 0 ? (
        <div className="exploration-mini-empty">No sources</div>
      ) : (
        <table className="exploration-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>State</th>
              <th>Boundary</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, index) => (
              <tr key={`${text(source.source_id, "source")}-${index}`}>
                <td>{text(source.source_id)}</td>
                <td>{text(source.source_type)}</td>
                <td>{text(source.source_state)}</td>
                <td>{text(source.source_boundary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MemoryEntriesTable({ entries }: { entries: Record<string, unknown>[] }) {
  return (
    <div className="exploration-table-wrap">
      <div className="exploration-table-title">Entries ({entries.length})</div>
      {entries.length === 0 ? (
        <div className="exploration-mini-empty">No entries</div>
      ) : (
        <table className="exploration-table">
          <thead>
            <tr>
              <th>Note</th>
              <th>Kind</th>
              <th>Promotion</th>
              <th>Review</th>
              <th>Next gap</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={`${text(entry.memory_note_id, "entry")}-${index}`}>
                <td>
                  <strong>{text(entry.title, text(entry.memory_note_id))}</strong>
                  {typeof entry.summary === "string" && entry.summary && (
                    <span className="exploration-table-subtext">{entry.summary}</span>
                  )}
                </td>
                <td>{text(entry.note_kind)}</td>
                <td>{text(entry.promotion_state)}</td>
                <td>{text(entry.review_state)}</td>
                <td>{text(entry.next_gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ExplorationPreviewReadOnly({ artifact }: { artifact: ArtifactEnvelope }) {
  const data = asRecord(artifact.data);
  const nodes = recordList(data.nodes);
  const edges = recordList(data.edges);
  const edgesBySource = edges.reduce<Record<string, Record<string, unknown>[]>>((acc, edge) => {
    const source = text(edge.source, "");
    if (!source) return acc;
    (acc[source] ??= []).push(edge);
    return acc;
  }, {});

  return (
    <section className="exploration-surface-section">
      <div className="exploration-section-head">
        <div>
          <h3>Exploration Preview</h3>
          <p>Assumption-mode preview, visually separate from canonical graph</p>
        </div>
        <ArtifactStatus artifact={artifact} />
      </div>
      {!artifact.available ? (
        <ArtifactUnavailable artifact={artifact} fallbackLabel="exploration_preview.json not built yet" />
      ) : (
        <>
          {boundaryViolation(data) && (
            <div className="exploration-warning">
              Boundary warning: this preview does not explicitly disable canonical mutations and tracked writes.
            </div>
          )}
          <div className="exploration-summary-chips">
            <SummaryChip label="mode" value={text(data.mode, "assumption")} />
            <SummaryChip label="review" value={text(data.review_state)} />
            <SummaryChip label="nodes" value={count(data.node_count)} />
            <SummaryChip label="edges" value={count(data.edge_count)} />
            <SummaryChip label="next gap" value={text(data.next_gap)} tone="tone-draft" />
          </div>
          <div className="exploration-nodes">
            {nodes.length === 0 ? (
              <ArtifactEmpty label="No preview nodes in artifact" />
            ) : nodes.map((node) => (
              <ExplorationNodeCard
                key={text(node.id)}
                node={node}
                edges={edgesBySource[text(node.id, "")] ?? []}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ExplorationNodeCard({
  node,
  edges,
}: {
  node: Record<string, unknown>;
  edges: Record<string, unknown>[];
}) {
  const kind = text(node.kind, "unknown");
  const label = NODE_KIND_LABEL[kind] ?? formatKey(kind);

  return (
    <div className="exploration-node-card exploration-surfaces-node-card">
      <div className="exploration-node-header">
        <span className="exploration-node-kind-badge">{label}</span>
        <span className="exploration-node-id">{text(node.id)}</span>
      </div>
      <div className="exploration-node-label">{text(node.label)}</div>
      {text(node.text, "") && text(node.text) !== text(node.label) && (
        <div className="exploration-node-text">{text(node.text)}</div>
      )}
      <div className="exploration-node-meta">
        <span className="exploration-node-meta-item">{text(node.status)}</span>
        <span className="exploration-node-meta-item">{text(node.confidence)}</span>
        <span className="exploration-node-meta-item">{text(node.layer)}</span>
      </div>
      {edges.length > 0 && (
        <div className="exploration-node-edges">
          {edges.map((edge, index) => {
            const kindLabel = text(edge.edge_kind, "edge");
            return (
              <span key={`${kindLabel}-${index}`} className="exploration-edge-chip">
                → {EDGE_KIND_LABEL[kindLabel] ?? formatKey(kindLabel)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NextMovesPanel({
  artifact,
  pressure,
  proposalsById,
  onSelectProposal,
}: {
  artifact: ArtifactEnvelope;
  pressure: ExplorationSurfacesData["proposal_pressure"];
  proposalsById: Map<string, ProposalEntry>;
  onSelectProposal: (id: string) => void;
}) {
  const data = asRecord(artifact.data);
  const move = asRecord(data.recommended_next_move);
  const alternatives = recordList(data.alternatives).slice(0, 3);
  const recommendedIds = proposalIdsFromMove(move);

  return (
    <section className="exploration-surface-section">
      <div className="exploration-section-head">
        <div>
          <h3>Next Moves / Proposal Pressure</h3>
          <p>Advisory guidance and proposal artifact counts; not canonical</p>
        </div>
        <ArtifactStatus artifact={artifact} />
      </div>
      {!artifact.available ? (
        <ArtifactUnavailable artifact={artifact} fallbackLabel="graph_next_moves.json not built yet" />
      ) : (
        <>
          {boundaryViolation(data) && (
            <div className="exploration-warning">
              Boundary warning: next-move artifact does not explicitly disable canonical mutations and tracked writes.
            </div>
          )}
          <div className="exploration-next-move">
            <div className="exploration-next-move-kicker">
              {text(data.current_scene)} · {text(data.scene_confidence)} confidence
            </div>
            <h4>{text(move.title, "No recommended move")}</h4>
            <p>{text(move.reason, "No reason supplied.")}</p>
            <div className="exploration-summary-chips">
              <SummaryChip label="kind" value={text(move.kind)} />
              <SummaryChip label="next gap" value={text(move.next_gap)} tone="tone-draft" />
              <SummaryChip label="review" value={move.review_required === true ? "required" : "advisory"} />
            </div>
            {isMetricRuntimeMove(move) && (
              <div className="exploration-runtime-move">
                <span className="exploration-runtime-label">Metric runtime executable gap</span>
                <span>{moveSubjectLabel(move)}</span>
                <span>{formatKey(text(move.next_gap, "define_metric_value_adapter"))}</span>
              </div>
            )}
            {text(move.command_hint, "") && (
              <div className="exploration-command-hint">{text(move.command_hint)}</div>
            )}
            {recommendedIds.length > 0 && (
              <ProposalIdLinks
                ids={recommendedIds}
                proposalsById={proposalsById}
                onSelectProposal={onSelectProposal}
              />
            )}
          </div>
          {alternatives.length > 0 && (
            <div className="exploration-alternatives">
              <div className="exploration-table-title">Alternatives</div>
              {alternatives.map((alt) => {
                const altProposalIds = proposalIdsFromMove(alt);
                return (
                  <div key={text(alt.move_id, text(alt.title))} className="exploration-alt-row">
                    <div className="exploration-alt-main">
                      <span>{text(alt.title)}</span>
                      {altProposalIds.length > 0 && (
                        <ProposalIdLinks
                          ids={altProposalIds}
                          proposalsById={proposalsById}
                          onSelectProposal={onSelectProposal}
                        />
                      )}
                    </div>
                    <span>{text(alt.next_gap)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <ProposalPressurePanel
        pressure={pressure}
        proposalsById={proposalsById}
        onSelectProposal={onSelectProposal}
      />
    </section>
  );
}

function ProposalPressurePanel({
  pressure,
  proposalsById,
  onSelectProposal,
}: {
  pressure: ExplorationSurfacesData["proposal_pressure"];
  proposalsById: Map<string, ProposalEntry>;
  onSelectProposal: (id: string) => void;
}) {
  return (
    <div className="exploration-pressure-grid">
      <PressureCard
        label="Runtime"
        summary={pressure.runtime}
        primaryCountLabel="backlog"
        primaryCount={pressure.runtime.reflective_backlog_count}
        countMap={pressure.runtime.posture_counts}
        secondaryMap={pressure.runtime.next_gap_counts}
        proposalsById={proposalsById}
        onSelectProposal={onSelectProposal}
      />
      <PressureCard
        label="Promotion"
        summary={pressure.promotion}
        primaryCountLabel="policy findings"
        primaryCount={pressure.promotion.policy_finding_count}
        countMap={pressure.promotion.traceability_counts}
        secondaryMap={pressure.promotion.next_gap_counts}
        proposalsById={proposalsById}
        onSelectProposal={onSelectProposal}
      />
      <PressureCard
        label="Lane"
        summary={pressure.lane}
        primaryCountLabel="under review"
        primaryCount={pressure.lane.under_review_count}
        countMap={pressure.lane.authority_state_counts}
        secondaryMap={pressure.lane.proposal_type_counts}
        proposalsById={proposalsById}
        onSelectProposal={onSelectProposal}
      />
    </div>
  );
}

function PressureCard({
  label,
  summary,
  primaryCountLabel,
  primaryCount,
  countMap,
  secondaryMap,
  proposalsById,
  onSelectProposal,
}: {
  label: string;
  summary: PressureSummary;
  primaryCountLabel: string;
  primaryCount?: number;
  countMap?: Record<string, number>;
  secondaryMap?: Record<string, number>;
  proposalsById: Map<string, ProposalEntry>;
  onSelectProposal: (id: string) => void;
}) {
  return (
    <div className="exploration-pressure-card">
      <div className="exploration-pressure-head">
        <span>{label}</span>
        <span className={summary.available ? "exploration-dot available" : "exploration-dot"}>
          {summary.available ? "available" : "not built"}
        </span>
      </div>
      <div className="exploration-pressure-counts">
        <SummaryChip label="entries" value={String(summary.entry_count ?? 0)} />
        <SummaryChip label={primaryCountLabel} value={String(primaryCount ?? 0)} tone="tone-draft" />
      </div>
      <CountMap counts={countMap} />
      <CountMap counts={secondaryMap} compact />
      {summary.proposal_ids && summary.proposal_ids.length > 0 && (
        <ProposalIdLinks
          ids={summary.proposal_ids.slice(0, 24)}
          proposalsById={proposalsById}
          onSelectProposal={onSelectProposal}
        />
      )}
      {(!summary.proposal_ids || summary.proposal_ids.length === 0) && summary.proposal_handles && (
        <ProposalHandleList handles={summary.proposal_handles.slice(0, 10)} />
      )}
    </div>
  );
}

function ProposalIdLinks({
  ids,
  proposalsById,
  onSelectProposal,
}: {
  ids: string[];
  proposalsById: Map<string, ProposalEntry>;
  onSelectProposal: (id: string) => void;
}) {
  return (
    <div className="exploration-proposal-links">
      {ids.map((id) => {
        const linked = proposalsById.has(id);
        return linked ? (
          <button key={id} type="button" className="exploration-proposal-link" onClick={() => onSelectProposal(id)}>
            {id}
          </button>
        ) : (
          <span key={id} className="exploration-proposal-link disabled">{id}</span>
        );
      })}
    </div>
  );
}

function CountMap({
  counts,
  compact = false,
}: {
  counts?: Record<string, number>;
  compact?: boolean;
}) {
  const entries = Object.entries(counts ?? {}).filter((entry) => typeof entry[1] === "number");
  if (entries.length === 0) return null;
  return (
    <div className={`exploration-count-map ${compact ? "compact" : ""}`}>
      {entries.slice(0, compact ? 4 : 6).map(([key, value]) => (
        <span key={key} className="exploration-count-row">
          <span>{formatKey(key)}</span>
          <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

function ProposalHandleList({ handles }: { handles: string[] }) {
  if (handles.length === 0) return null;
  return (
    <div className="exploration-proposal-links">
      {handles.map((handle) => (
        <span key={handle} className="exploration-proposal-link disabled">
          {handle}
        </span>
      ))}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="specpm-badges-cell exploration-summary-chip">
      <span className="specpm-badge-label">{label}</span>
      <span className={`spec-inspector-tag specpm-tag ${tone ?? ""}`}>{value}</span>
    </span>
  );
}

function ArtifactStatus({ artifact }: { artifact: ArtifactEnvelope }) {
  const tone = artifact.available ? "available" : artifact.error ? "error" : "";
  return (
    <span className={`exploration-artifact-status ${tone}`}>
      {artifact.available ? fmtTime(artifact.generated_at) ?? "available" : artifact.error ? "error" : "not built yet"}
    </span>
  );
}

function ArtifactUnavailable({
  artifact,
  fallbackLabel,
}: {
  artifact: ArtifactEnvelope;
  fallbackLabel: string;
}) {
  if (!artifact.error) return <ArtifactEmpty label={fallbackLabel} />;
  return (
    <div className="exploration-empty exploration-empty-error">
      <strong>{artifact.filename} could not be read</strong>
      <span>{artifact.error}</span>
    </div>
  );
}

function ArtifactEmpty({ label }: { label: string }) {
  return <div className="exploration-empty">{label}</div>;
}
