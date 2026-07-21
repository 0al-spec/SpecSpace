"""CLI and runtime setup for the viewer HTTP server."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Protocol, cast
import urllib.parse

from viewer import managed_operations_registry, operator_auth, specspace_state_backend


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
    specspace_state_backend: Any
    external_state_enabled: bool
    external_state_url: str | None
    external_state_token: str | None
    external_state_token_file: Path | None
    external_state_timeout_seconds: float
    platform_dir: Path | None
    platform_execution_enabled: bool
    hosted_managed_execution_enabled: bool
    hosted_managed_executor_url: str | None
    hosted_managed_executor_token: str | None
    hosted_managed_executor_token_file: Path | None
    hosted_managed_executor_timeout_seconds: float
    hosted_managed_state_durability: str
    hosted_managed_operation_allowlist: frozenset[str] | None
    operator_auth_enabled: bool
    operator_auth_username: str | None
    operator_auth_password_digest: bytes | None
    operator_auth_allowed_origin: str | None
    allow_legacy_workspace_execution: bool
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
    external_state_enabled_env = os.environ.get(
        "SPECSPACE_EXTERNAL_STATE_ENABLED", ""
    ).strip()
    external_state_url_env = os.environ.get(
        "SPECSPACE_EXTERNAL_STATE_URL", ""
    ).strip()
    external_state_token_env = os.environ.get(
        "SPECSPACE_EXTERNAL_STATE_TOKEN", ""
    ).strip()
    external_state_token_file_env = os.environ.get(
        "SPECSPACE_EXTERNAL_STATE_TOKEN_FILE", ""
    ).strip()
    external_state_timeout_env = os.environ.get(
        "SPECSPACE_EXTERNAL_STATE_TIMEOUT_SECONDS", ""
    ).strip()
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
    allow_legacy_workspace_execution_env = os.environ.get(
        "SPECSPACE_ALLOW_LEGACY_WORKSPACE_EXECUTION",
        "",
    ).strip()
    platform_execution_timeout_env = os.environ.get(
        "SPECSPACE_PLATFORM_EXECUTION_TIMEOUT_SECONDS",
        "",
    ).strip()
    hosted_managed_execution_enabled_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_EXECUTION_ENABLED",
        "",
    ).strip()
    hosted_managed_executor_url_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_EXECUTOR_URL",
        "",
    ).strip()
    hosted_managed_executor_token_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_EXECUTOR_TOKEN",
        "",
    ).strip()
    hosted_managed_executor_token_file_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_EXECUTOR_TOKEN_FILE",
        "",
    ).strip()
    hosted_managed_executor_timeout_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_EXECUTOR_TIMEOUT_SECONDS",
        "",
    ).strip()
    hosted_managed_state_durability_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_STATE_DURABILITY",
        "",
    ).strip()
    hosted_managed_operation_allowlist_env = os.environ.get(
        "SPECSPACE_HOSTED_MANAGED_OPERATION_ALLOWLIST",
        "",
    ).strip()
    operator_auth_enabled_env = os.environ.get(
        "SPECSPACE_OPERATOR_AUTH_ENABLED",
        "",
    ).strip()
    operator_auth_username_env = os.environ.get(
        "SPECSPACE_OPERATOR_AUTH_USERNAME",
        "",
    ).strip()
    operator_auth_password_env = os.environ.get(
        "SPECSPACE_OPERATOR_AUTH_PASSWORD",
        "",
    )
    operator_auth_password_file_env = os.environ.get(
        "SPECSPACE_OPERATOR_AUTH_PASSWORD_FILE",
        "",
    ).strip()
    operator_auth_allowed_origin_env = os.environ.get(
        "SPECSPACE_OPERATOR_AUTH_ALLOWED_ORIGIN",
        "",
    ).strip()
    if (
        hosted_managed_state_durability_env
        and hosted_managed_state_durability_env not in {"persistent", "ephemeral"}
    ):
        raise ValueError("hosted managed state durability is invalid")
    try:
        hosted_managed_executor_timeout_default = float(
            hosted_managed_executor_timeout_env
        )
    except ValueError:
        hosted_managed_executor_timeout_default = 5.0
    try:
        external_state_timeout_default = float(external_state_timeout_env)
    except ValueError:
        external_state_timeout_default = 5.0
    try:
        platform_execution_timeout_default = int(platform_execution_timeout_env)
    except ValueError:
        platform_execution_timeout_default = 120
    parser = argparse.ArgumentParser(description=description)
    parser.set_defaults(
        hosted_managed_executor_token=hosted_managed_executor_token_env or None,
        hosted_managed_executor_token_file=(
            Path(hosted_managed_executor_token_file_env)
            if hosted_managed_executor_token_file_env
            else None
        ),
        external_state_token=external_state_token_env or None,
        external_state_token_file=(
            Path(external_state_token_file_env)
            if external_state_token_file_env
            else None
        ),
        operator_auth_password=operator_auth_password_env or None,
        operator_auth_password_file=(
            Path(operator_auth_password_file_env)
            if operator_auth_password_file_env
            else None
        ),
    )
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
        "--enable-external-state",
        action="store_true",
        default=external_state_enabled_env.lower() in {"1", "true", "yes", "on"},
        help=(
            "Persist SpecSpace-owned mutable state through the authenticated "
            "external state service. The local state directory becomes a "
            "private ephemeral materialization cache."
        ),
    )
    parser.add_argument(
        "--external-state-url",
        default=external_state_url_env or None,
        help=(
            "External SpecSpace state service URL. Plain HTTP is accepted only "
            "for loopback development."
        ),
    )
    parser.add_argument(
        "--external-state-token-file",
        type=Path,
        help="Mounted secret file containing the external state bearer token.",
    )
    parser.add_argument(
        "--external-state-timeout-seconds",
        type=float,
        default=external_state_timeout_default,
        help="Bounded HTTP timeout for external state requests.",
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
        "--enable-hosted-managed-execution",
        action="store_true",
        default=hosted_managed_execution_enabled_env.lower()
        in {"1", "true", "yes", "on"},
        help=(
            "Enqueue allowlisted managed operations through the configured "
            "Platform hosted service instead of invoking local subprocesses."
        ),
    )
    parser.add_argument(
        "--hosted-managed-executor-token-file",
        type=Path,
        help="Mounted secret file containing the hosted executor bearer token.",
    )
    parser.add_argument(
        "--hosted-managed-executor-url",
        default=hosted_managed_executor_url_env or None,
        help=(
            "Platform hosted managed-operation service URL. Plain HTTP is "
            "accepted only for loopback development."
        ),
    )
    parser.add_argument(
        "--hosted-managed-executor-timeout-seconds",
        type=float,
        default=hosted_managed_executor_timeout_default,
        help="Bounded HTTP timeout for hosted enqueue/status requests.",
    )
    parser.add_argument(
        "--hosted-managed-state-durability",
        choices=("persistent", "ephemeral"),
        default=hosted_managed_state_durability_env or "persistent",
        help=(
            "Durability of SpecSpace-owned hosted request state. Ephemeral mode "
            "is restricted to explicitly bounded canary deployments."
        ),
    )
    parser.add_argument(
        "--hosted-managed-operation-allowlist",
        default=hosted_managed_operation_allowlist_env or None,
        help=(
            "Optional comma-separated client-side maximum operation allowlist. "
            "Hosted enqueue rejects operations outside this set even if the "
            "Platform service enables them."
        ),
    )
    parser.add_argument(
        "--platform-execution-timeout-seconds",
        type=int,
        default=platform_execution_timeout_default,
        help="Timeout for allowlisted Platform subprocess calls. Defaults to 120.",
    )
    parser.add_argument(
        "--allow-legacy-workspace-execution",
        action="store_true",
        default=allow_legacy_workspace_execution_env.lower()
        in {"1", "true", "yes", "on"},
        help=(
            "Debug-only migration override allowing managed operations without "
            "a ready durable workspace binding. Disabled by default."
        ),
    )
    parser.add_argument(
        "--enable-operator-auth",
        action="store_true",
        default=operator_auth_enabled_env.lower() in {"1", "true", "yes", "on"},
        help=(
            "Require single-operator HTTP Basic authentication for private "
            "state and managed-operation routes."
        ),
    )
    parser.add_argument(
        "--operator-auth-username",
        default=operator_auth_username_env or "operator",
        help="Single operator username. The password is accepted only through environment or file input.",
    )
    parser.add_argument(
        "--operator-auth-password-file",
        type=Path,
        help="File containing the single-operator password.",
    )
    parser.add_argument(
        "--operator-auth-allowed-origin",
        default=operator_auth_allowed_origin_env or None,
        help=(
            "Exact browser origin allowed to send authenticated mutation "
            "requests, for example https://specgraph.space."
        ),
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


def _operator_username(value: Any) -> str:
    username = value.strip() if isinstance(value, str) else ""
    if (
        not 1 <= len(username) <= 128
        or ":" in username
        or not username.isascii()
        or any(ord(char) < 33 or ord(char) == 127 for char in username)
    ):
        raise ValueError("operator auth username is invalid")
    return username


def _operator_allowed_origin(value: Any) -> str:
    origin = value.strip().rstrip("/") if isinstance(value, str) else ""
    parsed = urllib.parse.urlparse(origin)
    loopback = parsed.hostname in {"127.0.0.1", "::1", "localhost"}
    if (
        not origin
        or parsed.scheme not in {"http", "https"}
        or (parsed.scheme != "https" and not loopback)
        or parsed.hostname is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(
            "operator auth allowed origin must be an HTTPS origin "
            "(HTTP is accepted only for loopback development)"
        )
    return origin


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
    server.operator_auth_enabled = bool(
        getattr(args, "enable_operator_auth", False)
    )
    operator_auth_password = getattr(args, "operator_auth_password", None)
    operator_auth_password_file = getattr(args, "operator_auth_password_file", None)
    if operator_auth_password and operator_auth_password_file is not None:
        raise ValueError(
            "operator auth password must use either environment or file input, not both"
        )
    if operator_auth_password_file is not None:
        password_path = Path(operator_auth_password_file)
        if password_path.is_symlink() or not password_path.is_file():
            raise ValueError("operator auth password file is unavailable")
        try:
            operator_auth_password = password_path.read_text(
                encoding="utf-8"
            ).strip()
        except OSError as exc:
            raise ValueError("operator auth password file is unreadable") from exc
    if server.operator_auth_enabled:
        server.operator_auth_username = _operator_username(
            getattr(args, "operator_auth_username", None)
        )
        if (
            not isinstance(operator_auth_password, str)
            or len(operator_auth_password) < 32
            or len(operator_auth_password) > 4096
            or any(ord(char) < 32 or ord(char) == 127 for char in operator_auth_password)
        ):
            raise ValueError(
                "operator auth password must contain 32 to 4096 printable characters"
            )
        server.operator_auth_password_digest = operator_auth.password_digest(
            operator_auth_password
        )
        args.operator_auth_password = None
        server.operator_auth_allowed_origin = _operator_allowed_origin(
            getattr(args, "operator_auth_allowed_origin", None)
        )
    else:
        server.operator_auth_username = None
        server.operator_auth_password_digest = None
        server.operator_auth_allowed_origin = None
    server.external_state_enabled = bool(
        getattr(args, "enable_external_state", False)
    )
    external_state_url = getattr(args, "external_state_url", None)
    server.external_state_url = (
        external_state_url.strip().rstrip("/")
        if isinstance(external_state_url, str) and external_state_url.strip()
        else None
    )
    external_state_token = getattr(args, "external_state_token", None)
    external_state_token_file = getattr(args, "external_state_token_file", None)
    if external_state_token and external_state_token_file is not None:
        raise ValueError(
            "external state token must use either environment or file input, not both"
        )
    if external_state_token_file is not None:
        token_path = Path(external_state_token_file)
        if token_path.is_symlink() or not token_path.is_file():
            raise ValueError("external state token file is unavailable")
        try:
            external_state_token = token_path.read_text(
                encoding="utf-8"
            ).strip()
        except OSError as exc:
            raise ValueError("external state token file is unreadable") from exc
    server.external_state_token = external_state_token
    server.external_state_token_file = external_state_token_file
    server.external_state_timeout_seconds = float(
        getattr(args, "external_state_timeout_seconds", 5.0)
    )
    if not 0.1 <= server.external_state_timeout_seconds <= 30:
        raise ValueError(
            "external state timeout must be between 0.1 and 30 seconds"
        )
    if server.external_state_enabled:
        if server.external_state_url is None:
            raise ValueError("external state URL is required")
        parsed_external_state_url = urllib.parse.urlparse(
            server.external_state_url
        )
        if (
            parsed_external_state_url.username is not None
            or parsed_external_state_url.password is not None
            or parsed_external_state_url.query
            or parsed_external_state_url.fragment
        ):
            raise ValueError(
                "external state URL must not contain credentials, query, or fragment"
            )
        loopback = parsed_external_state_url.hostname in {
            "127.0.0.1",
            "::1",
            "localhost",
            "specspace-state-service",
        }
        if parsed_external_state_url.scheme != "https" and not (
            parsed_external_state_url.scheme == "http" and loopback
        ):
            raise ValueError(
                "external state URL must use HTTPS outside loopback development"
            )
        if not isinstance(external_state_token, str) or len(
            external_state_token
        ) < 32:
            raise ValueError(
                "external state service token must contain at least 32 characters"
            )
        try:
            server.specspace_state_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise ValueError(
                "external state materialization directory is not writable: "
                f"{server.specspace_state_dir}"
            ) from exc
        server.specspace_state_backend = (
            specspace_state_backend.ExternalHTTPStateBackend(
                config=specspace_state_backend.ExternalStateConfig(
                    base_url=server.external_state_url,
                    token=external_state_token,
                    timeout_seconds=server.external_state_timeout_seconds,
                ),
                materialization_root=server.specspace_state_dir,
            )
        )
    else:
        server.specspace_state_backend = specspace_state_backend.FileStateBackend(
            server.specspace_state_dir
        )
    platform_dir = getattr(args, "platform_dir", None)
    server.platform_dir = platform_dir.expanduser().resolve() if platform_dir else None
    server.platform_execution_enabled = bool(
        getattr(args, "enable_platform_execution", False)
    )
    server.hosted_managed_execution_enabled = bool(
        getattr(args, "enable_hosted_managed_execution", False)
    )
    if (
        server.external_state_enabled
        or server.platform_execution_enabled
        or server.hosted_managed_execution_enabled
    ) and not server.operator_auth_enabled:
        raise ValueError(
            "mutable external state and managed execution require operator authentication"
        )
    if server.hosted_managed_execution_enabled:
        try:
            server.specspace_state_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise ValueError(
                "hosted managed state directory is not writable: "
                f"{server.specspace_state_dir}"
            ) from exc
    hosted_executor_url = getattr(args, "hosted_managed_executor_url", None)
    server.hosted_managed_executor_url = (
        hosted_executor_url.strip().rstrip("/")
        if isinstance(hosted_executor_url, str) and hosted_executor_url.strip()
        else None
    )
    hosted_executor_token = getattr(
        args,
        "hosted_managed_executor_token",
        None,
    )
    hosted_executor_token_file = getattr(
        args,
        "hosted_managed_executor_token_file",
        None,
    )
    if hosted_executor_token and hosted_executor_token_file is not None:
        raise ValueError(
            "hosted executor token must use either environment or file input, not both"
        )
    if hosted_executor_token_file is not None:
        try:
            hosted_executor_token = Path(hosted_executor_token_file).read_text(
                encoding="utf-8"
            ).strip()
        except OSError as exc:
            raise ValueError("hosted executor token file is unreadable") from exc
    server.hosted_managed_executor_token = hosted_executor_token
    server.hosted_managed_executor_token_file = hosted_executor_token_file
    server.hosted_managed_executor_timeout_seconds = float(
        getattr(args, "hosted_managed_executor_timeout_seconds", 5.0)
    )
    hosted_state_durability = str(
        getattr(args, "hosted_managed_state_durability", "persistent")
    )
    if hosted_state_durability not in {"persistent", "ephemeral"}:
        raise ValueError("hosted managed state durability is invalid")
    server.hosted_managed_state_durability = hosted_state_durability
    raw_hosted_allowlist = getattr(args, "hosted_managed_operation_allowlist", None)
    if isinstance(raw_hosted_allowlist, str) and raw_hosted_allowlist.strip():
        values = [item.strip() for item in raw_hosted_allowlist.split(",")]
        if any(not item or not item.replace("_", "").isalnum() for item in values):
            raise ValueError("hosted managed operation allowlist is invalid")
        if len(values) != len(set(values)):
            raise ValueError("hosted managed operation allowlist contains duplicates")
        registered_operation_ids = {
            operation.operation_id
            for operation in managed_operations_registry.MANAGED_OPERATIONS
        }
        unknown_operation_ids = sorted(set(values) - registered_operation_ids)
        if unknown_operation_ids:
            raise ValueError(
                "hosted managed operation allowlist contains unknown operation ids: "
                + ", ".join(unknown_operation_ids)
            )
        server.hosted_managed_operation_allowlist = frozenset(values)
    else:
        server.hosted_managed_operation_allowlist = None
    if (
        server.hosted_managed_state_durability == "ephemeral"
        and not server.hosted_managed_operation_allowlist
    ):
        raise ValueError(
            "ephemeral hosted managed state requires an explicit operation allowlist"
        )
    server.allow_legacy_workspace_execution = bool(
        getattr(args, "allow_legacy_workspace_execution", False)
    )
    server.platform_execution_timeout_seconds = int(
        getattr(args, "platform_execution_timeout_seconds", 120)
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
