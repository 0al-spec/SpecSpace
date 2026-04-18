import { useRef, useCallback } from "react";
import type { ApiSpecNode } from "./types";
import "./TimelineFilter.css";

export type TimelineField = "created_at" | "updated_at";

interface TimelineFilterProps {
  nodes: ApiSpecNode[];
  field: TimelineField;
  onFieldChange: (f: TimelineField) => void;
  /** Currently selected [minTs, maxTs] in milliseconds */
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
  /** [absoluteMin, absoluteMax] in milliseconds — full extent of all node dates */
  fullRange: [number, number];
  onClose: () => void;
}

const TRACK_H = 300; // px — height of the draggable portion

function tsToY(ts: number, [min, max]: [number, number]): number {
  // top = newest (max), bottom = oldest (min)
  if (max === min) return TRACK_H / 2;
  return TRACK_H * (1 - (ts - min) / (max - min));
}

function yToTs(y: number, [min, max]: [number, number]): number {
  const clamped = Math.max(0, Math.min(TRACK_H, y));
  return min + (1 - clamped / TRACK_H) * (max - min);
}

function fmtLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtShort(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

export default function TimelineFilter({
  nodes, field, onFieldChange, range, onRangeChange, fullRange, onClose,
}: TimelineFilterProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [selMin, selMax] = range;
  const [fullMin, fullMax] = fullRange;

  const minY = tsToY(selMin, fullRange); // lower handle — older date, lower on screen
  const maxY = tsToY(selMax, fullRange); // upper handle — newer date, higher on screen

  const getTrackY = useCallback((clientY: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return clientY - rect.top;
  }, []);

  const startDrag = useCallback(
    (which: "min" | "max") => (e: React.MouseEvent) => {
      e.preventDefault();
      // Capture the OTHER handle's value at drag-start so it stays fixed
      const fixedMax = selMax;
      const fixedMin = selMin;

      const onMove = (ev: MouseEvent) => {
        const y = getTrackY(ev.clientY);
        const ts = yToTs(y, fullRange);
        if (which === "max") {
          onRangeChange([fixedMin, Math.max(ts, fixedMin + 86_400_000)]);
        } else {
          onRangeChange([Math.min(ts, fixedMax - 86_400_000), fixedMax]);
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [fullRange, selMin, selMax, onRangeChange, getTrackY],
  );

  const inCount = nodes.filter((n) => {
    const v = n[field];
    if (!v) return true; // nodes without date are never dimmed → count as "shown"
    const ts = new Date(v).getTime();
    return !isNaN(ts) && ts >= selMin && ts <= selMax;
  }).length;

  const totalWithDate = nodes.filter((n) => {
    const v = n[field];
    if (!v) return false;
    return !isNaN(new Date(v).getTime());
  }).length;

  return (
    <div className="tl-panel">
      {/* ── Segmented control: Created / Updated ── */}
      <div className="tl-segment">
        <button
          className={`tl-seg-btn${field === "created_at" ? " active" : ""}`}
          onClick={() => onFieldChange("created_at")}
        >Created</button>
        <button
          className={`tl-seg-btn${field === "updated_at" ? " active" : ""}`}
          onClick={() => onFieldChange("updated_at")}
        >Updated</button>
      </div>

      {/* ── Track ── */}
      <div className="tl-track-wrap">
        {/* Axis label top (newest) */}
        <div className="tl-axis-label tl-axis-top">{fmtShort(fullMax)}</div>

        {/* Track area — draggable zone */}
        <div className="tl-track-area" ref={trackRef} style={{ height: TRACK_H }}>
          {/* Background rail */}
          <div className="tl-rail" />

          {/* Selected range fill */}
          <div
            className="tl-range-fill"
            style={{ top: maxY, height: Math.max(0, minY - maxY) }}
          />

          {/* Max handle (upper — newer date) */}
          <div
            className="tl-handle tl-handle-max"
            style={{ top: maxY }}
            onMouseDown={startDrag("max")}
            title={fmtLabel(selMax)}
          >
            <span className="tl-handle-label tl-handle-label-right">
              {fmtShort(selMax)}
            </span>
          </div>

          {/* Min handle (lower — older date) */}
          <div
            className="tl-handle tl-handle-min"
            style={{ top: minY }}
            onMouseDown={startDrag("min")}
            title={fmtLabel(selMin)}
          >
            <span className="tl-handle-label tl-handle-label-right">
              {fmtShort(selMin)}
            </span>
          </div>
        </div>

        {/* Axis label bottom (oldest) */}
        <div className="tl-axis-label tl-axis-bottom">{fmtShort(fullMin)}</div>
      </div>

      {/* ── Footer: count + close ── */}
      <div className="tl-footer">
        <span className="tl-count">{inCount} / {totalWithDate}</span>
        <button className="tl-close" onClick={onClose} title="Close timeline">✕</button>
      </div>
    </div>
  );
}
