#!/usr/bin/env python3
"""Minimal JSON dialog viewer server with folder read/write/delete APIs."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
if __package__ in {None, ""}:  # pragma: no cover - allows running `python viewer/server.py`
    sys.path.insert(0, str(REPO_ROOT))

from viewer import schema  # noqa: E402
from viewer import graph as conversation_graph  # noqa: E402
from viewer import export as graph_export  # noqa: E402
from viewer import hyperprompt_compile  # noqa: E402
from viewer import specgraph  # noqa: E402
from viewer import spec_compile  # noqa: E402
from viewer import specgraph_surfaces  # noqa: E402
from viewer import supervisor_build  # noqa: E402
from viewer import workspace_cache  # noqa: E402
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
from viewer.specpm import (  # noqa: E402
    _artifact_available_meta,
    _build_proposal_pressure_summary,
    _build_specpm_lifecycle,
    _collect_exploration_surfaces,
    _collect_proposals,
    _count_field,
    _count_nested,
    _dict_value,
    _entries_from_artifact,
    _entry_count,
    _extract_proposal_status,
    _extract_proposal_title,
    _merge_specpm_source_refs,
    _nested_value,
    _pkg_key,
    _proposal_entry,
    _read_proposal_markdown,
    _read_specgraph_runs_artifact,
    _read_specpm_artifact,
    _string_list,
)

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


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


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
    """Resolve *name* relative to *dialog_dir* and enforce containment.

    Raises ``ValueError`` if the resolved path escapes *dialog_dir* (directory
    traversal attempt).  *dialog_dir* must already be an absolute resolved path.
    """
    resolved = (dialog_dir / name).resolve()
    dir_str = str(dialog_dir.resolve())
    # Use os.sep suffix to avoid false matches (e.g. /tmp/foo vs /tmp/foobar).
    if not (str(resolved).startswith(dir_str + os.sep) or str(resolved) == dir_str):
        raise ValueError(
            f"Path '{name}' resolves outside dialog_dir '{dialog_dir}': {resolved}"
        )
    return resolved


def load_json_file(path: Path) -> tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, (schema.NormalizationError("invalid_json", f"Failed to read JSON: {exc}"),)

    if not isinstance(data, dict):
        return None, (schema.NormalizationError("invalid_payload", "Payload must be a JSON object."),)

    return data, ()


def load_workspace_payloads(dialog_dir: Path, exclude_name: str | None = None) -> list[tuple[str, dict[str, Any]]]:
    payloads: list[tuple[str, dict[str, Any]]] = []
    for path in sorted(dialog_dir.glob("*.json")):
        if exclude_name and path.name == exclude_name:
            continue
        payload, errors = load_json_file(path)
        if errors or payload is None:
            continue
        payloads.append((path.name, payload))
    return payloads


def _build_workspace_listing(dialog_dir: Path) -> dict[str, Any]:
    """Build the full workspace listing by reading and validating all JSON files.

    This is the uncached implementation.  Call ``collect_workspace_listing``
    instead, which adds mtime-based caching.
    """
    discovered: list[tuple[dict[str, Any], dict[str, Any] | None, tuple[schema.NormalizationError, ...]]] = []
    payloads: list[tuple[str, dict[str, Any]]] = []

    for path in sorted(dialog_dir.glob("*.json")):
        stat = path.stat()
        meta = {
            "name": path.name,
            "size": stat.st_size,
            "modified_at": stat.st_mtime,
        }
        payload, errors = load_json_file(path)
        discovered.append((meta, payload, errors))
        if payload is not None and not errors:
            payloads.append((path.name, payload))

    reports = {report.file_name: report for report in schema.validate_workspace(payloads)}
    files: list[dict[str, Any]] = []
    diagnostics: list[dict[str, str]] = []

    for meta, payload, errors in discovered:
        if errors or payload is None:
            validation = serialize_validation("invalid", None, errors)
        else:
            report = reports[meta["name"]]
            validation = serialize_validation(report.kind, report.normalized, report.errors)

        files.append(
            {
                **meta,
                "kind": validation["kind"],
                "validation": validation,
            }
        )
        for error in validation["errors"]:
            diagnostics.append({"file": meta["name"], **error})

    return {
        "files": files,
        "diagnostics": diagnostics,
        "graph": build_graph_snapshot(discovered, reports),
        "dialog_dir": str(dialog_dir),
    }


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
    filename_errors = schema.validate_file_name(name)
    if filename_errors:
        return None, filename_errors

    if not isinstance(data, dict):
        return None, (schema.NormalizationError("invalid_payload", "`data` must be a JSON object."),)

    path = dialog_path_for_name(dialog_dir.resolve(), name)
    if path.exists() and not overwrite:
        return None, (schema.NormalizationError("file_exists", "File already exists."),)

    payloads = load_workspace_payloads(dialog_dir, exclude_name=name if overwrite else None)
    payloads.append((name, data))
    reports = {report.file_name: report for report in schema.validate_workspace(payloads)}
    candidate = reports[name]

    if candidate.errors:
        return None, candidate.errors

    return candidate.normalized, ()


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

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/files":
            self.handle_list_files()
            return
        if parsed.path == "/api/graph":
            self.handle_graph()
            return
        if parsed.path == "/api/conversation":
            self.handle_get_conversation(parsed)
            return
        if parsed.path == "/api/checkpoint":
            self.handle_get_checkpoint(parsed)
            return
        if parsed.path == "/api/file":
            self.handle_get_file(parsed)
            return
        if parsed.path == "/api/spec-graph":
            self.handle_spec_graph()
            return
        if parsed.path == "/api/spec-watch":
            self.handle_spec_watch()
            return
        if parsed.path == "/api/runs-watch":
            self.handle_runs_watch()
            return
        if parsed.path == "/api/spec-node":
            self.handle_spec_node(parsed)
            return
        if parsed.path == "/api/spec-compile":
            self.handle_spec_compile(parsed)
            return
        if parsed.path == "/api/capabilities":
            self.handle_capabilities()
            return
        if parsed.path == "/api/graph-dashboard":
            self.handle_graph_dashboard()
            return
        if parsed.path == "/api/graph-backlog-projection":
            self.handle_graph_backlog_projection()
            return
        if parsed.path == "/api/metrics-source-promotion":
            self.handle_metrics_source_promotion()
            return
        if parsed.path == "/api/metrics-delivery":
            self.handle_metrics_delivery()
            return
        if parsed.path == "/api/metrics-feedback":
            self.handle_metrics_feedback()
            return
        if parsed.path == "/api/metric-pack-adapters":
            self.handle_metric_pack_adapters()
            return
        if parsed.path == "/api/metric-pack-runs":
            self.handle_metric_pack_runs()
            return
        if parsed.path == "/api/recent-runs":
            self.handle_recent_runs(parsed)
            return
        if parsed.path == "/api/spec-activity":
            self.handle_spec_activity(parsed)
            return
        if parsed.path == "/api/implementation-work-index":
            self.handle_implementation_work_index(parsed)
            return
        if parsed.path == "/api/metric-pricing-provenance":
            self.handle_metric_pricing_provenance()
            return
        if parsed.path == "/api/model-usage-telemetry":
            self.handle_model_usage_telemetry()
            return
        if parsed.path == "/api/metric-signals":
            self.handle_metric_signals()
            return
        if parsed.path == "/api/spec-overlay":
            self.handle_spec_overlay()
            return
        if parsed.path == "/api/specpm/preview":
            self.handle_specpm_preview_get()
            return
        if parsed.path == "/api/specpm/export-preview":
            self._handle_specpm_artifact_get("specpm_export_preview.json")
            return
        if parsed.path == "/api/specpm/handoff":
            self._handle_specpm_artifact_get("specpm_handoff_packets.json")
            return
        if parsed.path == "/api/specpm/materialization":
            self._handle_specpm_artifact_get("specpm_materialization_report.json")
            return
        if parsed.path == "/api/specpm/import-preview":
            self._handle_specpm_artifact_get("specpm_import_preview.json")
            return
        if parsed.path == "/api/specpm/import-handoff":
            self._handle_specpm_artifact_get("specpm_import_handoff_packets.json")
            return
        if parsed.path == "/api/specpm/lifecycle":
            self.handle_specpm_lifecycle()
            return
        if parsed.path == "/api/exploration-preview":
            self.handle_exploration_preview_get()
            return
        if parsed.path == "/api/exploration-surfaces":
            self.handle_exploration_surfaces_get()
            return
        if parsed.path == "/api/exploration-proposal":
            self.handle_exploration_proposal_get(parsed)
            return
        if parsed.path == "/api/proposal-spec-trace-index":
            self.handle_proposal_spec_trace_index_get()
            return
        self.handle_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.handle_write_file()
            return
        if parsed.path == "/api/export":
            self.handle_export()
            return
        if parsed.path == "/api/compile":
            self.handle_compile()
            return
        if parsed.path == "/api/specpm/preview/build":
            self.handle_specpm_preview_build()
            return
        if parsed.path == "/api/specpm/build-export-preview":
            self._handle_specpm_build("--build-specpm-export-preview", "specpm_export_preview.json")
            return
        if parsed.path == "/api/specpm/materialize":
            self._handle_specpm_build("--materialize-specpm-export-bundles", "specpm_materialization_report.json")
            return
        if parsed.path == "/api/specpm/build-import-preview":
            self._handle_specpm_build("--build-specpm-import-preview", "specpm_import_preview.json")
            return
        if parsed.path == "/api/specpm/build-import-handoff-packets":
            self._handle_specpm_build("--build-specpm-import-handoff-packets", "specpm_import_handoff_packets.json")
            return
        if parsed.path == "/api/exploration-preview/build":
            self.handle_exploration_preview_build()
            return
        if parsed.path == "/api/viewer-surfaces/build":
            self.handle_viewer_surfaces_build()
            return
        if parsed.path == "/api/reveal":
            self.handle_reveal()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.handle_delete_file(parsed)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def handle_capabilities(self) -> None:
        json_response(
            self,
            HTTPStatus.OK,
            {
                "spec_graph": self.server.spec_dir is not None,
                "spec_compile": self.server.spec_dir is not None,
                "compile": self.server.compile_available,
                "graph_dashboard": self._graph_dashboard_path() is not None,
                "spec_overlay": self._runs_dir() is not None,
                "specpm_preview": self.server.specgraph_dir is not None,
                "exploration_preview": self.server.specgraph_dir is not None,
                "exploration_surfaces": self.server.specgraph_dir is not None,
                "exploration_preview_build": self._exploration_build_available(),
                "viewer_surfaces_build": self._viewer_surfaces_build_available(),
                "agent": bool(getattr(self.server, "agent_available", False)),
            },
        )

    def _runs_dir(self):
        return specgraph_surfaces.runs_dir_from_context(self.server.spec_dir, self.server.specgraph_dir)

    def _viewer_surfaces_build_available(self) -> bool:
        """True only when supervisor.py declares --build-viewer-surfaces in its source."""
        return specgraph_surfaces.supervisor_has_flags(self.server.specgraph_dir, "--build-viewer-surfaces")

    def handle_viewer_surfaces_build(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Viewer surfaces build not configured. Start the server with --specgraph-dir."},
            )
            return
        status, payload = supervisor_build.build_viewer_surfaces(self.server.specgraph_dir)
        json_response(self, status, payload)

    def _graph_dashboard_path(self):
        return specgraph_surfaces.graph_dashboard_path(self._runs_dir())

    def handle_graph_dashboard(self) -> None:
        status, payload = specgraph_surfaces.read_graph_dashboard(self._runs_dir())
        json_response(self, status, payload)

    def handle_graph_backlog_projection(self) -> None:
        if self.server.spec_dir is None and self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
            )
            return
        status, payload = specgraph_surfaces.read_graph_backlog_projection(
            self.server.spec_dir,
            self._runs_dir(),
        )
        json_response(self, status, payload)

    def _handle_runs_artifact(self, filename: str, build_hint: str) -> None:
        """Serve a single file from runs/ under the standard envelope, or 503/404/422."""
        if self.server.spec_dir is None and self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
            )
            return
        status, payload = specgraph_surfaces.read_runs_artifact(
            spec_dir=self.server.spec_dir,
            runs_dir=self._runs_dir(),
            filename=filename,
            build_hint=build_hint,
        )
        json_response(self, status, payload)

    def handle_metrics_source_promotion(self) -> None:
        self._handle_runs_artifact(
            "metrics_source_promotion_index.json",
            "--build-viewer-surfaces",
        )

    def handle_metrics_delivery(self) -> None:
        self._handle_runs_artifact(
            "metrics_delivery_workflow.json",
            "--build-viewer-surfaces",
        )

    def handle_metrics_feedback(self) -> None:
        self._handle_runs_artifact(
            "metrics_feedback_index.json",
            "--build-viewer-surfaces",
        )

    def handle_metric_pack_adapters(self) -> None:
        self._handle_runs_artifact(
            "metric_pack_adapter_index.json",
            "--build-viewer-surfaces",
        )

    def handle_metric_pack_runs(self) -> None:
        self._handle_runs_artifact(
            "metric_pack_runs.json",
            "--build-viewer-surfaces",
        )

    def handle_recent_runs(self, parsed) -> None:
        runs_dir = self._runs_dir()
        if runs_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "runs/ directory not configured. Start the server with --specgraph-dir."},
            )
            return

        qs = parse_qs(parsed.query or "")
        try:
            limit = int(qs.get("limit", ["50"])[0])
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 500))
        since = qs.get("since", [None])[0]
        since_iso = since if isinstance(since, str) and since else None

        json_response(
            self,
            HTTPStatus.OK,
            specgraph_surfaces.collect_recent_runs(runs_dir, limit=limit, since_iso=since_iso),
        )

    def handle_spec_activity(self, parsed) -> None:
        """Serve runs/spec_activity_feed.json with optional limit/since filtering.

        Contract: docs/spec_activity_feed_viewer_contract.md (SpecGraph PR #243).
        Returns the artifact data inside the standard runs envelope. limit/since
        are applied to data.entries[] after loading. since accepts an ISO
        timestamp string and is compared against entry.occurred_at.
        """
        if self.server.spec_dir is None and self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
            )
            return
        qs = parse_qs(parsed.query or "")
        status, payload = specgraph_surfaces.read_spec_activity(
            spec_dir=self.server.spec_dir,
            runs_dir=self._runs_dir(),
            limit_raw=qs.get("limit", [None])[0],
            since_raw=qs.get("since", [None])[0],
        )
        json_response(self, status, payload)

    def handle_implementation_work_index(self, parsed) -> None:
        """Serve runs/implementation_work_index.json inside the standard envelope.

        Contract: SpecGraph/docs/implementation_work_viewer_contract.md.
        Optional ?limit=N caps data.entries[] (default 50, max 1000). No
        ?since here — work items don't carry their own timestamps; the
        artifact's `generated_at` is the only time signal and is preserved
        in the envelope unchanged.
        """
        if self.server.spec_dir is None and self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir or --specgraph-dir."},
            )
            return
        qs = parse_qs(parsed.query or "")
        status, payload = specgraph_surfaces.read_implementation_work_index(
            spec_dir=self.server.spec_dir,
            runs_dir=self._runs_dir(),
            limit_raw=qs.get("limit", ["50"])[0],
        )
        json_response(self, status, payload)

    def handle_metric_pricing_provenance(self) -> None:
        self._handle_runs_artifact(
            "metric_pricing_provenance.json",
            "--build-viewer-surfaces",
        )

    def handle_model_usage_telemetry(self) -> None:
        self._handle_runs_artifact(
            "model_usage_telemetry_index.json",
            "--build-viewer-surfaces",
        )

    def handle_metric_signals(self) -> None:
        self._handle_runs_artifact(
            "metric_signal_index.json",
            "--build-viewer-surfaces",
        )

    def handle_spec_overlay(self) -> None:
        """Merge the three node-facing overlays into a single per-spec map."""
        runs = self._runs_dir()
        if runs is None:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "runs/ not available"})
            return
        status, payload = specgraph_surfaces.collect_spec_overlay(runs)
        json_response(self, status, payload)

    def _specpm_preview_path(self) -> Path | None:
        if self.server.specgraph_dir is None:
            return None
        return self.server.specgraph_dir / "runs" / "specpm_export_preview.json"

    def handle_specpm_preview_get(self) -> None:
        preview_path = self._specpm_preview_path()
        if preview_path is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecPM preview not configured. Start the server with --specgraph-dir."},
            )
            return
        if not preview_path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {
                    "error": "Preview artifact not built yet",
                    "hint": "POST /api/specpm/preview/build to create it",
                    "preview_path": str(preview_path),
                },
            )
            return
        try:
            data = json.loads(preview_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": f"Failed to read preview: {exc}", "preview_path": str(preview_path)},
            )
            return
        mtime = preview_path.stat().st_mtime
        json_response(
            self,
            HTTPStatus.OK,
            {
                "preview_path": str(preview_path),
                "mtime": mtime,
                "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
                "preview": data,
            },
        )

    def handle_specpm_preview_build(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecPM preview not configured. Start the server with --specgraph-dir."},
            )
            return
        status, payload = supervisor_build.build_specpm_preview(self.server.specgraph_dir)
        json_response(self, status, payload)

    def _specpm_runs_path(self, filename: str) -> Path | None:
        if self.server.specgraph_dir is None:
            return None
        return self.server.specgraph_dir / "runs" / filename

    def _handle_specpm_artifact_get(self, filename: str) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
            )
            return
        path = self._specpm_runs_path(filename)
        if path is None or not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "Artifact not built yet", "path": str(path) if path else None},
            )
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": f"Failed to read artifact: {exc}"},
            )
            return
        mtime = path.stat().st_mtime
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            "data": data,
        })

    def _handle_specpm_build(self, flag: str, artifact_filename: str) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
            )
            return
        status, payload = supervisor_build.build_specpm_artifact(
            self.server.specgraph_dir,
            flag,
            artifact_filename,
        )
        json_response(self, status, payload)

    def handle_specpm_lifecycle(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecPM not configured. Start the server with --specgraph-dir."},
            )
            return
        json_response(self, HTTPStatus.OK, _build_specpm_lifecycle(self.server.specgraph_dir))

    def handle_exploration_surfaces_get(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Exploration surfaces not configured. Start the server with --specgraph-dir."},
            )
            return
        json_response(self, HTTPStatus.OK, _collect_exploration_surfaces(self.server.specgraph_dir))

    def handle_exploration_proposal_get(self, parsed) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Exploration surfaces not configured. Start the server with --specgraph-dir."},
            )
            return
        params = parse_qs(parsed.query)
        status, payload = _read_proposal_markdown(self.server.specgraph_dir, params.get("file", [""])[0])
        json_response(self, status, payload)

    def handle_proposal_spec_trace_index_get(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Proposal spec trace is not configured. Start the server with --specgraph-dir."},
            )
            return
        json_response(
            self,
            HTTPStatus.OK,
            _read_specgraph_runs_artifact(
                self.server.specgraph_dir,
                "proposal_spec_trace_index.json",
                expected_kind="proposal_spec_trace_index",
            ),
        )

    def _exploration_preview_path(self) -> Path | None:
        if self.server.specgraph_dir is None:
            return None
        return self.server.specgraph_dir / "runs" / "exploration_preview.json"

    def _exploration_build_available(self) -> bool:
        """True only when supervisor.py declares both required flags in its source."""
        return specgraph_surfaces.supervisor_has_flags(
            self.server.specgraph_dir,
            "--build-exploration-preview",
            "--exploration-intent",
        )

    def handle_exploration_preview_get(self) -> None:
        path = self._exploration_preview_path()
        if path is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Exploration preview not configured. Start the server with --specgraph-dir."},
            )
            return
        if not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {
                    "error": "Exploration preview artifact not built yet",
                    "hint": "POST /api/exploration-preview/build to create it",
                    "path": str(path),
                },
            )
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": f"Failed to read exploration preview: {exc}", "path": str(path)},
            )
            return
        if (
            data.get("artifact_kind") != "exploration_preview"
            or data.get("canonical_mutations_allowed") is not False
            or data.get("tracked_artifacts_written") is not False
        ):
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "Artifact failed boundary check",
                    "artifact_kind": data.get("artifact_kind"),
                    "canonical_mutations_allowed": data.get("canonical_mutations_allowed"),
                    "tracked_artifacts_written": data.get("tracked_artifacts_written"),
                },
            )
            return
        mtime = path.stat().st_mtime
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            "data": data,
        })

    def handle_exploration_preview_build(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Exploration preview not configured. Start the server with --specgraph-dir."},
            )
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except (ValueError, json.JSONDecodeError):
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON body"})
            return
        intent = (body.get("intent") or "").strip()
        if not intent:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "intent is required and must not be blank"})
            return
        status, payload = supervisor_build.build_exploration_preview(self.server.specgraph_dir, intent)
        json_response(self, status, payload)

    def handle_reveal(self) -> None:
        """POST /api/reveal — open a file path in Finder (macOS: open -R <path>)."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            path_str = body.get("path", "")
        except Exception:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Invalid request body"})
            return
        if not path_str:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Missing path"})
            return
        path = Path(path_str).resolve()
        if not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": f"Path not found: {path}"})
            return
        try:
            subprocess.Popen(["open", "-R", str(path)])
            json_response(self, HTTPStatus.OK, {"revealed": str(path)})
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

    def handle_spec_graph(self) -> None:
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "Spec graph not configured. Start the server with --spec-dir."},
            )
            return
        json_response(self, HTTPStatus.OK, specgraph.collect_spec_graph_api(self.server.spec_dir))

    def handle_spec_node(self, parsed) -> None:
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "Spec graph not configured. Start the server with --spec-dir."},
            )
            return
        params = parse_qs(parsed.query)
        node_id = params.get("id", [""])[0]
        if not node_id:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: id"})
            return
        nodes, _ = specgraph.load_spec_nodes(self.server.spec_dir)
        detail = specgraph.get_spec_node_detail(nodes, node_id)
        if detail is None:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": f"Spec node '{node_id}' not found"})
            return
        json_response(self, HTTPStatus.OK, {"node_id": node_id, "data": detail})

    def handle_spec_compile(self, parsed) -> None:
        """GET /api/spec-compile?root=<node_id>[&depth=<1-6>][&objective=0][&acceptance=0][&deps=0][&prompt=1]

        Compiles the spec subtree rooted at *root* into a Markdown document.
        Query params map directly to spec_compile.CompileOptions; all optional.
        Returns JSON with 'markdown' (string) and 'manifest' (dict).
        """
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Spec graph not configured. Start the server with --spec-dir."},
            )
            return

        params = parse_qs(parsed.query)
        root_id = params.get("root", [""])[0].strip()
        if not root_id:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: root"})
            return

        def _bool_param(name: str, default: bool) -> bool:
            val = params.get(name, [""])[0]
            if val == "1" or val.lower() == "true":
                return True
            if val == "0" or val.lower() == "false":
                return False
            return default

        def _int_param(name: str, default: int, lo: int, hi: int) -> int:
            try:
                v = int(params.get(name, [""])[0])
                return max(lo, min(hi, v))
            except (ValueError, IndexError):
                return default

        options = spec_compile.CompileOptions(
            max_depth=_int_param("depth", 6, 1, 6),
            include_objective=_bool_param("objective", True),
            include_acceptance=_bool_param("acceptance", True),
            include_depends_on_refs=_bool_param("deps", True),
            include_prompt=_bool_param("prompt", False),
        )

        nodes, load_errors = specgraph.load_spec_nodes(self.server.spec_dir)
        nodes_by_id = spec_compile.index_nodes(nodes)

        if root_id not in nodes_by_id:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": f"Spec node '{root_id}' not found in spec directory."},
            )
            return

        result = spec_compile.compile_spec_tree(nodes_by_id, root_id, options)

        json_response(self, HTTPStatus.OK, {
            "root_id": root_id,
            "markdown": result.markdown,
            "manifest": result.manifest(),
            "load_errors": load_errors,
        })

    def handle_list_files(self) -> None:
        json_response(self, HTTPStatus.OK, collect_workspace_listing(self.server.dialog_dir))

    def handle_graph(self) -> None:
        json_response(self, HTTPStatus.OK, collect_graph_api(self.server.dialog_dir))

    def handle_get_conversation(self, parsed) -> None:
        params = parse_qs(parsed.query)
        conversation_id = params.get("conversation_id", [""])[0]
        status, payload = collect_conversation_api(self.server.dialog_dir, conversation_id)
        json_response(self, status, payload)

    def handle_get_checkpoint(self, parsed) -> None:
        params = parse_qs(parsed.query)
        conversation_id = params.get("conversation_id", [""])[0]
        message_id = params.get("message_id", [""])[0]
        status, payload = collect_checkpoint_api(self.server.dialog_dir, conversation_id, message_id)
        json_response(self, status, payload)

    def handle_get_file(self, parsed) -> None:
        params = parse_qs(parsed.query)
        name = params.get("name", [""])[0]
        filename_errors = schema.validate_file_name(name)
        if filename_errors:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
            )
            return

        path = self.safe_dialog_path(name)
        if not path or not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "File not found"})
            return

        data, errors = load_json_file(path)
        if errors or data is None:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "File contains invalid JSON", "errors": serialize_errors(errors), "name": path.name},
            )
            return

        workspace = collect_workspace_listing(self.server.dialog_dir)
        file_entry = next((file for file in workspace["files"] if file["name"] == path.name), None)

        json_response(
            self,
            HTTPStatus.OK,
            {
                "name": path.name,
                "data": data,
                "validation": file_entry["validation"] if file_entry else serialize_validation("invalid", None, ()),
                "workspace_diagnostics": workspace["diagnostics"],
            },
        )

    def handle_export(self) -> None:
        payload = self.read_json_body()
        if payload is None:
            return
        conversation_id = payload.get("conversation_id", "")
        message_id = payload.get("message_id") or None
        status, response = export_graph_nodes(self.server.dialog_dir, conversation_id, message_id)
        json_response(self, status, response)

    def handle_compile(self) -> None:
        payload = self.read_json_body()
        if payload is None:
            return
        conversation_id = payload.get("conversation_id", "")
        message_id = payload.get("message_id") or None
        status, response = compile_graph_nodes(
            self.server.dialog_dir,
            conversation_id,
            message_id,
            self.server.hyperprompt_binary,
        )
        json_response(self, status, response)

    def handle_write_file(self) -> None:
        payload = self.read_json_body()
        if payload is None:
            return

        name = payload.get("name", "")
        data = payload.get("data")
        overwrite = bool(payload.get("overwrite", False))
        normalized, errors = validate_write_request(self.server.dialog_dir, name, data, overwrite)
        if errors or normalized is None:
            status = HTTPStatus.CONFLICT if errors and errors[0].code == "file_exists" else HTTPStatus.BAD_REQUEST
            message = "File already exists" if status == HTTPStatus.CONFLICT else "Validation failed"
            json_response(
                self,
                status,
                {
                    "error": message,
                    "name": name,
                    "errors": serialize_errors(errors),
                },
            )
            return

        path = self.safe_dialog_path(name)
        if path is None:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {
                    "error": "Invalid file name",
                    "errors": serialize_errors(schema.validate_file_name(name)),
                },
            )
            return

        try:
            path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to write file: {exc}"})
            return

        # Invalidate cache so the next read sees the updated file immediately,
        # even if mtime resolution hasn't advanced (e.g. HFS+ 1-second granularity).
        _get_workspace_cache(self.server.dialog_dir).invalidate()

        validation = schema.validate_conversation(normalized)
        json_response(
            self,
            HTTPStatus.OK,
            {
                "ok": True,
                "name": path.name,
                "data": normalized,
                "validation": serialize_validation(validation.kind, validation.normalized, validation.errors),
            },
        )

    def handle_delete_file(self, parsed) -> None:
        params = parse_qs(parsed.query)
        name = params.get("name", [""])[0]
        filename_errors = schema.validate_file_name(name)
        if filename_errors:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
            )
            return

        path = self.safe_dialog_path(name)
        if not path or not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "File not found"})
            return

        try:
            path.unlink()
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to delete file: {exc}"})
            return

        # Invalidate cache so the next read sees the deletion immediately.
        _get_workspace_cache(self.server.dialog_dir).invalidate()

        json_response(self, HTTPStatus.OK, {"ok": True, "name": name})

    def handle_static(self, request_path: str) -> None:
        dist_dir = self.server.repo_root / "viewer" / "app" / "dist"
        relative = request_path.lstrip("/")

        if not relative:
            path = dist_dir / "index.html"
        else:
            candidate = (dist_dir / relative).resolve()
            if str(candidate).startswith(str(dist_dir.resolve())) and candidate.exists() and not candidate.is_dir():
                path = candidate
            elif "." in relative.split("/")[-1]:
                # Request has a file extension but file not found — 404
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            else:
                # SPA fallback: serve index.html for non-file routes
                path = dist_dir / "index.html"

        if not path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type, _ = mimetypes.guess_type(str(path))
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length)
            decoded = json.loads(payload.decode("utf-8"))
        except Exception as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})
            return None

        if not isinstance(decoded, dict):
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid JSON body: top-level value must be an object."},
            )
            return None

        return decoded

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
