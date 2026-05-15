"""Readonly SpecGraph provider used by SpecSpace API v1."""

from __future__ import annotations

from dataclasses import dataclass
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer import capabilities_api, specgraph, specgraph_surfaces
from viewer.specpm import _build_specpm_lifecycle

SPECSPACE_API_VERSION = "v1"


class CapabilityContext(capabilities_api.CapabilitiesHandler, Protocol):
    """Viewer handler/server context needed for capability introspection."""


@dataclass(frozen=True)
class SourceHealth:
    name: str
    path: Path | None
    status: str
    item_count: int | None = None
    detail: str | None = None

    def to_json(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": self.name,
            "path": str(self.path) if self.path is not None else None,
            "status": self.status,
        }
        if self.item_count is not None:
            payload["item_count"] = self.item_count
        if self.detail is not None:
            payload["detail"] = self.detail
        return payload


def inspect_directory_source(
    *,
    name: str,
    path: Path | None,
    pattern: str,
) -> SourceHealth:
    if path is None:
        return SourceHealth(name=name, path=None, status="not_configured")
    try:
        if not path.exists():
            return SourceHealth(name=name, path=path, status="missing")
        if not path.is_dir():
            return SourceHealth(name=name, path=path, status="not_directory")
        items = [entry for entry in path.glob(pattern) if entry.is_file()]
    except OSError as exc:
        return SourceHealth(name=name, path=path, status="unreadable", detail=str(exc))
    status = "ok" if items else "empty"
    return SourceHealth(name=name, path=path, status=status, item_count=len(items))


def inspect_root_source(*, name: str, path: Path | None) -> SourceHealth:
    if path is None:
        return SourceHealth(name=name, path=None, status="not_configured")
    try:
        if not path.exists():
            return SourceHealth(name=name, path=path, status="missing")
        if not path.is_dir():
            return SourceHealth(name=name, path=path, status="not_directory")
        next(path.iterdir(), None)
    except OSError as exc:
        return SourceHealth(name=name, path=path, status="unreadable", detail=str(exc))
    return SourceHealth(name=name, path=path, status="ok")


def source_is_readable(source: SourceHealth) -> bool:
    return source.status in {"ok", "empty"}


