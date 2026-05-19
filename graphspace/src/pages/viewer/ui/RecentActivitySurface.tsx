import type { RecentChange, RecentChangeTone } from "@/entities/recent-change";
import { RecentChangesPanel } from "@/widgets/recent-changes-panel";
import type { PromptOverlayStatus, PromptOverlaySummary } from "@/shared/spec-graph-contract";
import type { SpecRefResolver } from "@/shared/ui/spec-id-text";
import { ToneFilterBar } from "@/features/filter-by-tone";
import { SpecSearchBox } from "@/features/search-by-spec";
import type {
  RecentTimelineField,
  RecentTimelineFilter,
  RecentTimelineRange,
} from "../model/recent-timeline-filter";
import { RecentTimelineFilterBar } from "./RecentTimelineFilterBar";
import styles from "./ViewerPage.module.css";

type Props = {
  entries: readonly RecentChange[];
  now?: Date;
  caption: string;
  emptyMessage: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  search: {
    query: string;
    onQueryChange: (query: string) => void;
    onClear: () => void;
    resultCount: number;
    totalCount: number;
  };
  tone: {
    entries: readonly RecentChange[];
    selected: ReadonlySet<RecentChangeTone>;
    onToggle: (tone: RecentChangeTone) => void;
    onClear: () => void;
  };
  timeline: {
    filter: RecentTimelineFilter;
    resultCount: number;
    totalCount: number;
    knownCount: number;
    unknownCount: number;
    onFieldChange: (field: RecentTimelineField) => void;
    onRangeChange: (range: RecentTimelineRange) => void;
    onIncludeUnknownChange: (includeUnknown: boolean) => void;
    onClear: () => void;
  };
  promptOverlay?: PromptOverlaySummary;
};

export function RecentActivitySurface({
  entries,
  now,
  caption,
  emptyMessage,
  resolveSpecRef,
  onSpecIdClick,
  search,
  tone,
  timeline,
  promptOverlay,
}: Props) {
  const hasPromptOverlay =
    promptOverlay &&
    (promptOverlay.drift_group_count > 0 ||
      Object.keys(promptOverlay.status_counts).length > 0);

  return (
    <div className={styles.feedColumn}>
      <SpecSearchBox
        query={search.query}
        onQueryChange={search.onQueryChange}
        onClear={search.onClear}
        resultCount={search.resultCount}
        totalCount={search.totalCount}
      />
      <RecentTimelineFilterBar
        filter={timeline.filter}
        resultCount={timeline.resultCount}
        totalCount={timeline.totalCount}
        knownCount={timeline.knownCount}
        unknownCount={timeline.unknownCount}
        onFieldChange={timeline.onFieldChange}
        onRangeChange={timeline.onRangeChange}
        onIncludeUnknownChange={timeline.onIncludeUnknownChange}
        onClear={timeline.onClear}
      />
      <ToneFilterBar
        entries={tone.entries}
        selected={tone.selected}
        onToggle={tone.onToggle}
        onClear={tone.onClear}
      />
      {hasPromptOverlay ? <PromptOverlayDriftSummary summary={promptOverlay} /> : null}
      <RecentChangesPanel
        entries={entries}
        now={now}
        caption={caption}
        emptyMessage={emptyMessage}
        resolveSpecRef={resolveSpecRef}
        onSpecIdClick={onSpecIdClick}
        className={styles.recentPanel}
      />
    </div>
  );
}

function PromptOverlayDriftSummary({ summary }: { summary: PromptOverlaySummary }) {
  const groups = summary.drift_groups ?? [];
  const visibleGroups = groups.slice(0, 4);
  const hiddenGroupCount = Math.max(0, groups.length - visibleGroups.length);

  return (
    <section className={styles.promptDrift} aria-label={summary.label}>
      <header className={styles.promptDriftHeader}>
        <span>{summary.label}</span>
        <span>
          {summary.drift_group_count}{" "}
          {summary.drift_group_count === 1 ? "group" : "groups"}
        </span>
      </header>
      <div className={styles.promptDriftCounts}>
        {Object.entries(summary.status_counts).map(([status, count]) => (
          <span
            key={status}
            className={[
              styles.promptDriftCount,
              styles[`promptDriftCount-${statusTone(status as PromptOverlayStatus)}`],
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {statusLabel(status)} {count}
          </span>
        ))}
      </div>
      {visibleGroups.length > 0 ? (
        <div className={styles.promptDriftGroups}>
          {visibleGroups.map((group) => {
            const status = group.dominant_status ?? group.status ?? "legacy_unknown";
            return (
              <div key={group.drift_key} className={styles.promptDriftGroup}>
                <span
                  className={[
                    styles.promptDriftDot,
                    styles[`promptDriftDot-${statusTone(status)}`],
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                />
                <span className={styles.promptDriftGroupLabel}>
                  {group.display_label}
                </span>
                <span className={styles.promptDriftGroupMeta}>
                  {group.event_count} {group.event_count === 1 ? "run" : "runs"}
                </span>
              </div>
            );
          })}
          {hiddenGroupCount > 0 ? (
            <div className={styles.promptDriftMore}>+{hiddenGroupCount} more</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function statusTone(status: PromptOverlayStatus): "active" | "danger" | "muted" | "neutral" {
  switch (status) {
    case "enabled":
      return "active";
    case "unsafe":
      return "danger";
    case "legacy_unknown":
      return "muted";
    case "core":
      return "neutral";
  }
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}
