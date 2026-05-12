import { useState } from "react";
import { useRunsWatchVersion } from "@/shared/api";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
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
import { describeLive } from "../model/live-status";
import {
  SAMPLE_ENTRIES,
  SAMPLE_NOW,
  SAMPLE_PROPOSAL_TRACES,
  SAMPLE_WORK_ITEMS,
} from "../model/sample-data";
import { LiveArtifactStatusPanel } from "./LiveArtifactStatusPanel";

/**
 * Viewer page shell: live data via graph contract hooks with sample fallback
 * when the backend is offline, not configured, or emits invalid artifacts.
 */
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
  const now = feedState.kind === "ok" ? undefined : SAMPLE_NOW;

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

      <Overlay
        anchor="bottom-right"
        style={{ position: "fixed", maxWidth: "calc(100vw - 40px)" }}
      >
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
