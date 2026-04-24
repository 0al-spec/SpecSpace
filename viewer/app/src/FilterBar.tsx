import "./FilterBar.css";

export type FilterStatus = "idea" | "stub" | "outlined" | "specified" | "linked" | "reviewed" | "frozen";

export const ALL_STATUSES: FilterStatus[] = [
  "idea", "stub", "outlined", "specified", "linked", "reviewed", "frozen",
];

export interface FilterOptions {
  statuses: Set<FilterStatus>;   // empty = no status filter (show all)
  hasGaps: boolean;              // true = show only nodes with gap_count > 0
  hasBroken: boolean;            // true = show only nodes with broken edges
}

export const DEFAULT_FILTER: FilterOptions = {
  statuses: new Set(),
  hasGaps: false,
  hasBroken: false,
};

export function isFilterActive(f: FilterOptions): boolean {
  return f.statuses.size > 0 || f.hasGaps || f.hasBroken;
}

interface FilterBarProps {
  filter: FilterOptions;
  onChange: (f: FilterOptions) => void;
}

const STATUS_LABELS: Record<FilterStatus, string> = {
  idea: "idea",
  stub: "stub",
  outlined: "outlined",
  specified: "specified",
  linked: "linked",
  reviewed: "reviewed",
  frozen: "frozen",
};

export default function FilterBar({ filter, onChange }: FilterBarProps) {
  const active = isFilterActive(filter);

  function toggleStatus(s: FilterStatus) {
    const next = new Set(filter.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...filter, statuses: next });
  }

  function clearAll() {
    onChange(DEFAULT_FILTER);
  }

  return (
    <div className={`filter-bar${active ? " filter-bar--active" : ""}`}>
      <span className="filter-bar-label">Filter</span>

      <div className="filter-bar-chips">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            className={`filter-chip filter-chip--${s}${filter.statuses.has(s) ? " filter-chip--on" : ""}`}
            onClick={() => toggleStatus(s)}
            title={`Show only ${s} nodes`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="filter-bar-toggles">
        <button
          className={`filter-toggle${filter.hasGaps ? " filter-toggle--on" : ""}`}
          onClick={() => onChange({ ...filter, hasGaps: !filter.hasGaps })}
          title="Show only nodes with unmet acceptance criteria"
        >
          ⚡ has gaps
        </button>
        <button
          className={`filter-toggle${filter.hasBroken ? " filter-toggle--on" : ""}`}
          onClick={() => onChange({ ...filter, hasBroken: !filter.hasBroken })}
          title="Show only nodes with broken edge references"
        >
          ⚠ broken
        </button>
      </div>

      {active && (
        <button className="filter-bar-clear" onClick={clearAll} title="Clear all filters">
          ✕ clear
        </button>
      )}
    </div>
  );
}
