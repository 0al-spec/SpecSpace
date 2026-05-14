import type { Dispatch, SetStateAction } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faClock, faClockRotateLeft, faFilter } from "@fortawesome/free-solid-svg-icons";
import TimelineFilter, { type TimelineField } from "./TimelineFilter";
import RecentChangesOverlay from "./RecentChangesOverlay";
import FilterBar, { DEFAULT_FILTER, isFilterActive, type FilterOptions } from "./FilterBar";
import PanelBtn from "./PanelBtn";
import "./PanelBtn.css";
import type { ApiSpecNode, GraphMode, SpecViewOptions } from "./types";

type RecentSource = "activity" | "nodes" | "runs";

interface CanvasOverlaysProps {
  graphMode: GraphMode;
  specViewOptions: SpecViewOptions;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  timelineOpen: boolean;
  timelineField: TimelineField;
  timelineFullRange: [number, number] | null;
  timelineRange: [number, number] | null;
  onTimelineFieldChange: (field: TimelineField) => void;
  onTimelineRangeChange: Dispatch<SetStateAction<[number, number] | null>>;
  onToggleTimeline: () => void;
  recentOpen: boolean;
  recentUnreadCount: number;
  recentMultiSelectIds: Set<string> | null;
  onRecentMultiSelectChange: Dispatch<SetStateAction<Set<string> | null>>;
  onToggleRecent: () => void;
  onRecentSelect: (nodeId: string, ts: string, source: RecentSource) => void;
  specNodes: ApiSpecNode[] | undefined;
  selectedNodeId: string | null;
  filterOpen: boolean;
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
  filterOptions: FilterOptions;
  setFilterOptions: Dispatch<SetStateAction<FilterOptions>>;
}

export default function CanvasOverlays({
  graphMode,
  specViewOptions,
  sidebarCollapsed,
  onToggleSidebar,
  timelineOpen,
  timelineField,
  timelineFullRange,
  timelineRange,
  onTimelineFieldChange,
  onTimelineRangeChange,
  onToggleTimeline,
  recentOpen,
  recentUnreadCount,
  recentMultiSelectIds,
  onRecentMultiSelectChange,
  onToggleRecent,
  onRecentSelect,
  specNodes,
  selectedNodeId,
  filterOpen,
  setFilterOpen,
  filterOptions,
  setFilterOptions,
}: CanvasOverlaysProps) {
  const showSpecControls = graphMode === "specifications" && specViewOptions.viewMode !== "force";

  return (
    <>
      <div className="timeline-overlay">
        {sidebarCollapsed && (
          <PanelBtn
            icon={<FontAwesomeIcon icon={faBars} />}
            title="Show sidebar"
            onClick={onToggleSidebar}
          />
        )}

        {showSpecControls && (
          <>
            <div className="timeline-header">
              <PanelBtn
                icon={<FontAwesomeIcon icon={faClock} />}
                title={timelineOpen ? "Close timeline filter (T)" : "Open timeline filter (T)"}
                onClick={onToggleTimeline}
                className={timelineOpen ? "timeline-btn-active" : undefined}
              />
              <PanelBtn
                icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
                title={recentOpen ? "Close recent changes (R)" : "Show recently updated nodes (R)"}
                onClick={onToggleRecent}
                className={recentOpen ? "timeline-btn-active" : undefined}
                badge={recentOpen ? 0 : recentUnreadCount}
              />
              {timelineOpen && (
                <div className="tl-segment">
                  <button
                    className={`tl-seg-btn${timelineField === "created_at" ? " active" : ""}`}
                    onClick={() => onTimelineFieldChange("created_at")}
                  >Created</button>
                  <button
                    className={`tl-seg-btn${timelineField === "updated_at" ? " active" : ""}`}
                    onClick={() => onTimelineFieldChange("updated_at")}
                  >Updated</button>
                </div>
              )}
            </div>
            {timelineOpen && timelineFullRange && timelineRange && (
              <TimelineFilter
                range={timelineRange}
                onRangeChange={onTimelineRangeChange}
                fullRange={timelineFullRange}
              />
            )}
            {recentOpen && specNodes && (
              <RecentChangesOverlay
                nodes={specNodes}
                multiSelectIds={recentMultiSelectIds}
                onMultiSelectChange={onRecentMultiSelectChange}
                onSelect={onRecentSelect}
                selectedNodeId={selectedNodeId}
              />
            )}
          </>
        )}
      </div>

      {showSpecControls && (
        <div className="filter-overlay">
          <PanelBtn
            icon={<FontAwesomeIcon icon={faFilter} />}
            title={filterOpen ? "Close filter" : "Filter nodes"}
            onClick={() => {
              if (filterOpen) {
                setFilterOpen(false);
                setFilterOptions(DEFAULT_FILTER);
              } else {
                setFilterOpen(true);
              }
            }}
            className={isFilterActive(filterOptions) ? "filter-btn-active" : undefined}
          />
          {filterOpen && (
            <FilterBar filter={filterOptions} onChange={setFilterOptions} />
          )}
        </div>
      )}
    </>
  );
}
