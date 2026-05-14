import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import { type FilterOptions, type FilterStatus, DEFAULT_FILTER, isFilterActive } from "./FilterBar";
import type { TimelineField } from "./TimelineFilter";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { lensStyleFor } from "./specLens";
import type { ApiSpecNode, GraphMode, SpecLensMode, SpecOverlayMap } from "./types";

type HighlightedEdge = { id: string; source: string; target: string } | null;
type RecentSource = "activity" | "nodes" | "runs";

interface UseCanvasOverlayStateOptions {
  graphMode: GraphMode;
  specLens: SpecLensMode;
  specNodes: ApiSpecNode[] | undefined;
  specOverlays: SpecOverlayMap;
  nodes: Node[];
  edges: Edge[];
  highlightedEdge: HighlightedEdge;
  searchMatchIds: Set<string> | null;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  navigateToSpec: (nodeId: string) => void;
  onSpecNavBack: () => void;
  onSpecNavForward: () => void;
}

function dateRangeForNodes(nodes: ApiSpecNode[] | undefined, field: TimelineField): [number, number] | null {
  const timestamps = (nodes ?? [])
    .map((node) => node[field])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => new Date(value).getTime())
    .filter((timestamp) => !isNaN(timestamp));
  if (timestamps.length === 0) return null;
  return [Math.min(...timestamps), Math.max(...timestamps)];
}

