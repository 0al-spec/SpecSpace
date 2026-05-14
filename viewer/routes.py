"""HTTP route table for the viewer server."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RouteSpec:
    handler: str
    pass_parsed: bool = False
    args: tuple[Any, ...] = ()


GET_ROUTES: dict[str, RouteSpec] = {
    "/api/files": RouteSpec("handle_list_files"),
    "/api/graph": RouteSpec("handle_graph"),
    "/api/watch": RouteSpec("handle_watch"),
    "/api/conversation": RouteSpec("handle_get_conversation", pass_parsed=True),
    "/api/checkpoint": RouteSpec("handle_get_checkpoint", pass_parsed=True),
    "/api/file": RouteSpec("handle_get_file", pass_parsed=True),
    "/api/spec-graph": RouteSpec("handle_spec_graph"),
    "/api/spec-watch": RouteSpec("handle_spec_watch"),
    "/api/runs-watch": RouteSpec("handle_runs_watch"),
    "/api/spec-node": RouteSpec("handle_spec_node", pass_parsed=True),
    "/api/spec-compile": RouteSpec("handle_spec_compile", pass_parsed=True),
    "/api/capabilities": RouteSpec("handle_capabilities"),
    "/api/graph-dashboard": RouteSpec("handle_graph_dashboard"),
    "/api/graph-backlog-projection": RouteSpec("handle_graph_backlog_projection"),
    "/api/metrics-source-promotion": RouteSpec("handle_metrics_source_promotion"),
    "/api/metrics-delivery": RouteSpec("handle_metrics_delivery"),
    "/api/metrics-feedback": RouteSpec("handle_metrics_feedback"),
    "/api/metric-pack-adapters": RouteSpec("handle_metric_pack_adapters"),
    "/api/metric-pack-runs": RouteSpec("handle_metric_pack_runs"),
    "/api/recent-runs": RouteSpec("handle_recent_runs", pass_parsed=True),
    "/api/spec-activity": RouteSpec("handle_spec_activity", pass_parsed=True),
    "/api/implementation-work-index": RouteSpec("handle_implementation_work_index", pass_parsed=True),
    "/api/metric-pricing-provenance": RouteSpec("handle_metric_pricing_provenance"),
    "/api/model-usage-telemetry": RouteSpec("handle_model_usage_telemetry"),
    "/api/metric-signals": RouteSpec("handle_metric_signals"),
    "/api/spec-overlay": RouteSpec("handle_spec_overlay"),
    "/api/specpm/preview": RouteSpec("handle_specpm_preview_get"),
    "/api/specpm/export-preview": RouteSpec("_handle_specpm_artifact_get", args=("specpm_export_preview.json",)),
    "/api/specpm/handoff": RouteSpec("_handle_specpm_artifact_get", args=("specpm_handoff_packets.json",)),
    "/api/specpm/materialization": RouteSpec(
        "_handle_specpm_artifact_get",
        args=("specpm_materialization_report.json",),
    ),
    "/api/specpm/import-preview": RouteSpec("_handle_specpm_artifact_get", args=("specpm_import_preview.json",)),
    "/api/specpm/import-handoff": RouteSpec(
        "_handle_specpm_artifact_get",
        args=("specpm_import_handoff_packets.json",),
    ),
    "/api/specpm/lifecycle": RouteSpec("handle_specpm_lifecycle"),
    "/api/exploration-preview": RouteSpec("handle_exploration_preview_get"),
    "/api/exploration-surfaces": RouteSpec("handle_exploration_surfaces_get"),
    "/api/exploration-proposal": RouteSpec("handle_exploration_proposal_get", pass_parsed=True),
    "/api/proposal-spec-trace-index": RouteSpec("handle_proposal_spec_trace_index_get"),
}


POST_ROUTES: dict[str, RouteSpec] = {
    "/api/file": RouteSpec("handle_write_file"),
    "/api/export": RouteSpec("handle_export"),
    "/api/compile": RouteSpec("handle_compile"),
    "/api/specpm/preview/build": RouteSpec("handle_specpm_preview_build"),
    "/api/specpm/build-export-preview": RouteSpec(
        "_handle_specpm_build",
        args=("--build-specpm-export-preview", "specpm_export_preview.json"),
    ),
    "/api/specpm/materialize": RouteSpec(
        "_handle_specpm_build",
        args=("--materialize-specpm-export-bundles", "specpm_materialization_report.json"),
    ),
    "/api/specpm/build-import-preview": RouteSpec(
        "_handle_specpm_build",
        args=("--build-specpm-import-preview", "specpm_import_preview.json"),
    ),
    "/api/specpm/build-import-handoff-packets": RouteSpec(
        "_handle_specpm_build",
        args=("--build-specpm-import-handoff-packets", "specpm_import_handoff_packets.json"),
    ),
    "/api/exploration-preview/build": RouteSpec("handle_exploration_preview_build"),
    "/api/viewer-surfaces/build": RouteSpec("handle_viewer_surfaces_build"),
    "/api/reveal": RouteSpec("handle_reveal"),
}


DELETE_ROUTES: dict[str, RouteSpec] = {
    "/api/file": RouteSpec("handle_delete_file", pass_parsed=True),
}


ROUTES_BY_METHOD: dict[str, dict[str, RouteSpec]] = {
    "GET": GET_ROUTES,
    "POST": POST_ROUTES,
    "DELETE": DELETE_ROUTES,
}


def route_for(method: str, path: str) -> RouteSpec | None:
    return ROUTES_BY_METHOD.get(method, {}).get(path)
