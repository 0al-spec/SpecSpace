from viewer import routes
from viewer.server import ViewerHandler


def test_route_table_resolves_query_aware_get_route() -> None:
    route = routes.route_for("GET", "/api/conversation")

    assert route is not None
    assert route.handler == "handle_get_conversation"
    assert route.pass_parsed is True
    assert route.args == ()


def test_route_table_resolves_specpm_build_route_args() -> None:
    route = routes.route_for("POST", "/api/specpm/materialize")

    assert route is not None
    assert route.handler == "_handle_specpm_build"
    assert route.pass_parsed is False
    assert route.args == ("--materialize-specpm-export-bundles", "specpm_materialization_report.json")


def test_route_table_resolves_delete_file_with_parsed_url() -> None:
    route = routes.route_for("DELETE", "/api/file")

    assert route is not None
    assert route.handler == "handle_delete_file"
    assert route.pass_parsed is True


def test_route_table_resolves_agent_workbench_conversation_prefix() -> None:
    route = routes.route_for("GET", "/api/v1/agent-workbench/conversations/awb-conv-0001")

    assert route is not None
    assert route.handler == "handle_v1_agent_workbench_conversation"
    assert route.pass_parsed is True


def test_route_table_resolves_agent_surfaces() -> None:
    route = routes.route_for("GET", "/api/v1/agent-surfaces")

    assert route is not None
    assert route.handler == "handle_v1_agent_surfaces"


def test_route_table_resolves_ontology_semantic_review_surface() -> None:
    route = routes.route_for("GET", "/api/v1/ontology-semantic-review-surface")

    assert route is not None
    assert route.handler == "handle_v1_ontology_semantic_review_surface"


def test_route_table_resolves_ontology_review_dashboard() -> None:
    route = routes.route_for("GET", "/api/v1/ontology-review-dashboard")

    assert route is not None
    assert route.handler == "handle_v1_ontology_review_dashboard"


def test_route_table_resolves_ontology_owner_decision_review() -> None:
    route = routes.route_for("GET", "/api/v1/ontology-owner-decision-review")

    assert route is not None
    assert route.handler == "handle_v1_ontology_owner_decision_review"


def test_route_table_resolves_ontology_workbench() -> None:
    route = routes.route_for("GET", "/api/v1/ontology-workbench")

    assert route is not None
    assert route.handler == "handle_v1_ontology_workbench"


def test_route_table_resolves_idea_to_spec_workspace() -> None:
    route = routes.route_for("GET", "/api/v1/idea-to-spec-workspace")

    assert route is not None
    assert route.handler == "handle_v1_idea_to_spec_workspace"


def test_route_table_resolves_idea_to_spec_workspace_state_hygiene() -> None:
    route = routes.route_for("GET", "/api/v1/idea-to-spec-workspace-state-hygiene")

    assert route is not None
    assert route.handler == "handle_v1_idea_to_spec_workspace_state_hygiene"
    assert route.pass_parsed is True


def test_route_table_resolves_idea_to_spec_repair_drafts() -> None:
    get_route = routes.route_for("GET", "/api/v1/idea-to-spec-repair-drafts")
    post_route = routes.route_for("POST", "/api/v1/idea-to-spec-repair-drafts")

    assert get_route is not None
    assert get_route.handler == "handle_v1_idea_to_spec_repair_drafts"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_idea_to_spec_repair_draft_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_idea_to_spec_intake_clarification_answers() -> None:
    get_route = routes.route_for("GET", "/api/v1/idea-to-spec-intake-clarification-answers")
    post_route = routes.route_for("POST", "/api/v1/idea-to-spec-intake-clarification-answers")

    assert get_route is not None
    assert get_route.handler == "handle_v1_idea_to_spec_intake_clarification_answers"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_idea_to_spec_intake_clarification_answer_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_product_workspace_creation_requests() -> None:
    get_route = routes.route_for("GET", "/api/v1/product-workspace-creation-requests")
    post_route = routes.route_for("POST", "/api/v1/product-workspace-creation-requests")

    assert get_route is not None
    assert get_route.handler == "handle_v1_product_workspace_creation_requests"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_product_workspace_creation_request_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_product_workspace_initialization_execute() -> None:
    post_route = routes.route_for(
        "POST", "/api/v1/product-workspace-initialization/execute"
    )

    assert post_route is not None
    assert (
        post_route.handler
        == "handle_v1_product_workspace_initialization_execute_post"
    )
    assert post_route.pass_parsed is True


