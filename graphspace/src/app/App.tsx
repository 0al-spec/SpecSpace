import { useEffect, useMemo } from "react";
import { OntologyViewerPage } from "@/pages/ontology-viewer";
import { IdeaToSpecFixtureGalleryPage, ViewerPage } from "@/pages/viewer";
import { resolveSpecSpaceAppRoute } from "./model/app-route";

export function App() {
  const route = useMemo(
    () => resolveSpecSpaceAppRoute(window.location.pathname),
    [],
  );

  useEffect(() => {
    if (!route.shouldReplace) return;
    window.history.replaceState(null, "", route.canonicalPath);
  }, [route]);

  if (route.kind === "ontology-viewer") {
    return <OntologyViewerPage />;
  }

  if (route.kind === "idea-to-spec-fixture-gallery") {
    return <IdeaToSpecFixtureGalleryPage />;
  }

  return <ViewerPage workspace={route.workspaceRoute.workspace} />;
}
