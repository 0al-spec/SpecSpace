import type { HTMLAttributes } from "react";
import { RecentChangeRow, type RecentChange } from "@/entities/recent-change";
import type { SpecRefResolver } from "@/shared/ui/spec-id-text";
import styles from "./RecentChangesPanel.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  /** Activity entries already validated by spec-graph-contract. */
  entries: readonly RecentChange[];
  /** Optional header title; defaults to "Recent changes". */
  title?: string;
  /** Override "now" — used for stable demo screenshots and tests. */
  now?: Date;
  /**
   * Empty-state copy. Distinguishes "no data yet" from "filtered to zero":
   * the parent decides the right wording.
   */
  emptyMessage?: string;
  /** Optional small text on the right of the header (source, status). */
  caption?: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
};

export function RecentChangesPanel({
  entries,
  title = "Recent changes",
  now,
  emptyMessage = "No activity recorded yet",
  caption,
  resolveSpecRef,
  onSpecIdClick,
  className,
  ...rest
}: Props) {
  const cls = [styles.panel, className].filter(Boolean).join(" ");
  const meta = caption ?? `${entries.length} ${entries.length === 1 ? "event" : "events"}`;

  return (
    <section className={cls} {...rest}>
      <header className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
      </header>
      <div className={styles.scroll}>
        {entries.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles["empty-eyebrow"]}>Empty</p>
            <p className={styles["empty-msg"]}>{emptyMessage}</p>
          </div>
        ) : (
          entries.map((e) => (
            <RecentChangeRow
              key={e.event_id}
              entry={e}
              now={now}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
            />
          ))
        )}
      </div>
    </section>
  );
}
