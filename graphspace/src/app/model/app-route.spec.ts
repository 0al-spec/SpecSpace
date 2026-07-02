import { describe, expect, it } from "vitest";
import { resolveSpecSpaceAppRoute } from "./app-route";

describe("SpecSpace app route selection", () => {
  it("reserves /ontology for the standalone ontology viewer", () => {
    const route = resolveSpecSpaceAppRoute("/ontology");

    expect(route.kind).toBe("ontology-viewer");
    expect(route.canonicalPath).toBe("/ontology");
    expect(route.shouldReplace).toBe(false);
  });

  it("canonicalizes trailing slash ontology paths without entering workspace routing", () => {
    const route = resolveSpecSpaceAppRoute("/ontology/");

    expect(route.kind).toBe("ontology-viewer");
    expect(route.canonicalPath).toBe("/ontology");
    expect(route.shouldReplace).toBe(true);
  });

  it("reserves /dev/idea-to-spec-fixtures for the static fixture gallery", () => {
    const route = resolveSpecSpaceAppRoute("/dev/idea-to-spec-fixtures");

    expect(route.kind).toBe("idea-to-spec-fixture-gallery");
    expect(route.canonicalPath).toBe("/dev/idea-to-spec-fixtures");
    expect(route.shouldReplace).toBe(false);
  });

  it("canonicalizes trailing slash fixture gallery paths", () => {
    const route = resolveSpecSpaceAppRoute("/dev/idea-to-spec-fixtures/");

    expect(route.kind).toBe("idea-to-spec-fixture-gallery");
    expect(route.canonicalPath).toBe("/dev/idea-to-spec-fixtures");
    expect(route.shouldReplace).toBe(true);
  });

  it("keeps generic product workspaces on the workspace viewer", () => {
    const route = resolveSpecSpaceAppRoute("/support-triage-log");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("support-triage-log");
  });

  it("canonicalizes trailing slash product workspaces", () => {
    const route = resolveSpecSpaceAppRoute("/support-triage-log/");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("support-triage-log");
    expect(route.canonicalPath).toBe("/support-triage-log");
    expect(route.shouldReplace).toBe(true);
  });

  it("canonicalizes padded workspace paths before workspace routing", () => {
    const route = resolveSpecSpaceAppRoute(" /team-decision-log ");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("team-decision-log");
    expect(route.canonicalPath).toBe("/team-decision-log");
    expect(route.shouldReplace).toBe(true);
  });

  it("keeps the root SpecGraph workspace on the workspace viewer", () => {
    const route = resolveSpecSpaceAppRoute("/");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("specgraph-bootstrap");
  });
});
