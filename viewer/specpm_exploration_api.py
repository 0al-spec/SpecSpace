"""SpecPM and exploration API handlers for the viewer HTTP server."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, Protocol

from viewer import specgraph_surfaces, supervisor_build
from viewer.http_response import json_response
from viewer.request_body import read_json_object_request_body
from viewer.request_query import query_params, query_value
from viewer.specpm import (
    _build_specpm_lifecycle,
    _collect_exploration_surfaces,
    _read_proposal_markdown,
    _read_specgraph_runs_artifact,
    read_exploration_preview_response,
    read_specpm_artifact_response,
    read_specpm_preview_response,
)


class SpecPmExplorationApiHandler(Protocol):
    server: Any
    headers: Any
    rfile: Any


def handle_specpm_preview_get(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecPM preview not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = read_specpm_preview_response(handler.server.specgraph_dir)
    json_response(handler, status, payload)


def handle_specpm_preview_build(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecPM preview not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = supervisor_build.build_specpm_preview(handler.server.specgraph_dir)
    json_response(handler, status, payload)


def handle_specpm_artifact_get(handler: SpecPmExplorationApiHandler, filename: str) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = read_specpm_artifact_response(handler.server.specgraph_dir, filename)
    json_response(handler, status, payload)


def handle_specpm_build(handler: SpecPmExplorationApiHandler, flag: str, artifact_filename: str) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = supervisor_build.build_specpm_artifact(
        handler.server.specgraph_dir,
        flag,
        artifact_filename,
    )
    json_response(handler, status, payload)


def handle_specpm_lifecycle(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
        )
        return
    json_response(handler, HTTPStatus.OK, _build_specpm_lifecycle(handler.server.specgraph_dir))


def handle_exploration_surfaces_get(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Exploration surfaces not configured. Start the server with --specgraph-dir."},
        )
        return
    json_response(handler, HTTPStatus.OK, _collect_exploration_surfaces(handler.server.specgraph_dir))


def handle_exploration_proposal_get(handler: SpecPmExplorationApiHandler, parsed: Any) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Exploration surfaces not configured. Start the server with --specgraph-dir."},
        )
        return
    params = query_params(parsed)
    status, payload = _read_proposal_markdown(handler.server.specgraph_dir, query_value(params, "file", ""))
    json_response(handler, status, payload)


def handle_proposal_spec_trace_index_get(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Proposal spec trace is not configured. Start the server with --specgraph-dir."},
        )
        return
    json_response(
        handler,
        HTTPStatus.OK,
        _read_specgraph_runs_artifact(
            handler.server.specgraph_dir,
            "proposal_spec_trace_index.json",
            expected_kind="proposal_spec_trace_index",
        ),
    )


def exploration_build_available(handler: SpecPmExplorationApiHandler) -> bool:
    return specgraph_surfaces.supervisor_has_flags(
        handler.server.specgraph_dir,
        "--build-exploration-preview",
        "--exploration-intent",
    )


def handle_exploration_preview_get(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Exploration preview not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = read_exploration_preview_response(handler.server.specgraph_dir)
    json_response(handler, status, payload)


def handle_exploration_preview_build(handler: SpecPmExplorationApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Exploration preview not configured. Start the server with --specgraph-dir."},
        )
        return
    try:
        body = read_json_object_request_body(handler.headers, handler.rfile, allow_empty=True)
    except ValueError:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON body"})
        return
    intent = (body.get("intent") or "").strip()
    if not intent:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "intent is required and must not be blank"})
        return
    status, payload = supervisor_build.build_exploration_preview(handler.server.specgraph_dir, intent)
    json_response(handler, status, payload)
