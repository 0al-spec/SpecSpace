import { useCallback, useRef, useState, type MouseEvent } from "react";
import { useReactFlow, type Viewport } from "@xyflow/react";

function loadViewport(): Viewport | undefined {
  try {
    const stored = sessionStorage.getItem("ctxb_viewport");
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return undefined;
}

// Inspector panel width in px (matches SpecInspector.css)
const INSPECTOR_WIDTH = 440;

export function useViewportSync() {
  const savedViewport = useRef(loadViewport());
  const hasFitView = !savedViewport.current;

  const [isZoomedOut, setIsZoomedOut] = useState(() => (savedViewport.current?.zoom ?? 1) < 0.5);
  const [autoCollapseExpanded, setAutoCollapseExpanded] = useState(() => (savedViewport.current?.zoom ?? 1) < 0.6);

  const { getNode, setCenter, getZoom } = useReactFlow();

  const getVisibleCanvas = useCallback(() => {
    const canvas = document.querySelector<HTMLElement>(".react-flow");
    const canvasW = canvas?.offsetWidth ?? window.innerWidth;
    const inspectorOpen = !!document.querySelector(
      ".spec-inspector.visible, .inspector-overlay.visible",
    );
    return {
      width: inspectorOpen ? canvasW - INSPECTOR_WIDTH : canvasW,
      offsetX: inspectorOpen ? INSPECTOR_WIDTH : 0,
    };
  }, []);

  const panToPoint = useCallback(
    (cx: number, cy: number, zoom: number, delay = 0) => {
      const run = () => {
        const { offsetX } = getVisibleCanvas();
        setCenter(cx + offsetX / 2 / zoom, cy, { duration: 400, zoom });
      };
      if (delay > 0) setTimeout(run, delay);
      else run();
    },
    [setCenter, getVisibleCanvas],
  );

  const panToNode = useCallback(
    (nodeId: string, delay = 0, keepZoom = false) => {
      const node = getNode(nodeId);
      if (!node) return;
      const nodeW = node.measured?.width ?? 220;
      const nodeH = node.measured?.height ?? 110;
      const cx = node.position.x + nodeW / 2;
      const cy = node.position.y + nodeH / 2;
      const zoom = keepZoom ? (getZoom() || 1) : 1.2;
      panToPoint(cx, cy, zoom, delay);
    },
    [getNode, getZoom, panToPoint],
  );

  const fitNodes = useCallback(
    (nodeIds: string[]) => {
      const rects = nodeIds
        .map(getNode)
        .filter(Boolean)
        .map((n) => {
          const w = n!.measured?.width ?? 220;
          const h = n!.measured?.height ?? 110;
          return { x: n!.position.x, y: n!.position.y, w, h };
        });
      if (rects.length === 0) return;
      const minX = Math.min(...rects.map((r) => r.x));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxX = Math.max(...rects.map((r) => r.x + r.w));
      const maxY = Math.max(...rects.map((r) => r.y + r.h));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const { width: visibleW } = getVisibleCanvas();
      const visibleH = document.querySelector<HTMLElement>(".react-flow")?.offsetHeight ?? window.innerHeight;
      const padding = 80;
      const z = getZoom() || 1;
      const fitZoom = Math.min(
        z,
        (visibleW - padding * 2) / Math.max(contentW, 1),
        (visibleH - padding * 2) / Math.max(contentH, 1),
      );
      panToPoint(cx, cy, fitZoom, 0);
    },
    [getNode, getZoom, getVisibleCanvas, panToPoint],
  );

  const onMiniMapClick = useCallback(
    (_event: MouseEvent, position: { x: number; y: number }) => {
      const z = getZoom() || 1;
      setCenter(position.x, position.y, { duration: 300, zoom: z });
    },
    [setCenter, getZoom],
  );

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    try {
      sessionStorage.setItem("ctxb_viewport", JSON.stringify(viewport));
    } catch {
      // ignore
    }
    setIsZoomedOut(viewport.zoom < 0.5);
    setAutoCollapseExpanded(viewport.zoom < 0.6);
  }, []);

  return {
    savedViewport,
    hasFitView,
    isZoomedOut,
    autoCollapseExpanded,
    getZoom,
    panToPoint,
    panToNode,
    fitNodes,
    onMiniMapClick,
    onMoveEnd,
  };
}
