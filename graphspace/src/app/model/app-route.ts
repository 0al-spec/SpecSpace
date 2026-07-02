import { resolveWorkspaceRoute, type WorkspaceRouteResolution } from "@/pages/viewer";

export const ONTOLOGY_VIEWER_ROUTE = "/ontology";
export const IDEA_TO_SPEC_FIXTURE_GALLERY_ROUTE = "/dev/idea-to-spec-fixtures";

export type SpecSpaceAppRoute =
  | {
      kind: "ontology-viewer";
      canonicalPath: typeof ONTOLOGY_VIEWER_ROUTE;
      shouldReplace: boolean;
    }
  | {
      kind: "idea-to-spec-fixture-gallery";
      canonicalPath: typeof IDEA_TO_SPEC_FIXTURE_GALLERY_ROUTE;
      shouldReplace: boolean;
    }
  | {
      kind: "workspace-viewer";
      workspaceRoute: WorkspaceRouteResolution;
      canonicalPath: string;
      shouldReplace: boolean;
    };

function normalizePathname(pathname: string): string {
  const normalized = pathname.trim() || "/";
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

export function resolveSpecSpaceAppRoute(pathname: string): SpecSpaceAppRoute {
  const normalized = normalizePathname(pathname);
  const appPathWasNormalized = normalized !== pathname;
  if (normalized === ONTOLOGY_VIEWER_ROUTE) {
    return {
      kind: "ontology-viewer",
      canonicalPath: ONTOLOGY_VIEWER_ROUTE,
      shouldReplace: appPathWasNormalized,
    };
  }
  if (normalized === IDEA_TO_SPEC_FIXTURE_GALLERY_ROUTE) {
    return {
      kind: "idea-to-spec-fixture-gallery",
      canonicalPath: IDEA_TO_SPEC_FIXTURE_GALLERY_ROUTE,
      shouldReplace: appPathWasNormalized,
    };
  }

  const workspaceRoute = resolveWorkspaceRoute(normalized);
  return {
    kind: "workspace-viewer",
    workspaceRoute,
    canonicalPath: workspaceRoute.canonicalPath,
    shouldReplace: appPathWasNormalized || workspaceRoute.shouldReplace,
  };
}
