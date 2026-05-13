import { SpecNodeCard } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import {
  placeSpecNodeHoverPreview,
  SPEC_NODE_HOVER_PREVIEW_SIZE,
  type HoverPreviewAnchor,
  type HoverPreviewPosition,
  type HoverPreviewViewport,
  type SpecNodeHoverPreview as SpecNodeHoverPreviewModel,
} from "../model/hover-preview";
import styles from "./SpecNodeHoverPreview.module.css";

type Props = {
  preview: SpecNodeHoverPreviewModel;
  anchor: HoverPreviewAnchor;
  lifecycleBadge?: SpecPMLifecycleBadge | null;
  viewport?: HoverPreviewViewport;
};

const VIEWPORT_SAFE_GUTTER = 24;
const PLACEMENT_CLASS: Record<HoverPreviewPosition["placement"], string> = {
  right: styles.placementRight,
  left: styles.placementLeft,
  bottom: styles.placementBottom,
  top: styles.placementTop,
};

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

export function SpecNodeHoverPreview({
  preview,
  anchor,
  lifecycleBadge = null,
  viewport,
}: Props) {
  const currentViewport = viewport ?? readViewport();
  const position = placeSpecNodeHoverPreview(
    anchor,
    currentViewport,
    previewSizeForViewport(currentViewport),
  );
  const className = [
    styles.previewCard,
    PLACEMENT_CLASS[position.placement],
  ].join(" ");

  return (
    <SpecNodeCard
      node={preview.node}
      variant="preview"
      objectivePreview={preview.objectivePreview}
      lifecycleBadge={lifecycleBadge}
      ariaHidden
      className={className}
      style={{
        left: position.left,
        top: position.top,
      }}
    />
  );
}
