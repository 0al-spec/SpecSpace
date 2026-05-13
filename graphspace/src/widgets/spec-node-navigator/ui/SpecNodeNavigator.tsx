import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpecNode } from "@/entities/spec-node";
import {
  filterSpecNodeNavigatorNodes,
  type SpecNodeNavigatorSignalFilter,
} from "../model/filter";
import styles from "./SpecNodeNavigator.module.css";

type Props = {
  nodes: readonly SpecNode[];
  selectedNodeId: string | null;
  source: "live" | "sample";
  onSelectNodeId: (nodeId: string) => void;
};

type ScrollMetrics = {
  thumbHeight: number;
  thumbTop: number;
  visible: boolean;
};

const formatCountLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const FILTER_LABELS: Record<SpecNodeNavigatorSignalFilter, string> = {
  all: "All",
  gaps: "Gaps",
  diagnostics: "Diagnostics",
};

const FILTER_ORDER: SpecNodeNavigatorSignalFilter[] = [
  "all",
  "gaps",
  "diagnostics",
];

export function SpecNodeNavigator({
  nodes,
  selectedNodeId,
  source,
  onSelectNodeId,
}: Props) {
  const [query, setQuery] = useState("");
  const [signalFilter, setSignalFilter] =
    useState<SpecNodeNavigatorSignalFilter>("all");
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics>({
    thumbHeight: 0,
    thumbTop: 0,
    visible: false,
  });
  const listRef = useRef<HTMLUListElement | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const lastScrolledSelectionRef = useRef<string | null>(null);
  const selectedWasVisibleRef = useRef(false);
  const filterCounts = useMemo(
    () => ({
      all: nodes.length,
      gaps: nodes.filter((node) => node.gap_count > 0).length,
      diagnostics: nodes.filter((node) => node.diagnostics.length > 0).length,
    }),
    [nodes],
  );
  const visibleNodes = useMemo(
    () => filterSpecNodeNavigatorNodes(nodes, query, signalFilter),
    [nodes, query, signalFilter],
  );
  const selectedNodeIsVisible = useMemo(
    () =>
      selectedNodeId !== null &&
      visibleNodes.some((node) => node.node_id === selectedNodeId),
    [selectedNodeId, visibleNodes],
  );
  const caption = `${visibleNodes.length} of ${nodes.length} nodes · ${source}`;
  const updateScrollMetrics = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const visible = list.scrollHeight > list.clientHeight + 1;
    if (!visible) {
      setScrollMetrics((current) =>
        current.visible ? { thumbHeight: 0, thumbTop: 0, visible: false } : current,
      );
      return;
    }

    const thumbHeight = Math.max(32, (list.clientHeight / list.scrollHeight) * list.clientHeight);
    const maxThumbTop = list.clientHeight - thumbHeight;
    const maxScrollTop = list.scrollHeight - list.clientHeight;
    const thumbTop = maxScrollTop > 0 ? (list.scrollTop / maxScrollTop) * maxThumbTop : 0;

    setScrollMetrics((current) => {
      const next = {
        thumbHeight,
        thumbTop,
        visible: true,
      };
      return Math.abs(current.thumbHeight - next.thumbHeight) < 0.5 &&
        Math.abs(current.thumbTop - next.thumbTop) < 0.5 &&
        current.visible === next.visible
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    updateScrollMetrics();

    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollMetrics);
    observer.observe(list);
    return () => observer.disconnect();
  }, [updateScrollMetrics, visibleNodes.length]);

  useEffect(() => {
    const becameVisible = selectedNodeIsVisible && !selectedWasVisibleRef.current;
    selectedWasVisibleRef.current = selectedNodeIsVisible;

    if (!selectedNodeId || !selectedNodeIsVisible) {
      if (!selectedNodeId) lastScrolledSelectionRef.current = null;
      return;
    }

    if (lastScrolledSelectionRef.current === selectedNodeId && !becameVisible) return;

    const selectedRow = selectedRowRef.current;
    if (!selectedRow) return;

    selectedRow.scrollIntoView({ block: "nearest" });
    lastScrolledSelectionRef.current = selectedNodeId;
    const frame = window.requestAnimationFrame(updateScrollMetrics);
    return () => window.cancelAnimationFrame(frame);
  }, [selectedNodeId, selectedNodeIsVisible, updateScrollMetrics]);

  return (
    <section className={styles.root} aria-label="Spec node navigator">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Spec nodes</h2>
          <p className={styles.caption}>{caption}</p>
        </div>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          aria-label="Search SpecGraph nodes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SG-SPEC-0001 or title"
        />
        {query ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className={styles.filterRow} aria-label="Spec node signal filters">
        {FILTER_ORDER.map((filter) => (
          <button
            key={filter}
            type="button"
            className={[
              styles.filterButton,
              signalFilter === filter ? styles.filterButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={signalFilter === filter}
            onClick={() => setSignalFilter(filter)}
          >
            <span>{FILTER_LABELS[filter]}</span>
            <span>{filterCounts[filter]}</span>
          </button>
        ))}
      </div>

      {nodes.length === 0 ? (
        <p className={styles.empty}>No spec nodes available.</p>
      ) : visibleNodes.length === 0 ? (
        <p className={styles.empty}>No spec nodes match this search.</p>
      ) : (
        <div className={styles.listFrame}>
          <ul
            ref={listRef}
            className={styles.list}
            onScroll={updateScrollMetrics}
          >
            {visibleNodes.map((node) => {
              const isSelected = selectedNodeId === node.node_id;

              return (
                <li key={node.node_id} className={styles.listItem}>
                  <button
                    ref={isSelected ? selectedRowRef : undefined}
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`Select ${node.node_id}`}
                    className={[styles.row, isSelected ? styles.rowSelected : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSelectNodeId(node.node_id)}
                  >
                    <span className={styles.rowTop}>
                      <span className={styles.nodeId}>{node.node_id}</span>
                      <span className={styles.status}>{node.status}</span>
                    </span>
                    <span className={styles.nodeTitle}>{node.title}</span>
                    <span className={styles.rowMeta}>
                      <span>{node.kind}</span>
                      <span>{formatCountLabel(node.gap_count, "gap")}</span>
                      {node.diagnostics.length > 0 ? (
                        <span>
                          {formatCountLabel(node.diagnostics.length, "diagnostic")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {scrollMetrics.visible ? (
            <div className={styles.scrollbar} aria-hidden="true">
              <span
                className={styles.scrollbarThumb}
                style={{
                  height: `${scrollMetrics.thumbHeight}px`,
                  transform: `translateY(${scrollMetrics.thumbTop}px)`,
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
