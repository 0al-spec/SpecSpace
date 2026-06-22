export type SpecSpaceWorkspace = {
  id: "specgraph-bootstrap" | "team-decision-log";
  displayName: string;
  route: string;
  aliases: readonly string[];
  workflowLane: "specgraph_bootstrap_showcase" | "product_idea_to_spec";
  targetRepositoryRole: "specgraph_bootstrap" | "product_spec_workspace";
  surfaceMode: "bootstrap_showcase" | "product_idea_to_spec";
};

export const SPECGRAPH_BOOTSTRAP_WORKSPACE: SpecSpaceWorkspace = {
  id: "specgraph-bootstrap",
  displayName: "SpecGraph",
  route: "/",
  aliases: [],
  workflowLane: "specgraph_bootstrap_showcase",
  targetRepositoryRole: "specgraph_bootstrap",
  surfaceMode: "bootstrap_showcase",
};

export const TEAM_DECISION_LOG_WORKSPACE: SpecSpaceWorkspace = {
  id: "team-decision-log",
  displayName: "Team Decision Log",
  route: "/team-decision-log",
  aliases: ["/team_decision_log"],
  workflowLane: "product_idea_to_spec",
  targetRepositoryRole: "product_spec_workspace",
  surfaceMode: "product_idea_to_spec",
};

export const SPECSPACE_WORKSPACES = [
  SPECGRAPH_BOOTSTRAP_WORKSPACE,
  TEAM_DECISION_LOG_WORKSPACE,
] as const;

export type WorkspaceRouteResolution = {
  workspace: SpecSpaceWorkspace;
  canonicalPath: string;
  shouldReplace: boolean;
};

function normalizePathname(pathname: string): string {
  const normalized = pathname.trim() || "/";
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

export function resolveWorkspaceRoute(pathname: string): WorkspaceRouteResolution {
  const normalized = normalizePathname(pathname);
  for (const workspace of SPECSPACE_WORKSPACES) {
    if (normalized === workspace.route) {
      return {
        workspace,
        canonicalPath: workspace.route,
        shouldReplace: false,
      };
    }
    if (workspace.aliases.includes(normalized)) {
      return {
        workspace,
        canonicalPath: workspace.route,
        shouldReplace: true,
      };
    }
  }
  return {
    workspace: SPECGRAPH_BOOTSTRAP_WORKSPACE,
    canonicalPath: SPECGRAPH_BOOTSTRAP_WORKSPACE.route,
    shouldReplace: normalized !== SPECGRAPH_BOOTSTRAP_WORKSPACE.route,
  };
}

export function workspaceApiUrl(path: string, workspace: SpecSpaceWorkspace): string {
  if (workspace.id === SPECGRAPH_BOOTSTRAP_WORKSPACE.id) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspace=${encodeURIComponent(workspace.id)}`;
}
