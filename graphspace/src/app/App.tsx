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
import { ImplementationWorkPanel } from "@/widgets/implementation-work-panel";

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

type FeedView = {
  entries: readonly RecentChange[];
  caption: string;
  emptyMessage: string;
};

function describeFeed(state: UseRecentChangesState): FeedView {
  switch (state.kind) {
    case "idle":
    case "loading":
      return { entries: SAMPLE_ENTRIES, caption: "loading… · sample fallback", emptyMessage: "loading" };
    case "ok":
      return {
        entries: state.data.entries,
        caption: `${state.data.entries.length} events · live`,
        emptyMessage: "No activity recorded yet",
      };
    case "http-error":
      return {
        entries: SAMPLE_ENTRIES,
        caption: `live · HTTP ${state.status} · sample fallback`,
        emptyMessage: state.statusText || "endpoint failed",
      };
    case "network-error":
      return {
        entries: SAMPLE_ENTRIES,
        caption: "live · backend unreachable · sample fallback",
        emptyMessage: "network error",
      };
    case "envelope-error":
      return { entries: SAMPLE_ENTRIES, caption: "live · bad envelope · sample fallback", emptyMessage: state.reason };
    case "version-not-supported":
      return {
        entries: SAMPLE_ENTRIES,
        caption: `live · schema_version ${state.schema_version} unsupported · sample fallback`,
        emptyMessage: `schema_version ${state.schema_version} > max ${state.max_supported}`,
      };
    case "wrong-artifact-kind":
      return {
        entries: SAMPLE_ENTRIES,
        caption: "live · wrong artifact_kind · sample fallback",
        emptyMessage: `expected ${state.expected}`,
      };
    case "parse-error":
      return { entries: SAMPLE_ENTRIES, caption: "live · parse error · sample fallback", emptyMessage: "schema validation failed" };
    case "invariant-violation":
      return { entries: SAMPLE_ENTRIES, caption: "live · invariant violation · sample fallback", emptyMessage: state.message };
  }
}

export function App() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(true);
  const feedState = useRecentChanges();
  const view = describeFeed(feedState);
  // For "ok" with live entries, drop the static demo timestamps so relative
  // time reflects the real artifact mtime story.
  const now = feedState.kind === "ok" ? undefined : NOW;
  const count = view.entries.length;

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
            GraphSpace · Day 7A
          </p>

          <h1 style={{ margin: "16px 0 0", fontSize: 50, lineHeight: 1 }}>
            A new viewer for{" "}
            <em style={{ color: "var(--gs-muted-2)", fontStyle: "italic" }}>
              SpecGraph artifacts
            </em>
          </h1>

          <p style={{ margin: "20px 0 0", color: "var(--gs-muted)", fontSize: 16, lineHeight: 1.62 }}>
            Second contract on board: <code>implementation_work_index</code>{" "}
            adds a new <code>entities/implementation-work</code> and{" "}
            <code>widgets/implementation-work-panel</code>. The generic
            parser, version guard, and FSD boundaries proved out across a
            second domain — only the row markup and readiness palette
            differ. Backend endpoint wiring lands next (Day 7B).
          </p>

          <ImplementationWorkPanel
            items={SAMPLE_WORK_ITEMS}
            caption={`${SAMPLE_WORK_ITEMS.length} items · static · golden fixture`}
            style={{ marginTop: 28, maxHeight: "calc(100vh - 540px)" }}
          />
        </div>

        {/* Right: feed of rows */}
        <RecentChangesPanel
          entries={view.entries}
          now={now}
          caption={view.caption}
          emptyMessage={view.emptyMessage}
          style={{ alignSelf: "start", maxHeight: "calc(100vh - 200px)" }}
        />
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
            v0.0.1 · recent {feedState.kind} · {count} events · work {SAMPLE_WORK_ITEMS.length} items
          </span>
        </Panel>
      </Overlay>
    </div>
  );
}
