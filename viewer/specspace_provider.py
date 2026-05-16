"""Readonly SpecGraph provider used by SpecSpace API v1."""

from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path, PurePosixPath
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import yaml  # type: ignore[import-untyped]

from viewer import capabilities_api, specgraph, specgraph_surfaces
from viewer.specpm import _build_specpm_lifecycle

SPECSPACE_API_VERSION = "v1"
HTTP_ARTIFACT_TIMEOUT_SECONDS = 10
HTTP_ARTIFACT_CACHE_TTL_SECONDS = 30
HTTP_ARTIFACT_MAX_BYTES = 10_000_000
HTTP_ARTIFACT_PREFIX_BYTES = 4096
SPECSPACE_APP_VERSION = "0.0.1"


class CapabilityContext(capabilities_api.CapabilitiesHandler, Protocol):
    """Viewer handler/server context needed for capability introspection."""


@dataclass(frozen=True)
class SourceHealth:
    name: str
    path: Path | str | None
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


class SpecSpaceProvider(Protocol):
    kind: str

    def health(self) -> dict[str, Any]: ...

    def capabilities(self, handler: CapabilityContext) -> dict[str, bool]: ...

    def read_spec_graph(self) -> tuple[int, dict[str, Any]]: ...

    def read_spec_node(self, node_id: str) -> tuple[int, dict[str, Any]]: ...

    def read_recent_runs(self, *, limit: int, since_iso: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_spec_activity(self, *, limit_raw: str | None, since_raw: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_implementation_work_index(self, *, limit_raw: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_proposal_spec_trace_index(self) -> tuple[int, dict[str, Any]]: ...

    def read_specpm_lifecycle(self) -> tuple[int, dict[str, Any]]: ...


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


def optional_source_is_available(source: SourceHealth) -> bool:
    return source.status == "not_configured" or source_is_readable(source)


def _optional_env(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def deployment_metadata() -> dict[str, Any]:
    return {
        "version": _optional_env("SPECSPACE_VERSION") or SPECSPACE_APP_VERSION,
        "commit": _optional_env("SPECSPACE_RELEASE_COMMIT"),
        "created_at": _optional_env("SPECSPACE_RELEASE_CREATED_AT"),
        "api_image_ref": _optional_env("SPECSPACE_API_IMAGE_REF"),
        "ui_image_ref": _optional_env("SPECSPACE_UI_IMAGE_REF"),
    }


@dataclass(frozen=True)
class FileSpecGraphProvider:
    """Readonly file-backed provider over SpecGraph nodes and runs artifacts."""

    kind = "file"
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
        elif optional_source_is_available(runs) and optional_source_is_available(specgraph_root):
            status = "ok"
        else:
            status = "degraded"
        return {
            "api_version": SPECSPACE_API_VERSION,
            "deployment": deployment_metadata(),
            "provider": "file",
            "read_only": True,
            "status": status,
            "sources": {
                "spec_nodes": spec_nodes.to_json(),
                "runs": runs.to_json(),
                "specgraph_root": specgraph_root.to_json(),
            },
        }

    def capabilities(self, handler: CapabilityContext) -> dict[str, bool]:
        return capabilities_api.build_capabilities(handler)

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


@dataclass
class HttpArtifactCache:
    manifest: dict[str, Any] | None = None
    manifest_loaded_at: float = 0.0
    text_by_path: dict[str, tuple[float, str]] | None = None

    def __post_init__(self) -> None:
        if self.text_by_path is None:
            self.text_by_path = {}


@dataclass(frozen=True)
class HttpSpecGraphProvider:
    """Readonly HTTP-backed provider over a static SpecGraph artifact site."""

    base_url: str
    cache: HttpArtifactCache
    cache_ttl_seconds: int = HTTP_ARTIFACT_CACHE_TTL_SECONDS

    kind = "http"

    @property
    def normalized_base_url(self) -> str:
        return self.base_url.rstrip("/")

    @property
    def manifest_url(self) -> str:
        return f"{self.normalized_base_url}/artifact_manifest.json"

    def _artifact_url(self, path: str) -> str:
        return f"{self.normalized_base_url}/{quote(path, safe='/-._~')}"

    def _manifest_error(self, detail: str) -> dict[str, Any]:
        return {
            "error": "SpecGraph artifact manifest is not readable.",
            "source": SourceHealth(
                name="artifact_manifest",
                path=self.manifest_url,
                status="unreadable",
                detail=detail,
            ).to_json(),
        }

    def _read_manifest(self) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        now = time.time()
        if self.cache.manifest is not None and now - self.cache.manifest_loaded_at <= self.cache_ttl_seconds:
            return self.cache.manifest, None

        status, text, error = http_get_text(self.manifest_url)
        if error is not None:
            return None, self._manifest_error(error["detail"])
        if status != HTTPStatus.OK or text is None:
            return None, self._manifest_error(f"manifest returned HTTP {int(status)}")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            return None, self._manifest_error(f"manifest is not valid JSON: {exc}")
        if not isinstance(data, dict):
            return None, self._manifest_error("manifest JSON root is not an object")
        if data.get("artifact_kind") != "specgraph_static_artifact_manifest":
            return None, self._manifest_error("manifest artifact_kind is not specgraph_static_artifact_manifest")

        self.cache.manifest = data
        self.cache.manifest_loaded_at = now
        return data, None

    def _manifest_files(self, manifest: dict[str, Any]) -> list[dict[str, Any]]:
        files = manifest.get("files")
        if not isinstance(files, list):
            return []
        return [entry for entry in files if isinstance(entry, dict) and safe_manifest_path(entry.get("path"))]

    def _paths_for(self, manifest: dict[str, Any], *, prefix: str, suffix: str | None = None) -> list[str]:
        paths: list[str] = []
        for entry in self._manifest_files(manifest):
            path = safe_manifest_path(entry.get("path"))
            if path is None or not path.startswith(prefix):
                continue
            if suffix is not None and not path.endswith(suffix):
                continue
            paths.append(path)
        return sorted(paths)

    def _has_artifact(self, manifest: dict[str, Any], path: str) -> bool:
        return path in {entry_path for entry_path in self._paths_for(manifest, prefix="")}

    def _read_artifact_text(self, path: str) -> tuple[int, str | None, dict[str, Any] | None]:
        if safe_manifest_path(path) is None:
            return HTTPStatus.BAD_REQUEST, None, {"error": "Invalid artifact path.", "path": path}

        now = time.time()
        prune_expired_text_cache(self.cache, now=now, ttl_seconds=self.cache_ttl_seconds)
        cached = self.cache.text_by_path.get(path) if self.cache.text_by_path is not None else None
        if cached is not None and now - cached[0] <= self.cache_ttl_seconds:
            return HTTPStatus.OK, cached[1], None

        url = self._artifact_url(path)
        status, text, error = http_get_text(url)
        if error is not None:
            return status, None, {"error": f"{path} could not be read.", "detail": error["detail"], "path": url}
        if text is None:
            return status, None, {"error": f"{path} could not be read.", "path": url}
        if self.cache.text_by_path is not None:
            self.cache.text_by_path[path] = (now, text)
        return status, text, None

    def _read_artifact_prefix(self, path: str) -> tuple[int, str | None, dict[str, Any] | None]:
        if safe_manifest_path(path) is None:
            return HTTPStatus.BAD_REQUEST, None, {"error": "Invalid artifact path.", "path": path}

        url = self._artifact_url(path)
        status, text, error = http_get_text(
            url,
            max_bytes=HTTP_ARTIFACT_PREFIX_BYTES,
            range_bytes=HTTP_ARTIFACT_PREFIX_BYTES,
            allow_truncated=True,
        )
        if error is not None:
            return status, None, {"error": f"{path} could not be read.", "detail": error["detail"], "path": url}
        return status, text, None

    def _read_json_artifact(self, filename: str, *, build_hint: str) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        path = f"runs/{filename}"
        if not self._has_artifact(manifest, path):
            return HTTPStatus.NOT_FOUND, {"error": f"{filename} not found. Run {build_hint} first."}

        status, text, error = self._read_artifact_text(path)
        if error is not None:
            return status, error
        assert text is not None
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            return HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": f"{filename} is not valid JSON",
                "detail": str(exc),
            }
        return HTTPStatus.OK, http_envelope(self._artifact_url(path), manifest, data)

    def health(self) -> dict[str, Any]:
        manifest, error = self._read_manifest()
        if error is not None:
            return {
                "api_version": SPECSPACE_API_VERSION,
                "deployment": deployment_metadata(),
                "provider": self.kind,
                "read_only": True,
                "status": "unavailable",
                "sources": {
                    "artifact_manifest": error["source"],
                    "spec_nodes": SourceHealth(name="spec_nodes", path=None, status="not_configured").to_json(),
                    "runs": SourceHealth(name="runs", path=None, status="not_configured").to_json(),
                },
            }
        assert manifest is not None
        spec_paths = self._paths_for(manifest, prefix="specs/nodes/", suffix=".yaml")
        run_paths = self._paths_for(manifest, prefix="runs/", suffix=".json")
        status = "ok" if spec_paths else "unavailable"
        return {
            "api_version": SPECSPACE_API_VERSION,
            "deployment": deployment_metadata(),
            "provider": self.kind,
            "read_only": True,
            "status": status,
            "artifact_base_url": self.normalized_base_url,
            "generated_at": manifest.get("generated_at"),
            "git": manifest.get("git") if isinstance(manifest.get("git"), dict) else None,
            "sources": {
                "artifact_manifest": SourceHealth(
                    name="artifact_manifest",
                    path=self.manifest_url,
                    status="ok",
                    item_count=len(self._manifest_files(manifest)),
                ).to_json(),
                "spec_nodes": SourceHealth(
                    name="spec_nodes",
                    path=f"{self.normalized_base_url}/specs/nodes",
                    status="ok" if spec_paths else "empty",
                    item_count=len(spec_paths),
                ).to_json(),
                "runs": SourceHealth(
                    name="runs",
                    path=f"{self.normalized_base_url}/runs",
                    status="ok" if run_paths else "empty",
                    item_count=len(run_paths),
                ).to_json(),
            },
        }

    def capabilities(self, handler: CapabilityContext) -> dict[str, bool]:
        capabilities = capabilities_api.build_capabilities(handler)
        manifest, _ = self._read_manifest()
        if manifest is None:
            return capabilities
        run_paths = set(self._paths_for(manifest, prefix="runs/", suffix=".json"))
        capabilities.update(
            {
                "spec_graph": bool(self._paths_for(manifest, prefix="specs/nodes/", suffix=".yaml")),
                "spec_compile": False,
                "graph_dashboard": "runs/graph_dashboard.json" in run_paths,
                "spec_overlay": any(
                    path in run_paths
                    for path in (
                        "runs/graph_health_overlay.json",
                        "runs/spec_trace_projection.json",
                        "runs/evidence_plane_overlay.json",
                    )
                ),
                "specpm_preview": False,
                "exploration_preview": False,
                "exploration_surfaces": False,
                "exploration_preview_build": False,
                "viewer_surfaces_build": False,
            }
        )
        return capabilities

    def _load_spec_node_path(self, path: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        file_name = PurePosixPath(path).name
        status, text, error = self._read_artifact_text(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            return None, {
                "file_name": file_name,
                "message": error["detail"] if error is not None else f"HTTP {int(status)}",
            }
        try:
            raw = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            return None, {
                "file_name": file_name,
                "message": f"YAML parse error: {exc}",
            }
        if not isinstance(raw, dict):
            return None, {
                "file_name": file_name,
                "message": "YAML root is not a mapping — skipping.",
            }
        raw["_file_name"] = file_name
        return raw, None

    def _load_spec_nodes(self, manifest: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        nodes: list[dict[str, Any]] = []
        load_errors: list[dict[str, Any]] = []
        paths = self._paths_for(manifest, prefix="specs/nodes/", suffix=".yaml")
        max_workers = min(12, max(1, len(paths)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for raw, error in executor.map(self._load_spec_node_path, paths):
                if error is not None:
                    load_errors.append(error)
                    continue
                if raw is not None:
                    nodes.append(raw)
        return nodes, load_errors

    def read_spec_graph(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        nodes, load_errors = self._load_spec_nodes(manifest)
        graph = specgraph.build_spec_graph(nodes, load_errors)
        return HTTPStatus.OK, {
            "api_version": SPECSPACE_API_VERSION,
            "spec_dir": f"{self.normalized_base_url}/specs/nodes",
            "artifact_base_url": self.normalized_base_url,
            "manifest": {
                "generated_at": manifest.get("generated_at"),
                "git": manifest.get("git") if isinstance(manifest.get("git"), dict) else None,
            },
            "graph": graph,
            "summary": graph["summary"],
        }

    def read_spec_node(self, node_id: str) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        node_path = next(
            (
                path
                for path in self._paths_for(manifest, prefix="specs/nodes/", suffix=".yaml")
                if PurePosixPath(path).stem == node_id
            ),
            None,
        )
        if node_path is not None:
            raw, error = self._load_spec_node_path(node_path)
            if error is not None:
                return HTTPStatus.SERVICE_UNAVAILABLE, {"error": error["message"], "file_name": error["file_name"]}
            if raw is not None and raw.get("id") == node_id:
                return HTTPStatus.OK, {
                    "api_version": SPECSPACE_API_VERSION,
                    "node_id": node_id,
                    "data": {key: value for key, value in raw.items() if not key.startswith("_")},
                }

        nodes, _ = self._load_spec_nodes(manifest)
        detail = specgraph.get_spec_node_detail(nodes, node_id)
        if detail is None:
            return HTTPStatus.NOT_FOUND, {"error": f"Spec node '{node_id}' not found"}
        return HTTPStatus.OK, {"api_version": SPECSPACE_API_VERSION, "node_id": node_id, "data": detail}

    def read_recent_runs(self, *, limit: int, since_iso: str | None) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        candidates: list[tuple[str, str, str, str]] = []
        for path in self._paths_for(manifest, prefix="runs/", suffix=".json"):
            name = PurePosixPath(path).name
            match = specgraph_surfaces.RUN_FILENAME_RE.match(name)
            if not match:
                continue
            ts_iso = specgraph_surfaces.parse_iso_compact(match.group("ts"))
            if since_iso is not None and ts_iso <= since_iso:
                continue
            candidates.append((ts_iso, name.removesuffix(".json"), match.group("spec_id"), path))
        candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)

        events: list[dict[str, Any]] = []
        for ts_iso, run_id, spec_id, path in candidates[:limit]:
            _, text, _ = self._read_artifact_prefix(path)
            meta = harvest_run_meta_text(text or "")
            events.append(
                {
                    "run_id": run_id,
                    "ts": ts_iso,
                    "spec_id": spec_id,
                    "title": meta.get("title"),
                    "run_kind": meta.get("run_kind"),
                    "completion_status": meta.get("completion_status"),
                    "duration_sec": meta.get("duration_sec"),
                    "execution_profile": meta.get("execution_profile"),
                    "child_model": meta.get("child_model"),
                }
            )
        return HTTPStatus.OK, {"api_version": SPECSPACE_API_VERSION, "events": events, "total": len(events)}

    def read_spec_activity(self, *, limit_raw: str | None, since_raw: str | None) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            "spec_activity_feed.json",
            build_hint="`make spec-activity` in SpecGraph",
        )
        if status != HTTPStatus.OK:
            return status, payload
        data = payload.get("data")
        if isinstance(data, dict):
            entries = data.get("entries") or []
            if isinstance(entries, list):
                try:
                    limit: int | None = int(limit_raw) if limit_raw is not None else None
                except (TypeError, ValueError):
                    limit = 50
                if limit is not None:
                    limit = max(1, min(limit, 1000))
                since_iso = since_raw if isinstance(since_raw, str) and since_raw else None
                if since_iso is not None:
                    entries = [
                        entry
                        for entry in entries
                        if isinstance(entry, dict)
                        and isinstance(entry.get("occurred_at"), str)
                        and entry["occurred_at"] > since_iso
                    ]
                if limit is not None:
                    entries = entries[:limit]
                payload = {**payload, "data": {**data, "entries": entries, "entry_count": len(entries)}}
        return status, payload

    def read_implementation_work_index(self, *, limit_raw: str | None) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            "implementation_work_index.json",
            build_hint="`make viewer-surfaces` in SpecGraph",
        )
        if status != HTTPStatus.OK:
            return status, payload
        data = payload.get("data")
        if isinstance(data, dict):
            entries = data.get("entries") or []
            if isinstance(entries, list):
                try:
                    limit: int | None = int(limit_raw) if limit_raw is not None else 50
                except (TypeError, ValueError):
                    limit = 50
                if limit is not None:
                    limit = max(1, min(limit, 1000))
                    entries = entries[:limit]
                    payload = {**payload, "data": {**data, "entries": entries, "entry_count": len(entries)}}
        return status, payload

    def read_proposal_spec_trace_index(self) -> tuple[int, dict[str, Any]]:
        return self._read_json_artifact(
            "proposal_spec_trace_index.json",
            build_hint="`make viewer-surfaces` in SpecGraph",
        )

    def read_specpm_lifecycle(self) -> tuple[int, dict[str, Any]]:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecPM lifecycle source is not available from the HTTP artifact provider.",
            "source": SourceHealth(
                name="specpm_lifecycle",
                path=self.normalized_base_url,
                status="not_configured",
            ).to_json(),
        }


def safe_manifest_path(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    if value.startswith("/") or "\\" in value or "://" in value:
        return None
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        return None
    return path.as_posix()


def prune_expired_text_cache(cache: HttpArtifactCache, *, now: float, ttl_seconds: int) -> None:
    if cache.text_by_path is None:
        return
    expired = [
        path
        for path, (loaded_at, _) in cache.text_by_path.items()
        if now - loaded_at > ttl_seconds
    ]
    for path in expired:
        del cache.text_by_path[path]


def http_get_text(
    url: str,
    *,
    max_bytes: int = HTTP_ARTIFACT_MAX_BYTES,
    range_bytes: int | None = None,
    allow_truncated: bool = False,
) -> tuple[int, str | None, dict[str, str] | None]:
    headers = {"User-Agent": "SpecSpace/0.1"}
    if range_bytes is not None:
        headers["Range"] = f"bytes=0-{max(0, range_bytes - 1)}"
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=HTTP_ARTIFACT_TIMEOUT_SECONDS) as response:
            raw = response.read(max_bytes + 1)
            if len(raw) > max_bytes and not allow_truncated:
                return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, None, {
                    "detail": f"artifact exceeds {max_bytes} bytes"
                }
            raw = raw[:max_bytes]
            charset = response.headers.get_content_charset() or "utf-8"
            return HTTPStatus(response.status), raw.decode(charset), None
    except HTTPError as exc:
        return exc.code, None, {"detail": f"HTTP {exc.code}"}
    except (OSError, TimeoutError, UnicodeDecodeError, URLError) as exc:
        return HTTPStatus.SERVICE_UNAVAILABLE, None, {"detail": str(exc)}


def manifest_timestamp(manifest: dict[str, Any]) -> tuple[float, str]:
    generated_at = manifest.get("generated_at")
    if isinstance(generated_at, str):
        try:
            dt = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            return dt.timestamp(), dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    now = datetime.now(tz=timezone.utc)
    return now.timestamp(), now.isoformat()


def http_envelope(url: str, manifest: dict[str, Any], data: Any) -> dict[str, Any]:
    mtime, mtime_iso = manifest_timestamp(manifest)
    return {
        "path": url,
        "mtime": mtime,
        "mtime_iso": mtime_iso,
        "data": data,
    }


def harvest_run_meta_text(text: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in ("title", "run_kind", "completion_status", "execution_profile", "child_model"):
        match = re.search(
            rf'"{re.escape(key)}"\s*:\s*(?P<value>{specgraph_surfaces.JSON_STRING_RE})',
            text[:4096],
        )
        if match:
            try:
                out[key] = json.loads(match.group("value"))
            except json.JSONDecodeError:
                pass
    match = re.search(r'"run_duration_sec"\s*:\s*([0-9.]+)', text[:4096])
    if match:
        try:
            out["duration_sec"] = float(match.group(1))
        except ValueError:
            pass
    return out


def provider_from_server(server: Any) -> SpecSpaceProvider:
    artifact_base_url = getattr(server, "artifact_base_url", None)
    if isinstance(artifact_base_url, str) and artifact_base_url.strip():
        cache = getattr(server, "artifact_cache", None)
        if not isinstance(cache, HttpArtifactCache):
            cache = HttpArtifactCache()
            setattr(server, "artifact_cache", cache)
        return HttpSpecGraphProvider(base_url=artifact_base_url.strip(), cache=cache)

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


def versioned_capabilities(handler: CapabilityContext, provider: SpecSpaceProvider) -> dict[str, Any]:
    return {
        "api_version": SPECSPACE_API_VERSION,
        "capabilities": provider.capabilities(handler),
        "provider": {
            "kind": provider.kind,
            "read_only": True,
            "health": provider.health()["status"],
        },
    }
