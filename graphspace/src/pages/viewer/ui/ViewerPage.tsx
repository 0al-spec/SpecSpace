import { useState } from "react";
import { useRunsWatchVersion, type EnvelopeResult } from "@/shared/api";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import { type RecentChange } from "@/entities/recent-change";
import { type WorkItem } from "@/entities/implementation-work";
import { type ProposalTraceEntry } from "@/entities/proposal-trace";
import {
  RecentChangesPanel,
  useRecentChanges,
} from "@/widgets/recent-changes-panel";
import {
  ImplementationWorkPanel,
  useImplementationWorkIndex,
} from "@/widgets/implementation-work-panel";
import {
  ProposalTracePanel,
  useProposalSpecTraceIndex,
} from "@/widgets/proposal-trace";
import {
  ToneFilterBar,
  useToneFilter,
  filterByTone,
} from "@/features/filter-by-tone";
import {
  SpecSearchBox,
  useSpecSearch,
  filterBySpecQuery,
} from "@/features/search-by-spec";
import { describeArtifact, describeSourceDeltaSnapshot } from "../model/live-artifacts";
import { LiveArtifactStatusPanel } from "./LiveArtifactStatusPanel";

/**
 * Viewer page shell: live data via graph contract hooks with sample fallback
 * when the backend is offline, not configured, or emits invalid artifacts.
 */
const NOW = new Date("2026-05-10T12:00:00Z");

const SAMPLE_ENTRIES: RecentChange[] = [
  {
    event_id: "demo-1",
    event_type: "canonical_spec_updated",
    spec_id: "SG-SPEC-0028",
    title: "Reflective Mechanics Integration",
    occurred_at: "2026-05-10T11:45:00Z",
    summary: "Updated readiness gate to honor three-valued authority_class.",
    source_kind: "git_commit",
    source_paths: ["specs/nodes/SG-SPEC-0028.yaml"],
    viewer: { tone: "spec", label: "spec updated" },
  },
  {
    event_id: "demo-2",
    event_type: "trace_baseline_attached",
    spec_id: "SG-SPEC-0030",
    title: "Trace baseline attached",
    occurred_at: "2026-05-10T10:12:00Z",
    summary: "Wired runtime evidence registry into the trace overlay.",
    source_kind: "git_commit",
    source_paths: ["tools/spec_trace_registry.json"],
    viewer: { tone: "trace", label: "trace baseline attached" },
  },
  {
    event_id: "demo-3",
    event_type: "proposal_emitted",
    spec_id: "SG-SPEC-0045",
    title: "Proposal: viewer surfaces build budget",
    occurred_at: "2026-05-09T22:30:00Z",
    summary: "New proposal lane entry — promote when CI cost trends settle.",
    source_kind: "git_commit",
    source_paths: ["runs/proposal_lane_overlay.json"],
    viewer: { tone: "proposal", label: "proposal emitted" },
  },
  {
    event_id: "demo-4",
    event_type: "implementation_work_emitted",
    spec_id: "SG-SPEC-0057",
    title: "Implementation work logged",
    occurred_at: "2026-05-08T18:00:00Z",
    summary: "First iteration of the viewer-surfaces builder lands.",
    source_kind: "git_commit",
    source_paths: ["tools/supervisor.py"],
    viewer: { tone: "implementation", label: "work emitted" },
  },
  {
    event_id: "demo-5",
    event_type: "review_feedback_applied",
    spec_id: "",
    title: "Codex review applied across activity feed",
    occurred_at: "2026-05-08T09:00:00Z",
    summary: "Empty navigation state, limit handling, sort fix.",
    source_kind: "git_commit",
    source_paths: ["viewer/server.py"],
    viewer: { tone: "review", label: "review applied" },
  },
];

