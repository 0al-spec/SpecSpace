import type { RecentChange, RecentChangeTone } from "@/entities/recent-change";
import { RecentChangesPanel } from "@/widgets/recent-changes-panel";
import { ToneFilterBar } from "@/features/filter-by-tone";
import { SpecSearchBox } from "@/features/search-by-spec";
import styles from "./ViewerPage.module.css";

type Props = {
  entries: readonly RecentChange[];
  now?: Date;
  caption: string;
  emptyMessage: string;
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
};

export function RecentActivitySurface({
  entries,
  now,
  caption,
  emptyMessage,
  search,
  tone,
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
        className={styles.recentPanel}
      />
    </div>
  );
}
