import type { SpecNode } from "../model/types";
import styles from "./SpecNodeCard.module.css";

type Props = {
  node: SpecNode;
  selected?: boolean;
};

export function SpecNodeCard({ node, selected = false }: Props) {
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
    </article>
  );
}