@dataclass(frozen=True)
class FileSpecGraphProvider:
    """Readonly file-backed provider over SpecGraph nodes and runs artifacts."""

    spec_nodes_dir: Path | None
    runs_dir: Path | None
    specgraph_dir: Path | None = None

    def spec_nodes_health(self) -> SourceHealth:
        return inspect_directory_source(
            name="spec_nodes",
            path=self.spec_nodes_dir,
            pattern="*.yaml",
        )

    def runs_health(self) -> SourceHealth:
        return inspect_directory_source(
            name="runs",
            path=self.runs_dir,
            pattern="*.json",
        )

    def specgraph_health(self) -> SourceHealth:
        return inspect_root_source(name="specgraph_root", path=self.specgraph_dir)

    def health(self) -> dict[str, Any]:
        spec_nodes = self.spec_nodes_health()
        runs = self.runs_health()
        specgraph_root = self.specgraph_health()
        if not source_is_readable(spec_nodes):
            status = "unavailable"
        elif not source_is_readable(specgraph_root) and specgraph_root.status != "not_configured":
            status = "degraded"
        elif source_is_readable(runs) or runs.status == "not_configured":
            status = "ok"
        else:
            status = "degraded"
        return {
            "api_version": SPECSPACE_API_VERSION,
            "provider": "file",
            "read_only": True,
            "status": status,
            "sources": {
                "spec_nodes": spec_nodes.to_json(),
                "runs": runs.to_json(),
                "specgraph_root": specgraph_root.to_json(),
            },
        }

    def _spec_nodes_unavailable(self) -> tuple[HTTPStatus, dict[str, Any]] | None:
        source = self.spec_nodes_health()
        if source_is_readable(source):
            return None
        return (
            HTTPStatus.SERVICE_UNAVAILABLE,
            {
                "error": "SpecGraph spec nodes source is not readable.",
                "source": source.to_json(),
            },
        )

    def _runs_unavailable(self) -> tuple[HTTPStatus, dict[str, Any]] | None:
        source = self.runs_health()
        if source_is_readable(source):
            return None
        return (
            HTTPStatus.SERVICE_UNAVAILABLE,
            {
                "error": "SpecGraph runs source is not readable.",
                "source": source.to_json(),
            },
        )

    def read_spec_graph(self) -> tuple[HTTPStatus, dict[str, Any]]:
        unavailable = self._spec_nodes_unavailable()
        if unavailable is not None:
            return unavailable
        assert self.spec_nodes_dir is not None
        payload = specgraph.collect_spec_graph_api(self.spec_nodes_dir)
        return HTTPStatus.OK, {"api_version": SPECSPACE_API_VERSION, **payload}

    def read_spec_node(self, node_id: str) -> tuple[HTTPStatus, dict[str, Any]]:
        unavailable = self._spec_nodes_unavailable()
        if unavailable is not None:
            return unavailable
        assert self.spec_nodes_dir is not None
        nodes, _ = specgraph.load_spec_nodes(self.spec_nodes_dir)
        detail = specgraph.get_spec_node_detail(nodes, node_id)
        if detail is None:
            return HTTPStatus.NOT_FOUND, {"error": f"Spec node '{node_id}' not found"}
        return HTTPStatus.OK, {"api_version": SPECSPACE_API_VERSION, "node_id": node_id, "data": detail}

    def read_recent_runs(self, *, limit: int, since_iso: str | None) -> tuple[HTTPStatus, dict[str, Any]]:
        unavailable = self._runs_unavailable()
        if unavailable is not None:
            return unavailable
        assert self.runs_dir is not None
        return HTTPStatus.OK, {
            "api_version": SPECSPACE_API_VERSION,
            **specgraph_surfaces.collect_recent_runs(self.runs_dir, limit=limit, since_iso=since_iso),
        }

    def read_spec_activity(self, *, limit_raw: str | None, since_raw: str | None) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_spec_activity(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
            limit_raw=limit_raw,
            since_raw=since_raw,
        )

    def read_implementation_work_index(self, *, limit_raw: str | None) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_implementation_work_index(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
            limit_raw=limit_raw,
        )

    def read_proposal_spec_trace_index(self) -> tuple[int, dict[str, Any]]:
        if self.runs_dir is None:
            return HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "SpecGraph runs source is not configured.",
                "source": self.runs_health().to_json(),
            }
        return specgraph_surfaces.read_runs_artifact(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
            filename="proposal_spec_trace_index.json",
            build_hint="`make viewer-surfaces` in SpecGraph",
        )

    def read_specpm_lifecycle(self) -> tuple[HTTPStatus, dict[str, Any]]:
        specgraph_root = self.specgraph_health()
        if not source_is_readable(specgraph_root):
            return (
                HTTPStatus.SERVICE_UNAVAILABLE,
                {
                    "error": "SpecPM lifecycle source is not readable.",
                    "source": specgraph_root.to_json(),
                },
            )
        assert self.specgraph_dir is not None
        return HTTPStatus.OK, {
            "api_version": SPECSPACE_API_VERSION,
            **_build_specpm_lifecycle(self.specgraph_dir),
        }


def provider_from_server(server: Any) -> FileSpecGraphProvider:
    spec_dir = getattr(server, "spec_dir", None)
    specgraph_dir = getattr(server, "specgraph_dir", None)
    runs_dir = getattr(server, "runs_dir", None)
    if runs_dir is None:
        runs_dir = specgraph_surfaces.runs_dir_from_context(spec_dir, specgraph_dir)
    return FileSpecGraphProvider(
        spec_nodes_dir=spec_dir,
        runs_dir=runs_dir,
        specgraph_dir=specgraph_dir,
    )


def versioned_capabilities(handler: CapabilityContext, provider: FileSpecGraphProvider) -> dict[str, Any]:
    return {
        "api_version": SPECSPACE_API_VERSION,
        "capabilities": capabilities_api.build_capabilities(handler),
        "provider": {
            "kind": "file",
            "read_only": True,
            "health": provider.health()["status"],
        },
    }
