"""Capability response helper for the viewer HTTP server."""

from __future__ import annotations

import os
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer.http_response import JsonResponseHandler, json_response


class CapabilitiesHandler(JsonResponseHandler, Protocol):
    server: Any

    def _exploration_build_available(self) -> bool: ...

    def _graph_dashboard_path(self) -> Any: ...

    def _runs_dir(self) -> Any: ...

    def _viewer_surfaces_build_available(self) -> bool: ...


def build_capabilities(handler: CapabilitiesHandler) -> dict[str, bool]:
    return {
        "spec_graph": handler.server.spec_dir is not None,
        "spec_markdown_export": handler.server.spec_dir is not None,
        "spec_compile": handler.server.spec_dir is not None,
        "hyperprompt_compile": bool(getattr(handler.server, "hyperprompt_compile_available", False)),
        "compile": handler.server.compile_available,
        "graph_dashboard": handler._graph_dashboard_path() is not None,
        "spec_overlay": handler._runs_dir() is not None,
        "specpm_preview": handler.server.specgraph_dir is not None,
        "exploration_preview": handler.server.specgraph_dir is not None,
        "exploration_surfaces": handler.server.specgraph_dir is not None,
        "exploration_preview_build": handler._exploration_build_available(),
        "viewer_surfaces_build": handler._viewer_surfaces_build_available(),
        "agent": bool(getattr(handler.server, "agent_available", False)),
    }


def _path_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _scratch_workspace_diagnostic(work_dir: Any) -> dict[str, Any] | None:
    scratch = _path_text(work_dir)
    if scratch is None:
        return {
            "available": False,
            "status": "scratch_not_configured",
            "detail": "Hyperprompt compile requires an explicit scratch workspace.",
            "scratch_workspace": None,
        }

    path = Path(scratch).expanduser()
    try:
        if not path.exists():
            return {
                "available": False,
                "status": "scratch_missing",
                "detail": "Configured Hyperprompt scratch workspace does not exist.",
                "scratch_workspace": str(path),
            }
        if not path.is_dir():
            return {
                "available": False,
                "status": "scratch_not_directory",
                "detail": "Configured Hyperprompt scratch workspace is not a directory.",
                "scratch_workspace": str(path),
            }
        if not os.access(path, os.W_OK | os.X_OK):
            return {
                "available": False,
                "status": "scratch_not_writable",
                "detail": "Configured Hyperprompt scratch workspace is not writable.",
                "scratch_workspace": str(path),
            }
    except OSError as exc:
        return {
            "available": False,
            "status": "scratch_unreadable",
            "detail": str(exc),
            "scratch_workspace": str(path),
        }

    return None


def build_hyperprompt_compile_diagnostic(
    handler: CapabilitiesHandler,
    *,
    provider_kind: str,
) -> dict[str, Any]:
    server = handler.server
    configured_binary = _path_text(getattr(server, "hyperprompt_binary", None))
    resolved_binary = _path_text(getattr(server, "hyperprompt_resolved_binary", None))
    checked_paths = [
        path
        for path in getattr(server, "hyperprompt_checked_paths", [])
        if isinstance(path, str) and path.strip()
    ]
    resolution_source = _path_text(getattr(server, "hyperprompt_resolution_source", None)) or "missing"
    scratch_workspace = _path_text(getattr(server, "hyperprompt_work_dir", None))
    base: dict[str, Any] = {
        "configured_binary": configured_binary,
        "resolved_binary": resolved_binary,
        "resolution_source": resolution_source,
        "checked_paths": checked_paths,
        "scratch_workspace": scratch_workspace,
    }

    if provider_kind != "file":
        return {
            **base,
            "available": False,
            "status": "provider_unsupported",
            "detail": "Hyperprompt compile requires a local file provider; this deployment exposes readonly Markdown export only.",
        }

    if configured_binary is None:
        return {
            **base,
            "available": False,
            "status": "compiler_missing",
            "detail": "No Hyperprompt compiler binary is configured.",
        }

    if resolved_binary is None:
        return {
            **base,
            "available": False,
            "status": "compiler_missing",
            "detail": "Hyperprompt compiler binary was not found.",
        }

    binary_path = Path(resolved_binary).expanduser()
    if not os.access(binary_path, os.X_OK):
        return {
            **base,
            "available": False,
            "status": "compiler_not_executable",
            "detail": "Configured Hyperprompt compiler binary is not executable.",
        }

    scratch_diagnostic = _scratch_workspace_diagnostic(scratch_workspace)
    if scratch_diagnostic is not None:
        return {**base, **scratch_diagnostic}

    return {
        **base,
        "available": True,
        "status": "available",
        "detail": "Hyperprompt compile is configured for this local SpecSpace deployment.",
    }


def build_capability_diagnostics(
    handler: CapabilitiesHandler,
    *,
    provider_kind: str,
    capabilities: dict[str, bool],
) -> dict[str, dict[str, Any]]:
    markdown_available = bool(capabilities.get("spec_markdown_export"))
    return {
        "spec_markdown_export": {
            "available": markdown_available,
            "status": "available" if markdown_available else "unavailable",
            "detail": (
                "Readonly SpecGraph Markdown export is available."
                if markdown_available
                else "Readonly SpecGraph Markdown export is not available for the configured provider."
            ),
        },
        "hyperprompt_compile": build_hyperprompt_compile_diagnostic(
            handler,
            provider_kind=provider_kind,
        ),
    }


def handle_capabilities(handler: CapabilitiesHandler) -> None:
    json_response(handler, HTTPStatus.OK, build_capabilities(handler))
