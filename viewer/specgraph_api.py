"""SpecGraph API handlers for the viewer HTTP server."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, Protocol

from viewer import spec_compile, specgraph
from viewer.http_response import JsonResponseHandler, json_response
from viewer.request_query import query_bool, query_int, query_params, query_value


class SpecGraphApiHandler(JsonResponseHandler, Protocol):
    server: Any


def handle_spec_graph(handler: SpecGraphApiHandler) -> None:
    if handler.server.spec_dir is None:
        json_response(
            handler,
            HTTPStatus.NOT_FOUND,
            {"error": "Spec graph not configured. Start the server with --spec-dir."},
        )
        return
    json_response(handler, HTTPStatus.OK, specgraph.collect_spec_graph_api(handler.server.spec_dir))


def handle_spec_node(handler: SpecGraphApiHandler, parsed: Any) -> None:
    if handler.server.spec_dir is None:
        json_response(
            handler,
            HTTPStatus.NOT_FOUND,
            {"error": "Spec graph not configured. Start the server with --spec-dir."},
        )
        return
    params = query_params(parsed)
    node_id = query_value(params, "id", "")
    if not node_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: id"})
        return
    nodes, _ = specgraph.load_spec_nodes(handler.server.spec_dir)
    detail = specgraph.get_spec_node_detail(nodes, node_id)
    if detail is None:
        json_response(handler, HTTPStatus.NOT_FOUND, {"error": f"Spec node '{node_id}' not found"})
        return
    json_response(handler, HTTPStatus.OK, {"node_id": node_id, "data": detail})


def handle_spec_compile(handler: SpecGraphApiHandler, parsed: Any) -> None:
    if handler.server.spec_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Spec graph not configured. Start the server with --spec-dir."},
        )
        return

    params = query_params(parsed)
    root_id = query_value(params, "root", "").strip()
    if not root_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: root"})
        return

    options = spec_compile.CompileOptions(
        max_depth=query_int(params, "depth", 6, 1, 6),
        include_objective=query_bool(params, "objective", True),
        include_acceptance=query_bool(params, "acceptance", True),
        include_depends_on_refs=query_bool(params, "deps", True),
        include_prompt=query_bool(params, "prompt", False),
    )

    nodes, load_errors = specgraph.load_spec_nodes(handler.server.spec_dir)
    nodes_by_id = spec_compile.index_nodes(nodes)

    if root_id not in nodes_by_id:
        json_response(
            handler,
            HTTPStatus.NOT_FOUND,
            {"error": f"Spec node '{root_id}' not found in spec directory."},
        )
        return

    result = spec_compile.compile_spec_tree(nodes_by_id, root_id, options)

    json_response(
        handler,
        HTTPStatus.OK,
        {
            "root_id": root_id,
            "markdown": result.markdown,
            "manifest": result.manifest(),
            "load_errors": load_errors,
        },
    )