def test_route_table_resolves_real_idea_intake_execute() -> None:
    post_route = routes.route_for("POST", "/api/v1/real-idea-intake/execute")

    assert post_route is not None
    assert post_route.handler == "handle_v1_real_idea_intake_execute_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_real_idea_intake_execution_requests() -> None:
    get_route = routes.route_for("GET", "/api/v1/real-idea-intake-execution-requests")
    post_route = routes.route_for("POST", "/api/v1/real-idea-intake-execution-requests")

    assert get_route is not None
    assert get_route.handler == "handle_v1_real_idea_intake_execution_requests"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_real_idea_intake_execution_request_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_real_idea_answer_continuation_execution_requests() -> None:
    path = "/api/v1/real-idea-answer-continuation-execution-requests"
    get_route = routes.route_for("GET", path)
    post_route = routes.route_for("POST", path)

    assert get_route is not None
    assert (
        get_route.handler
        == "handle_v1_real_idea_answer_continuation_execution_requests"
    )
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert (
        post_route.handler
        == "handle_v1_real_idea_answer_continuation_execution_request_post"
    )
    assert post_route.pass_parsed is True


def test_route_table_resolves_idea_to_spec_repair_rerun_requests() -> None:
    get_route = routes.route_for("GET", "/api/v1/idea-to-spec-repair-rerun-requests")
    post_route = routes.route_for("POST", "/api/v1/idea-to-spec-repair-rerun-requests")

    assert get_route is not None
    assert get_route.handler == "handle_v1_idea_to_spec_repair_rerun_requests"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_idea_to_spec_repair_rerun_request_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_project_local_ontology_review_decisions() -> None:
    get_route = routes.route_for("GET", "/api/v1/project-local-ontology-review-decisions")
    post_route = routes.route_for("POST", "/api/v1/project-local-ontology-review-decisions")

    assert get_route is not None
    assert get_route.handler == "handle_v1_project_local_ontology_review_decisions"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_project_local_ontology_review_decision_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_idea_to_spec_candidate_approval_intents() -> None:
    get_route = routes.route_for("GET", "/api/v1/idea-to-spec-candidate-approval-intents")
    post_route = routes.route_for("POST", "/api/v1/idea-to-spec-candidate-approval-intents")

    assert get_route is not None
    assert get_route.handler == "handle_v1_idea_to_spec_candidate_approval_intents"
    assert get_route.pass_parsed is True
    assert post_route is not None
    assert post_route.handler == "handle_v1_idea_to_spec_candidate_approval_intent_post"
    assert post_route.pass_parsed is True


def test_route_table_resolves_ontology_compliance_review() -> None:
    route = routes.route_for("GET", "/api/v1/ontology-compliance-review")

    assert route is not None
    assert route.handler == "handle_v1_ontology_compliance_review"


def test_route_table_resolves_ontology_owner_decision_acknowledgements() -> None:
    get_route = routes.route_for("GET", "/api/v1/ontology-owner-decision-acknowledgements")
    post_route = routes.route_for("POST", "/api/v1/ontology-owner-decision-acknowledgements")

    assert get_route is not None
    assert get_route.handler == "handle_v1_ontology_owner_decision_acknowledgements"
    assert post_route is not None
    assert post_route.handler == "handle_v1_ontology_owner_decision_acknowledgement_post"


def test_route_table_returns_none_for_unknown_route() -> None:
    assert routes.route_for("GET", "/api/not-a-real-route") is None
    assert routes.route_for("PATCH", "/api/file") is None


def test_all_route_handlers_exist_on_viewer_handler() -> None:
    for table in routes.ROUTES_BY_METHOD.values():
        for route in table.values():
            assert hasattr(ViewerHandler, route.handler), route.handler
    for route in routes.GET_PREFIX_ROUTES.values():
        assert hasattr(ViewerHandler, route.handler), route.handler
