import type { CSSProperties } from "react";
import {
  placeSpecNodeHoverPreview,
  SPEC_NODE_HOVER_PREVIEW_SIZE,
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

const VIEWPORT_SAFE_GUTTER = 24;

const readViewport = (): HoverPreviewViewport => {
  if (typeof window === "undefined") {
    return {
      width: SPEC_NODE_HOVER_PREVIEW_SIZE.width + VIEWPORT_SAFE_GUTTER,
      height: SPEC_NODE_HOVER_PREVIEW_SIZE.height + VIEWPORT_SAFE_GUTTER,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const previewSizeForViewport = (viewport: HoverPreviewViewport) => ({
  width: Math.min(
    SPEC_NODE_HOVER_PREVIEW_SIZE.width,
    Math.max(0, viewport.width - VIEWPORT_SAFE_GUTTER),
  ),
  height: SPEC_NODE_HOVER_PREVIEW_SIZE.height,
});

export function SpecNodeHoverPreview({ preview, anchor, viewport }: Props) {
  const currentViewport = viewport ?? readViewport();
  const position = placeSpecNodeHoverPreview(
    anchor,
    currentViewport,
    previewSizeForViewport(currentViewport),
  );
  const maturityStyle: MaturityStyle = {
    "--spec-node-preview-maturity": `${preview.maturityPercent ?? 0}%`,
  };

  return (
    <aside
      className={styles.card}
      data-placement={position.placement}
      aria-hidden="true"
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
