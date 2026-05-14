"""Capability response helper for the viewer HTTP server."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, Protocol

from viewer.http_response import json_response


class CapabilitiesHandler(Protocol):
    server: Any

    def _exploration_build_available(self) -> bool: ...

    def _graph_dashboard_path(self) -> Any: ...

    def _runs_dir(self) -> Any: ...

    def _viewer_surfaces_build_available(self) -> bool: ...


def build_capabilities(handler: CapabilitiesHandler) -> dict[str, bool]:
    return {
        "spec_graph": handler.server.spec_dir is not None,
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
    }


def handle_capabilities(handler: CapabilitiesHandler) -> None:
    json_response(handler, HTTPStatus.OK, build_capabilities(handler))