export function useCanvasOverlayState({
  graphMode,
  specLens,
  specNodes,
  specOverlays,
  nodes,
  edges,
  highlightedEdge,
  searchMatchIds,
  setSearchOpen,
  navigateToSpec,
  onSpecNavBack,
  onSpecNavForward,
}: UseCanvasOverlayStateOptions) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentMultiSelectIds, setRecentMultiSelectIds] = useState<Set<string> | null>(null);
  const [recentLastSeen, setRecentLastSeen] = useState<string>(() => {
    const saved = localStorage.getItem("contextbuilder.recentLastSeen");
    if (saved) return saved;
    const now = new Date().toISOString();
    localStorage.setItem("contextbuilder.recentLastSeen", now);
    return now;
  });
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineField, setTimelineField] = useState<TimelineField>("updated_at");
  const [timelineRange, setTimelineRange] = useState<[number, number] | null>(null);

  const timelineFullRange = useMemo(
    () => dateRangeForNodes(specNodes, timelineField),
    [specNodes, timelineField],
  );

  const timelineMatchIds = useMemo((): Set<string> | null => {
    if (!timelineOpen || !timelineRange || !specNodes) return null;
    const [minTs, maxTs] = timelineRange;
    return new Set(
      specNodes
        .filter((node) => {
          const value = node[timelineField];
          if (!value) return true;
          const timestamp = new Date(value).getTime();
          return !isNaN(timestamp) && timestamp >= minTs && timestamp <= maxTs;
        })
        .map((node) => node.node_id),
    );
  }, [timelineOpen, timelineRange, timelineField, specNodes]);

  const filterMatchIds = useMemo((): Set<string> | null => {
    if (!isFilterActive(filterOptions) || !specNodes) return null;
    return new Set(
      specNodes
        .filter((node) => {
          const statusOk = filterOptions.statuses.size === 0 || filterOptions.statuses.has(node.status as FilterStatus);
          const gapsOk = !filterOptions.hasGaps || (node.gap_count ?? 0) > 0;
          const brokenOk = !filterOptions.hasBroken || node.diagnostics.length > 0;
          return statusOk && gapsOk && brokenOk;
        })
        .map((node) => node.node_id),
    );
  }, [filterOptions, specNodes]);

  const displayNodes = useMemo(() => {
    const edgeEndpoints = highlightedEdge
      ? new Set([highlightedEdge.source, highlightedEdge.target])
      : null;
    const lensActive = graphMode === "specifications" && specLens !== "none";
    const recentActive = recentMultiSelectIds !== null && recentMultiSelectIds.size > 0;
    if (!edgeEndpoints && !searchMatchIds && !timelineMatchIds && !filterMatchIds && !recentActive && !lensActive) return nodes;
    return nodes.map((node) => {
      const edgeHighlighted = edgeEndpoints?.has(node.id);
      const matchKey = node.parentId ?? node.id;
      const searchDimmed = searchMatchIds ? !searchMatchIds.has(matchKey) : false;
      const timelineDimmed = timelineMatchIds ? !timelineMatchIds.has(matchKey) : false;
      const filterDimmed = filterMatchIds ? !filterMatchIds.has(matchKey) : false;
      const recentDimmed = recentActive ? !recentMultiSelectIds!.has(matchKey) : false;
      let lensStyle: ReturnType<typeof lensStyleFor> | undefined;
      if (lensActive && (node.type === "spec" || node.type === "expandedSpec")) {
        const style = lensStyleFor(node.id, specLens, specOverlays);
        if (Object.keys(style).length > 0) lensStyle = style;
      }
      if (!edgeHighlighted && !searchDimmed && !timelineDimmed && !filterDimmed && !recentDimmed && !lensStyle) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(edgeHighlighted ? { edgeHighlighted: true } : {}),
          ...(searchDimmed ? { searchDimmed: true } : {}),
          ...(timelineDimmed ? { timelineDimmed: true } : {}),
          ...(filterDimmed ? { filterDimmed: true } : {}),
          ...(recentDimmed ? { recentDimmed: true } : {}),
          ...(lensStyle ? { lensStyle } : {}),
        },
      };
    });
  }, [nodes, highlightedEdge, searchMatchIds, timelineMatchIds, filterMatchIds, recentMultiSelectIds, graphMode, specLens, specOverlays]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdge) return edges;
    return edges.map((edge) =>
      edge.id === highlightedEdge.id
        ? { ...edge, className: ((edge.className ?? "") + " edge-highlight").trim() }
        : edge,
    );
  }, [edges, highlightedEdge]);

  const handleTimelineFieldChange = useCallback((field: TimelineField) => {
    setTimelineField(field);
    const range = dateRangeForNodes(specNodes, field);
    if (range) setTimelineRange(range);
  }, [specNodes]);

  const toggleTimeline = useCallback(() => {
    setTimelineOpen((open) => {
      if (open) {
        setTimelineRange(null);
        return false;
      }
      if (timelineFullRange) setTimelineRange(timelineFullRange);
      setRecentOpen(false);
      return true;
    });
  }, [timelineFullRange]);

  const recentUnreadCount = useMemo(() => {
    if (!specNodes) return 0;
    const lastMs = new Date(recentLastSeen).getTime();
    if (!Number.isFinite(lastMs)) return 0;
    return specNodes.reduce((count, node) => {
      if (!node.updated_at) return count;
      return new Date(node.updated_at).getTime() > lastMs ? count + 1 : count;
    }, 0);
  }, [specNodes, recentLastSeen]);

  const toggleRecent = useCallback(() => {
    setRecentOpen((open) => {
      if (!open) {
        const now = new Date().toISOString();
        localStorage.setItem("contextbuilder.recentLastSeen", now);
        setRecentLastSeen(now);
        setTimelineOpen(false);
        setTimelineRange(null);
      }
      return !open;
    });
  }, []);

  const onRecentSelect = useCallback(
    (id: string, ts: string, source: RecentSource) => {
      const tsMs = new Date(ts).getTime();
      if (source === "nodes" && Number.isFinite(tsMs)) {
        const hour = 60 * 60 * 1000;
        if (timelineField !== "updated_at") {
          setTimelineField("updated_at");
        }
        if (timelineFullRange) {
          const [fullMin, fullMax] = timelineFullRange;
          const lo = Math.max(fullMin, tsMs - hour);
          const hi = Math.min(fullMax, tsMs + hour);
          setTimelineRange([Math.min(lo, hi), Math.max(lo, hi)]);
        } else {
          setTimelineRange([tsMs - hour, tsMs + hour]);
        }
        setTimelineOpen(true);
        setRecentOpen(false);
      } else {
        setRecentOpen(false);
      }
      navigateToSpec(id);
    },
    [navigateToSpec, timelineField, timelineFullRange],
  );

  useKeyboardShortcuts({
    graphMode,
    recentMultiSelectIds,
    setSearchOpen,
    setRecentMultiSelectIds,
    onSpecNavBack,
    onSpecNavForward,
    toggleRecent,
    toggleTimeline,
  });

  return {
    displayNodes,
    displayEdges,
    timelineOpen,
    timelineField,
    timelineFullRange,
    timelineRange,
    setTimelineRange,
    handleTimelineFieldChange,
    toggleTimeline,
    recentOpen,
    recentUnreadCount,
    recentMultiSelectIds,
    setRecentMultiSelectIds,
    toggleRecent,
    onRecentSelect,
    filterOpen,
    setFilterOpen,
    filterOptions,
    setFilterOptions,
  };
}
