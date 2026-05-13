import type { SpecNode } from "../model/types";
import styles from "./SpecNodeCard.module.css";

type LifecycleBadge = {
  packageKey: string;
  status: string;
  tone: "draft" | "ready" | "blocked" | "unknown";
};

type Props = {
  node: SpecNode;
  selected?: boolean;
  lifecycleBadge?: LifecycleBadge | null;
};

export function SpecNodeCard({ node, selected = false, lifecycleBadge = null }: Props) {
  const maturity = typeof node.maturity === "number" ? Math.round(node.maturity * 100) : null;
  const gapLabel = node.gap_count === 1 ? "1 gap" : `${node.gap_count} gaps`;

  return (
    <article
      className={selected ? `${styles.card} ${styles.selected}` : styles.card}
      data-spec-node-id={node.node_id}
    >
      <div className={styles.header}>
        <span className={styles.id}>{node.node_id}</span>
        <span className={styles.status}>{node.status}</span>
      </div>
      <h3 className={styles.title}>{node.title}</h3>
      <div className={styles.meta}>
        <span>{node.kind}</span>
        <span>{gapLabel}</span>
        {maturity !== null ? <span>{maturity}%</span> : null}
      </div>
      {lifecycleBadge ? (
        <div className={styles.lifecycle}>
          <span
            className={`${styles.lifecycleBadge} ${styles[`lifecycleBadge-${lifecycleBadge.tone}`]}`}
            title={lifecycleBadge.packageKey}
          >
            {lifecycleBadge.status}
          </span>
        </div>
      ) : null}
    </article>
  );
}