// Day 7A: sample WorkItems hitting every readiness tone so the visual story
// matches contract §7. Live wiring lands in Day 7B once the backend endpoint
// exists.
const SAMPLE_WORK_ITEMS: WorkItem[] = [
  {
    work_item_id: "implementation_work::SG-SPEC-0042::changed_acceptance",
    affected_spec_ids: ["SG-SPEC-0042"],
    implementation_reason: "changed_acceptance",
    delta_refs: ["changed_acceptance_refs::SG-SPEC-0042"],
    required_tests: [],
    expected_evidence: [],
    likely_code_refs: [],
    readiness: "ready_for_planning",
    blockers: [],
    next_gap: "review_implementation_delta",
  },
  {
    work_item_id: "implementation_work::SG-SPEC-0028::ready_to_code",
    affected_spec_ids: ["SG-SPEC-0028"],
    implementation_reason: "new_contract",
    delta_refs: ["new_spec_ids::SG-SPEC-0028"],
    required_tests: ["tests/test_readiness_gate.py"],
    expected_evidence: [],
    likely_code_refs: ["tools/readiness.py"],
    readiness: "ready_for_coding_agent",
    blockers: [],
    next_gap: "hand_to_coding_agent",
  },
  {
    work_item_id: "implementation_work::SG-SPEC-0057::blocked_trace",
    affected_spec_ids: ["SG-SPEC-0057"],
    implementation_reason: "missing_trace",
    delta_refs: ["missing_trace_refs::SG-SPEC-0057"],
    required_tests: [],
    expected_evidence: [],
    likely_code_refs: [],
    readiness: "blocked_by_trace_gap",
    blockers: ["trace baseline not attached for SG-SPEC-0057"],
    next_gap: "attach_trace_baseline",
  },
  {
    work_item_id: "implementation_work::SG-SPEC-0060::quality_block",
    affected_spec_ids: ["SG-SPEC-0060"],
    implementation_reason: "spec_quality_check",
    delta_refs: [],
    required_tests: [],
    expected_evidence: [],
    likely_code_refs: [],
    readiness: "blocked_by_spec_quality",
    blockers: ["acceptance criteria reference removed contract", "readiness gate inconsistent"],
    next_gap: "repair_spec",
  },
  {
    work_item_id: "implementation_work::SG-SPEC-0030::done",
    affected_spec_ids: ["SG-SPEC-0030"],
    implementation_reason: "changed_acceptance",
    delta_refs: [],
    required_tests: [],
    expected_evidence: ["runs/test_results/SG-SPEC-0030.json"],
    likely_code_refs: ["tools/spec_trace_registry.json"],
    readiness: "implemented",
    blockers: [],
    next_gap: "—",
  },
];

const SAMPLE_PROPOSAL_TRACES: ProposalTraceEntry[] = [
  {
    trace_entry_id: "proposal::0048",
    proposal_id: "0048",
    proposal_path: "docs/proposals/0048_continuation_candidate_selection.md",
    title: "Deterministic continuation candidate selector",
    status: "Draft proposal",
    spec_refs: [],
    mentioned_spec_ids: ["SG-SPEC-0033"],
    promotion_trace: {
      status: "missing_trace",
      trace_status: "missing_trace",
      next_gap: "attach_promotion_trace",
      source_refs: [],
    },
    next_gap: "attach_promotion_trace",
  },
];

/**
 * Both hooks expose the same discriminated union (idle/loading + every
 * EnvelopeResult variant). Map any state to (caption, emptyMessage); the
 * caller picks live data on "ok" and falls back to sample otherwise.
 *
 * Kept as a single helper rather than per-panel describeFeed/describeWork
 * because the failure-mode mapping is verbatim across the two domains —
 * any new artifact will get the same treatment for free.
 */
type LiveStatus = { caption: string; emptyMessage: string };
type LiveArtifactState = { kind: "idle" } | { kind: "loading" } | EnvelopeResult<unknown>;

function describeLive(
  state: LiveArtifactState,
  noun: { items: string; itemSingular: string; emptyLive: string },
): LiveStatus {
  switch (state.kind) {
    case "idle":
    case "loading":
      return { caption: `loading… · sample fallback`, emptyMessage: "loading" };
    case "ok":
      return { caption: `live`, emptyMessage: noun.emptyLive };
    case "http-error":
      return {
        caption: `live · HTTP ${state.status} · sample fallback`,
        emptyMessage: state.statusText || "endpoint failed",
      };
    case "network-error":
      return {
        caption: "live · backend unreachable · sample fallback",
        emptyMessage: "network error",
      };
    case "envelope-error":
      return { caption: "live · bad envelope · sample fallback", emptyMessage: state.reason };
    case "version-not-supported":
      return {
        caption: `live · schema_version ${state.schema_version} unsupported · sample fallback`,
        emptyMessage: `schema_version ${state.schema_version} > max ${state.max_supported}`,
      };
    case "wrong-artifact-kind":
      return {
        caption: "live · wrong artifact_kind · sample fallback",
        emptyMessage: `expected ${state.expected}`,
      };
    case "parse-error":
      return { caption: "live · parse error · sample fallback", emptyMessage: "schema validation failed" };
    case "invariant-violation":
      return { caption: "live · invariant violation · sample fallback", emptyMessage: state.message };
  }
  // Exhaustive — narrow noun usage avoids "unused" warnings in cases without
  // a count prefix (kept here as a typed escape hatch for future tones).
  void noun.items;
  void noun.itemSingular;
}

