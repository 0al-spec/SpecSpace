import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpecNode } from "@/entities/spec-node";
import { filterSpecNodeNavigatorNodes } from "../model/filter";
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

export function SpecNodeNavigator({
  nodes,
  selectedNodeId,
  source,
  onSelectNodeId,
}: Props) {
  const [query, setQuery] = useState("");
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics>({
    thumbHeight: 0,
    thumbTop: 0,
    visible: false,
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const visibleNodes = useMemo(
    () => filterSpecNodeNavigatorNodes(nodes, query),
    [nodes, query],
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

      {nodes.length === 0 ? (
        <p className={styles.empty}>No spec nodes available.</p>
      ) : visibleNodes.length === 0 ? (
        <p className={styles.empty}>No spec nodes match this search.</p>
      ) : (
        <div className={styles.listFrame}>
          <div
            ref={listRef}
            className={styles.list}
            role="list"
            onScroll={updateScrollMetrics}
          >
            {visibleNodes.map((node) => (
              <button
                key={node.node_id}
                type="button"
                aria-label={`Select ${node.node_id}`}
                className={[
                  styles.row,
                  selectedNodeId === node.node_id ? styles.rowSelected : "",
                ]
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
                  <span>{node.gap_count} gaps</span>
                  {node.diagnostics.length > 0 ? (
                    <span>{node.diagnostics.length} diagnostics</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
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
