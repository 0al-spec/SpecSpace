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

from viewer import (
    agent_surfaces,
    agent_workbench,
    capabilities_api,
    metrics,
    practical_ontology,
    proposals,
    spec_compile,
    specgraph,
    specgraph_surfaces,
    specspace_hyperprompt,
)
from viewer.specpm import _build_specpm_lifecycle

SPECSPACE_API_VERSION = "v1"
HTTP_ARTIFACT_TIMEOUT_SECONDS = 10
HTTP_ARTIFACT_CACHE_TTL_SECONDS = 30
HTTP_ARTIFACT_MAX_BYTES = 10_000_000
HTTP_ARTIFACT_PREFIX_BYTES = 4096
ARTIFACT_CONTENT_MAX_BYTES = 1_000_000
SPECSPACE_APP_VERSION = "0.0.1"
SPECPM_REGISTRY_SOURCE_NAME = "specpm_registry"
SPECPM_REGISTRY_API_VERSION = "specpm.registry/v0"


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

    def read_spec_markdown(self, root_id: str, options: spec_compile.CompileOptions) -> tuple[int, dict[str, Any]]: ...

    def compile_spec_markdown(
        self,
        handler: CapabilityContext,
        root_id: str,
        options: spec_compile.CompileOptions,
        *,
        scope: str,
    ) -> tuple[int, dict[str, Any]]: ...

    def read_recent_runs(self, *, limit: int, since_iso: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_spec_activity(self, *, limit_raw: str | None, since_raw: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_implementation_work_index(self, *, limit_raw: str | None) -> tuple[int, dict[str, Any]]: ...

    def read_proposal_spec_trace_index(self) -> tuple[int, dict[str, Any]]: ...

    def read_proposals(self) -> tuple[int, dict[str, Any]]: ...

    def read_practical_ontology(self) -> tuple[int, dict[str, Any]]: ...

    def read_metrics(self) -> tuple[int, dict[str, Any]]: ...

    def read_agent_surfaces(self) -> tuple[int, dict[str, Any]]: ...

    def read_artifact_catalog(self) -> tuple[int, dict[str, Any]]: ...

    def read_artifact_content(self, path: str) -> tuple[int, dict[str, Any]]: ...

    def read_ontology_semantic_review_surface(self) -> tuple[int, dict[str, Any]]: ...

    def read_ontology_review_dashboard(self) -> tuple[int, dict[str, Any]]: ...

    def read_ontology_owner_decision_review(self) -> tuple[int, dict[str, Any]]: ...

    def read_spec_ontology_validation_report(self) -> tuple[int, dict[str, Any]]: ...

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


def specpm_registry_source(registry_url: Any) -> dict[str, Any]:
    if not isinstance(registry_url, str) or not registry_url.strip():
        return SourceHealth(
            name=SPECPM_REGISTRY_SOURCE_NAME,
            path=None,
            status="not_configured",
        ).to_json()
    normalized = registry_url.strip().rstrip("/")
    return SourceHealth(
        name=SPECPM_REGISTRY_SOURCE_NAME,
        path=normalized,
        status="configured",
        detail="Read-only SpecPM registry metadata source.",
    ).to_json()


def _download_filename(root_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", root_id).strip("._-")
    return f"{stem or 'spec'}.md"


def build_spec_markdown_response(
    *,
    nodes: list[dict[str, Any]],
    load_errors: list[dict[str, Any]],
    root_id: str,
    options: spec_compile.CompileOptions,
    source: dict[str, Any],
) -> tuple[HTTPStatus, dict[str, Any]]:
    nodes_by_id = spec_compile.index_nodes(nodes)
    invalid_node_count = len(nodes) - len(nodes_by_id)
    if not nodes_by_id and (load_errors or invalid_node_count):
        invalid_nodes = [
            {
                "file_name": raw.get("_file_name", "unknown.yaml"),
                "message": "Missing or invalid 'id' field.",
            }
            for raw in nodes
            if not isinstance(raw.get("id"), str) or not raw.get("id", "").strip()
        ]
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "error": "SpecGraph provider data contains no exportable spec nodes.",
            "reason": "invalid_provider_data",
            "root_id": root_id,
            "load_errors": load_errors,
            "invalid_nodes": invalid_nodes,
            "source": source,
        }
    if root_id not in nodes_by_id:
        return HTTPStatus.NOT_FOUND, {
            "api_version": SPECSPACE_API_VERSION,
            "error": f"Spec node '{root_id}' not found",
            "root_id": root_id,
            "source": source,
        }

    result = spec_compile.compile_spec_tree(nodes_by_id, root_id, options)
    return HTTPStatus.OK, {
        "api_version": SPECSPACE_API_VERSION,
        "root_id": root_id,
        "markdown": result.markdown,
        "manifest": {
            **result.manifest(),
            "load_errors": load_errors,
        },
        "source": source,
        "download_filename": _download_filename(root_id),
    }


def build_hyperprompt_compile_unavailable_response(
    handler: CapabilityContext,
    provider: SpecSpaceProvider,
) -> tuple[HTTPStatus, dict[str, Any]]:
    capabilities = provider.capabilities(handler)
    diagnostic = capabilities_api.build_hyperprompt_compile_diagnostic(
        handler,
        provider_kind=provider.kind,
    )
    return HTTPStatus.SERVICE_UNAVAILABLE, {
        "api_version": SPECSPACE_API_VERSION,
        "error": "Hyperprompt compile is not available.",
        "reason": "hyperprompt_compile_unavailable",
        "provider": {
            "kind": provider.kind,
            "read_only": True,
        },
        "capabilities": {
            **capabilities,
            "hyperprompt_compile": bool(diagnostic.get("available")),
        },
        "diagnostic": diagnostic,
    }


def compile_spec_markdown_with_provider(
    provider: SpecSpaceProvider,
    handler: CapabilityContext,
    root_id: str,
    options: spec_compile.CompileOptions,
    *,
    scope: str,
) -> tuple[int, dict[str, Any]]:
    diagnostic = capabilities_api.build_hyperprompt_compile_diagnostic(
        handler,
        provider_kind=provider.kind,
    )
    if not bool(diagnostic.get("available")):
        return build_hyperprompt_compile_unavailable_response(handler, provider)

    export_status, export_payload = provider.read_spec_markdown(root_id, options)
    if export_status != HTTPStatus.OK:
        return export_status, export_payload

    markdown = export_payload.get("markdown")
    manifest = export_payload.get("manifest")
    source = export_payload.get("source")
    if not isinstance(markdown, str) or not isinstance(manifest, dict) or not isinstance(source, dict):
        return HTTPStatus.INTERNAL_SERVER_ERROR, {
            "api_version": SPECSPACE_API_VERSION,
            "error": "Spec Markdown export response was incomplete.",
        }

    server = handler.server
    limits, limit_error = capabilities_api.hyperprompt_compile_limits(server)
    if limit_error is not None:
        return build_hyperprompt_compile_unavailable_response(handler, provider)
    work_dir = Path(getattr(server, "hyperprompt_work_dir"))
    binary_path = str(getattr(server, "hyperprompt_resolved_binary") or getattr(server, "hyperprompt_binary"))
    default_binary = str(getattr(server, "hyperprompt_binary"))
    repo_root = Path(getattr(server, "repo_root"))
    compile_status, compile_payload = specspace_hyperprompt.compile_spec_markdown_export(
        work_dir=work_dir,
        root_id=root_id,
        scope=scope,
        markdown=markdown,
        manifest=manifest,
        source=source,
        options=options,
        binary_path=binary_path,
        default_hyperprompt_binary=default_binary,
        repo_root=repo_root,
        timeout_seconds=limits["timeout_seconds"],
        max_input_bytes=limits["max_input_bytes"],
        max_output_bytes=limits["max_output_bytes"],
        bundle_retention_count=limits["bundle_retention_count"],
    )
    response: dict[str, Any] = {
        "api_version": SPECSPACE_API_VERSION,
        "artifact_kind": "specspace_hyperprompt_compile",
        "root_id": root_id,
        "scope": scope,
        "source": source,
        "export": {
            "manifest": {
                **manifest,
                "scope": scope,
            },
            "download_filename": export_payload.get("download_filename"),
        },
        "compile": compile_payload,
    }
    if compile_status != HTTPStatus.OK:
        response["error"] = compile_payload.get("error", "Hyperprompt compile failed.")
    return compile_status, response


def artifact_group(path: str) -> str:
    if path == "artifact_manifest.json":
        return "manifest"
    if path.endswith("ontology.normalized.json"):
        return "ontology_ir"
    if path.startswith("runs/ontology"):
        return "ontology"
    if path.startswith("runs/"):
        return "runs"
    if path.startswith("specs/"):
        return "specs"
    if path.startswith("tests/fixtures/ontology_import/"):
        return "ontology_ir"
    return path.split("/", 1)[0] if "/" in path else "root"


def artifact_label(path: str) -> str:
    name = PurePosixPath(path).name
    if name.endswith(".json"):
        name = name.removesuffix(".json")
    return name.replace("_", " ")


def artifact_catalog_summary(artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    root_counts: dict[str, int] = {}
    group_counts: dict[str, int] = {}
    for artifact in artifacts:
        root = str(artifact.get("root") or "root")
        group = str(artifact.get("group") or "root")
        root_counts[root] = root_counts.get(root, 0) + 1
        group_counts[group] = group_counts.get(group, 0) + 1
    return {
        "artifact_count": len(artifacts),
        "runs_count": group_counts.get("runs", 0) + group_counts.get("ontology", 0),
        "ontology_artifact_count": group_counts.get("ontology", 0),
        "ontology_ir_count": group_counts.get("ontology_ir", 0),
        "root_counts": root_counts,
        "group_counts": group_counts,
    }


def build_artifact_catalog(
    *,
    source: dict[str, Any],
    artifacts: list[dict[str, Any]],
    manifest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ordered = sorted(
        artifacts,
        key=lambda item: (
            0 if item.get("group") in {"ontology", "ontology_ir"} else 1,
            str(item.get("group") or ""),
            str(item.get("path") or ""),
        ),
    )
    payload: dict[str, Any] = {
        "api_version": SPECSPACE_API_VERSION,
        "artifact_kind": "specspace_artifact_catalog",
        "schema_version": 1,
        "read_only": True,
        "source": source,
        "summary": artifact_catalog_summary(ordered),
        "artifacts": ordered,
    }
    if manifest is not None:
        payload["manifest"] = {
            "generated_at": manifest.get("generated_at"),
            "git": manifest.get("git") if isinstance(manifest.get("git"), dict) else None,
            "safety_gate": manifest.get("safety_gate") if isinstance(manifest.get("safety_gate"), dict) else None,
        }
    return payload


def decode_artifact_content(
    *,
    path: str,
    text: str,
    source: dict[str, Any],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "api_version": SPECSPACE_API_VERSION,
        "artifact_kind": "specspace_artifact_content",
        "schema_version": 1,
        "read_only": True,
        "path": path,
        "source": source,
        "size_bytes": len(text.encode("utf-8")),
    }
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        payload["content_kind"] = "text"
        payload["text"] = text
        return payload
    payload["content_kind"] = "json"
    payload["data"] = data
    if isinstance(data, dict):
        payload["json_summary"] = {
            "artifact_kind": data.get("artifact_kind"),
            "schema_version": data.get("schema_version"),
            "top_level_keys": sorted(data.keys()),
        }
    return payload


PUBLIC_SAFE_RUN_ARTIFACT_FILENAMES: frozenset[str] = frozenset(
    {
        "spec_activity_feed.json",
        "implementation_work_index.json",
        specgraph_surfaces.ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME,
        specgraph_surfaces.ONTOLOGY_REVIEW_DASHBOARD_FILENAME,
        specgraph_surfaces.ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME,
        practical_ontology.PACKAGE_INDEX_ARTIFACT,
        practical_ontology.BINDING_PREVIEW_ARTIFACT,
        practical_ontology.GAP_INDEX_ARTIFACT,
        practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT,
        practical_ontology.GOVERNANCE_EVIDENCE_INDEX_ARTIFACT,
        *proposals.PROPOSAL_ARTIFACTS.values(),
        *metrics.METRICS_ARTIFACTS.values(),
        *agent_surfaces.AGENT_SURFACE_ARTIFACTS.values(),
    }
)


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

    def read_spec_markdown(self, root_id: str, options: spec_compile.CompileOptions) -> tuple[HTTPStatus, dict[str, Any]]:
        unavailable = self._spec_nodes_unavailable()
        if unavailable is not None:
            return unavailable
        assert self.spec_nodes_dir is not None
        nodes, load_errors = specgraph.load_spec_nodes(self.spec_nodes_dir)
        return build_spec_markdown_response(
            nodes=nodes,
            load_errors=load_errors,
            root_id=root_id,
            options=options,
            source={
                "provider": "file",
                "read_only": True,
                "spec_nodes": str(self.spec_nodes_dir),
            },
        )

    def compile_spec_markdown(
        self,
        handler: CapabilityContext,
        root_id: str,
        options: spec_compile.CompileOptions,
        *,
        scope: str,
    ) -> tuple[int, dict[str, Any]]:
        return compile_spec_markdown_with_provider(self, handler, root_id, options, scope=scope)

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

    def read_proposals(self) -> tuple[int, dict[str, Any]]:
        return proposals.read_file_proposal_index(
            runs_dir=self.runs_dir,
            specgraph_dir=self.specgraph_dir,
        )

    def _read_local_runs_json(self, filename: str) -> dict[str, Any] | None:
        if self.runs_dir is None:
            return None
        path = self.runs_dir / filename
        if not path.exists() or not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def _read_local_normalized_ir(self, package_index: dict[str, Any] | None) -> dict[str, Any] | None:
        if not package_index:
            return None
        packages = package_index.get("packages")
        package = (
            packages[0]
            if isinstance(packages, list) and packages and isinstance(packages[0], dict)
            else None
        )
        if not package:
            return None
        raw_path = package.get("materialized_ir")
        if not isinstance(raw_path, str):
            return None
        relative = PurePosixPath(raw_path)
        if relative.is_absolute() or ".." in relative.parts:
            return None
        relative_path = Path(*relative.parts)
        roots: list[Path] = []
        if self.specgraph_dir is not None:
            roots.append(self.specgraph_dir)
        if self.runs_dir is not None:
            roots.append(self.runs_dir.parent)
        if (
            self.spec_nodes_dir is not None
            and self.spec_nodes_dir.name == "nodes"
            and self.spec_nodes_dir.parent.name == "specs"
        ):
            roots.append(self.spec_nodes_dir.parent.parent)
        for root in roots:
            path = root / relative_path
            if not path.exists() or not path.is_file():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return None
            return data if isinstance(data, dict) else None
        return None

    def _read_practical_ontology_artifacts(self) -> dict[str, Any]:
        filenames = (
            practical_ontology.PACKAGE_INDEX_ARTIFACT,
            practical_ontology.BINDING_PREVIEW_ARTIFACT,
            practical_ontology.GAP_INDEX_ARTIFACT,
            practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT,
            practical_ontology.GOVERNANCE_EVIDENCE_INDEX_ARTIFACT,
        )
        artifacts = {
            filename: payload
            for filename in filenames
            if (payload := self._read_local_runs_json(filename)) is not None
        }
        normalized_ir = self._read_local_normalized_ir(
            artifacts.get(practical_ontology.PACKAGE_INDEX_ARTIFACT)
        )
        if normalized_ir is not None:
            artifacts[practical_ontology.NORMALIZED_IR_ARTIFACT_KEY] = normalized_ir
        return artifacts

    def read_practical_ontology(self) -> tuple[int, dict[str, Any]]:
        unavailable = self._spec_nodes_unavailable()
        if unavailable is not None:
            return unavailable
        assert self.spec_nodes_dir is not None
        seed_path = self.spec_nodes_dir / "SG-SPEC-0001.yaml"
        curated_seed_source_ref = (
            practical_ontology.CURATED_SOURCE_REF
            if seed_path.exists() and seed_path.is_file()
            else practical_ontology.CONCEPTUAL_CURATED_SOURCE_REF
        )
        return HTTPStatus.OK, practical_ontology.build_practical_ontology(
            nodes=[],
            load_errors=[],
            proposal_markdown={"entry_count": 0},
            source={
                "provider": "file",
                "read_only": True,
                "spec_nodes": str(self.spec_nodes_dir),
                "specgraph_dir": str(self.specgraph_dir) if self.specgraph_dir is not None else None,
                "curated_seed_source_ref": curated_seed_source_ref,
            },
            ontology_artifacts=self._read_practical_ontology_artifacts(),
        )

    def read_metrics(self) -> tuple[int, dict[str, Any]]:
        return metrics.read_file_metrics_index(runs_dir=self.runs_dir)

    def read_agent_surfaces(self) -> tuple[int, dict[str, Any]]:
        return agent_surfaces.read_file_agent_surface_index(runs_dir=self.runs_dir)

    def _local_materialized_ir_files(self) -> list[tuple[str, Path]]:
        package_index = self._read_local_runs_json(practical_ontology.PACKAGE_INDEX_ARTIFACT)
        if not package_index:
            return []
        packages = package_index.get("packages")
        if not isinstance(packages, list):
            return []
        candidates: list[tuple[str, Path]] = []
        roots: list[Path] = []
        if self.specgraph_dir is not None:
            roots.append(self.specgraph_dir)
        if self.runs_dir is not None:
            roots.append(self.runs_dir.parent)
        if (
            self.spec_nodes_dir is not None
            and self.spec_nodes_dir.name == "nodes"
            and self.spec_nodes_dir.parent.name == "specs"
        ):
            roots.append(self.spec_nodes_dir.parent.parent)
        for package in packages:
            if not isinstance(package, dict):
                continue
            raw_path = package.get("materialized_ir")
            safe_path = safe_manifest_path(raw_path)
            if safe_path is None:
                continue
            relative = Path(*PurePosixPath(safe_path).parts)
            for root in roots:
                path = root / relative
                if path.exists() and path.is_file():
                    candidates.append((safe_path, path))
                    break
        return candidates

    def _local_artifact_roots(self) -> list[Path]:
        roots: list[Path] = []
        if self.specgraph_dir is not None:
            roots.append(self.specgraph_dir)
        if self.runs_dir is not None:
            roots.append(self.runs_dir.parent)
        if (
            self.spec_nodes_dir is not None
            and self.spec_nodes_dir.name == "nodes"
            and self.spec_nodes_dir.parent.name == "specs"
        ):
            roots.append(self.spec_nodes_dir.parent.parent)
        return list(dict.fromkeys(roots))

    def _local_public_manifest(self) -> tuple[Path, dict[str, Any]] | None:
        for root in self._local_artifact_roots():
            for path in (
                root / "dist" / "specgraph-public" / "artifact_manifest.json",
                root / "artifact_manifest.json",
            ):
                if not path.exists() or not path.is_file():
                    continue
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                if not isinstance(data, dict):
                    continue
                if data.get("artifact_kind") != "specgraph_static_artifact_manifest":
                    continue
                files = data.get("files")
                if not isinstance(files, list):
                    continue
                return path.parent, data
        return None

    def _file_artifact_map(self) -> dict[str, Path]:
        manifest = self._local_public_manifest()
        if manifest is not None:
            artifact_root, manifest_data = manifest
            artifact_map: dict[str, Path] = {}
            files = manifest_data.get("files")
            assert isinstance(files, list)
            for entry in files:
                if not isinstance(entry, dict):
                    continue
                rel = safe_manifest_path(entry.get("path"))
                if rel is None:
                    continue
                path = artifact_root / Path(*PurePosixPath(rel).parts)
                if path.exists() and path.is_file():
                    artifact_map[rel] = path
            return artifact_map

        artifact_map: dict[str, Path] = {}
        if self.runs_dir is not None and self.runs_dir.exists():
            for filename in sorted(PUBLIC_SAFE_RUN_ARTIFACT_FILENAMES):
                path = self.runs_dir / filename
                if not path.is_file():
                    continue
                artifact_map[f"runs/{filename}"] = path
        for rel, path in self._local_materialized_ir_files():
            artifact_map[rel] = path
        return artifact_map

    def read_artifact_catalog(self) -> tuple[int, dict[str, Any]]:
        artifact_map = self._file_artifact_map()
        artifacts: list[dict[str, Any]] = []
        for rel, path in artifact_map.items():
            try:
                size_bytes = path.stat().st_size
            except OSError:
                continue
            artifacts.append(
                {
                    "path": rel,
                    "root": rel.split("/", 1)[0],
                    "label": artifact_label(rel),
                    "group": artifact_group(rel),
                    "size_bytes": size_bytes,
                }
            )
        return HTTPStatus.OK, build_artifact_catalog(
            source={
                "provider": "file",
                "read_only": True,
                "runs_dir": str(self.runs_dir) if self.runs_dir is not None else None,
                "specgraph_dir": str(self.specgraph_dir) if self.specgraph_dir is not None else None,
            },
            artifacts=artifacts,
        )

    def read_artifact_content(self, path: str) -> tuple[int, dict[str, Any]]:
        safe_path = safe_manifest_path(path)
        if safe_path is None:
            return HTTPStatus.BAD_REQUEST, {
                "error": "Invalid artifact path.",
                "reason": "invalid_artifact_path",
                "path": path,
            }
        artifact_map = self._file_artifact_map()
        artifact_path = artifact_map.get(safe_path)
        if artifact_path is None:
            return HTTPStatus.NOT_FOUND, {
                "error": "Artifact is not available from the configured provider.",
                "reason": "missing_artifact",
                "path": safe_path,
            }
        try:
            size_bytes = artifact_path.stat().st_size
        except OSError as exc:
            return HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "Artifact could not be inspected.",
                "reason": "artifact_stat_failed",
                "path": safe_path,
                "detail": str(exc),
            }
        if size_bytes > ARTIFACT_CONTENT_MAX_BYTES:
            return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {
                "error": "Artifact exceeds preview limit.",
                "reason": "artifact_too_large",
                "path": safe_path,
                "max_bytes": ARTIFACT_CONTENT_MAX_BYTES,
            }
        try:
            text = artifact_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            return HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "Artifact could not be read.",
                "reason": "artifact_read_failed",
                "path": safe_path,
                "detail": str(exc),
            }
        return HTTPStatus.OK, decode_artifact_content(
            path=safe_path,
            text=text,
            source={
                "provider": "file",
                "read_only": True,
            },
        )

    def read_ontology_semantic_review_surface(self) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_ontology_semantic_review_surface(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
        )

    def read_ontology_review_dashboard(self) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_ontology_review_dashboard(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
        )

    def read_ontology_owner_decision_review(self) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_ontology_owner_decision_review(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
        )

    def read_spec_ontology_validation_report(self) -> tuple[int, dict[str, Any]]:
        return specgraph_surfaces.read_spec_ontology_validation_report(
            spec_dir=self.spec_nodes_dir,
            runs_dir=self.runs_dir,
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

    def _manifest_path_set(self, manifest: dict[str, Any]) -> set[str]:
        return {entry_path for entry_path in self._paths_for(manifest, prefix="")}

    def _has_artifact(
        self,
        manifest: dict[str, Any],
        path: str,
        *,
        manifest_paths: set[str] | None = None,
    ) -> bool:
        if safe_manifest_path(path) is None:
            return False
        return path in (manifest_paths if manifest_paths is not None else self._manifest_path_set(manifest))

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
            return HTTPStatus.NOT_FOUND, {
                "error": f"{filename} not found. Run {build_hint} first.",
                "reason": "missing_artifact",
                "artifact": path,
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
            }

        status, text, error = self._read_artifact_text(path)
        if error is not None:
            error.setdefault("reason", "artifact_fetch_failed")
            error.setdefault("artifact", path)
            return status, error
        assert text is not None
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            return HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": f"{filename} is not valid JSON",
                "reason": "invalid_json",
                "artifact": path,
                "path": self._artifact_url(path),
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
                "spec_markdown_export": bool(self._paths_for(manifest, prefix="specs/nodes/", suffix=".yaml")),
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

    def read_spec_markdown(self, root_id: str, options: spec_compile.CompileOptions) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        nodes, load_errors = self._load_spec_nodes(manifest)
        return build_spec_markdown_response(
            nodes=nodes,
            load_errors=load_errors,
            root_id=root_id,
            options=options,
            source={
                "provider": "http",
                "read_only": True,
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
                "generated_at": manifest.get("generated_at"),
                "git": manifest.get("git") if isinstance(manifest.get("git"), dict) else None,
            },
        )

    def compile_spec_markdown(
        self,
        handler: CapabilityContext,
        root_id: str,
        options: spec_compile.CompileOptions,
        *,
        scope: str,
    ) -> tuple[int, dict[str, Any]]:
        return compile_spec_markdown_with_provider(self, handler, root_id, options, scope=scope)

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

    def _read_optional_proposal_artifact(
        self,
        manifest: dict[str, Any],
        name: str,
        filename: str,
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        path = f"runs/{filename}"
        if not self._has_artifact(manifest, path):
            return proposals.empty_source(
                name,
                filename,
                reason="missing_artifact",
                path=f"{self.normalized_base_url}/{path}",
            ), None

        status, text, error = self._read_artifact_text(path)
        url = self._artifact_url(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            detail = error["detail"] if error is not None else f"HTTP {int(status)}"
            return {
                "available": False,
                "artifact": path,
                "path": url,
                "entry_count": 0,
                "reason": "artifact_fetch_failed",
                "detail": detail,
            }, None

        data, source_error = proposals.decode_json_artifact_text(
            text,
            artifact=path,
            path=url,
        )
        if source_error is not None:
            return source_error, None
        assert data is not None
        artifact = http_envelope(url, manifest, data)
        return proposals.artifact_source(name, filename, artifact), artifact

    def _collect_http_proposal_markdown(self, manifest: dict[str, Any]) -> dict[str, Any]:
        paths = self._paths_for(manifest, prefix="docs/proposals/", suffix=".md")
        if not paths:
            return {
                "available": False,
                "path": f"{self.normalized_base_url}/docs/proposals",
                "entry_count": 0,
                "entries": [],
                "reason": "proposals_dir_missing",
            }

        entries: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        for path in paths:
            status, text, error = self._read_artifact_text(path)
            if error is not None or status != HTTPStatus.OK or text is None:
                errors.append({
                    "file_name": PurePosixPath(path).name,
                    "error": error["detail"] if error is not None else f"HTTP {int(status)}",
                })
                continue
            file_name = PurePosixPath(path).name
            entries.append({
                "proposal_id": PurePosixPath(path).stem.split("_", 1)[0],
                "title": proposals.extract_proposal_title(text, PurePosixPath(path).stem),
                "status": proposals.extract_proposal_status(text) or "Unknown",
                "content_excerpt": proposals.extract_proposal_excerpt(text),
                "content_preview": proposals.extract_proposal_excerpt(text, max_length=1200),
                "content_body": text,
                "file_name": file_name,
                "relative_path": path,
                "path": self._artifact_url(path),
            })

        return {
            "available": True,
            "path": f"{self.normalized_base_url}/docs/proposals",
            "entry_count": len(entries),
            "entries": entries,
            "errors": errors,
        }

    def read_proposals(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None

        sources: dict[str, dict[str, Any]] = {}
        artifacts: dict[str, dict[str, Any] | None] = {}
        for name, filename in proposals.PROPOSAL_ARTIFACTS.items():
            source, artifact = self._read_optional_proposal_artifact(manifest, name, filename)
            sources[name] = source
            artifacts[name] = artifact

        return HTTPStatus.OK, proposals.build_proposal_index(
            artifacts=artifacts,
            sources=sources,
            markdown=self._collect_http_proposal_markdown(manifest),
            source={
                "provider": "http",
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
            },
        )

    def _read_optional_runs_json_data(
        self,
        manifest: dict[str, Any],
        filename: str,
    ) -> dict[str, Any] | None:
        path = f"runs/{filename}"
        if not self._has_artifact(manifest, path):
            return None
        status, text, error = self._read_artifact_text(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None

    def _read_http_normalized_ir(
        self,
        manifest: dict[str, Any],
        package_index: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if not package_index:
            return None
        packages = package_index.get("packages")
        package = (
            packages[0]
            if isinstance(packages, list) and packages and isinstance(packages[0], dict)
            else None
        )
        if not package:
            return None
        raw_path = package.get("materialized_ir")
        path = safe_manifest_path(raw_path)
        if path is None or not self._has_artifact(manifest, path):
            return None
        status, text, error = self._read_artifact_text(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None

    def _read_practical_ontology_artifacts(self, manifest: dict[str, Any]) -> dict[str, Any]:
        filenames = (
            practical_ontology.PACKAGE_INDEX_ARTIFACT,
            practical_ontology.BINDING_PREVIEW_ARTIFACT,
            practical_ontology.GAP_INDEX_ARTIFACT,
            practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT,
            practical_ontology.GOVERNANCE_EVIDENCE_INDEX_ARTIFACT,
        )
        artifacts = {
            filename: payload
            for filename in filenames
            if (payload := self._read_optional_runs_json_data(manifest, filename)) is not None
        }
        normalized_ir = self._read_http_normalized_ir(
            manifest,
            artifacts.get(practical_ontology.PACKAGE_INDEX_ARTIFACT),
        )
        if normalized_ir is not None:
            artifacts[practical_ontology.NORMALIZED_IR_ARTIFACT_KEY] = normalized_ir
        return artifacts

    def read_practical_ontology(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        curated_seed_source_ref = (
            practical_ontology.CURATED_SOURCE_REF
            if self._has_artifact(manifest, "specs/nodes/SG-SPEC-0001.yaml")
            else practical_ontology.CONCEPTUAL_CURATED_SOURCE_REF
        )
        return HTTPStatus.OK, practical_ontology.build_practical_ontology(
            nodes=[],
            load_errors=[],
            proposal_markdown={"entry_count": 0},
            source={
                "provider": "http",
                "read_only": True,
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
                "generated_at": manifest.get("generated_at"),
                "git": manifest.get("git") if isinstance(manifest.get("git"), dict) else None,
                "curated_seed_source_ref": curated_seed_source_ref,
            },
            ontology_artifacts=self._read_practical_ontology_artifacts(manifest),
        )

    def _read_optional_metrics_artifact(
        self,
        manifest: dict[str, Any],
        name: str,
        filename: str,
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        path = f"runs/{filename}"
        if not self._has_artifact(manifest, path):
            return metrics.empty_source(
                name,
                filename,
                reason="missing_artifact",
                path=f"{self.normalized_base_url}/{path}",
            ), None

        status, text, error = self._read_artifact_text(path)
        url = self._artifact_url(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            detail = error["detail"] if error is not None else f"HTTP {int(status)}"
            return {
                "available": False,
                "artifact": path,
                "path": url,
                "entry_count": 0,
                "reason": "artifact_fetch_failed",
                "detail": detail,
            }, None

        data, source_error = metrics.decode_json_artifact_text(
            text,
            artifact=path,
            path=url,
        )
        if source_error is not None:
            return source_error, None
        assert data is not None
        artifact = http_envelope(url, manifest, data)
        return metrics.artifact_source(name, filename, artifact), artifact

    def read_metrics(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None

        sources: dict[str, dict[str, Any]] = {}
        artifacts: dict[str, dict[str, Any] | None] = {}
        for name, filename in metrics.METRICS_ARTIFACTS.items():
            source, artifact = self._read_optional_metrics_artifact(manifest, name, filename)
            sources[name] = source
            artifacts[name] = artifact

        return HTTPStatus.OK, metrics.build_metrics_index(
            artifacts=artifacts,
            sources=sources,
            source={
                "provider": "http",
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
            },
        )

    def _read_optional_agent_surface_artifact(
        self,
        manifest: dict[str, Any],
        name: str,
        filename: str,
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        path = f"runs/{filename}"
        if not self._has_artifact(manifest, path):
            return agent_surfaces.empty_source(
                name,
                filename,
                reason="missing_artifact",
                path=f"{self.normalized_base_url}/{path}",
            ), None

        status, text, error = self._read_artifact_text(path)
        url = self._artifact_url(path)
        if error is not None or status != HTTPStatus.OK or text is None:
            detail = error["detail"] if error is not None else f"HTTP {int(status)}"
            return {
                "available": False,
                "artifact": path,
                "path": url,
                "entry_count": 0,
                "reason": "artifact_fetch_failed",
                "detail": detail,
            }, None

        data, source_error = agent_surfaces.decode_json_artifact_text(
            text,
            artifact=path,
            path=url,
        )
        if source_error is not None:
            return source_error, None
        assert data is not None
        artifact = http_envelope(url, manifest, data)
        return agent_surfaces.artifact_source(name, filename, artifact), artifact

    def _read_optional_agent_runtime_evidence_detail(
        self,
        manifest: dict[str, Any],
        ref: str,
        *,
        manifest_paths: set[str] | None = None,
    ) -> dict[str, Any]:
        safe_ref = agent_surfaces.safe_runtime_evidence_detail_ref(ref)
        if safe_ref is None:
            return agent_surfaces.runtime_evidence_detail_unavailable(
                "unsafe_evidence_ref",
                "Runtime evidence detail refs must be repo-relative paths under runs/agent_runtime_enforcement_evidence/.",
            )
        if not self._has_artifact(manifest, safe_ref, manifest_paths=manifest_paths):
            return agent_surfaces.runtime_evidence_detail_unavailable(
                "missing_detail_artifact",
                f"{safe_ref} is not available.",
            )
        status, text, error = self._read_artifact_text(safe_ref)
        if error is not None or status != HTTPStatus.OK or text is None:
            detail = error["detail"] if error is not None else f"HTTP {int(status)}"
            return agent_surfaces.runtime_evidence_detail_unavailable(
                "invalid_detail_artifact",
                detail,
            )
        data, source_error = agent_surfaces.decode_json_artifact_text(
            text,
            artifact=safe_ref,
            path=self._artifact_url(safe_ref),
        )
        if source_error is not None or data is None:
            return agent_surfaces.runtime_evidence_detail_unavailable(
                "invalid_detail_artifact",
                str((source_error or {}).get("detail") or (source_error or {}).get("reason") or "Invalid JSON."),
            )
        return agent_surfaces.runtime_evidence_detail_from_data(data)

    def read_agent_surfaces(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None

        sources: dict[str, dict[str, Any]] = {}
        artifacts: dict[str, dict[str, Any] | None] = {}
        for name, filename in agent_surfaces.AGENT_SURFACE_ARTIFACTS.items():
            source, artifact = self._read_optional_agent_surface_artifact(manifest, name, filename)
            sources[name] = source
            artifacts[name] = artifact
        runtime_evidence_entries = agent_surfaces._list_of_dicts(
            agent_surfaces._artifact_data(artifacts, "runtime_evidence").get("entries")
        )
        manifest_paths = self._manifest_path_set(manifest)
        runtime_evidence_details = {
            ref: self._read_optional_agent_runtime_evidence_detail(
                manifest,
                ref,
                manifest_paths=manifest_paths,
            )
            for ref in agent_surfaces.runtime_evidence_detail_refs(runtime_evidence_entries)
        }

        return HTTPStatus.OK, agent_surfaces.build_agent_surface_index(
            artifacts=artifacts,
            sources=sources,
            source={
                "provider": "http",
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
            },
            runtime_evidence_details=runtime_evidence_details,
        )

    def _http_materialized_ir_refs(self, manifest: dict[str, Any]) -> set[str]:
        package_index = self._read_optional_runs_json_data(
            manifest,
            practical_ontology.PACKAGE_INDEX_ARTIFACT,
        )
        if not package_index:
            return set()
        packages = package_index.get("packages")
        if not isinstance(packages, list):
            return set()
        refs: set[str] = set()
        for package in packages:
            if not isinstance(package, dict):
                continue
            path = safe_manifest_path(package.get("materialized_ir"))
            if path is not None:
                refs.add(path)
        return refs

    def read_artifact_catalog(self) -> tuple[int, dict[str, Any]]:
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        materialized_ir_refs = self._http_materialized_ir_refs(manifest)
        artifacts: list[dict[str, Any]] = []
        for entry in self._manifest_files(manifest):
            path = safe_manifest_path(entry.get("path"))
            if path is None:
                continue
            group = "ontology_ir" if path in materialized_ir_refs else artifact_group(path)
            artifacts.append(
                {
                    "path": path,
                    "root": entry.get("root") if isinstance(entry.get("root"), str) else path.split("/", 1)[0],
                    "label": artifact_label(path),
                    "group": group,
                    "size_bytes": entry.get("size_bytes") if isinstance(entry.get("size_bytes"), int) else None,
                    "sha256": entry.get("sha256") if isinstance(entry.get("sha256"), str) else None,
                    "url": self._artifact_url(path),
                    "referenced_by_package_index": path in materialized_ir_refs,
                }
            )
        return HTTPStatus.OK, build_artifact_catalog(
            source={
                "provider": "http",
                "read_only": True,
                "artifact_base_url": self.normalized_base_url,
                "manifest": self.manifest_url,
            },
            artifacts=artifacts,
            manifest=manifest,
        )

    def read_artifact_content(self, path: str) -> tuple[int, dict[str, Any]]:
        safe_path = safe_manifest_path(path)
        if safe_path is None:
            return HTTPStatus.BAD_REQUEST, {
                "error": "Invalid artifact path.",
                "reason": "invalid_artifact_path",
                "path": path,
            }
        manifest, manifest_error = self._read_manifest()
        if manifest_error is not None:
            return HTTPStatus.SERVICE_UNAVAILABLE, manifest_error
        assert manifest is not None
        if not self._has_artifact(manifest, safe_path):
            return HTTPStatus.NOT_FOUND, {
                "error": "Artifact is not listed in artifact_manifest.json.",
                "reason": "missing_artifact",
                "path": safe_path,
                "manifest": self.manifest_url,
            }
        manifest_entry = next(
            (
                entry
                for entry in self._manifest_files(manifest)
                if safe_manifest_path(entry.get("path")) == safe_path
            ),
            None,
        )
        manifest_size = (
            manifest_entry.get("size_bytes")
            if isinstance(manifest_entry, dict) and isinstance(manifest_entry.get("size_bytes"), int)
            else None
        )
        if manifest_size is not None and manifest_size > ARTIFACT_CONTENT_MAX_BYTES:
            return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {
                "error": "Artifact exceeds preview limit.",
                "reason": "artifact_too_large",
                "path": safe_path,
                "max_bytes": ARTIFACT_CONTENT_MAX_BYTES,
            }
        url = self._artifact_url(safe_path)
        status, text, error = http_get_text(url, max_bytes=ARTIFACT_CONTENT_MAX_BYTES)
        if error is not None or status != HTTPStatus.OK or text is None:
            return status, {
                "error": "Artifact could not be read.",
                "reason": "artifact_fetch_failed",
                "path": safe_path,
                "url": url,
                "detail": error["detail"] if error is not None else f"HTTP {int(status)}",
            }
        return HTTPStatus.OK, decode_artifact_content(
            path=safe_path,
            text=text,
            source={
                "provider": "http",
                "read_only": True,
                "url": url,
                "manifest": self.manifest_url,
            },
        )

    def read_ontology_semantic_review_surface(self) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            specgraph_surfaces.ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME,
            build_hint=(
                f"{specgraph_surfaces.ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} "
                "in SpecGraph"
            ),
        )
        if status != HTTPStatus.OK:
            return status, payload
        return specgraph_surfaces.validate_ontology_semantic_review_surface_envelope(payload)

    def read_ontology_review_dashboard(self) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            specgraph_surfaces.ONTOLOGY_REVIEW_DASHBOARD_FILENAME,
            build_hint=(
                f"{specgraph_surfaces.ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} "
                "in SpecGraph"
            ),
        )
        if status != HTTPStatus.OK:
            return status, payload
        return specgraph_surfaces.validate_ontology_review_dashboard_envelope(payload)

    def read_ontology_owner_decision_review(self) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            specgraph_surfaces.ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME,
            build_hint=(
                f"{specgraph_surfaces.ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} "
                "in SpecGraph"
            ),
        )
        if status != HTTPStatus.OK:
            return status, payload
        return specgraph_surfaces.validate_ontology_owner_decision_review_envelope(payload)

    def read_spec_ontology_validation_report(self) -> tuple[int, dict[str, Any]]:
        status, payload = self._read_json_artifact(
            specgraph_surfaces.SPEC_ONTOLOGY_VALIDATION_FILENAME,
            build_hint=(
                f"{specgraph_surfaces.SPEC_ONTOLOGY_VALIDATION_BUILD_HINT} "
                "in SpecGraph"
            ),
        )
        if status != HTTPStatus.OK:
            return status, payload
        return specgraph_surfaces.validate_spec_ontology_validation_envelope(payload)

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


def specpm_registry_url_from_server(server: Any) -> str | None:
    registry_url = getattr(server, "specpm_registry_url", None)
    return registry_url.strip().rstrip("/") if isinstance(registry_url, str) and registry_url.strip() else None


def health_with_specpm_registry(server: Any, provider: SpecSpaceProvider) -> dict[str, Any]:
    health = provider.health()
    sources = health.get("sources")
    if not isinstance(sources, dict):
        return health
    return {
        **health,
        "sources": {
            **sources,
            SPECPM_REGISTRY_SOURCE_NAME: specpm_registry_source(
                specpm_registry_url_from_server(server)
            ),
            "agent_workbench_conversations": agent_workbench.agent_workbench_source(server),
        },
    }


def _specpm_registry_endpoint_url(registry_url: str, endpoint: str) -> str:
    return f"{registry_url.rstrip('/')}/{endpoint.lstrip('/')}"


def _read_specpm_registry_json(registry_url: str, endpoint: str) -> tuple[int, dict[str, Any] | None, dict[str, Any] | None]:
    url = _specpm_registry_endpoint_url(registry_url, endpoint)
    status, text, error = http_get_text(url)
    if error is not None:
        return status, None, {
            "error": f"SpecPM registry endpoint {endpoint} could not be read.",
            "reason": "registry_fetch_failed",
            "path": url,
            "detail": error["detail"],
        }
    if status != HTTPStatus.OK or text is None:
        return status, None, {
            "error": f"SpecPM registry endpoint {endpoint} returned HTTP {int(status)}.",
            "reason": "registry_http_error",
            "path": url,
        }
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, None, {
            "error": f"SpecPM registry endpoint {endpoint} is not valid JSON.",
            "reason": "invalid_json",
            "path": url,
            "detail": str(exc),
        }
    if not isinstance(payload, dict):
        return HTTPStatus.UNPROCESSABLE_ENTITY, None, {
            "error": f"SpecPM registry endpoint {endpoint} did not return a JSON object.",
            "reason": "invalid_payload",
            "path": url,
        }
    if payload.get("apiVersion") != SPECPM_REGISTRY_API_VERSION:
        return HTTPStatus.UNPROCESSABLE_ENTITY, None, {
            "error": f"SpecPM registry endpoint {endpoint} has unsupported apiVersion.",
            "reason": "unsupported_api_version",
            "path": url,
            "apiVersion": payload.get("apiVersion"),
        }
    return HTTPStatus.OK, payload, None


def read_specpm_registry_summary(server: Any) -> tuple[int, dict[str, Any]]:
    registry_url = specpm_registry_url_from_server(server)
    if registry_url is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "api_version": SPECSPACE_API_VERSION,
            "error": "SpecPM registry source is not configured.",
            "source": specpm_registry_source(None),
        }

    status_code, status_payload, status_error = _read_specpm_registry_json(registry_url, "v0/status")
    if status_error is not None:
        return status_code, {
            "api_version": SPECSPACE_API_VERSION,
            "source": specpm_registry_source(registry_url),
            **status_error,
        }
    package_status, packages_payload, packages_error = _read_specpm_registry_json(registry_url, "v0/packages")
    if packages_error is not None:
        return package_status, {
            "api_version": SPECSPACE_API_VERSION,
            "source": specpm_registry_source(registry_url),
            **packages_error,
        }
    assert status_payload is not None
    assert packages_payload is not None
    return HTTPStatus.OK, {
        "api_version": SPECSPACE_API_VERSION,
        "source": specpm_registry_source(registry_url),
        "registry": status_payload,
        "packages": packages_payload,
    }


def _specpm_registry_not_configured_payload() -> dict[str, Any]:
    return {
        "api_version": SPECSPACE_API_VERSION,
        "error": "SpecPM registry source is not configured.",
        "source": specpm_registry_source(None),
    }


def _specpm_registry_bad_request_payload(error: str) -> dict[str, Any]:
    return {
        "api_version": SPECSPACE_API_VERSION,
        "error": error,
    }


def _has_dot_path_segment(value: str) -> bool:
    return any(segment in {".", ".."} for segment in value.split("/"))


def _read_configured_specpm_registry_endpoint(
    server: Any,
    endpoint: str,
) -> tuple[int, dict[str, Any]]:
    registry_url = specpm_registry_url_from_server(server)
    if registry_url is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _specpm_registry_not_configured_payload()

    status, payload, error = _read_specpm_registry_json(registry_url, endpoint)
    if error is not None:
        return status, {
            "api_version": SPECSPACE_API_VERSION,
            "source": specpm_registry_source(registry_url),
            **error,
        }
    assert payload is not None
    return HTTPStatus.OK, {
        "api_version": SPECSPACE_API_VERSION,
        "source": specpm_registry_source(registry_url),
        "data": payload,
    }


def read_specpm_registry_package(server: Any, package_id: str) -> tuple[int, dict[str, Any]]:
    if _has_dot_path_segment(package_id):
        return HTTPStatus.BAD_REQUEST, _specpm_registry_bad_request_payload(
            "SpecPM package id must not contain dot path segments.",
        )

    return _read_configured_specpm_registry_endpoint(
        server,
        f"v0/packages/{quote(package_id, safe='')}",
    )


def read_specpm_registry_package_version(
    server: Any,
    package_id: str,
    version: str,
) -> tuple[int, dict[str, Any]]:
    if _has_dot_path_segment(package_id):
        return HTTPStatus.BAD_REQUEST, _specpm_registry_bad_request_payload(
            "SpecPM package id must not contain dot path segments.",
        )

    return _read_configured_specpm_registry_endpoint(
        server,
        f"v0/packages/{quote(package_id, safe='')}/versions/{quote(version, safe='')}",
    )


def versioned_capabilities(handler: CapabilityContext, provider: SpecSpaceProvider) -> dict[str, Any]:
    capabilities = provider.capabilities(handler)
    diagnostics = capabilities_api.build_capability_diagnostics(
        handler,
        provider_kind=provider.kind,
        capabilities=capabilities,
    )
    capabilities = {
        **capabilities,
        "hyperprompt_compile": bool(diagnostics["hyperprompt_compile"]["available"]),
        "agent_passport_cli": bool(diagnostics["agent_passport_cli"]["available"]),
    }
    return {
        "api_version": SPECSPACE_API_VERSION,
        "capabilities": capabilities,
        "diagnostics": diagnostics,
        "provider": {
            "kind": provider.kind,
            "read_only": True,
            "health": provider.health()["status"],
        },
    }
