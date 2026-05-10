import type { HTMLAttributes } from "react";
import { WorkItemRow, type WorkItem } from "@/entities/implementation-work";
import styles from "./ImplementationWorkPanel.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  items: readonly WorkItem[];
  title?: string;
  caption?: string;
  emptyMessage?: string;
};

export function ImplementationWorkPanel({
  items,
  title = "Implementation work",
  caption,
  emptyMessage = "No work items emitted yet",
  className,
  ...rest
}: Props) {
  const cls = [styles.panel, className].filter(Boolean).join(" ");
  const meta = caption ?? `${items.length} ${items.length === 1 ? "item" : "items"}`;

  return (
    <section className={cls} {...rest}>
      <header className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
      </header>
      <div className={styles.scroll}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles["empty-eyebrow"]}>Empty</p>
            <p className={styles["empty-msg"]}>{emptyMessage}</p>
          </div>
        ) : (
          items.map((it) => <WorkItemRow key={it.work_item_id} item={it} />)
        )}
      </div>
      <footer className={styles.boundary}>
        Planning only · no canonical spec or code mutation
      </footer>
    </section>
  );
}
