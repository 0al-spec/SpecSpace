import { describe, expect, it } from "vitest";
import { parseRealIdeaEntryRequestState } from "./use-real-idea-entry-requests";

const entryState = {
  artifact_kind: "specspace_real_idea_entry_request_state",
  schema_version: 1,
  state_owner: "SpecSpace",
  selected_workspace_id: "team-decision-log",
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
  requests: [
    {
      request_id: "real-idea-entry.team-decision-log",
      workspace_id: "team-decision-log",
      operator_ref: "operator://specspace-local",
      idea_summary_hint: "Team decision log",
      workspace_display_name: "Team Decision Log",
      public_route_hint: "/team-decision-log",
      status: "submitted",
      created_at: "2026-07-04T00:00:00Z",
      updated_at: "2026-07-04T00:00:00Z",
    },
  ],
  consumer_boundary: {
    specspace_owned_state: true,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_execute_prompt_agent: false,
    may_apply_to_specgraph: false,
    may_mutate_user_intent: false,
    may_mutate_candidate_source_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_execute_git_service_operation: false,
    may_publish_read_model: false,
  },
  authority_boundary: {
    real_idea_entry_request_state_is_authority: false,
    specgraph_artifact_authority: false,
    platform_execution_authority: false,
    ontology_authority: false,
    git_service_authority: false,
    canonical_mutations_allowed: false,
  },
  summary: {
    status: "real_idea_entry_submitted",
    request_count: 1,
    draft_count: 0,
    submitted_count: 1,
    active_submitted_count: 1,
    invalid_request_count: 0,
    next_gap: "platform_intake_execution",
  },
};

describe("parseRealIdeaEntryRequestState", () => {
  it("keeps persisted submitted requests when raw idea text is redacted", () => {
    const parsed = parseRealIdeaEntryRequestState(entryState);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.requests).toHaveLength(1);
    expect(parsed.data.requests[0]?.requestId).toBe(
      "real-idea-entry.team-decision-log",
    );
    expect(parsed.data.requests[0]?.ideaText).toBe("");
    expect(parsed.data.summary.activeSubmittedCount).toBe(1);
  });

  it("still rejects entries without stable request identity", () => {
    const invalid = structuredClone(entryState);
    const [request] = invalid.requests;
    if (request) {
      (request as Record<string, unknown>).request_id = undefined;
    }

    const parsed = parseRealIdeaEntryRequestState(invalid);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.requests).toHaveLength(0);
  });
});
