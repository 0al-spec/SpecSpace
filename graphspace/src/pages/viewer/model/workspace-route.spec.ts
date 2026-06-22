import { describe, expect, it } from "vitest";
import { resolveWorkspaceRoute, workspaceApiUrl } from "./workspace-route";

describe("workspace route selection", () => {
  it("keeps root on the SpecGraph bootstrap workspace", () => {
    const route = resolveWorkspaceRoute("/");

    expect(route.workspace.id).toBe("specgraph-bootstrap");
    expect(route.canonicalPath).toBe("/");
    expect(route.shouldReplace).toBe(false);
    expect(workspaceApiUrl("/api/v1/idea-to-spec-workspace", route.workspace)).toBe(
      "/api/v1/idea-to-spec-workspace",
    );
  });

  it("selects Team Decision Log product workspace", () => {
    const route = resolveWorkspaceRoute("/team-decision-log");

    expect(route.workspace.id).toBe("team-decision-log");
    expect(route.workspace.targetRepositoryRole).toBe("product_spec_workspace");
    expect(route.shouldReplace).toBe(false);
    expect(workspaceApiUrl("/api/v1/idea-to-spec-workspace", route.workspace)).toBe(
      "/api/v1/idea-to-spec-workspace?workspace=team-decision-log",
    );
    expect(workspaceApiUrl("/api/v1/spec-activity?limit=1", route.workspace)).toBe(
      "/api/v1/spec-activity?limit=1&workspace=team-decision-log",
    );
  });

  it("canonicalizes the underscore alias", () => {
    const route = resolveWorkspaceRoute("/team_decision_log/");

    expect(route.workspace.id).toBe("team-decision-log");
    expect(route.canonicalPath).toBe("/team-decision-log");
    expect(route.shouldReplace).toBe(true);
  });

  it("treats any safe top-level slug as a product workspace route", () => {
    const route = resolveWorkspaceRoute("/support-triage-log");

    expect(route.workspace.id).toBe("support-triage-log");
    expect(route.workspace.displayName).toBe("Support Triage Log");
    expect(route.workspace.workflowLane).toBe("product_idea_to_spec");
    expect(route.workspace.targetRepositoryRole).toBe("product_spec_workspace");
    expect(route.canonicalPath).toBe("/support-triage-log");
    expect(route.shouldReplace).toBe(false);
    expect(workspaceApiUrl("/api/v1/spec-graph", route.workspace)).toBe(
      "/api/v1/spec-graph?workspace=support-triage-log",
    );
  });

  it("keeps unsafe or nested paths on the bootstrap workspace", () => {
    const route = resolveWorkspaceRoute("/support-triage-log/details");

    expect(route.workspace.id).toBe("specgraph-bootstrap");
    expect(route.canonicalPath).toBe("/");
    expect(route.shouldReplace).toBe(true);
  });
});
