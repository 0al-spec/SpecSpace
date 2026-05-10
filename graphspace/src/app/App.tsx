import { useState } from "react";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import { type RecentChange } from "@/entities/recent-change";
import { RecentChangesPanel } from "@/widgets/recent-changes-panel";

/**
 * Day-2 demo: same scaffold + a stack of RecentChangeRow components fed by
 * hand-crafted sample entries that cover every tone path. Stable timestamps
 * so screenshots don't drift between runs.
 *
 * Will be replaced by pages/viewer once a real fetch wiring lands.
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

export function App() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(true);
  const [count] = useState(SAMPLE_ENTRIES.length);

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
            GraphSpace · Day 5
          </p>

          <h1 style={{ margin: "16px 0 0", fontSize: 50, lineHeight: 1 }}>
            A new viewer for{" "}
            <em style={{ color: "var(--gs-muted-2)", fontStyle: "italic" }}>
              SpecGraph artifacts
            </em>
          </h1>

          <p style={{ margin: "20px 0 0", color: "var(--gs-muted)", fontSize: 16, lineHeight: 1.62 }}>
            First vertical slice fully composed.{" "}
            <code>shared/api/spec-graph-contract</code> validates the artifact;{" "}
            <code>entities/recent-change</code> turns one entry into a row;{" "}
            <code>widgets/recent-changes-panel</code> wraps the list with a
            header, count, scroll, and empty state. Live data wiring is the next
            step.
          </p>
        </div>

        {/* Right: feed of rows */}
        <RecentChangesPanel
          entries={SAMPLE_ENTRIES}
          now={NOW}
          caption={`${SAMPLE_ENTRIES.length} events · sample data`}
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
            v0.0.1 · entities/recent-change · {SAMPLE_ENTRIES.length} sample events
          </span>
        </Panel>
      </Overlay>
    </div>
  );
}
