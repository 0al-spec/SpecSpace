#!/usr/bin/env python3
"""Minimal JSON dialog viewer server with folder read/write/delete APIs."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import time
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
from viewer import workspace_cache  # noqa: E402
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
_WORKSPACE_CACHES = workspace_cache.WORKSPACE_CACHES
_REGISTRY_LOCK = workspace_cache.REGISTRY_LOCK


def _get_workspace_cache(dialog_dir: Path) -> WorkspaceCache:
    return workspace_cache.get_workspace_cache(dialog_dir, cache_factory=WorkspaceCache)


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


# ---------------------------------------------------------------------------
# SpecWatcher — shared SSE broadcaster
# ---------------------------------------------------------------------------

class SpecWatcher:
    """Single polling thread that broadcasts spec-file changes to all SSE clients.

    One instance lives on the server object.  Its internal thread starts on the
    first client subscription and stops when the last client unsubscribes — so
    there is at most one OS thread doing I/O regardless of how many tabs are open.

    SSE handler threads block on a Condition.wait_for() instead of sleeping,
    which means they use no CPU between events and wake up immediately when a
    change is detected.
    """

    POLL_INTERVAL: float = 1.0       # seconds between directory scans
    KEEPALIVE_TIMEOUT: float = 14.0  # seconds before sending an SSE keepalive comment

    def __init__(self, spec_dir: Path) -> None:
        self._spec_dir = spec_dir
        self._condition = threading.Condition()
        self._seq: int = 0          # bumped on each detected change
        self._client_count: int = 0
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_mtimes(self) -> dict[str, float]:
        result: dict[str, float] = {}
        try:
            with os.scandir(self._spec_dir) as entries:
                for entry in entries:
                    if entry.is_file() and entry.name.endswith((".yaml", ".yml")):
                        result[entry.name] = entry.stat().st_mtime
        except OSError:
            pass
        return result

    def _poll_loop(self) -> None:
        last_mtimes = self._get_mtimes()
        while True:
            time.sleep(self.POLL_INTERVAL)
            # Stop when there are no clients — next subscribe() will restart us.
            with self._condition:
                if self._client_count == 0:
                    self._thread = None
                    return
            # Do I/O without holding the lock.
            current = self._get_mtimes()
            if current != last_mtimes:
                last_mtimes = current
                with self._condition:
                    self._seq += 1
                    self._condition.notify_all()

    # ------------------------------------------------------------------
    # Public API (called from SSE handler threads)
    # ------------------------------------------------------------------

    def subscribe(self) -> int:
        """Register a new SSE client.  Starts the poll thread if needed.

        Returns the current sequence number so the caller can detect the first
        change after it connected.
        """
        with self._condition:
            self._client_count += 1
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(
                    target=self._poll_loop,
                    daemon=True,
                    name="spec-watcher-poll",
                )
                self._thread.start()
            return self._seq

    def unsubscribe(self) -> None:
        """Deregister an SSE client (call in a finally block)."""
        with self._condition:
            self._client_count = max(0, self._client_count - 1)

    def wait_for_change(self, last_seq: int) -> tuple[bool, int]:
        """Block until the seq changes or the keepalive timeout expires.

        Returns ``(changed, new_seq)``.  When *changed* is False a keepalive
        comment is due; the caller should re-enter with the same *last_seq*.
        """
        with self._condition:
            fired = self._condition.wait_for(
                lambda: self._seq != last_seq,
                timeout=self.KEEPALIVE_TIMEOUT,
            )
            return fired, self._seq


class RunsWatcher:
    """Polling watcher for SpecGraph runs/ — broadcasts when new run files
    appear (or any watched run artifact changes mtime). Mirrors SpecWatcher's
    one-thread-many-clients design, but scoped to the runs/ directory. Used by
    the /api/runs-watch SSE endpoint to drive live updates in the Recent
    Changes overlay and GraphSpace artifact panels.
    """

    POLL_INTERVAL: float = 2.0
    KEEPALIVE_TIMEOUT: float = 14.0
    _RUN_FILENAME_RE = re.compile(r"^\d{8}T\d{6}Z-SG-[A-Z]+-\d+-[0-9a-f]+\.json$")
    _WATCHED_ARTIFACT_NAMES = frozenset(
        {
            "spec_activity_feed.json",
            "implementation_work_index.json",
            "proposal_spec_trace_index.json",
            "exploration_preview.json",
        }
    )

    def __init__(self, runs_dir: Path) -> None:
        self._runs_dir = runs_dir
        self._condition = threading.Condition()
        self._seq: int = 0
        self._client_count: int = 0
        self._thread: threading.Thread | None = None

    def _get_mtimes(self) -> dict[str, float]:
        result: dict[str, float] = {}
        try:
            with os.scandir(self._runs_dir) as entries:
                for entry in entries:
                    if not entry.is_file():
                        continue
                    if (
                        self._RUN_FILENAME_RE.match(entry.name)
                        or entry.name in self._WATCHED_ARTIFACT_NAMES
                    ):
                        result[entry.name] = entry.stat().st_mtime
        except OSError:
            pass
        return result

    def _poll_loop(self) -> None:
        last_mtimes = self._get_mtimes()
        while True:
            time.sleep(self.POLL_INTERVAL)
            with self._condition:
                if self._client_count == 0:
                    self._thread = None
                    return
            current = self._get_mtimes()
            if current != last_mtimes:
                last_mtimes = current
                with self._condition:
                    self._seq += 1
                    self._condition.notify_all()

    def subscribe(self) -> int:
        with self._condition:
            self._client_count += 1
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(
                    target=self._poll_loop,
                    daemon=True,
                    name="runs-watcher-poll",
                )
                self._thread.start()
            return self._seq

    def unsubscribe(self) -> None:
        with self._condition:
            self._client_count = max(0, self._client_count - 1)

    def wait_for_change(self, last_seq: int) -> tuple[bool, int]:
        with self._condition:
            fired = self._condition.wait_for(
                lambda: self._seq != last_seq,
                timeout=self.KEEPALIVE_TIMEOUT,
            )
            return fired, self._seq


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
        if self.server.spec_dir is None:
            return None
        p = self.server.spec_dir.parent.parent / "runs"
        return p if p.is_dir() else None

    def _viewer_surfaces_build_available(self) -> bool:
        """True only when supervisor.py declares --build-viewer-surfaces in its source."""
        if self.server.specgraph_dir is None:
            return False
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            return False
        try:
            content = supervisor.read_text(encoding="utf-8", errors="ignore")
            return "--build-viewer-surfaces" in content
        except OSError:
            return False

    def handle_viewer_surfaces_build(self) -> None:
        if self.server.specgraph_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "Viewer surfaces build not configured. Start the server with --specgraph-dir."},
            )
            return
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "supervisor.py not found", "expected": str(supervisor)},
            )
            return
        cmd = [sys.executable, str(supervisor), "--build-viewer-surfaces"]
        built_at = datetime.now(tz=timezone.utc).isoformat()
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "supervisor.py --build-viewer-surfaces timed out", "exit_code": None, "built_at": built_at},
            )
            return
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Failed to invoke supervisor.py: {exc}", "exit_code": None, "built_at": built_at},
            )
            return
        stderr_tail = "\n".join((result.stderr or "").splitlines()[-40:])
        if result.returncode != 0:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "supervisor.py --build-viewer-surfaces failed",
                    "exit_code": result.returncode,
                    "stderr_tail": stderr_tail,
                    "stdout_tail": "\n".join((result.stdout or "").splitlines()[-40:]),
                    "built_at": built_at,
                },
            )
            return
        try:
            report = json.loads(result.stdout) if result.stdout.strip() else {}
        except json.JSONDecodeError:
            report = {}
        json_response(self, HTTPStatus.OK, {"built_at": built_at, "exit_code": 0, "report": report})

    def _graph_dashboard_path(self):
        d = self._runs_dir()
        if d is None:
            return None
        p = d / "graph_dashboard.json"
        return p if p.exists() else None

    def handle_graph_dashboard(self) -> None:
        path = self._graph_dashboard_path()
        if path is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "graph_dashboard.json not found. Run --build-graph-dashboard first."},
            )
            return
        import json as _json
        json_response(self, HTTPStatus.OK, _json.loads(path.read_text()))

    def handle_graph_backlog_projection(self) -> None:
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir."},
            )
            return
        runs = self._runs_dir()
        if runs is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."},
            )
            return
        path = runs / "graph_backlog_projection.json"
        if not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."},
            )
            return
        try:
            raw = path.read_text(encoding="utf-8")
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "graph_backlog_projection.json is not valid JSON", "detail": str(exc)},
            )
            return
        mtime = path.stat().st_mtime
        mtime_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": mtime_iso,
            "data": data,
        })

    def _handle_runs_artifact(self, filename: str, build_hint: str) -> None:
        """Serve a single file from runs/ under the standard envelope, or 503/404/422."""
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir."},
            )
            return
        runs = self._runs_dir()
        if runs is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": f"{filename} not found. Run {build_hint} first."},
            )
            return
        path = runs / filename
        if not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": f"{filename} not found. Run {build_hint} first."},
            )
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": f"{filename} is not valid JSON", "detail": str(exc)},
            )
            return
        mtime = path.stat().st_mtime
        mtime_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": mtime_iso,
            "data": data,
        })

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

    # ── Recent SpecGraph refine runs ────────────────────────────────────────
    # Lists per-spec run events from runs/<timestamp>-<spec_id>-<hash>.json.
    # Each event: { run_id, ts, spec_id, title, run_kind, completion_status,
    #               duration_sec }. Filename gives ts/spec_id/run_id without
    # any IO; the file is opened only to harvest a few small fields from its
    # head (~4KB max).
    _RUN_FILENAME_RE = re.compile(
        r"^(?P<ts>\d{8}T\d{6}Z)-(?P<spec_id>SG-[A-Z]+-\d+)-(?P<hash>[0-9a-f]+)\.json$",
    )

    @staticmethod
    def _parse_iso_compact(stamp: str) -> str:
        """Convert `20260427T204723Z` → ISO 8601 (`2026-04-27T20:47:23Z`)."""
        return f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}T{stamp[9:11]}:{stamp[11:13]}:{stamp[13:15]}Z"

    @staticmethod
    def _harvest_run_meta(path: Path) -> dict[str, Any]:
        """Read the head of a run file and extract a few cheap fields.

        We avoid parsing the (potentially 100s of KB) full payload — the
        fields we need live near the top of the JSON object as written by
        SpecGraph supervisor. Keys absent from the head still return None.
        """
        # Read just enough to cover the documented head fields.
        head_bytes = 4096
        try:
            with path.open("rb") as fh:
                head = fh.read(head_bytes).decode("utf-8", errors="ignore")
        except OSError:
            return {}
        # Try to parse a partial JSON object: append `}` candidates until
        # something parses, then drop unrelated trailing keys. Simpler:
        # regex-extract the specific fields we want. The producer is stable.
        out: dict[str, Any] = {}
        for key in ("title", "run_kind", "completion_status", "execution_profile", "child_model"):
            m = re.search(rf'"{key}"\s*:\s*"([^"]*)"', head)
            if m:
                out[key] = m.group(1)
        m = re.search(r'"run_duration_sec"\s*:\s*([0-9.]+)', head)
        if m:
            try:
                out["duration_sec"] = float(m.group(1))
            except ValueError:
                pass
        return out

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

        events: list[dict[str, Any]] = []
        for entry in runs_dir.iterdir():
            if not entry.is_file() or entry.suffix != ".json":
                continue
            m = self._RUN_FILENAME_RE.match(entry.name)
            if not m:
                continue
            ts_iso = self._parse_iso_compact(m.group("ts"))
            if since_iso is not None and ts_iso <= since_iso:
                continue
            meta = self._harvest_run_meta(entry)
            events.append({
                "run_id": entry.stem,
                "ts": ts_iso,
                "spec_id": m.group("spec_id"),
                "title": meta.get("title"),
                "run_kind": meta.get("run_kind"),
                "completion_status": meta.get("completion_status"),
                "duration_sec": meta.get("duration_sec"),
                "execution_profile": meta.get("execution_profile"),
                "child_model": meta.get("child_model"),
            })

        # Sort descending by timestamp string (ISO 8601 sorts lexicographically).
        events.sort(key=lambda e: e["ts"], reverse=True)
        events = events[:limit]
        json_response(self, HTTPStatus.OK, {"events": events, "total": len(events)})

    def handle_spec_activity(self, parsed) -> None:
        """Serve runs/spec_activity_feed.json with optional limit/since filtering.

        Contract: docs/spec_activity_feed_viewer_contract.md (SpecGraph PR #243).
        Returns the artifact data inside the standard runs envelope. limit/since
        are applied to data.entries[] after loading. since accepts an ISO
        timestamp string and is compared against entry.occurred_at.
        """
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir."},
            )
            return
        runs = self._runs_dir()
        if runs is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."},
            )
            return
        path = runs / "spec_activity_feed.json"
        if not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."},
            )
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "spec_activity_feed.json is not valid JSON", "detail": str(exc)},
            )
            return

        # Optional filtering on entries[] (preserve top-level metadata otherwise).
        qs = parse_qs(parsed.query or "")
        try:
            limit_raw = qs.get("limit", [None])[0]
            limit: int | None = int(limit_raw) if limit_raw is not None else None
        except (TypeError, ValueError):
            limit = 50  # safe default instead of unbounded
        if limit is not None:
            limit = max(1, min(limit, 1000))
        since = qs.get("since", [None])[0]
        since_iso = since if isinstance(since, str) and since else None

        if (limit is not None or since_iso is not None) and isinstance(data, dict):
            entries = data.get("entries") or []
            if isinstance(entries, list):
                if since_iso is not None:
                    entries = [
                        e for e in entries
                        if isinstance(e, dict)
                        and isinstance(e.get("occurred_at"), str)
                        and e["occurred_at"] > since_iso
                    ]
                if limit is not None:
                    entries = entries[:limit]
                data = {**data, "entries": entries, "entry_count": len(entries)}

        mtime = path.stat().st_mtime
        mtime_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": mtime_iso,
            "data": data,
        })

    def handle_implementation_work_index(self, parsed) -> None:
        """Serve runs/implementation_work_index.json inside the standard envelope.

        Contract: SpecGraph/docs/implementation_work_viewer_contract.md.
        Optional ?limit=N caps data.entries[] (default 50, max 1000). No
        ?since here — work items don't carry their own timestamps; the
        artifact's `generated_at` is the only time signal and is preserved
        in the envelope unchanged.
        """
        if self.server.spec_dir is None:
            json_response(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "SpecGraph not configured. Start the server with --spec-dir."},
            )
            return
        runs = self._runs_dir()
        if runs is None:
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first."},
            )
            return
        path = runs / "implementation_work_index.json"
        if not path.exists():
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"error": "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first."},
            )
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "implementation_work_index.json is not valid JSON", "detail": str(exc)},
            )
            return

        qs = parse_qs(parsed.query or "")
        try:
            limit_raw = qs.get("limit", ["50"])[0]
            limit: int | None = int(limit_raw)
        except (TypeError, ValueError):
            limit = 50
        if limit is not None:
            limit = max(1, min(limit, 1000))

        if limit is not None and isinstance(data, dict):
            entries = data.get("entries") or []
            if isinstance(entries, list):
                entries = entries[:limit]
                data = {**data, "entries": entries, "entry_count": len(entries)}

        mtime = path.stat().st_mtime
        mtime_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        json_response(self, HTTPStatus.OK, {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": mtime_iso,
            "data": data,
        })

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
        import json as _json
        out = {}

        # 1. graph_health_overlay.json → entries[].spec_id + { gate_state, signals, recommended_actions, filters }
        health_p = runs / "graph_health_overlay.json"
        if health_p.exists():
            data = _json.loads(health_p.read_text())
            vp = data.get("viewer_projection", {})
            nf = vp.get("named_filters", {})
            # Build reverse map: spec_id → list of active named filters
            spec_filters = {}
            for filter_name, spec_ids in nf.items():
                if not isinstance(spec_ids, list):
                    continue
                for sid in spec_ids:
                    spec_filters.setdefault(sid, []).append(filter_name)
            for entry in data.get("entries", []):
                sid = entry.get("spec_id")
                if not sid:
                    continue
                out.setdefault(sid, {})["health"] = {
                    "gate_state": entry.get("gate_state", "none"),
                    "signals": entry.get("signals", []),
                    "recommended_actions": entry.get("recommended_actions", []),
                    "filters": spec_filters.get(sid, []),
                }

        # 2. spec_trace_projection.json → viewer_projection.implementation_state[state] = [spec_ids]
        trace_p = runs / "spec_trace_projection.json"
        if trace_p.exists():
            data = _json.loads(trace_p.read_text())
            vp = data.get("viewer_projection", {})
            for state_map_key in ("implementation_state", "freshness", "acceptance_coverage"):
                smap = vp.get(state_map_key, {})
                for state, spec_ids in smap.items():
                    if not isinstance(spec_ids, list):
                        continue
                    for sid in spec_ids:
                        node = out.setdefault(sid, {}).setdefault("implementation", {})
                        node[state_map_key] = state
            # named filters for implementation
            nf = vp.get("named_filters", {})
            impl_filters = {}
            for filter_name, spec_ids in nf.items():
                if not isinstance(spec_ids, list):
                    continue
                for sid in spec_ids:
                    impl_filters.setdefault(sid, []).append(filter_name)
            for sid, filters in impl_filters.items():
                out.setdefault(sid, {}).setdefault("implementation", {})["filters"] = filters

        # 3. evidence_plane_overlay.json → viewer_projection.chain_status[status] = [spec_ids]
        ev_p = runs / "evidence_plane_overlay.json"
        if ev_p.exists():
            data = _json.loads(ev_p.read_text())
            vp = data.get("viewer_projection", {})
            for state_map_key in ("chain_status", "artifact_stage", "observation_coverage",
                                  "outcome_coverage", "adoption_coverage"):
                smap = vp.get(state_map_key, {})
                for state, spec_ids in smap.items():
                    if not isinstance(spec_ids, list):
                        continue
                    for sid in spec_ids:
                        node = out.setdefault(sid, {}).setdefault("evidence", {})
                        node[state_map_key] = state
            nf = vp.get("named_filters", {})
            ev_filters = {}
            for filter_name, spec_ids in nf.items():
                if not isinstance(spec_ids, list):
                    continue
                for sid in spec_ids:
                    ev_filters.setdefault(sid, []).append(filter_name)
            for sid, filters in ev_filters.items():
                out.setdefault(sid, {}).setdefault("evidence", {})["filters"] = filters

        json_response(self, HTTPStatus.OK, {"overlays": out})

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
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "supervisor.py not found", "expected": str(supervisor)},
            )
            return
        cmd = [sys.executable, str(supervisor), "--build-specpm-export-preview"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "supervisor.py timed out", "exit_code": None},
            )
            return
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Failed to invoke supervisor.py: {exc}", "exit_code": None},
            )
            return

        preview_path = self._specpm_preview_path()
        stderr_tail = "\n".join((result.stderr or "").splitlines()[-40:])
        built_at = datetime.now(tz=timezone.utc).isoformat()

        if result.returncode != 0:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "supervisor.py failed",
                    "exit_code": result.returncode,
                    "stderr_tail": stderr_tail,
                    "stdout_tail": "\n".join((result.stdout or "").splitlines()[-40:]),
                    "preview_path": str(preview_path) if preview_path else None,
                    "built_at": built_at,
                },
            )
            return

        json_response(
            self,
            HTTPStatus.OK,
            {
                "exit_code": 0,
                "stderr_tail": stderr_tail,
                "preview_path": str(preview_path) if preview_path else None,
                "preview_exists": bool(preview_path and preview_path.exists()),
                "built_at": built_at,
            },
        )

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
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "supervisor.py not found", "expected": str(supervisor)},
            )
            return
        cmd = [sys.executable, str(supervisor), flag]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "supervisor.py timed out", "exit_code": None},
            )
            return
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Failed to invoke supervisor.py: {exc}", "exit_code": None},
            )
            return

        artifact_path = self._specpm_runs_path(artifact_filename)
        stderr_tail = "\n".join((result.stderr or "").splitlines()[-40:])
        built_at = datetime.now(tz=timezone.utc).isoformat()

        if result.returncode != 0:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "supervisor.py failed",
                    "exit_code": result.returncode,
                    "stderr_tail": stderr_tail,
                    "stdout_tail": "\n".join((result.stdout or "").splitlines()[-40:]),
                    "path": str(artifact_path) if artifact_path else None,
                    "built_at": built_at,
                },
            )
            return

        json_response(self, HTTPStatus.OK, {
            "exit_code": 0,
            "stderr_tail": stderr_tail,
            "path": str(artifact_path) if artifact_path else None,
            "artifact_exists": bool(artifact_path and artifact_path.exists()),
            "built_at": built_at,
        })

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
        if self.server.specgraph_dir is None:
            return False
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            return False
        try:
            content = supervisor.read_text(encoding="utf-8", errors="ignore")
            return "--build-exploration-preview" in content and "--exploration-intent" in content
        except OSError:
            return False

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
        supervisor = self.server.specgraph_dir / "tools" / "supervisor.py"
        if not supervisor.exists():
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "supervisor.py not found", "expected": str(supervisor)},
            )
            return
        cmd = [
            sys.executable,
            str(supervisor),
            "--build-exploration-preview",
            "--exploration-intent",
            intent,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "supervisor.py timed out", "exit_code": None},
            )
            return
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Failed to invoke supervisor.py: {exc}", "exit_code": None},
            )
            return
        artifact_path = self._exploration_preview_path()
        stderr_tail = "\n".join((result.stderr or "").splitlines()[-40:])
        built_at = datetime.now(tz=timezone.utc).isoformat()
        if result.returncode != 0:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "supervisor.py failed",
                    "exit_code": result.returncode,
                    "stderr_tail": stderr_tail,
                    "stdout_tail": "\n".join((result.stdout or "").splitlines()[-40:]),
                    "path": str(artifact_path) if artifact_path else None,
                    "built_at": built_at,
                },
            )
            return
        # Validate the built artifact immediately — same boundary guard as GET.
        if artifact_path and artifact_path.exists():
            try:
                built_data = json.loads(artifact_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                json_response(self, HTTPStatus.UNPROCESSABLE_ENTITY, {
                    "error": f"Build succeeded but artifact is unreadable: {exc}",
                    "exit_code": 0,
                    "path": str(artifact_path),
                    "built_at": built_at,
                })
                return
            if (
                built_data.get("artifact_kind") != "exploration_preview"
                or built_data.get("canonical_mutations_allowed") is not False
                or built_data.get("tracked_artifacts_written") is not False
            ):
                json_response(self, HTTPStatus.UNPROCESSABLE_ENTITY, {
                    "error": "Built artifact failed boundary check",
                    "artifact_kind": built_data.get("artifact_kind"),
                    "canonical_mutations_allowed": built_data.get("canonical_mutations_allowed"),
                    "tracked_artifacts_written": built_data.get("tracked_artifacts_written"),
                    "exit_code": 0,
                    "path": str(artifact_path),
                    "built_at": built_at,
                })
                return
        json_response(self, HTTPStatus.OK, {
            "exit_code": 0,
            "stderr_tail": stderr_tail,
            "path": str(artifact_path) if artifact_path else None,
            "artifact_exists": bool(artifact_path and artifact_path.exists()),
            "built_at": built_at,
        })

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

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        def send(line: bytes) -> bool:
            try:
                self.wfile.write(line)
                self.wfile.flush()
                return True
            except (BrokenPipeError, ConnectionResetError, OSError):
                return False

        if not send(b": connected\n\n"):
            return

        last_seq = watcher.subscribe()
        try:
            while True:
                changed, last_seq = watcher.wait_for_change(last_seq)
                if changed:
                    if not send(b"event: change\ndata: {}\n\n"):
                        break
                else:
                    # Keepalive comment — prevents proxy / browser timeout
                    if not send(b": keepalive\n\n"):
                        break
        finally:
            watcher.unsubscribe()

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

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        def send(line: bytes) -> bool:
            try:
                self.wfile.write(line)
                self.wfile.flush()
                return True
            except (BrokenPipeError, ConnectionResetError, OSError):
                return False

        if not send(b": connected\n\n"):
            return

        last_seq = watcher.subscribe()
        try:
            while True:
                changed, last_seq = watcher.wait_for_change(last_seq)
                if changed:
                    if not send(b"event: change\ndata: {}\n\n"):
                        break
                else:
                    if not send(b": keepalive\n\n"):
                        break
        finally:
            watcher.unsubscribe()


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
