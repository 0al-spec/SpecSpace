"""CLI and runtime setup for the viewer HTTP server."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Protocol, cast


ResolveHyperpromptBinary = Callable[[str], tuple[str | None, list[str], str]]


class ViewerRuntimeServer(Protocol):
    repo_root: Path
    dialog_dir: Path
    workspace_watcher: Any
    hyperprompt_binary: str
    hyperprompt_resolved_binary: str | None
    hyperprompt_checked_paths: list[str]
    hyperprompt_resolution_source: str
    hyperprompt_work_dir: Path | None
    hyperprompt_http_compile_enabled: bool
    hyperprompt_compile_timeout_seconds: str | None
    hyperprompt_max_input_bytes: str | None
    hyperprompt_max_output_bytes: str | None
    hyperprompt_bundle_retention_count: str | None
    hyperprompt_compile_available: bool
    compile_available: bool
    spec_dir: Path | None
    spec_watcher: Any
    specgraph_dir: Path | None
    runs_dir: Path | None
    runs_watcher: Any
    artifact_base_url: str | None
    team_decision_log_artifact_base_url: str | None
    product_workspace_artifact_base_urls: dict[str, str]
    specpm_registry_url: str | None
    agent_workbench_dir: Path | None
    specspace_state_dir: Path
    platform_dir: Path | None
    platform_execution_enabled: bool
    platform_execution_timeout_seconds: int
    agent_available: bool

    def serve_forever(self) -> None: ...


def build_arg_parser(
    *,
    description: str | None,
    default_hyperprompt_binary: str,
) -> argparse.ArgumentParser:
    hyperprompt_work_dir_env = os.environ.get("SPECSPACE_HYPERPROMPT_WORK_DIR", "").strip()
    http_compile_enabled_env = os.environ.get("SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED", "").strip()
    agent_workbench_dir_env = os.environ.get("SPECSPACE_AGENT_WORKBENCH_DIR", "").strip()
    specspace_state_dir_env = os.environ.get("SPECSPACE_STATE_DIR", "").strip()
    team_decision_log_artifact_base_url_env = os.environ.get(
        "SPECSPACE_TEAM_DECISION_LOG_ARTIFACT_BASE_URL",
        "",
    ).strip()
    product_workspace_artifact_base_urls_env = os.environ.get(
        "SPECSPACE_PRODUCT_WORKSPACE_ARTIFACT_BASE_URLS",
        "",
    ).strip()
    platform_dir_env = os.environ.get("SPECSPACE_PLATFORM_DIR", "").strip()
    platform_execution_enabled_env = os.environ.get(
        "SPECSPACE_PLATFORM_EXECUTION_ENABLED",
        "",
    ).strip()
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host interface to bind. Use 0.0.0.0 inside container deployments.",
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--dialog-dir", type=Path, required=True)
    parser.add_argument(
        "--hyperprompt-binary",
        type=str,
        default=default_hyperprompt_binary,
        help="Path to the Hyperprompt compiler binary",
    )
    parser.add_argument(
        "--hyperprompt-work-dir",
        type=Path,
        default=Path(hyperprompt_work_dir_env) if hyperprompt_work_dir_env else None,
        help=(
            "Explicit scratch workspace for optional SpecSpace Hyperprompt compile. "
            "When omitted, /api/v1/capabilities reports Hyperprompt compile as unavailable."
        ),
    )
    parser.add_argument(
        "--enable-http-hyperprompt-compile",
        action="store_true",
        default=http_compile_enabled_env.lower() in {"1", "true", "yes", "on"},
        help="Allow Hyperprompt compile for HTTP artifact providers when scratch and limits are configured.",
    )
    parser.add_argument(
        "--hyperprompt-compile-timeout-seconds",
        default=os.environ.get("SPECSPACE_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS"),
        help="Hyperprompt compile timeout in seconds. Defaults to 60.",
    )
    parser.add_argument(
        "--hyperprompt-max-input-bytes",
        default=os.environ.get("SPECSPACE_HYPERPROMPT_MAX_INPUT_BYTES"),
        help="Maximum generated Markdown input size for Hyperprompt compile. Defaults to 1048576.",
    )
    parser.add_argument(
        "--hyperprompt-max-output-bytes",
        default=os.environ.get("SPECSPACE_HYPERPROMPT_MAX_OUTPUT_BYTES"),
        help="Maximum compiled Markdown bytes returned by the API. Defaults to 2097152.",
    )
    parser.add_argument(
        "--hyperprompt-bundle-retention-count",
        default=os.environ.get("SPECSPACE_HYPERPROMPT_BUNDLE_RETENTION_COUNT"),
        help="Number of SpecSpace-owned Hyperprompt bundles to retain. Defaults to 20.",
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
        "--runs-dir",
        type=Path,
        default=None,
        help="Path to a SpecGraph runs directory. Defaults to a path derived from --spec-dir or --specgraph-dir.",
    )
    parser.add_argument(
        "--artifact-base-url",
        type=str,
        default=os.environ.get("SPECSPACE_ARTIFACT_BASE_URL"),
        help=(
            "Base URL for a static SpecGraph artifact site. When set, SpecSpace "
            "reads artifact_manifest.json, specs/nodes/*.yaml, and runs/*.json over HTTP."
        ),
    )
    parser.add_argument(
        "--team-decision-log-artifact-base-url",
        type=str,
        default=team_decision_log_artifact_base_url_env or None,
        help=(
            "Compatibility alias for --product-workspace-artifact-base-url "
            "team-decision-log=URL."
        ),
    )
    parser.add_argument(
        "--product-workspace-artifact-base-url",
        action="append",
        default=[],
        metavar="WORKSPACE_ID=URL",
        help=(
            "Static artifact base URL for one product workspace. Repeat for "
            "multiple workspaces. Product workspaces never fall back to the "
            "bootstrap artifact base URL."
        ),
    )
    parser.add_argument(
        "--product-workspace-artifact-base-urls-json",
        default=product_workspace_artifact_base_urls_env or None,
        help=(
            "JSON object mapping product workspace ids to static artifact base "
            "URLs. Defaults to SPECSPACE_PRODUCT_WORKSPACE_ARTIFACT_BASE_URLS."
        ),
    )
    parser.add_argument(
        "--specpm-registry-url",
        type=str,
        default=os.environ.get("SPECSPACE_SPECPM_REGISTRY_URL"),
        help=(
            "Base URL for a read-only SpecPM public registry. When set, "
            "SpecSpace exposes it in /api/v1/health for registry-backed metadata."
        ),
    )
    parser.add_argument(
        "--agent",
        action="store_true",
        default=False,
        help="Enable the AgentChat panel in the UI",
    )
    parser.add_argument(
        "--agent-workbench-dir",
        type=Path,
        default=Path(agent_workbench_dir_env) if agent_workbench_dir_env else None,
        help=(
            "Optional SpecSpace-owned Agent Workbench artifact store. "
            "Readonly APIs expect workbench/conversations/index.json and conversation artifacts."
        ),
    )
    parser.add_argument(
        "--specspace-state-dir",
        type=Path,
        default=Path(specspace_state_dir_env) if specspace_state_dir_env else None,
        help=(
            "SpecSpace-owned local state directory for operator workflow state. "
            "Defaults to .specspace-dev/state under the repository root."
        ),
    )
    parser.add_argument(
        "--platform-dir",
        type=Path,
        default=Path(platform_dir_env) if platform_dir_env else None,
        help=(
            "Optional Platform repository root used only by explicitly enabled "
            "managed execution endpoints."
        ),
    )
    parser.add_argument(
        "--enable-platform-execution",
        action="store_true",
        default=platform_execution_enabled_env.lower() in {"1", "true", "yes", "on"},
        help=(
            "Enable allowlisted SpecSpace backend calls into Platform. The "
            "browser still receives no direct execution authority."
        ),
    )
    parser.add_argument(
        "--platform-execution-timeout-seconds",
        type=int,
        default=int(os.environ.get("SPECSPACE_PLATFORM_EXECUTION_TIMEOUT_SECONDS", "120")),
        help="Timeout for allowlisted Platform subprocess calls. Defaults to 120.",
    )
    return parser


def _normalize_workspace_id_for_url_map(value: str) -> str | None:
    normalized = value.strip().lower().replace("_", "-")
    if (
        len(normalized) < 3
        or len(normalized) > 64
        or not normalized[0].isalnum()
        or not normalized[-1].isalnum()
    ):
        return None
    if any(not (char.isalnum() or char == "-") for char in normalized):
        return None
    return normalized


def product_workspace_artifact_base_urls_from_args(
    args: argparse.Namespace,
) -> dict[str, str]:
    urls: dict[str, str] = {}
    raw_json = getattr(args, "product_workspace_artifact_base_urls_json", None)
    if isinstance(raw_json, str) and raw_json.strip():
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict):
            for key, value in payload.items():
                workspace_id = _normalize_workspace_id_for_url_map(str(key))
                if workspace_id is not None and isinstance(value, str) and value.strip():
                    urls[workspace_id] = value.strip()

    for entry in getattr(args, "product_workspace_artifact_base_url", []) or []:
        if not isinstance(entry, str) or "=" not in entry:
            continue
        raw_workspace_id, raw_url = entry.split("=", 1)
        workspace_id = _normalize_workspace_id_for_url_map(raw_workspace_id)
        if workspace_id is not None and raw_url.strip():
            urls[workspace_id] = raw_url.strip()

    legacy_team_url = getattr(args, "team_decision_log_artifact_base_url", None)
    if isinstance(legacy_team_url, str) and legacy_team_url.strip():
        urls.setdefault("team-decision-log", legacy_team_url.strip())
    return urls


def runs_watch_path(spec_dir: Path | None, specgraph_dir: Path | None) -> Path | None:
    if spec_dir is not None:
        return spec_dir.parent.parent / "runs"
    if specgraph_dir is not None:
        return specgraph_dir / "runs"
    return None


def configure_server(
    server: ViewerRuntimeServer,
    args: argparse.Namespace,
    *,
    repo_root: Path,
    resolve_hyperprompt_binary: ResolveHyperpromptBinary,
    workspace_watcher_factory: Callable[[Path], Any],
    spec_watcher_factory: Callable[[Path], Any],
    runs_watcher_factory: Callable[[Path], Any],
) -> None:
    server.repo_root = repo_root
    server.dialog_dir = args.dialog_dir.expanduser().resolve()
    server.dialog_dir.mkdir(parents=True, exist_ok=True)
    server.workspace_watcher = workspace_watcher_factory(server.dialog_dir)
    server.hyperprompt_binary = args.hyperprompt_binary
    resolved_binary, checked_paths, resolution_source = resolve_hyperprompt_binary(args.hyperprompt_binary)
    server.hyperprompt_resolved_binary = resolved_binary
    server.hyperprompt_checked_paths = checked_paths
    server.hyperprompt_resolution_source = resolution_source
    hyperprompt_work_dir = getattr(args, "hyperprompt_work_dir", None)
    server.hyperprompt_work_dir = hyperprompt_work_dir.expanduser().resolve() if hyperprompt_work_dir else None
    server.hyperprompt_http_compile_enabled = bool(args.enable_http_hyperprompt_compile)
    server.hyperprompt_compile_timeout_seconds = args.hyperprompt_compile_timeout_seconds
    server.hyperprompt_max_input_bytes = args.hyperprompt_max_input_bytes
    server.hyperprompt_max_output_bytes = args.hyperprompt_max_output_bytes
    server.hyperprompt_bundle_retention_count = args.hyperprompt_bundle_retention_count
    server.hyperprompt_compile_available = False
    server.compile_available = resolved_binary is not None
    server.spec_dir = args.spec_dir.expanduser().resolve() if args.spec_dir else None
    server.spec_watcher = spec_watcher_factory(server.spec_dir) if server.spec_dir else None
    server.specgraph_dir = args.specgraph_dir.expanduser().resolve() if args.specgraph_dir else None
    server.runs_dir = args.runs_dir.expanduser().resolve() if args.runs_dir else runs_watch_path(
        server.spec_dir,
        server.specgraph_dir,
    )
    server.runs_watcher = runs_watcher_factory(server.runs_dir) if server.runs_dir is not None else None
    artifact_base_url = getattr(args, "artifact_base_url", None)
    server.artifact_base_url = artifact_base_url.strip() if artifact_base_url else None
    team_decision_log_artifact_base_url = getattr(
        args,
        "team_decision_log_artifact_base_url",
        None,
    )
    server.team_decision_log_artifact_base_url = (
        team_decision_log_artifact_base_url.strip()
        if team_decision_log_artifact_base_url
        else None
    )
    server.product_workspace_artifact_base_urls = (
        product_workspace_artifact_base_urls_from_args(args)
    )
    specpm_registry_url = getattr(args, "specpm_registry_url", None)
    server.specpm_registry_url = specpm_registry_url.strip().rstrip("/") if specpm_registry_url else None
    agent_workbench_dir = getattr(args, "agent_workbench_dir", None)
    server.agent_workbench_dir = agent_workbench_dir.expanduser().resolve() if agent_workbench_dir else None
    specspace_state_dir = getattr(args, "specspace_state_dir", None)
    server.specspace_state_dir = (
        specspace_state_dir.expanduser().resolve()
        if specspace_state_dir
        else repo_root / ".specspace-dev" / "state"
    )
    platform_dir = getattr(args, "platform_dir", None)
    server.platform_dir = platform_dir.expanduser().resolve() if platform_dir else None
    server.platform_execution_enabled = bool(args.enable_platform_execution)
    server.platform_execution_timeout_seconds = int(
        args.platform_execution_timeout_seconds
    )
    server.agent_available = args.agent


def serve(
    handler_class: type[BaseHTTPRequestHandler],
    *,
    description: str | None,
    repo_root: Path,
    default_hyperprompt_binary: str,
    resolve_hyperprompt_binary: ResolveHyperpromptBinary,
    workspace_watcher_factory: Callable[[Path], Any],
    spec_watcher_factory: Callable[[Path], Any],
    runs_watcher_factory: Callable[[Path], Any],
) -> None:
    parser = build_arg_parser(
        description=description,
        default_hyperprompt_binary=default_hyperprompt_binary,
    )
    args = parser.parse_args()

    server = cast(ViewerRuntimeServer, ThreadingHTTPServer((args.host, args.port), handler_class))
    configure_server(
        server,
        args,
        repo_root=repo_root,
        resolve_hyperprompt_binary=resolve_hyperprompt_binary,
        workspace_watcher_factory=workspace_watcher_factory,
        spec_watcher_factory=spec_watcher_factory,
        runs_watcher_factory=runs_watcher_factory,
    )

    print(f"Serving ContextBuilder at http://{args.host}:{args.port}/")
    print(f"Dialog folder: {server.dialog_dir}")
    server.serve_forever()
