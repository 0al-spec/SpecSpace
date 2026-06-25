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
    "/api/v1/health": RouteSpec("handle_v1_health"),
    "/api/v1/capabilities": RouteSpec("handle_v1_capabilities"),
    "/api/v1/workspaces": RouteSpec("handle_v1_workspaces"),
    "/api/v1/spec-graph": RouteSpec("handle_v1_spec_graph", pass_parsed=True),
    "/api/v1/spec-markdown": RouteSpec("handle_v1_spec_markdown", pass_parsed=True),
    "/api/v1/runs/recent": RouteSpec("handle_v1_recent_runs", pass_parsed=True),
    "/api/v1/spec-activity": RouteSpec("handle_v1_spec_activity", pass_parsed=True),
    "/api/v1/implementation-work-index": RouteSpec("handle_v1_implementation_work_index", pass_parsed=True),
    "/api/v1/proposal-spec-trace-index": RouteSpec("handle_v1_proposal_spec_trace_index", pass_parsed=True),
    "/api/v1/proposals": RouteSpec("handle_v1_proposals", pass_parsed=True),
    "/api/v1/artifacts": RouteSpec("handle_v1_artifacts", pass_parsed=True),
    "/api/v1/artifacts/content": RouteSpec("handle_v1_artifact_content", pass_parsed=True),
    "/api/v1/idea-to-spec-workspace": RouteSpec("handle_v1_idea_to_spec_workspace", pass_parsed=True),
    "/api/v1/idea-to-spec-repair-drafts": RouteSpec(
        "handle_v1_idea_to_spec_repair_drafts",
        pass_parsed=True,
    ),
    "/api/v1/practical-ontology": RouteSpec("handle_v1_practical_ontology", pass_parsed=True),
    "/api/v1/ontology-workbench": RouteSpec("handle_v1_ontology_workbench", pass_parsed=True),
    "/api/v1/metrics": RouteSpec("handle_v1_metrics", pass_parsed=True),
    "/api/v1/agent-surfaces": RouteSpec("handle_v1_agent_surfaces", pass_parsed=True),
    "/api/v1/ontology-semantic-review-surface": RouteSpec(
        "handle_v1_ontology_semantic_review_surface", pass_parsed=True
    ),
    "/api/v1/ontology-review-dashboard": RouteSpec("handle_v1_ontology_review_dashboard", pass_parsed=True),
    "/api/v1/ontology-owner-decision-review": RouteSpec(
        "handle_v1_ontology_owner_decision_review", pass_parsed=True
    ),
    "/api/v1/ontology-compliance-review": RouteSpec(
        "handle_v1_ontology_compliance_review", pass_parsed=True
    ),
    "/api/v1/ontology-owner-decision-acknowledgements": RouteSpec(
        "handle_v1_ontology_owner_decision_acknowledgements"
    ),
    "/api/v1/specpm/registry": RouteSpec("handle_v1_specpm_registry"),
    "/api/v1/specpm/lifecycle": RouteSpec("handle_v1_specpm_lifecycle", pass_parsed=True),
    "/api/v1/agent-workbench/conversations": RouteSpec("handle_v1_agent_workbench_conversations"),
    "/api/v1/runs-watch": RouteSpec("handle_v1_runs_watch"),
}


GET_PREFIX_ROUTES: dict[str, RouteSpec] = {
    "/api/v1/specpm/registry/packages/": RouteSpec("handle_v1_specpm_registry_package", pass_parsed=True),
    "/api/v1/agent-workbench/conversations/": RouteSpec(
        "handle_v1_agent_workbench_conversation",
        pass_parsed=True,
    ),
    "/api/v1/spec-nodes/": RouteSpec("handle_v1_spec_node", pass_parsed=True),
}


POST_ROUTES: dict[str, RouteSpec] = {
    "/api/file": RouteSpec("handle_write_file"),
    "/api/export": RouteSpec("handle_export"),
    "/api/compile": RouteSpec("handle_compile"),
    "/api/v1/spec-markdown/compile": RouteSpec(
        "handle_v1_spec_markdown_compile",
        pass_parsed=True,
    ),
    "/api/v1/ontology-owner-decision-acknowledgements": RouteSpec(
        "handle_v1_ontology_owner_decision_acknowledgement_post"
    ),
    "/api/v1/idea-to-spec-repair-drafts": RouteSpec(
        "handle_v1_idea_to_spec_repair_draft_post",
        pass_parsed=True,
    ),
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
    route = ROUTES_BY_METHOD.get(method, {}).get(path)
    if route is not None:
        return route
    if method == "GET":
        for prefix, prefix_route in GET_PREFIX_ROUTES.items():
            if path.startswith(prefix):
                return prefix_route
    return None
