#!/usr/bin/env python3
"""Minimal JSON dialog viewer server with folder read/write/delete APIs."""

from __future__ import annotations

import argparse
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
if __package__ in {None, ""}:  # pragma: no cover - allows running `python viewer/server.py`
    sys.path.insert(0, str(REPO_ROOT))

from viewer import schema  # noqa: E402
from viewer import graph as conversation_graph  # noqa: E402
from viewer import capabilities_api  # noqa: E402
from viewer import export as graph_export  # noqa: E402
from viewer import hyperprompt_compile  # noqa: E402
from viewer import workspace_cache  # noqa: E402
from viewer import workspace_io  # noqa: E402
from viewer import conversation_api  # noqa: E402
from viewer import file_api  # noqa: E402
from viewer import specgraph_api  # noqa: E402
from viewer import specgraph_surfaces_api  # noqa: E402
from viewer import specpm_exploration_api  # noqa: E402
from viewer import static_api  # noqa: E402
from viewer.http_response import json_response  # noqa: E402
from viewer.request_body import read_json_object_request_body  # noqa: E402
from viewer.routes import route_for  # noqa: E402
from viewer.sse import send_sse_headers, stream_change_events  # noqa: E402
from viewer.watchers import RunsWatcher, SpecWatcher  # noqa: E402
from viewer.export import (  # noqa: E402
    _render_node_markdown,
    build_compile_provenance,
    generate_hc_root,
    render_compile_provenance_markdown,
)
from viewer.graph import (  # noqa: E402
    base_conversation_kind,
    build_checkpoint,
    build_compile_target,
    build_graph_indexes,
    build_graph_snapshot,
    build_graph_summary,
    build_lineage_paths,
    collect_related_diagnostics,
    graph_diagnostic_is_blocking,
    graph_error_is_blocking,
    serialize_errors,
    serialize_graph_diagnostics,
    serialize_validation,
    sort_graph_diagnostics,
    sort_lineage_paths,
    split_graph_diagnostics,
)
from viewer.specpm import _build_specpm_lifecycle  # noqa: E402

EXPORT_SENTINEL = ".ctxb_export"

NON_BLOCKING_GRAPH_ERROR_CODES = conversation_graph.NON_BLOCKING_GRAPH_ERROR_CODES


# ---------------------------------------------------------------------------
# Workspace cache — avoids re-reading unchanged JSON files on every request
# ---------------------------------------------------------------------------


def _scan_dir_key(dialog_dir: Path) -> frozenset[tuple[str, float, int]]:
    """Compatibility wrapper for the extracted workspace cache key scanner."""
    return workspace_cache.scan_dir_key(dialog_dir)


class WorkspaceCache(workspace_cache.WorkspaceCache):
    """Thread-safe cache for collect_workspace_listing results.

    A cache miss occurs when any file is added, removed, or has its mtime/size
    changed.  On a miss the full workspace is rebuilt and the cache updated
    atomically under a lock.  Concurrent callers on a miss serialize through
    the lock — exactly one rebuilds, others wait and then get the fresh result.
    """

    def get(self, dialog_dir: Path) -> dict[str, Any]:
        return super().get(dialog_dir, _build_workspace_listing)


# Registry: one WorkspaceCache per dialog_dir path used in the process.
_WORKSPACE_CACHES: dict[Path, WorkspaceCache] = {}
_REGISTRY_LOCK = threading.Lock()


def _get_workspace_cache(dialog_dir: Path) -> WorkspaceCache:
    with _REGISTRY_LOCK:
        if dialog_dir not in _WORKSPACE_CACHES:
            _WORKSPACE_CACHES[dialog_dir] = WorkspaceCache()
        return _WORKSPACE_CACHES[dialog_dir]


def collect_graph_api(dialog_dir: Path) -> dict[str, Any]:
    """Compatibility wrapper for the extracted conversation graph read model."""
    return conversation_graph.collect_graph_api(
        dialog_dir,
        collect_workspace_listing=collect_workspace_listing,
    )


def collect_conversation_api(dialog_dir: Path, conversation_id: str) -> tuple[int, dict[str, Any]]:
    """Compatibility wrapper for the extracted conversation selection API."""
    return conversation_graph.collect_conversation_api(
        dialog_dir,
        conversation_id,
        collect_workspace_listing=collect_workspace_listing,
    )


