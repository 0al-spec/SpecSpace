import { useEffect, useRef, useState } from "react";
import { useStore } from "@xyflow/react";
import "./TelemetryOverlay.css";

const STORAGE_KEY = "ctxb_telemetry_enabled";

export function useTelemetryToggle(): boolean {
  const [enabled, setEnabled] = useState(() => sessionStorage.getItem(STORAGE_KEY) === "1");
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        setEnabled((prev) => {
          const next = !prev;
          sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return enabled;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export default function TelemetryOverlay() {
  const zoom = useStore((s) => s.transform[2]);
  const totalNodes = useStore((s) => s.nodes.length);
  const totalEdges = useStore((s) => s.edges.length);
  const visibleNodes = useStore((s) => {
    const [tx, ty, tz] = s.transform;
    const vw = s.width;
    const vh = s.height;
    if (!vw || !vh || !tz) return s.nodes.length;
    let count = 0;
    for (const n of s.nodes) {
      const x = n.position.x * tz + tx;
      const y = n.position.y * tz + ty;
      const w = (n.measured?.width ?? n.width ?? 200) * tz;
      const h = (n.measured?.height ?? n.height ?? 60) * tz;
      if (x + w >= 0 && y + h >= 0 && x <= vw && y <= vh) count++;
    }
    return count;
  });

  const [fps, setFps] = useState(0);
  const [heapMB, setHeapMB] = useState<number | null>(null);
  const frameCountRef = useRef(0);
  const lastTickRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      frameCountRef.current += 1;
      const now = performance.now();
      const elapsed = now - lastTickRef.current;
      if (elapsed >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTickRef.current = now;
        const mem = (performance as unknown as { memory?: PerformanceMemory }).memory;
        if (mem) setHeapMB(Math.round(mem.usedJSHeapSize / (1024 * 1024)));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  const fpsClass = fps >= 50 ? "telemetry-good" : fps >= 30 ? "telemetry-warn" : "telemetry-bad";

  return (
    <div className="telemetry-overlay">
      <div className="telemetry-row"><span>zoom</span><span>{zoom.toFixed(2)}</span></div>
      <div className="telemetry-row"><span>nodes</span><span>{visibleNodes}/{totalNodes}</span></div>
      <div className="telemetry-row"><span>edges</span><span>{totalEdges}</span></div>
      <div className="telemetry-row"><span>fps</span><span className={fpsClass}>{fps}</span></div>
      {heapMB !== null && (
        <div className="telemetry-row"><span>heap</span><span>{heapMB} MB</span></div>
      )}
      <div className="telemetry-hint">Shift+D to hide</div>
    </div>
  );
}
