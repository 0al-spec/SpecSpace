import type { RecentChange, RecentChangeTone } from "@/entities/recent-change";
import { RecentChangesPanel } from "@/widgets/recent-changes-panel";
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
}: Props) {
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