def collect_checkpoint_api(dialog_dir: Path, conversation_id: str, message_id: str) -> tuple[int, dict[str, Any]]:
    """Compatibility wrapper for the extracted checkpoint selection API."""
    return conversation_graph.collect_checkpoint_api(
        dialog_dir,
        conversation_id,
        message_id,
        collect_workspace_listing=collect_workspace_listing,
    )


def dialog_path_for_name(dialog_dir: Path, name: str) -> Path:
    """Compatibility wrapper for workspace path containment."""
    return workspace_io.dialog_path_for_name(dialog_dir, name)


def load_json_file(path: Path) -> tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]:
    """Compatibility wrapper for workspace JSON loading."""
    return workspace_io.load_json_file(path)


def load_workspace_payloads(dialog_dir: Path, exclude_name: str | None = None) -> list[tuple[str, dict[str, Any]]]:
    """Compatibility wrapper preserving server.load_json_file monkeypatch hooks."""
    return workspace_io.load_workspace_payloads(
        dialog_dir,
        exclude_name,
        load_json_file=load_json_file,
    )


def _build_workspace_listing(dialog_dir: Path) -> dict[str, Any]:
    """Compatibility wrapper preserving server.load_json_file monkeypatch hooks."""
    return workspace_io.build_workspace_listing(dialog_dir, load_json_file=load_json_file)


def collect_workspace_listing(dialog_dir: Path) -> dict[str, Any]:
    """Return the workspace listing, using a per-directory mtime-based cache.

    The cache is invalidated whenever any *.json file in *dialog_dir* is added,
    removed, or has its mtime/size changed.  File reads are performed only on a
    cache miss.  Thread-safe under ``ThreadingHTTPServer``.
    """
    return _get_workspace_cache(dialog_dir).get(dialog_dir)


def validate_write_request(
    dialog_dir: Path,
    name: str,
    data: Any,
    overwrite: bool,
) -> tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]:
    """Compatibility wrapper preserving server path and payload loader hooks."""
    return workspace_io.validate_write_request(
        dialog_dir,
        name,
        data,
        overwrite,
        dialog_path_for_name=dialog_path_for_name,
        load_workspace_payloads=load_workspace_payloads,
    )


def export_graph_nodes(
    dialog_dir: Path,
    conversation_id: str,
    message_id: str | None = None,
) -> tuple[int, dict[str, Any]]:
    """Compatibility wrapper for the extracted export pipeline."""
    return graph_export.export_graph_nodes(
        dialog_dir,
        conversation_id,
        message_id,
        collect_workspace_listing=collect_workspace_listing,
        build_graph_indexes=build_graph_indexes,
        build_compile_target=build_compile_target,
        export_sentinel=EXPORT_SENTINEL,
    )


_EXIT_CODE_DESCRIPTIONS = hyperprompt_compile.EXIT_CODE_DESCRIPTIONS
DEFAULT_HYPERPROMPT_BINARY = str(REPO_ROOT / "deps" / "hyperprompt")


def _default_hyperprompt_fallbacks(default_binary: Path) -> list[tuple[str, Path]]:
    """Compatibility wrapper for Hyperprompt fallback candidate discovery."""
    return hyperprompt_compile.default_hyperprompt_fallbacks(default_binary, repo_root=REPO_ROOT)


def resolve_hyperprompt_binary(configured_binary: str) -> tuple[str | None, list[str], str]:
    """Compatibility wrapper that uses the current mutable default binary path."""
    return hyperprompt_compile.resolve_hyperprompt_binary(
        configured_binary,
        default_hyperprompt_binary=DEFAULT_HYPERPROMPT_BINARY,
        repo_root=REPO_ROOT,
    )


def invoke_hyperprompt(
    export_dir: Path,
    binary_path: str,
) -> tuple[int, dict[str, Any]]:
    """Compatibility wrapper that preserves server.DEFAULT_HYPERPROMPT_BINARY mutation."""
    return hyperprompt_compile.invoke_hyperprompt(
        export_dir,
        binary_path,
        default_hyperprompt_binary=DEFAULT_HYPERPROMPT_BINARY,
        repo_root=REPO_ROOT,
    )


