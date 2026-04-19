import { useRef, useCallback } from "react";
import "./TimelineFilter.css";

export type TimelineField = "created_at" | "updated_at";

interface TimelineFilterProps {
  /** Currently selected [minTs, maxTs] in milliseconds */
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
  /** [absoluteMin, absoluteMax] in milliseconds — full extent of all node dates */
  fullRange: [number, number];
}

/** Minimum gap enforced when dragging — whichever is larger wins */
const MIN_GAP_MS = 3_600_000; // 1 hour — time floor
const MIN_GAP_PX = 28;        // px   — visual floor (handle height + margin)

/** Fraction in [0,1]: 0 = oldest (min), 1 = newest (max) */
function tsToFrac(ts: number, [min, max]: [number, number]): number {
  if (max === min) return 0.5;
  return (ts - min) / (max - min);
}

function fracToTs(frac: number, [min, max]: [number, number]): number {
  const clamped = Math.max(0, Math.min(1, frac));
  return min + clamped * (max - min);
}

function fmtLabel(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtShort(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TimelineFilter({
  range, onRangeChange, fullRange,
}: TimelineFilterProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [selMin, selMax] = range;

  // Fraction: 0 = oldest (bottom of track), 1 = newest (top of track)
  const minFrac = tsToFrac(selMin, fullRange);
  const maxFrac = tsToFrac(selMax, fullRange);

  // CSS top%: 0% = top (newest), 100% = bottom (oldest)
  const minTopPct = (1 - minFrac) * 100; // older handle — sits lower on screen
  const maxTopPct = (1 - maxFrac) * 100; // newer handle — sits higher on screen

  /** Returns a fraction in [0,1] (0=oldest, 1=newest) for a given clientY */
  const getTrackFrac = useCallback((clientY: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const fracFromTop = (clientY - rect.top) / rect.height;
    return 1 - fracFromTop; // flip so 0=oldest, 1=newest
  }, []);

  const startDrag = useCallback(
    (which: "min" | "max") => (e: React.MouseEvent) => {
      e.preventDefault();
      const fixedMax = selMax;
      const fixedMin = selMin;

      // Compute effective minimum gap — the larger of time-floor and pixel-floor.
      // Pixel floor prevents handles from overlapping on tall tracks with narrow
      // time ranges.
      const trackH = trackRef.current?.getBoundingClientRect().height ?? 1;
      const rangeMs = fullRange[1] - fullRange[0];
      const pxGapMs = (MIN_GAP_PX / trackH) * rangeMs;
      const minGapMs = Math.max(MIN_GAP_MS, pxGapMs);

      const onMove = (ev: MouseEvent) => {
        const frac = getTrackFrac(ev.clientY);
        const ts = fracToTs(frac, fullRange);
        if (which === "max") {
          onRangeChange([fixedMin, Math.max(ts, fixedMin + minGapMs)]);
        } else {
          onRangeChange([Math.min(ts, fixedMax - minGapMs), fixedMax]);
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [fullRange, selMin, selMax, onRangeChange, getTrackFrac],
  );

  return (
    <div className="tl-panel">
      {/* Track area — fills all available flex space */}
      <div className="tl-track-area" ref={trackRef}>
        {/* Background rail */}
        <div className="tl-rail" />

        {/* Highlighted range between the two handles */}
        <div
          className="tl-range-fill"
          style={{
            top: `${maxTopPct}%`,
            height: `${Math.max(0, minTopPct - maxTopPct)}%`,
          }}
        />

        {/* Max handle — newer date, sits near top */}
        <div
          className="tl-handle tl-handle-max"
          style={{ top: `${maxTopPct}%` }}
          onMouseDown={startDrag("max")}
          title={fmtLabel(selMax)}
        >
          <span className="tl-handle-label tl-handle-label-right">
            {fmtShort(selMax)}
          </span>
        </div>

        {/* Min handle — older date, sits near bottom */}
        <div
          className="tl-handle tl-handle-min"
          style={{ top: `${minTopPct}%` }}
          onMouseDown={startDrag("min")}
          title={fmtLabel(selMin)}
        >
          <span className="tl-handle-label tl-handle-label-right">
            {fmtShort(selMin)}
          </span>
        </div>
      </div>
    </div>
  );
}
