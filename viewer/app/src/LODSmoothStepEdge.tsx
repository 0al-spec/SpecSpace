import { memo } from "react";
import { getSmoothStepPath, getBezierPath, BaseEdge, type EdgeProps } from "@xyflow/react";
import { useLODLevel } from "./useLODLevel";

function scaledStyle(style: React.CSSProperties, minimal: boolean): React.CSSProperties {
  if (!minimal) return style;
  return { ...style, strokeWidth: ((style.strokeWidth as number) ?? 1.5) * 2 };
}

function LODSmoothStepEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, markerEnd, markerStart, pathOptions,
  label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius,
}: EdgeProps) {
  const minimal = useLODLevel() === "minimal";
  const [path, lx, ly] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: (pathOptions as { borderRadius?: number } | undefined)?.borderRadius,
  });
  return (
    <BaseEdge id={id} path={path} style={scaledStyle(style, minimal)}
      markerEnd={markerEnd} markerStart={markerStart}
      label={label} labelX={lx} labelY={ly}
      labelStyle={labelStyle} labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle} labelBgPadding={labelBgPadding} labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}

function LODBezierEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, markerEnd, markerStart, curvature,
  label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius,
}: EdgeProps) {
  const minimal = useLODLevel() === "minimal";
  const [path, lx, ly] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    curvature: curvature as number | undefined,
  });
  return (
    <BaseEdge id={id} path={path} style={scaledStyle(style, minimal)}
      markerEnd={markerEnd} markerStart={markerStart}
      label={label} labelX={lx} labelY={ly}
      labelStyle={labelStyle} labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle} labelBgPadding={labelBgPadding} labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}

export const LODSmoothStepEdgeMemo = memo(LODSmoothStepEdge);
export const LODBezierEdgeMemo = memo(LODBezierEdge);
