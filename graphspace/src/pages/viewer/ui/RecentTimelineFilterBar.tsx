import type {
  RecentTimelineField,
  RecentTimelineFilter,
  RecentTimelineRange,
} from "../model/recent-timeline-filter";
import {
  DEFAULT_RECENT_TIMELINE_FILTER,
  hasRecentTimelineFilter,
} from "../model/recent-timeline-filter";
import styles from "./ViewerPage.module.css";

const FIELD_OPTIONS: readonly {
  value: RecentTimelineField;
  label: string;
}[] = [
  { value: "event", label: "event" },
  { value: "spec-updated", label: "spec updated" },
  { value: "spec-created", label: "spec created" },
];

const RANGE_OPTIONS: readonly {
  value: RecentTimelineRange;
  label: string;
}[] = [
  { value: "all", label: "all" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

type Props = {
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

export function RecentTimelineFilterBar({
  filter,
  resultCount,
  totalCount,
  knownCount,
  unknownCount,
  onFieldChange,
  onRangeChange,
  onIncludeUnknownChange,
  onClear,
}: Props) {
  const active = hasRecentTimelineFilter(filter);

  return (
    <div className={styles.timelineFilter} aria-label="Filter recent changes by time">
      <div className={styles.timelineFilterGroup} role="group" aria-label="Timestamp field">
        {FIELD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[
              styles.timelineFilterChip,
              filter.field === option.value ? styles.timelineFilterChipActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={filter.field === option.value}
            onClick={() => onFieldChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={styles.timelineFilterGroup} role="group" aria-label="Time range">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[
              styles.timelineFilterChip,
              filter.range === option.value ? styles.timelineFilterChipActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={filter.range === option.value}
            onClick={() => onRangeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className={styles.timelineUnknownToggle}>
        <input
          type="checkbox"
          checked={filter.includeUnknown}
          onChange={(event) => onIncludeUnknownChange(event.currentTarget.checked)}
        />
        <span>unknown {unknownCount}</span>
      </label>
      <span className={styles.timelineFilterCount}>
        {resultCount}/{totalCount} shown · {knownCount} dated
      </span>
      <button
        type="button"
        className={styles.timelineFilterClear}
        onClick={onClear}
        disabled={!active}
      >
        Clear
      </button>
      <span className={styles.timelineFilterDefault} hidden={active}>
        default {DEFAULT_RECENT_TIMELINE_FILTER.range}
      </span>
    </div>
  );
}
