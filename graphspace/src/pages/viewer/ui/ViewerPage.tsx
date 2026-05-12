import { useState } from "react";
import { useRunsWatchVersion } from "@/shared/api";
import { useRecentChanges } from "@/widgets/recent-changes-panel";
import {
  ImplementationWorkPanel,
  useImplementationWorkIndex,
} from "@/widgets/implementation-work-panel";
import {
  ProposalTracePanel,
  useProposalSpecTraceIndex,
} from "@/widgets/proposal-trace";
import { SpecGraphCanvas } from "@/widgets/spec-graph-canvas";
import { SpecInspector, type SpecInspectorSelection } from "@/widgets/spec-inspector";
import { useToneFilter, filterByTone } from "@/features/filter-by-tone";
import {
  useSpecSearch,
  filterBySpecQuery,
} from "@/features/search-by-spec";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { describeArtifact, describeSourceDeltaSnapshot } from "../model/live-artifacts";
import { describeLive } from "../model/live-status";
import {
  SAMPLE_ENTRIES,
  SAMPLE_NOW,
  SAMPLE_PROPOSAL_TRACES,
  SAMPLE_WORK_ITEMS,
} from "../model/sample-data";
import { LiveArtifactStatusPanel } from "./LiveArtifactStatusPanel";
import { RecentActivitySurface } from "./RecentActivitySurface";
import { ViewerChrome, type ViewerUtilityPanelId } from "./ViewerChrome";
import { ViewerHero } from "./ViewerHero";
import styles from "./ViewerPage.module.css";

/**
 * Viewer page shell: live data via graph contract hooks with sample fallback
 * when the backend is offline, not configured, or emits invalid artifacts.
 */
export function ViewerPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] =
    useState<ViewerUtilityPanelId | null>(null);
  const [selectedSpecNodeId, setSelectedSpecNodeId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<SpecInspectorSelection | null>(null);
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
  const clearSpecSelection = () => {
    setSelectedSpecNodeId(null);
    setSelectedSpec(null);
  };
  const toggleUtilityPanel = (panel: ViewerUtilityPanelId) => {
    setActiveUtilityPanel((current) => (current === panel ? null : panel));
  };
  const closeUtilityPanel = () => setActiveUtilityPanel(null);
  const utilityPanelTitle =
    activeUtilityPanel === "recent"
      ? "Recent changes"
      : activeUtilityPanel === "work"
        ? "Implementation work"
        : "Proposal trace";
  const utilityPanelCaption =
    activeUtilityPanel === "recent"
      ? feedCaption
      : activeUtilityPanel === "work"
        ? workCaption
        : proposalTraceCaption;

  return (
    <div className={styles.root}>
      <SpecGraphCanvas
        className={styles.canvasLayer}
        refreshKey={runsWatchVersion}
        selectedNodeId={selectedSpecNodeId}
        onSelectedNodeIdChange={setSelectedSpecNodeId}
        onSelectionChange={setSelectedSpec}
      />

      {sidebarOpen ? (
        <aside className={styles.sidebarRail} aria-label="GraphSpace Sidebar">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Sidebar</span>
            <button
              title="Close Sidebar"
              aria-label="Close Sidebar"
              className={styles.closeButton}
              type="button"
              onClick={() => setSidebarOpen(false)}
            >
              Close
            </button>
          </div>

          <PanelBtnRow className={styles.sidebarDock} aria-label="Utility panels">
            <PanelBtn
              title="Open Recent changes"
              aria-label="Open Recent changes"
              active={activeUtilityPanel === "recent"}
              badge={count}
              onClick={() => toggleUtilityPanel("recent")}
            >
              ◷
            </PanelBtn>
            <PanelBtn
              title="Open Implementation work"
              aria-label="Open Implementation work"
              active={activeUtilityPanel === "work"}
              badge={liveWorkItems.length}
              onClick={() => toggleUtilityPanel("work")}
            >
              ▤
            </PanelBtn>
            <PanelBtn
              title="Open Proposal trace"
              aria-label="Open Proposal trace"
              active={activeUtilityPanel === "proposal-trace"}
              badge={
                proposalTraceState.kind === "ok"
                  ? proposalTraceState.data.entry_count
                  : liveProposalTraceEntries.length
              }
              onClick={() => toggleUtilityPanel("proposal-trace")}
            >
              ◇
            </PanelBtn>
          </PanelBtnRow>

          <ViewerHero />

          <LiveArtifactStatusPanel
            diagnostics={artifactDiagnostics}
            runsWatchVersion={runsWatchVersion}
          />
        </aside>
      ) : null}

      {activeUtilityPanel ? (
        <aside
          className={[
            styles.utilityRail,
            selectedSpec ? styles.utilityRailWithInspector : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={utilityPanelTitle}
        >
          <div className={styles.utilityHeader}>
            <div>
              <span className={styles.utilityKicker}>Utility panel</span>
              <h2 className={styles.utilityTitle}>{utilityPanelTitle}</h2>
              <p className={styles.utilityCaption}>{utilityPanelCaption}</p>
            </div>
            <button
              title={`Close ${utilityPanelTitle}`}
              aria-label={`Close ${utilityPanelTitle}`}
              className={styles.closeButton}
              type="button"
              onClick={closeUtilityPanel}
            >
              Close
            </button>
          </div>

          {activeUtilityPanel === "recent" ? (
            <RecentActivitySurface
              entries={filteredEntries}
              now={now}
              caption={feedCaption}
              emptyMessage={feedEmptyMessage}
              search={{
                query: specSearch.query,
                onQueryChange: specSearch.setQuery,
                onClear: specSearch.clear,
                resultCount: specMatchedEntries.length,
                totalCount: liveEntries.length,
              }}
              tone={{
                entries: specMatchedEntries,
                selected: toneFilter.selected,
                onToggle: toneFilter.toggle,
                onClear: toneFilter.clear,
              }}
            />
          ) : null}

          {activeUtilityPanel === "work" ? (
            <ImplementationWorkPanel
              items={liveWorkItems}
              caption={workCaption}
              emptyMessage={
                workState.kind === "ok" && liveWorkItems.length === 0
                  ? workEmptyDetail
                  : workStatus.emptyMessage
              }
              className={styles.workPanel}
            />
          ) : null}

          {activeUtilityPanel === "proposal-trace" ? (
            <ProposalTracePanel
              index={liveProposalTraceIndex}
              entries={liveProposalTraceEntries}
              caption={proposalTraceCaption}
              emptyMessage={proposalTraceStatus.emptyMessage}
              className={styles.proposalTracePanel}
            />
          ) : null}
        </aside>
      ) : null}

      {selectedSpec ? (
        <SpecInspector
          className={styles.inspectorRail}
          selection={selectedSpec}
          onClose={clearSpecSelection}
          onSelectNodeId={setSelectedSpecNodeId}
        />
      ) : null}

      <ViewerChrome
        controls={{
          sidebarOpen,
          activeUtilityPanel,
          recentCount: count,
          onSidebarToggle: () => setSidebarOpen((v) => !v),
          onRecentToggle: () => toggleUtilityPanel("recent"),
        }}
        status={{
          runsWatchVersion,
          recentKind: feedState.kind,
          eventCount: count,
          workKind: workState.kind,
          workItemCount: liveWorkItems.length,
          traceKind: proposalTraceState.kind,
        }}
      />
    </div>
  );
}
