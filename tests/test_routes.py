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


def test_route_table_returns_none_for_unknown_route() -> None:
    assert routes.route_for("GET", "/api/not-a-real-route") is None
    assert routes.route_for("PATCH", "/api/file") is None


def test_all_route_handlers_exist_on_viewer_handler() -> None:
    for table in routes.ROUTES_BY_METHOD.values():
        for route in table.values():
            assert hasattr(ViewerHandler, route.handler), route.handler
