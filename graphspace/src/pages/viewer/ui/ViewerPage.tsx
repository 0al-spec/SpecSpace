import { useCallback, useMemo, useState } from "react";
import { createSpecNodeRefResolver } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
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
import {
  SpecGraphCanvas,
  useSpecGraph,
  useSpecPMLifecycleBadges,
} from "@/widgets/spec-graph-canvas";
import { SpecInspector, type SpecInspectorSelection } from "@/widgets/spec-inspector";
import { SpecNodeNavigator } from "@/widgets/spec-node-navigator";
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
  const specGraphState = useSpecGraph({ refreshKey: runsWatchVersion });
  const specpmLifecycleState = useSpecPMLifecycleBadges({
    refreshKey: runsWatchVersion,
  });

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
      endpoint: "/api/v1/spec-activity",
      state: feedState,
      liveCount: feedState.kind === "ok" ? feedState.data.entry_count : 0,
      sampleCount: SAMPLE_ENTRIES.length,
      noun: { singular: "event", plural: "events" },
      emptyDetail: "Artifact is live but contains no activity events.",
    }),
    describeArtifact({
      id: "work",
      label: "Implementation work",
      endpoint: "/api/v1/implementation-work-index",
      state: workState,
      liveCount: workState.kind === "ok" ? workState.data.entry_count : 0,
      sampleCount: SAMPLE_WORK_ITEMS.length,
      noun: { singular: "item", plural: "items" },
      emptyDetail: workEmptyDetail,
    }),
    describeArtifact({
      id: "proposal-trace",
      label: "Proposal trace",
      endpoint: "/api/v1/proposal-spec-trace-index",
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
  const artifactAttentionCount = artifactDiagnostics.filter(
    (artifact) => artifact.tone !== "live",
  ).length;
  const artifactCaption = `runs tick ${runsWatchVersion}`;
  const lifecycleBadgesByNode: ReadonlyMap<string, SpecPMLifecycleBadge> | undefined =
    specpmLifecycleState.kind === "ok"
      ? specpmLifecycleState.badgesByNode
      : undefined;
  const resolveSpecRef = useMemo(
    () => createSpecNodeRefResolver(specGraphState.data.graph.nodes),
    [specGraphState.data.graph.nodes],
  );

  const count = filteredEntries.length;
  const selectableSpecNodeIds = useMemo(
    () => new Set(specGraphState.data.graph.nodes.map((node) => node.node_id)),
    [specGraphState.data.graph.nodes],
  );
  const clearSpecSelection = () => {
    setSelectedSpecNodeId(null);
    setSelectedSpec(null);
  };
  const selectSpecNodeId = useCallback(
    (nodeId: string) => {
      if (!selectableSpecNodeIds.has(nodeId)) return;
      setSelectedSpecNodeId(nodeId);
    },
    [selectableSpecNodeIds],
  );
  const toggleUtilityPanel = (panel: ViewerUtilityPanelId) => {
    setActiveUtilityPanel((current) => (current === panel ? null : panel));
  };
  const closeUtilityPanel = () => setActiveUtilityPanel(null);
  const utilityPanelDetails =
    activeUtilityPanel === "recent"
      ? { title: "Recent changes", caption: feedCaption }
      : activeUtilityPanel === "work"
        ? { title: "Implementation work", caption: workCaption }
        : activeUtilityPanel === "proposal-trace"
          ? { title: "Proposal trace", caption: proposalTraceCaption }
          : activeUtilityPanel === "artifacts"
            ? { title: "Live artifacts", caption: artifactCaption }
            : null;

  return (
    <div className={styles.root}>
      <SpecGraphCanvas
        state={specGraphState}
        className={[
          styles.canvasLayer,
          sidebarOpen ? styles.canvasLayerWithSidebar : "",
        ]
          .filter(Boolean)
          .join(" ")}
        selectedNodeId={selectedSpecNodeId}
        lifecycleBadgesByNode={lifecycleBadgesByNode}
        onSelectedNodeIdChange={setSelectedSpecNodeId}
        onSelectionChange={setSelectedSpec}
      />

      {sidebarOpen ? (
        <aside className={styles.sidebarRail} aria-label="GraphSpace Sidebar">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarBrandMark}>
              <SidebarLogo />
              <span className={styles.sidebarBrand}>SpecSpace</span>
            </span>
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

          <PanelBtnRow
            className={styles.sidebarDock}
            role="toolbar"
            aria-label="Utility panels"
          >
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
            <PanelBtn
              title="Open Live artifacts"
              aria-label="Open Live artifacts"
              active={activeUtilityPanel === "artifacts"}
              badge={artifactAttentionCount}
              onClick={() => toggleUtilityPanel("artifacts")}
            >
              ◎
            </PanelBtn>
          </PanelBtnRow>

          <SpecNodeNavigator
            nodes={specGraphState.data.graph.nodes}
            selectedNodeId={selectedSpecNodeId}
            source={specGraphState.source}
            onSelectNodeId={selectSpecNodeId}
          />
        </aside>
      ) : null}

      {utilityPanelDetails ? (
        <aside
          className={[
            styles.utilityRail,
            selectedSpec ? styles.utilityRailWithInspector : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={utilityPanelDetails.title}
        >
          <div className={styles.utilityHeader}>
            <div>
              <span className={styles.utilityKicker}>Utility panel</span>
              <h2 className={styles.utilityTitle}>{utilityPanelDetails.title}</h2>
              <p className={styles.utilityCaption}>{utilityPanelDetails.caption}</p>
            </div>
            <button
              title={`Close ${utilityPanelDetails.title}`}
              aria-label={`Close ${utilityPanelDetails.title}`}
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
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
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
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
            />
          ) : null}

          {activeUtilityPanel === "proposal-trace" ? (
            <ProposalTracePanel
              index={liveProposalTraceIndex}
              entries={liveProposalTraceEntries}
              caption={proposalTraceCaption}
              emptyMessage={proposalTraceStatus.emptyMessage}
              className={styles.proposalTracePanel}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
            />
          ) : null}

          {activeUtilityPanel === "artifacts" ? (
            <LiveArtifactStatusPanel
              diagnostics={artifactDiagnostics}
              runsWatchVersion={runsWatchVersion}
              showHeader={false}
            />
          ) : null}
        </aside>
      ) : null}

      {selectedSpec ? (
        <SpecInspector
          className={styles.inspectorRail}
          selection={selectedSpec}
          onClose={clearSpecSelection}
          resolveSpecRef={resolveSpecRef}
          onSelectNodeId={selectSpecNodeId}
        />
      ) : null}

      <ViewerChrome
        controls={{
          sidebarOpen,
          onSidebarToggle: () => setSidebarOpen((v) => !v),
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

function SidebarLogo() {
  return (
    <span className={styles.sidebarGlyph} aria-hidden="true">
      <svg
        width="1091"
        height="1091"
        viewBox="0 0 1091 1091"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M374 534.5C374 488.384 336.616 451 290.5 451C244.384 451 207 488.384 207 534.5C207 580.616 244.384 618 290.5 618V642C231.129 642 183 593.871 183 534.5C183 475.129 231.129 427 290.5 427C349.871 427 398 475.129 398 534.5C398 593.871 349.871 642 290.5 642V618C336.616 618 374 580.616 374 534.5Z"
          fill="currentColor"
        />
        <path
          d="M881 291.5C881 245.384 843.616 208 797.5 208C751.384 208 714 245.384 714 291.5C714 337.616 751.384 375 797.5 375V399C738.129 399 690 350.871 690 291.5C690 232.129 738.129 184 797.5 184C856.871 184 905 232.129 905 291.5C905 350.871 856.871 399 797.5 399V375C843.616 375 881 337.616 881 291.5Z"
          fill="currentColor"
        />
        <path
          d="M881 777.5C881 731.384 843.616 694 797.5 694C751.384 694 714 731.384 714 777.5C714 823.616 751.384 861 797.5 861V885C738.129 885 690 836.871 690 777.5C690 718.129 738.129 670 797.5 670C856.871 670 905 718.129 905 777.5C905 836.871 856.871 885 797.5 885V861C843.616 861 881 823.616 881 777.5Z"
          fill="currentColor"
        />
        <path
          d="M606.6 785.6C556.2 785.6 531 758.4 531 704V618.8C531 590.4 527.6 570.6 520.8 559.4C514.4 547.8 504.2 542 490.2 542C485.4 542 483 539.6 483 534.8C483 530 485.4 527.6 490.2 527.6C504.2 527.6 514.4 521.8 520.8 510.2C527.6 498.6 531 478.8 531 450.8V365.6C531 311.2 556.2 284 606.6 284C611.4 284 613.8 286.4 613.8 291.2C613.8 296 611.4 298.4 606.6 298.4C579.4 298.4 565.8 320 565.8 363.2V448.4C565.8 475.2 562.2 494.8 555 507.2C548.2 519.6 537 528.8 521.4 534.8C537 540.8 548.2 550 555 562.4C562.2 574.8 565.8 594.4 565.8 621.2V706.4C565.8 749.6 579.4 771.2 606.6 771.2C611.4 771.2 613.8 773.6 613.8 778.4C613.8 783.2 611.4 785.6 606.6 785.6Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
