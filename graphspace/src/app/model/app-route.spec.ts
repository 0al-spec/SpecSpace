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

  it("keeps generic product workspaces on the workspace viewer", () => {
    const route = resolveSpecSpaceAppRoute("/support-triage-log");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("support-triage-log");
  });

  it("keeps the root SpecGraph workspace on the workspace viewer", () => {
    const route = resolveSpecSpaceAppRoute("/");

    expect(route.kind).toBe("workspace-viewer");
    if (route.kind !== "workspace-viewer") return;
    expect(route.workspaceRoute.workspace.id).toBe("specgraph-bootstrap");
  });
});
