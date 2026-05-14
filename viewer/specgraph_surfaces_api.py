"""SpecGraph viewer-surface API handlers for the viewer HTTP server."""

from __future__ import annotations

from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer import specgraph_surfaces, supervisor_build
from viewer.http_response import json_response
from viewer.request_query import query_params, query_value


class SpecGraphSurfacesApiHandler(Protocol):
    server: Any

    def _runs_dir(self) -> Path | None: ...

    def _handle_runs_artifact(self, filename: str, build_hint: str) -> None: ...


def runs_dir(handler: SpecGraphSurfacesApiHandler) -> Path | None:
    return specgraph_surfaces.runs_dir_from_context(handler.server.spec_dir, handler.server.specgraph_dir)


def viewer_surfaces_build_available(handler: SpecGraphSurfacesApiHandler) -> bool:
    return specgraph_surfaces.supervisor_has_flags(handler.server.specgraph_dir, "--build-viewer-surfaces")


def handle_viewer_surfaces_build(handler: SpecGraphSurfacesApiHandler) -> None:
    if handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "Viewer surfaces build not configured. Start the server with --specgraph-dir."},
        )
        return
    status, payload = supervisor_build.build_viewer_surfaces(handler.server.specgraph_dir)
    json_response(handler, status, payload)


def graph_dashboard_path(handler: SpecGraphSurfacesApiHandler) -> Path | None:
    return specgraph_surfaces.graph_dashboard_path(handler._runs_dir())


def handle_graph_dashboard(handler: SpecGraphSurfacesApiHandler) -> None:
    status, payload = specgraph_surfaces.read_graph_dashboard(handler._runs_dir())
    json_response(handler, status, payload)


def handle_graph_backlog_projection(handler: SpecGraphSurfacesApiHandler) -> None:
    if handler.server.spec_dir is None and handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
        )
        return
    status, payload = specgraph_surfaces.read_graph_backlog_projection(
        handler.server.spec_dir,
        handler._runs_dir(),
    )
    json_response(handler, status, payload)


def handle_runs_artifact(handler: SpecGraphSurfacesApiHandler, filename: str, build_hint: str) -> None:
    if handler.server.spec_dir is None and handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
        )
        return
    status, payload = specgraph_surfaces.read_runs_artifact(
        spec_dir=handler.server.spec_dir,
        runs_dir=handler._runs_dir(),
        filename=filename,
        build_hint=build_hint,
    )
    json_response(handler, status, payload)


def handle_metrics_source_promotion(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metrics_source_promotion_index.json",
        "--build-viewer-surfaces",
    )


def handle_metrics_delivery(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metrics_delivery_workflow.json",
        "--build-viewer-surfaces",
    )


def handle_metrics_feedback(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metrics_feedback_index.json",
        "--build-viewer-surfaces",
    )


def handle_metric_pack_adapters(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metric_pack_adapter_index.json",
        "--build-viewer-surfaces",
    )


def handle_metric_pack_runs(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metric_pack_runs.json",
        "--build-viewer-surfaces",
    )


def handle_recent_runs(handler: SpecGraphSurfacesApiHandler, parsed: Any) -> None:
    current_runs_dir = handler._runs_dir()
    if current_runs_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "runs/ directory not configured. Start the server with --specgraph-dir."},
        )
        return

    qs = query_params(parsed)
    try:
        limit = int(query_value(qs, "limit", "50"))
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, 500))
    since = query_value(qs, "since", None)
    since_iso = since if isinstance(since, str) and since else None

    json_response(
        handler,
        HTTPStatus.OK,
        specgraph_surfaces.collect_recent_runs(current_runs_dir, limit=limit, since_iso=since_iso),
    )


def handle_spec_activity(handler: SpecGraphSurfacesApiHandler, parsed: Any) -> None:
    if handler.server.spec_dir is None and handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
        )
        return
    qs = query_params(parsed)
    status, payload = specgraph_surfaces.read_spec_activity(
        spec_dir=handler.server.spec_dir,
        runs_dir=handler._runs_dir(),
        limit_raw=query_value(qs, "limit", None),
        since_raw=query_value(qs, "since", None),
    )
    json_response(handler, status, payload)


def handle_implementation_work_index(handler: SpecGraphSurfacesApiHandler, parsed: Any) -> None:
    if handler.server.spec_dir is None and handler.server.specgraph_dir is None:
        json_response(
            handler,
            HTTPStatus.SERVICE_UNAVAILABLE,
            {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
        )
        return
    qs = query_params(parsed)
    status, payload = specgraph_surfaces.read_implementation_work_index(
        spec_dir=handler.server.spec_dir,
        runs_dir=handler._runs_dir(),
        limit_raw=query_value(qs, "limit", "50"),
    )
    json_response(handler, status, payload)


def handle_metric_pricing_provenance(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metric_pricing_provenance.json",
        "--build-viewer-surfaces",
    )


def handle_model_usage_telemetry(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "model_usage_telemetry_index.json",
        "--build-viewer-surfaces",
    )


def handle_metric_signals(handler: SpecGraphSurfacesApiHandler) -> None:
    handler._handle_runs_artifact(
        "metric_signal_index.json",
        "--build-viewer-surfaces",
    )


def handle_spec_overlay(handler: SpecGraphSurfacesApiHandler) -> None:
    current_runs_dir = handler._runs_dir()
    if current_runs_dir is None:
        json_response(handler, HTTPStatus.NOT_FOUND, {"error": "runs/ not available"})
        return
    status, payload = specgraph_surfaces.collect_spec_overlay(current_runs_dir)
    json_response(handler, status, payload)
