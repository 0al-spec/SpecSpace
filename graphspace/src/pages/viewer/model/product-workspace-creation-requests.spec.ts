import { describe, expect, it } from "vitest";
import { parseProductWorkspaceCreationRequestState } from "./use-product-workspace-creation-requests";

const creationState = {
  artifact_kind: "specspace_product_workspace_creation_request_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  selected_workspace_id: "pantry-rotation",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  requests: [
    {
      request_id: "product-workspace-create.pantry-rotation",
      workspace_id: "pantry-rotation",
      display_name: "Pantry Rotation",
      route: "/pantry-rotation",
      operator_ref: "operator://specspace-local",
      root_intent_summary_present: true,
      status: "requested",
      created_at: "2026-07-04T00:00:00Z",
      updated_at: "2026-07-04T00:00:00Z",
    },
  ],
  active_request: {
    request_id: "product-workspace-create.pantry-rotation",
    workspace_id: "pantry-rotation",
    display_name: "Pantry Rotation",
    route: "/pantry-rotation",
    operator_ref: "operator://specspace-local",
    root_intent_summary_present: true,
    status: "requested",
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
  },
  consumer_boundary: {
    specspace_owned_state: true,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_create_workspace: false,
    may_initialize_workspace: false,
    may_create_branch_or_commit: false,
    may_publish_read_model: false,
  },
  authority_boundary: {
    product_workspace_creation_request_state_is_authority: false,
    specgraph_artifact_authority: false,
    platform_execution_authority: false,
    workspace_catalog_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
  summary: {
    status: "workspace_creation_requested",
    request_count: 1,
    requested_count: 1,
    active_requested_count: 1,
    invalid_request_count: 0,
    next_gap: "run_platform_workspace_initialization",
  },
};

describe("parseProductWorkspaceCreationRequestState", () => {
  it("keeps backend-backed workspace creation requests", () => {
    const parsed = parseProductWorkspaceCreationRequestState(creationState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.activeRequest?.workspaceId).toBe("pantry-rotation");
    expect(parsed.data.activeRequest?.route).toBe("/pantry-rotation");
    expect(parsed.data.summary.activeRequestedCount).toBe(1);
  });

  it("rejects authority expansion", () => {
    const invalid = structuredClone(creationState);
    invalid.consumer_boundary.may_initialize_workspace = true;

    const parsed = parseProductWorkspaceCreationRequestState(invalid);

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects unexpected schema versions", () => {
    const invalid = structuredClone(creationState);
    invalid.schema_version = 2;

    const parsed = parseProductWorkspaceCreationRequestState(invalid);

    expect(parsed.kind).toBe("parse-error");
  });

  it("rejects non-SpecSpace state owners", () => {
    const invalid = structuredClone(creationState);
    invalid.state_owner = "Platform";

    const parsed = parseProductWorkspaceCreationRequestState(invalid);

    expect(parsed.kind).toBe("parse-error");
  });
});