export function ViewerPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(true);
  const runsWatchVersion = useRunsWatchVersion();
  const feedState = useRecentChanges({ refreshKey: runsWatchVersion });
  const workState = useImplementationWorkIndex({ refreshKey: runsWatchVersion });
  const proposalTraceState = useProposalSpecTraceIndex({ refreshKey: runsWatchVersion });

  const feedStatus = describeLive(feedState, {
    items: "events",
    itemSingular: "event",
    emptyLive: "No activity recorded yet",
  });
  const workStatus = describeLive(workState, {
    items: "items",
    itemSingular: "item",
    emptyLive: "No work items emitted yet",
  });
  const proposalTraceStatus = describeLive(proposalTraceState, {
    items: "entries",
    itemSingular: "entry",
    emptyLive: "No proposal trace entries yet",
  });

  const liveEntries =
    feedState.kind === "ok" ? feedState.data.entries : SAMPLE_ENTRIES;
  const liveWorkItems =
    workState.kind === "ok" ? workState.data.entries : SAMPLE_WORK_ITEMS;
  const liveProposalTraceIndex =
    proposalTraceState.kind === "ok" ? proposalTraceState.data : null;
  const liveProposalTraceEntries =
    proposalTraceState.kind === "ok"
      ? proposalTraceState.data.entries.slice(0, 8)
      : SAMPLE_PROPOSAL_TRACES;
  const sourceDelta =
    workState.kind === "ok" ? workState.data.source_delta_snapshot : null;
  const sourceDeltaDescription = describeSourceDeltaSnapshot(sourceDelta);
  const workEmptyDetail =
    workState.kind === "ok"
      ? `Artifact is live; ${sourceDeltaDescription}. No coding handoff has been emitted.`
      : workStatus.emptyMessage;
  const artifactDiagnostics = [
    describeArtifact({
      id: "recent",
      label: "Recent changes",
      endpoint: "/api/spec-activity",
      state: feedState,
      liveCount: feedState.kind === "ok" ? feedState.data.entry_count : 0,
      sampleCount: SAMPLE_ENTRIES.length,
      noun: { singular: "event", plural: "events" },
      emptyDetail: "Artifact is live but contains no activity events.",
    }),
    describeArtifact({
      id: "work",
      label: "Implementation work",
      endpoint: "/api/implementation-work-index",
      state: workState,
      liveCount: workState.kind === "ok" ? workState.data.entry_count : 0,
      sampleCount: SAMPLE_WORK_ITEMS.length,
      noun: { singular: "item", plural: "items" },
      emptyDetail: workEmptyDetail,
    }),
    describeArtifact({
      id: "proposal-trace",
      label: "Proposal trace",
      endpoint: "/api/proposal-spec-trace-index",
      state: proposalTraceState,
      liveCount: proposalTraceState.kind === "ok" ? proposalTraceState.data.entry_count : 0,
      sampleCount: SAMPLE_PROPOSAL_TRACES.length,
      noun: { singular: "entry", plural: "entries" },
      emptyDetail: "Artifact is live but contains no proposal trace entries.",
    }),
  ] as const;

  // Spec search narrows the feed before tone bucketing, so chip counts show
  // the tone distribution inside the active spec/path query.
  const specSearch = useSpecSearch();
  const specMatchedEntries = filterBySpecQuery(liveEntries, specSearch.query);

  // Tone filter is local UI state — lifted from inside the panel because the
  // chip bar lives above the panel header. Empty selection = no filter.
  const toneFilter = useToneFilter();
  const filteredEntries = filterByTone(specMatchedEntries, toneFilter.selected);

  // For "ok" with live data, drop the static demo timestamps so relative time
  // reflects the real artifact mtime story.
  const now = feedState.kind === "ok" ? undefined : NOW;

  const feedCaption =
    feedState.kind === "ok"
      ? toneFilter.hasAny || specSearch.hasQuery
        ? `${filteredEntries.length} of ${liveEntries.length} events · live · filtered`
        : `${liveEntries.length} events · live`
      : feedStatus.caption;
  const feedEmptyMessage =
    specSearch.hasQuery && specMatchedEntries.length === 0
      ? "No events match that spec search"
      : toneFilter.hasAny && filteredEntries.length === 0
        ? "No events match the current filter"
        : feedStatus.emptyMessage;
  const workCaption =
    workState.kind === "ok"
      ? `${liveWorkItems.length} items · live`
      : workStatus.caption;
  const proposalTraceCaption =
    proposalTraceState.kind === "ok"
      ? `${proposalTraceState.data.entry_count} entries · live`
      : proposalTraceStatus.caption;

  const count = filteredEntries.length;

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowY: "auto" }}>
      <div
        style={{
          display: "grid",
          // auto-fit + minmax collapses to a single column below ~712 px so
          // narrow viewports (laptop split, mobile) stack instead of clipping.
          // The outer container scrolls vertically; nothing gets cut off.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 32,
          padding: "clamp(60px, 8vw, 120px) clamp(20px, 5vw, 80px) 80px",
          alignContent: "start",
        }}
      >
        {/* Left: hero headline */}
        <div>
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              margin: 0,
              fontFamily: "var(--gs-mono)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--gs-muted)",
            }}
          >
            <span aria-hidden style={{ width: 26, height: 1, background: "currentColor" }} />
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--gs-accent)",
                boxShadow: "0 0 0 3px var(--gs-accent-soft)",
              }}
            />
            GraphSpace · Day 14
          </p>

          <h1 style={{ margin: "16px 0 0", fontSize: 50, lineHeight: 1 }}>
            A new viewer for{" "}
            <em style={{ color: "var(--gs-muted-2)", fontStyle: "italic" }}>
              SpecGraph artifacts
            </em>
          </h1>

          <p style={{ margin: "20px 0 0", color: "var(--gs-muted)", fontSize: 16, lineHeight: 1.62 }}>
            Live artifact diagnostics now distinguish real empty artifacts
            from sample fallback. Empty Implementation Work means the
            producer emitted a valid zero-item handoff, not that the panel is
            disconnected.
          </p>

          <LiveArtifactStatusPanel
            diagnostics={artifactDiagnostics}
            runsWatchVersion={runsWatchVersion}
          />

          <ImplementationWorkPanel
            items={liveWorkItems}
            caption={workCaption}
            emptyMessage={
              workState.kind === "ok" && liveWorkItems.length === 0
                ? workEmptyDetail
                : workStatus.emptyMessage
            }
            style={{ marginTop: 28, maxHeight: "calc(100vh - 540px)" }}
          />

          <ProposalTracePanel
            index={liveProposalTraceIndex}
            entries={liveProposalTraceEntries}
            caption={proposalTraceCaption}
            emptyMessage={proposalTraceStatus.emptyMessage}
            style={{ marginTop: 16, maxHeight: "calc(100vh - 540px)" }}
          />
        </div>

        {/* Right: filter chips + feed of rows */}
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "start", maxHeight: "calc(100vh - 200px)", minHeight: 0 }}>
          <SpecSearchBox
            query={specSearch.query}
            onQueryChange={specSearch.setQuery}
            onClear={specSearch.clear}
            resultCount={specMatchedEntries.length}
            totalCount={liveEntries.length}
          />
          <ToneFilterBar
            entries={specMatchedEntries}
            selected={toneFilter.selected}
            onToggle={toneFilter.toggle}
            onClear={toneFilter.clear}
          />
          <RecentChangesPanel
            entries={filteredEntries}
            now={now}
            caption={feedCaption}
            emptyMessage={feedEmptyMessage}
            style={{ minHeight: 0 }}
          />
        </div>
      </div>

      <Overlay anchor="top-left" direction="row">
        <PanelBtnRow>
          <PanelBtn title="Toggle timeline" active={timelineOn} onClick={() => setTimelineOn((v) => !v)}>
            ⏱
          </PanelBtn>
          <PanelBtn
            title="Open filter"
            active={filterOpen}
            badge={count}
            onClick={() => setFilterOpen((v) => !v)}
          >
            ⚲
          </PanelBtn>
          <PanelBtn dim title="Disabled action">
            ✕
          </PanelBtn>
        </PanelBtnRow>
      </Overlay>

      <Overlay anchor="bottom-right">
        <Panel tone="muted" padding="sm">
          <span
            style={{
              fontFamily: "var(--gs-mono)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--gs-muted)",
            }}
          >
            v0.0.1 · runs tick {runsWatchVersion} · recent {feedState.kind} · {count} events · work {workState.kind} · {liveWorkItems.length} items · trace {proposalTraceState.kind}
          </span>
        </Panel>
      </Overlay>
    </div>
  );
}
