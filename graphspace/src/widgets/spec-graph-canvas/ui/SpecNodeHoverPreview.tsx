import type { CSSProperties } from "react";
import {
  placeSpecNodeHoverPreview,
  type HoverPreviewAnchor,
  type HoverPreviewViewport,
  type SpecNodeHoverPreview as SpecNodeHoverPreviewModel,
} from "../model/hover-preview";
import styles from "./SpecNodeHoverPreview.module.css";

type Props = {
  preview: SpecNodeHoverPreviewModel;
  anchor: HoverPreviewAnchor;
  viewport?: HoverPreviewViewport;
};

type MaturityStyle = CSSProperties & {
  "--spec-node-preview-maturity": string;
};

const readViewport = (): HoverPreviewViewport => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

export function SpecNodeHoverPreview({ preview, anchor, viewport }: Props) {
  const position = placeSpecNodeHoverPreview(anchor, viewport ?? readViewport());
  const maturityStyle: MaturityStyle = {
    "--spec-node-preview-maturity": `${preview.maturityPercent ?? 0}%`,
  };

  return (
    <aside
      className={styles.card}
      data-placement={position.placement}
      role="tooltip"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div className={styles.header}>
        <span className={styles.id}>{preview.nodeId}</span>
        <span className={styles.status}>{preview.status}</span>
      </div>

      <h3 className={styles.title}>{preview.title}</h3>

      {preview.objectivePreview ? (
        <p className={styles.objective}>{preview.objectivePreview}</p>
      ) : null}

      <div className={styles.footer}>
        <div className={styles.maturity}>
          <span className={styles.maturityLabel}>Maturity</span>
          <span className={styles.maturityValue}>
            {preview.maturityLabel ?? "n/a"}
          </span>
          <span className={styles.maturityTrack} aria-hidden="true">
            <span className={styles.maturityFill} style={maturityStyle} />
          </span>
        </div>
        <span className={styles.gaps}>{preview.gapLabel}</span>
      </div>
    </aside>
  );
}
