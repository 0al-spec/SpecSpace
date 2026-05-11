import { useState } from "react";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import { type RecentChange } from "@/entities/recent-change";
import { type WorkItem } from "@/entities/implementation-work";
import {
  RecentChangesPanel,
  useRecentChanges,
  type UseRecentChangesState,
} from "@/widgets/recent-changes-panel";
import {
  ImplementationWorkPanel,
  useImplementationWorkIndex,
  type UseImplementationWorkState,
} from "@/widgets/implementation-work-panel";
import {
  ToneFilterBar,
  useToneFilter,
  filterByTone,
} from "@/features/filter-by-tone";

/**
 * Day-6 demo: live data via useRecentChanges + sample fallback when the
 * backend is offline / not configured / parse fails. The caption surfaces
 * which state we're in so screenshots are self-documenting.
 *
 * Will be replaced by pages/viewer once layout lands.
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

function describeLive(
  state: UseRecentChangesState | UseImplementationWorkState,
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

export function App() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(true);
  const feedState = useRecentChanges();
  const workState = useImplementationWorkIndex();

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

  const liveEntries =
    feedState.kind === "ok" ? feedState.data.entries : SAMPLE_ENTRIES;
  const liveWorkItems =
    workState.kind === "ok" ? workState.data.entries : SAMPLE_WORK_ITEMS;

  // Tone filter is local UI state — lifted from inside the panel because the
  // chip bar lives above the panel header. Empty selection = no filter.
  const toneFilter = useToneFilter();
  const filteredEntries = filterByTone(liveEntries, toneFilter.selected);

  // For "ok" with live data, drop the static demo timestamps so relative time
  // reflects the real artifact mtime story.
  const now = feedState.kind === "ok" ? undefined : NOW;

  const feedCaption =
    feedState.kind === "ok"
      ? toneFilter.hasAny
        ? `${filteredEntries.length} of ${liveEntries.length} events · live · filtered`
        : `${liveEntries.length} events · live`
      : feedStatus.caption;
  const workCaption =
    workState.kind === "ok"
      ? `${liveWorkItems.length} items · live`
      : workStatus.caption;

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
            GraphSpace · Day 9
          </p>

          <h1 style={{ margin: "16px 0 0", fontSize: 50, lineHeight: 1 }}>
            A new viewer for{" "}
            <em style={{ color: "var(--gs-muted-2)", fontStyle: "italic" }}>
              SpecGraph artifacts
            </em>
          </h1>

          <p style={{ margin: "20px 0 0", color: "var(--gs-muted)", fontSize: 16, lineHeight: 1.62 }}>
            First <code>features/</code> slice. <code>filter-by-tone</code>{" "}
            adds a chip bar above Recent Changes — click any tone to keep
            only matching events, click again to release. State and the
            pure filter live inside the feature; the panel stays
            presentational. Counts above each chip come from the same
            mapping the row uses.
          </p>

          <ImplementationWorkPanel
            items={liveWorkItems}
            caption={workCaption}
            emptyMessage={workStatus.emptyMessage}
            style={{ marginTop: 28, maxHeight: "calc(100vh - 540px)" }}
          />
        </div>

        {/* Right: filter chips + feed of rows */}
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "start", maxHeight: "calc(100vh - 200px)", minHeight: 0 }}>
          <ToneFilterBar
            entries={liveEntries}
            selected={toneFilter.selected}
            onToggle={toneFilter.toggle}
            onClear={toneFilter.clear}
          />
          <RecentChangesPanel
            entries={filteredEntries}
            now={now}
            caption={feedCaption}
            emptyMessage={
              toneFilter.hasAny && filteredEntries.length === 0
                ? "No events match the current filter"
                : feedStatus.emptyMessage
            }
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
            v0.0.1 · recent {feedState.kind} · {count} events · work {workState.kind} · {liveWorkItems.length} items
          </span>
        </Panel>
      </Overlay>
    </div>
  );
}
