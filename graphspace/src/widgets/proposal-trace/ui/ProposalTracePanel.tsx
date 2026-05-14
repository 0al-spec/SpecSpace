import type { HTMLAttributes } from "react";
import { ProposalTraceRow, type ProposalTraceEntry } from "@/entities/proposal-trace";
import type { ProposalSpecTraceIndex } from "@/shared/spec-graph-contract";
import styles from "./ProposalTracePanel.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  index: ProposalSpecTraceIndex | null;
  entries: readonly ProposalTraceEntry[];
  title?: string;
  caption?: string;
  emptyMessage?: string;
  onSpecIdClick?: (nodeId: string) => void;
};

export function ProposalTracePanel({
  index,
  entries,
  title = "Proposal trace",
  caption,
  emptyMessage = "No proposal trace entries yet",
  onSpecIdClick,
  className,
  ...rest
}: Props) {
  const cls = [styles.panel, className].filter(Boolean).join(" ");
  const meta = caption ?? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  return (
    <section className={cls} {...rest}>
      <header className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
      </header>
      {index && (
        <div className={styles.summary}>
          <Metric value={index.entry_count} label="entries" />
          <Metric value={index.summary.spec_ref_count} label="spec refs" />
          <Metric value={index.lane_ref_count} label="lane refs" />
        </div>
      )}
      <div className={styles.scroll}>
        {entries.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles["empty-eyebrow"]}>Empty</p>
            <p className={styles["empty-msg"]}>{emptyMessage}</p>
          </div>
        ) : (
          entries.map((entry) => (
            <ProposalTraceRow
              key={entry.trace_entry_id}
              entry={entry}
              onSpecIdClick={onSpecIdClick}
            />
          ))
        )}
      </div>
      <footer className={styles.boundary}>Read-only · proposal refs are not canonical graph edges</footer>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles["metric-value"]}>{value}</span>
      <span className={styles["metric-label"]}>{label}</span>
    </div>
  );
}
