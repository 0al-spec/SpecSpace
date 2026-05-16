"""SpecSpace API v1 handlers."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, Protocol
from urllib.parse import unquote

from viewer import specspace_provider
from viewer.http_response import JsonResponseHandler, json_response
from viewer.request_query import query_params, query_value


class SpecSpaceV1Handler(JsonResponseHandler, Protocol):
    server: Any

    def _exploration_build_available(self) -> bool: ...

    def _graph_dashboard_path(self) -> Any: ...

    def _runs_dir(self) -> Any: ...

    def _viewer_surfaces_build_available(self) -> bool: ...

    def handle_runs_watch(self) -> None: ...


def _provider(handler: SpecSpaceV1Handler) -> specspace_provider.SpecSpaceProvider:
    return specspace_provider.provider_from_server(handler.server)


def _query_limit(parsed: Any, *, default: int, minimum: int = 1, maximum: int = 500) -> int:
    params = query_params(parsed)
    try:
        value = int(query_value(params, "limit", str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def handle_v1_health(handler: SpecSpaceV1Handler) -> None:
    json_response(handler, HTTPStatus.OK, _provider(handler).health())


def handle_v1_capabilities(handler: SpecSpaceV1Handler) -> None:
    provider = _provider(handler)
    json_response(handler, HTTPStatus.OK, specspace_provider.versioned_capabilities(handler, provider))


def handle_v1_spec_graph(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_spec_graph()
    json_response(handler, status, payload)


def handle_v1_spec_node(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    prefix = "/api/v1/spec-nodes/"
    node_id = unquote(parsed.path[len(prefix):]).strip()
    if not node_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing spec node id in path."})
        return
    status, payload = _provider(handler).read_spec_node(node_id)
    json_response(handler, status, payload)


def handle_v1_recent_runs(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_recent_runs(
        limit=_query_limit(parsed, default=50, maximum=500),
        since_iso=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_spec_activity(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_spec_activity(
        limit_raw=query_value(params, "limit", None),
        since_raw=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_implementation_work_index(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_implementation_work_index(
        limit_raw=query_value(params, "limit", "50"),
    )
    json_response(handler, status, payload)


def handle_v1_proposal_spec_trace_index(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_proposal_spec_trace_index()
    json_response(handler, status, payload)


def handle_v1_specpm_lifecycle(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_specpm_lifecycle()
    json_response(handler, status, payload)


def handle_v1_runs_watch(handler: SpecSpaceV1Handler) -> None:
    handler.handle_runs_watch()
