import { resolveWorkspaceRoute, type WorkspaceRouteResolution } from "@/pages/viewer";

export const ONTOLOGY_VIEWER_ROUTE = "/ontology";

export type SpecSpaceAppRoute =
  | {
      kind: "ontology-viewer";
      canonicalPath: typeof ONTOLOGY_VIEWER_ROUTE;
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
  if (normalized === ONTOLOGY_VIEWER_ROUTE) {
    return {
      kind: "ontology-viewer",
      canonicalPath: ONTOLOGY_VIEWER_ROUTE,
      shouldReplace: pathname !== ONTOLOGY_VIEWER_ROUTE,
    };
  }

  const workspaceRoute = resolveWorkspaceRoute(pathname);
  return {
    kind: "workspace-viewer",
    workspaceRoute,
    canonicalPath: workspaceRoute.canonicalPath,
    shouldReplace: workspaceRoute.shouldReplace,
  };
}
