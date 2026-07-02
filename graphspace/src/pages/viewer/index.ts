export { ViewerPage } from "./ui/ViewerPage";
export function loadIdeaToSpecFixtureGalleryPage() {
  return import("./ui/IdeaToSpecFixtureGalleryPage").then(
    ({ IdeaToSpecFixtureGalleryPage }) => ({
      default: IdeaToSpecFixtureGalleryPage,
    }),
  );
}
export {
  resolveWorkspaceRoute,
  workspaceApiUrl,
  SPECGRAPH_BOOTSTRAP_WORKSPACE,
  TEAM_DECISION_LOG_WORKSPACE,
  SPECSPACE_WORKSPACES,
  type SpecSpaceWorkspace,
  type WorkspaceRouteResolution,
} from "./model/workspace-route";
