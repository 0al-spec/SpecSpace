import { useEffect, useState } from "react";
import type { SpecOverlayMap } from "./types";

export function useSpecOverlayData(enabled: boolean) {
  const [overlays, setOverlays] = useState<SpecOverlayMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/spec-overlay")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => {
        if (cancelled) return;
        setOverlays(d.overlays || {});
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOverlays({});
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { overlays, loaded };
}
