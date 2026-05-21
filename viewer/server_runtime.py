"""CLI and runtime setup for the viewer HTTP server."""

from __future__ import annotations

import argparse
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
    hyperprompt_compile_available: bool
    compile_available: bool
    spec_dir: Path | None
    spec_watcher: Any
    specgraph_dir: Path | None
    runs_dir: Path | None
    runs_watcher: Any
    artifact_base_url: str | None
    specpm_registry_url: str | None
    agent_workbench_dir: Path | None
    agent_available: bool

    def serve_forever(self) -> None: ...


def build_arg_parser(
    *,
    description: str | None,
    default_hyperprompt_binary: str,
) -> argparse.ArgumentParser:
    hyperprompt_work_dir_env = os.environ.get("SPECSPACE_HYPERPROMPT_WORK_DIR", "").strip()
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
        default=Path(os.environ["SPECSPACE_AGENT_WORKBENCH_DIR"])
        if os.environ.get("SPECSPACE_AGENT_WORKBENCH_DIR")
        else None,
        help=(
            "Optional SpecSpace-owned Agent Workbench artifact store. "
            "Readonly APIs expect workbench/conversations/index.json and conversation artifacts."
        ),
    )
    return parser


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
    specpm_registry_url = getattr(args, "specpm_registry_url", None)
    server.specpm_registry_url = specpm_registry_url.strip().rstrip("/") if specpm_registry_url else None
    agent_workbench_dir = getattr(args, "agent_workbench_dir", None)
    server.agent_workbench_dir = agent_workbench_dir.expanduser().resolve() if agent_workbench_dir else None
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
