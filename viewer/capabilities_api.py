"""Capability response helper for the viewer HTTP server."""

from __future__ import annotations

import os
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer import agent_workbench
from viewer.http_response import JsonResponseHandler, json_response

DEFAULT_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS = 60
DEFAULT_HYPERPROMPT_MAX_INPUT_BYTES = 1_048_576
DEFAULT_HYPERPROMPT_MAX_OUTPUT_BYTES = 2_097_152
DEFAULT_HYPERPROMPT_BUNDLE_RETENTION_COUNT = 20
MAX_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS = 300
MAX_HYPERPROMPT_MAX_INPUT_BYTES = 10_485_760
MAX_HYPERPROMPT_MAX_OUTPUT_BYTES = 20_971_520
MAX_HYPERPROMPT_BUNDLE_RETENTION_COUNT = 100
DEFAULT_AGENT_PASSPORT_BINARY = Path(__file__).resolve().parents[1] / "deps" / "agent-passport"


class CapabilitiesHandler(JsonResponseHandler, Protocol):
    server: Any

    def _exploration_build_available(self) -> bool: ...

    def _graph_dashboard_path(self) -> Any: ...

    def _runs_dir(self) -> Any: ...

    def _viewer_surfaces_build_available(self) -> bool: ...


def build_capabilities(handler: CapabilitiesHandler) -> dict[str, bool]:
    agent_passport = build_agent_passport_cli_diagnostic(handler)
    return {
        "spec_graph": handler.server.spec_dir is not None,
        "spec_markdown_export": handler.server.spec_dir is not None,
        "spec_compile": handler.server.spec_dir is not None,
        "compile": handler.server.compile_available,
        "graph_dashboard": handler._graph_dashboard_path() is not None,
        "spec_overlay": handler._runs_dir() is not None,
        "specpm_preview": handler.server.specgraph_dir is not None,
        "exploration_preview": handler.server.specgraph_dir is not None,
        "exploration_surfaces": handler.server.specgraph_dir is not None,
        "exploration_preview_build": handler._exploration_build_available(),
        "viewer_surfaces_build": handler._viewer_surfaces_build_available(),
        "agent": bool(getattr(handler.server, "agent_available", False)),
        "agent_workbench_conversations": agent_workbench.agent_workbench_read_available(handler.server),
        "agent_workbench_writes": False,
        "agent_passport_cli": bool(agent_passport["available"]),
    }


def _path_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _server_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _server_positive_int(
    server: Any,
    attr: str,
    *,
    default: int,
    minimum: int = 1,
    maximum: int,
) -> tuple[int | None, dict[str, Any] | None]:
    raw = getattr(server, attr, None)
    if raw is None or raw == "":
        return default, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, {
            "field": attr,
            "value": raw,
            "message": f"{attr} must be an integer.",
        }
    if value < minimum or value > maximum:
        return None, {
            "field": attr,
            "value": raw,
            "message": f"{attr} must be between {minimum} and {maximum}.",
        }
    return value, None


