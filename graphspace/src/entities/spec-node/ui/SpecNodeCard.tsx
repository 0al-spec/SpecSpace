import type { CSSProperties } from "react";
import type { SpecNode } from "../model/types";
import {
  formatSpecNodeGapLabel,
  formatSpecNodeMaturity,
  getSpecNodeMaturityPercent,
  getSpecNodeMaturityTone,
  getSpecNodeStatusTone,
} from "../lib/visual-signals";
import styles from "./SpecNodeCard.module.css";

type LifecycleBadge = {
  packageKey: string;
  status: string;
  tone: "draft" | "ready" | "blocked" | "unknown";
};

type SpecNodeCardVariant = "canvas" | "preview";

type Props = {
  node: SpecNode;
  selected?: boolean;
  lifecycleBadge?: LifecycleBadge | null;
  objectivePreview?: string | null;
  variant?: SpecNodeCardVariant;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
};

type MaturityStyle = CSSProperties & {
  "--spec-node-maturity": string;
};

export function SpecNodeCard({
  node,
  selected = false,
  lifecycleBadge = null,
  objectivePreview = null,
  variant = "canvas",
  className,
  style,
  ariaHidden = false,
}: Props) {
  const maturityPercent = getSpecNodeMaturityPercent(node.maturity);
  const maturityLabel = formatSpecNodeMaturity(node.maturity);
  const maturityTone = getSpecNodeMaturityTone(node.maturity);
  const statusTone = getSpecNodeStatusTone(node.status);
  const gapLabel = formatSpecNodeGapLabel(node.gap_count);
  const showMaturity = variant === "preview" || maturityPercent !== null;
  const maturityStyle: MaturityStyle = {
    "--spec-node-maturity": `${maturityPercent ?? 0}%`,
  };
  const cardClassName = [
    styles.card,
    variant === "preview" ? styles.preview : "",
    selected ? styles.selected : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cardClassName}
      data-spec-node-id={node.node_id}
      style={style}
      aria-hidden={ariaHidden ? "true" : undefined}
    >
      <div className={styles.header}>
        <span className={styles.id}>{node.node_id}</span>
        <span className={`${styles.status} ${styles[`status-${statusTone}`]}`}>
          {node.status}
        </span>
      </div>
      <h3 className={styles.title}>{node.title}</h3>
      {objectivePreview ? (
        <p className={styles.objective}>{objectivePreview}</p>
      ) : null}
      <div className={styles.meta}>
        <span>{node.kind}</span>
        <span>{gapLabel}</span>
        {showMaturity ? <span>{maturityLabel ?? "n/a"}</span> : null}
      </div>
      {showMaturity ? (
        <span className={styles.maturityTrack} aria-hidden="true">
          <span
            className={`${styles.maturityFill} ${styles[`maturityFill-${maturityTone}`]}`}
            style={maturityStyle}
          />
        </span>
      ) : null}
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
