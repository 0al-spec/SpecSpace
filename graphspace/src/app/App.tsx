import { lazy, Suspense, useEffect, useMemo } from "react";
import { OntologyViewerPage } from "@/pages/ontology-viewer";
import { loadUiCatalogPage } from "@/pages/ui-catalog";
import { loadIdeaToSpecFixtureGalleryPage, ViewerPage } from "@/pages/viewer";
import { resolveSpecSpaceAppRoute } from "./model/app-route";

const UiCatalogPage = lazy(loadUiCatalogPage);
const IdeaToSpecFixtureGalleryPage = lazy(loadIdeaToSpecFixtureGalleryPage);

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

  if (route.kind === "ui-catalog") {
    return (
      <Suspense fallback={null}>
        <UiCatalogPage />
      </Suspense>
    );
  }

  if (route.kind === "idea-to-spec-fixture-gallery") {
    return (
      <Suspense fallback={null}>
        <IdeaToSpecFixtureGalleryPage />
      </Suspense>
    );
  }

  return <ViewerPage workspace={route.workspaceRoute.workspace} />;
}
