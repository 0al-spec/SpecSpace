import { useEffect, useState } from "react";

export interface Capabilities {
  specAvailable: boolean;
  compileAvailable: boolean;
  specCompileAvailable: boolean;
  dashboardAvailable: boolean;
  specOverlayAvailable: boolean;
  specpmPreviewAvailable: boolean;
  explorationSurfacesAvailable: boolean;
  viewerSurfacesBuildAvailable: boolean;
  agentAvailable: boolean;
}

const EMPTY_CAPABILITIES: Capabilities = {
  specAvailable: false,
  compileAvailable: false,
  specCompileAvailable: false,
  dashboardAvailable: false,
  specOverlayAvailable: false,
  specpmPreviewAvailable: false,
  explorationSurfacesAvailable: false,
  viewerSurfacesBuildAvailable: false,
  agentAvailable: false,
};

async function checkCapabilities(): Promise<Capabilities> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return EMPTY_CAPABILITIES;
    const data = await res.json();
    return {
      specAvailable: Boolean(data.spec_graph),
      compileAvailable: Boolean(data.compile),
      specCompileAvailable: Boolean(data.spec_compile),
      dashboardAvailable: Boolean(data.graph_dashboard),
      specOverlayAvailable: Boolean(data.spec_overlay),
      specpmPreviewAvailable: Boolean(data.specpm_preview),
      explorationSurfacesAvailable: Boolean(data.exploration_surfaces ?? data.exploration_preview),
      viewerSurfacesBuildAvailable: Boolean(data.viewer_surfaces_build),
      agentAvailable: Boolean(data.agent),
    };
  } catch {
    return EMPTY_CAPABILITIES;
  }
}

export function useCapabilities(): Capabilities {
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);

  useEffect(() => {
    let cancelled = false;
    checkCapabilities().then((next) => {
      if (!cancelled) setCapabilities(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return capabilities;
}