def hyperprompt_compile_limits(server: Any) -> tuple[dict[str, int], dict[str, Any] | None]:
    fields = [
        (
            "hyperprompt_compile_timeout_seconds",
            "timeout_seconds",
            DEFAULT_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS,
            MAX_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS,
        ),
        (
            "hyperprompt_max_input_bytes",
            "max_input_bytes",
            DEFAULT_HYPERPROMPT_MAX_INPUT_BYTES,
            MAX_HYPERPROMPT_MAX_INPUT_BYTES,
        ),
        (
            "hyperprompt_max_output_bytes",
            "max_output_bytes",
            DEFAULT_HYPERPROMPT_MAX_OUTPUT_BYTES,
            MAX_HYPERPROMPT_MAX_OUTPUT_BYTES,
        ),
        (
            "hyperprompt_bundle_retention_count",
            "bundle_retention_count",
            DEFAULT_HYPERPROMPT_BUNDLE_RETENTION_COUNT,
            MAX_HYPERPROMPT_BUNDLE_RETENTION_COUNT,
        ),
    ]
    limits: dict[str, int] = {}
    for attr, key, default, maximum in fields:
        value, error = _server_positive_int(server, attr, default=default, maximum=maximum)
        if error is not None:
            return limits, error
        assert value is not None
        limits[key] = value
    return limits, None


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
    http_compile_enabled = _server_bool(getattr(server, "hyperprompt_http_compile_enabled", False))
    limits, limit_error = hyperprompt_compile_limits(server)
    base: dict[str, Any] = {
        "configured_binary": configured_binary,
        "resolved_binary": resolved_binary,
        "resolution_source": resolution_source,
        "checked_paths": checked_paths,
        "scratch_workspace": scratch_workspace,
        "http_compile_enabled": http_compile_enabled,
        "limits": limits,
    }

    if provider_kind in {"http", "http-product-workspace"} and not http_compile_enabled:
        return {
            **base,
            "available": False,
            "status": "http_compile_disabled",
            "detail": "Hyperprompt compile for HTTP artifact providers requires an explicit feature flag.",
        }

    if provider_kind not in {"file", "file-product-workspace", "http", "http-product-workspace"}:
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

    if limit_error is not None:
        return {
            **base,
            "available": False,
            "status": "invalid_limit",
            "detail": limit_error["message"],
            "limit_error": limit_error,
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
        "detail": "Hyperprompt compile is configured for this SpecSpace deployment.",
    }


def build_agent_passport_cli_diagnostic(handler: CapabilitiesHandler) -> dict[str, Any]:
    configured_binary = (
        _path_text(getattr(handler.server, "agent_passport_binary", None))
        or str(DEFAULT_AGENT_PASSPORT_BINARY)
    )
    binary_path = Path(configured_binary).expanduser()
    base: dict[str, Any] = {
        "configured_binary": configured_binary,
        "resolved_binary": str(binary_path),
        "checked_paths": [configured_binary],
    }

    try:
        if not binary_path.exists():
            return {
                **base,
                "available": False,
                "status": "binary_missing",
                "detail": "Agent Passport CLI binary was not found.",
            }
        if not binary_path.is_file():
            return {
                **base,
                "available": False,
                "status": "binary_not_file",
                "detail": "Configured Agent Passport CLI path is not a file.",
            }
        if not os.access(binary_path, os.X_OK):
            return {
                **base,
                "available": False,
                "status": "binary_not_executable",
                "detail": "Configured Agent Passport CLI binary is not executable.",
            }
    except OSError as exc:
        return {
            **base,
            "available": False,
            "status": "binary_unreadable",
            "detail": str(exc),
        }

    return {
        **base,
        "available": True,
        "status": "available",
        "detail": "Agent Passport validation CLI is bundled with this SpecSpace deployment.",
    }


def build_capability_diagnostics(
    handler: CapabilitiesHandler,
    *,
    provider_kind: str,
    capabilities: dict[str, bool],
) -> dict[str, dict[str, Any]]:
    markdown_available = bool(capabilities.get("spec_markdown_export"))
    agent_workbench_available = bool(capabilities.get("agent_workbench_conversations"))
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
        "agent_passport_cli": build_agent_passport_cli_diagnostic(handler),
        "agent_workbench_conversations": {
            "available": agent_workbench_available,
            "status": "available" if agent_workbench_available else "unavailable",
            "detail": (
                "Readonly Agent Workbench conversation artifacts are available."
                if agent_workbench_available
                else "Readonly Agent Workbench conversation artifacts are not configured."
            ),
            "source": agent_workbench.agent_workbench_source(handler.server),
            "writes_available": False,
        },
    }


def handle_capabilities(handler: CapabilitiesHandler) -> None:
    json_response(handler, HTTPStatus.OK, build_capabilities(handler))
