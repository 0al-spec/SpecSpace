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