def compile_graph_nodes(
    dialog_dir: Path,
    conversation_id: str,
    message_id: str | None,
    hyperprompt_binary: str,
) -> tuple[int, dict[str, Any]]:
    """Compatibility wrapper for the extracted compile pipeline."""
    return hyperprompt_compile.compile_graph_nodes(
        dialog_dir,
        conversation_id,
        message_id,
        hyperprompt_binary,
        export_graph_nodes=export_graph_nodes,
        invoke_hyperprompt=invoke_hyperprompt,
    )


class ViewerHandler(BaseHTTPRequestHandler):
    server_version = "ContextBuilderViewer/0.1"

    collect_workspace_listing = staticmethod(collect_workspace_listing)
    collect_checkpoint_api = staticmethod(collect_checkpoint_api)
    collect_conversation_api = staticmethod(collect_conversation_api)
    collect_graph_api = staticmethod(collect_graph_api)
    compile_graph_nodes = staticmethod(compile_graph_nodes)
    export_graph_nodes = staticmethod(export_graph_nodes)
    get_workspace_cache = staticmethod(_get_workspace_cache)
    load_json_file = staticmethod(load_json_file)
    validate_write_request = staticmethod(validate_write_request)

    handle_compile = conversation_api.handle_compile
    handle_delete_file = file_api.handle_delete_file
    handle_export = conversation_api.handle_export
    handle_get_file = file_api.handle_get_file
    handle_get_checkpoint = conversation_api.handle_get_checkpoint
    handle_get_conversation = conversation_api.handle_get_conversation
    handle_graph = conversation_api.handle_graph
    handle_list_files = file_api.handle_list_files
    handle_spec_compile = specgraph_api.handle_spec_compile
    handle_spec_graph = specgraph_api.handle_spec_graph
    handle_spec_node = specgraph_api.handle_spec_node
    handle_write_file = file_api.handle_write_file
    _graph_dashboard_path = specgraph_surfaces_api.graph_dashboard_path
    _handle_runs_artifact = specgraph_surfaces_api.handle_runs_artifact
    _runs_dir = specgraph_surfaces_api.runs_dir
    _viewer_surfaces_build_available = specgraph_surfaces_api.viewer_surfaces_build_available
    handle_graph_backlog_projection = specgraph_surfaces_api.handle_graph_backlog_projection
    handle_graph_dashboard = specgraph_surfaces_api.handle_graph_dashboard
    handle_implementation_work_index = specgraph_surfaces_api.handle_implementation_work_index
    handle_metric_pack_adapters = specgraph_surfaces_api.handle_metric_pack_adapters
    handle_metric_pack_runs = specgraph_surfaces_api.handle_metric_pack_runs
    handle_metric_pricing_provenance = specgraph_surfaces_api.handle_metric_pricing_provenance
    handle_metric_signals = specgraph_surfaces_api.handle_metric_signals
    handle_metrics_delivery = specgraph_surfaces_api.handle_metrics_delivery
    handle_metrics_feedback = specgraph_surfaces_api.handle_metrics_feedback
    handle_metrics_source_promotion = specgraph_surfaces_api.handle_metrics_source_promotion
    handle_model_usage_telemetry = specgraph_surfaces_api.handle_model_usage_telemetry
    handle_recent_runs = specgraph_surfaces_api.handle_recent_runs
    handle_spec_activity = specgraph_surfaces_api.handle_spec_activity
    handle_spec_overlay = specgraph_surfaces_api.handle_spec_overlay
    handle_viewer_surfaces_build = specgraph_surfaces_api.handle_viewer_surfaces_build
    _exploration_build_available = specpm_exploration_api.exploration_build_available
    _handle_specpm_artifact_get = specpm_exploration_api.handle_specpm_artifact_get
    _handle_specpm_build = specpm_exploration_api.handle_specpm_build
    handle_exploration_preview_build = specpm_exploration_api.handle_exploration_preview_build
    handle_exploration_preview_get = specpm_exploration_api.handle_exploration_preview_get
    handle_exploration_proposal_get = specpm_exploration_api.handle_exploration_proposal_get
    handle_exploration_surfaces_get = specpm_exploration_api.handle_exploration_surfaces_get
    handle_proposal_spec_trace_index_get = specpm_exploration_api.handle_proposal_spec_trace_index_get
    handle_specpm_lifecycle = specpm_exploration_api.handle_specpm_lifecycle
    handle_specpm_preview_build = specpm_exploration_api.handle_specpm_preview_build
    handle_specpm_preview_get = specpm_exploration_api.handle_specpm_preview_get
    handle_capabilities = capabilities_api.handle_capabilities
    handle_reveal = static_api.handle_reveal
    handle_static = static_api.handle_static

    def _dispatch_route(self, method: str, parsed) -> bool:
        route = route_for(method, parsed.path)
        if route is None:
            return False
        handler = getattr(self, route.handler)
        args = (parsed, *route.args) if route.pass_parsed else route.args
        handler(*args)
        return True

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if self._dispatch_route("GET", parsed):
            return
        self.handle_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if self._dispatch_route("POST", parsed):
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if self._dispatch_route("DELETE", parsed):
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict | None:
        try:
            return read_json_object_request_body(self.headers, self.rfile)
        except Exception as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})
            return None

    def safe_dialog_path(self, name: str) -> Path | None:
        if schema.validate_file_name(name):
            return None
        try:
            return dialog_path_for_name(self.server.dialog_dir.resolve(), name)
        except ValueError:
            return None

    def log_message(self, format: str, *args) -> None:
        return

    def handle_spec_watch(self) -> None:
        """SSE endpoint: streams a 'change' event whenever spec files are modified.

        Uses the shared SpecWatcher so a single polling thread serves all clients.
        """
        watcher: SpecWatcher | None = getattr(self.server, "spec_watcher", None)
        if watcher is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "Spec graph not configured. Start the server with --spec-dir."},
            )
            return

        send_sse_headers(self)
        stream_change_events(self, watcher)

    def handle_runs_watch(self) -> None:
        """SSE endpoint: streams a 'change' event when files in runs/ change.

        Same shape as handle_spec_watch but backed by RunsWatcher; powers the
        live-feed mode of the Recent Changes overlay.
        """
        watcher: RunsWatcher | None = getattr(self.server, "runs_watcher", None)
        if watcher is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "runs/ not configured. Start the server with --specgraph-dir."},
            )
            return

        send_sse_headers(self)
        stream_change_events(self, watcher)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--dialog-dir", type=Path, required=True)
    parser.add_argument(
        "--hyperprompt-binary",
        type=str,
        default=DEFAULT_HYPERPROMPT_BINARY,
        help="Path to the Hyperprompt compiler binary",
    )
    parser.add_argument(
        "--spec-dir",
        type=Path,
        default=None,
        help="Path to a SpecGraph specs/nodes directory (enables /api/spec-graph)",
    )
    parser.add_argument(
        "--specgraph-dir",
        type=Path,
        default=None,
        help="Path to the SpecGraph repo root (enables /api/specpm/preview)",
    )
    parser.add_argument(
        "--agent",
        action="store_true",
        default=False,
        help="Enable the AgentChat panel in the UI",
    )
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ViewerHandler)
    server.repo_root = REPO_ROOT
    server.dialog_dir = args.dialog_dir.expanduser().resolve()
    server.dialog_dir.mkdir(parents=True, exist_ok=True)
    server.hyperprompt_binary = args.hyperprompt_binary
    resolved_binary, _, _ = resolve_hyperprompt_binary(args.hyperprompt_binary)
    server.compile_available = resolved_binary is not None
    server.spec_dir = args.spec_dir.expanduser().resolve() if args.spec_dir else None
    server.spec_watcher = SpecWatcher(server.spec_dir) if server.spec_dir else None
    server.specgraph_dir = args.specgraph_dir.expanduser().resolve() if args.specgraph_dir else None
    # Runs watcher: derive runs/ the same way /api/recent-runs does (via
    # ViewerHandler._runs_dir(): spec_dir.parent.parent / "runs"), falling back
    # to --specgraph-dir for deployments that only set that flag. RunsWatcher
    # tolerates a missing directory at boot — it'll start emitting events once
    # runs/ appears, so first-run setups don't lose live updates.
    runs_path: Path | None = None
    if server.spec_dir is not None:
        runs_path = server.spec_dir.parent.parent / "runs"
    elif server.specgraph_dir is not None:
        runs_path = server.specgraph_dir / "runs"
    server.runs_watcher = RunsWatcher(runs_path) if runs_path is not None else None
    server.agent_available = args.agent

    print(f"Serving ContextBuilder at http://localhost:{args.port}/")
    print(f"Dialog folder: {server.dialog_dir}")
    server.serve_forever()


if __name__ == "__main__":
    main()
