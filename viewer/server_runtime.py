"""CLI and runtime setup for the viewer HTTP server."""

from __future__ import annotations

import argparse
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
    compile_available: bool
    spec_dir: Path | None
    spec_watcher: Any
    specgraph_dir: Path | None
    runs_dir: Path | None
    runs_watcher: Any
    agent_available: bool

    def serve_forever(self) -> None: ...


def build_arg_parser(
    *,
    description: str | None,
    default_hyperprompt_binary: str,
) -> argparse.ArgumentParser:
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
        "--agent",
        action="store_true",
        default=False,
        help="Enable the AgentChat panel in the UI",
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
    resolved_binary, _, _ = resolve_hyperprompt_binary(args.hyperprompt_binary)
    server.compile_available = resolved_binary is not None
    server.spec_dir = args.spec_dir.expanduser().resolve() if args.spec_dir else None
    server.spec_watcher = spec_watcher_factory(server.spec_dir) if server.spec_dir else None
    server.specgraph_dir = args.specgraph_dir.expanduser().resolve() if args.specgraph_dir else None
    server.runs_dir = args.runs_dir.expanduser().resolve() if args.runs_dir else runs_watch_path(
        server.spec_dir,
        server.specgraph_dir,
    )
    server.runs_watcher = runs_watcher_factory(server.runs_dir) if server.runs_dir is not None else None
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
