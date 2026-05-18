import type { CSSProperties } from "react";
import type { SpecNode } from "../model/types";
import {
  formatSpecNodeGapLabel,
  formatSpecNodeMaturity,
  getSpecNodeGapMarks,
  getSpecNodeMaturityPercent,
  getSpecNodeMaturityTone,
} from "../lib/visual-signals";
import styles from "./SpecNodeCard.module.css";
import { SpecNodeStatusBadge } from "./SpecNodeStatusBadge";

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
  const gapLabel = formatSpecNodeGapLabel(node.gap_count);
  const gapMarks = getSpecNodeGapMarks(node);
  const showMaturity = variant === "preview" || maturityPercent !== null;
  const showObjective = variant === "preview" || Boolean(objectivePreview);
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
        <SpecNodeStatusBadge status={node.status} />
      </div>
      <h3 className={styles.title}>{node.title}</h3>
      {showObjective ? (
        <p
          className={styles.objective}
          data-placeholder={objectivePreview ? undefined : "true"}
        >
          {objectivePreview ?? ""}
        </p>
      ) : null}
      <div className={styles.meta}>
        <span className={styles.metaGroup}>
          <span>{node.kind}</span>
          <span>{gapLabel}</span>
        </span>
        {showMaturity ? (
          <span className={styles.maturityValue}>{maturityLabel ?? "n/a"}</span>
        ) : null}
      </div>
      {showMaturity ? (
        <span className={styles.maturityTrack} aria-hidden="true">
          <span
            className={`${styles.maturityFill} ${styles[`maturityFill-${maturityTone}`]}`}
            style={maturityStyle}
          />
        </span>
      ) : null}
      {gapMarks.length > 0 ? (
        <div className={styles.gapMarks} aria-label="Gap profile">
          {gapMarks.map((mark) => (
            <span
              key={mark.kind}
              className={`${styles.gapMark} ${styles[`gapMark-${mark.kind}`]}`}
              title={`${mark.label} gaps: ${mark.count}`}
            >
              <span>{mark.shortLabel}</span>
              <span>{mark.count}</span>
            </span>
          ))}
        </div>
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
