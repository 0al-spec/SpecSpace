from __future__ import annotations

import hashlib
import json
from http import HTTPStatus
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest import mock

from viewer import product_workspace_binding, specspace_provider, specspace_v1_api


def _binding(workspace_id: str, display_name: str) -> dict:
    logical = {
        "workspace_id": workspace_id,
        "display_name": display_name,
        "route": f"/{workspace_id}",
        "repository_role": "product_spec_workspace",
        "governance_profile": "product_workspace",
        "specspace_state_namespace_ref": (
            f"specspace-state://workspace/{workspace_id}"
        ),
        "platform_default_run_dir_ref": f"runs/{workspace_id}",
        "product_artifact_bundle_ref": f"workspaces/{workspace_id}",
        "product_artifact_manifest_ref": (
            f"workspaces/{workspace_id}/artifact_manifest.json"
        ),
        "root_artifact_base_url": "https://specgraph.tech",
        "product_artifact_base_url": (
            f"https://specgraph.tech/workspaces/{workspace_id}"
        ),
    }
    revision = hashlib.sha256(
        json.dumps(logical, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return {
        "artifact_kind": "platform_product_workspace_binding",
        "schema_version": 1,
        "contract_ref": "platform.product-workspace.binding.v1",
        "binding_id": f"product-workspace-binding://{workspace_id}",
        "binding_revision_sha256": revision,
        "status": "ready",
        "identity": {
            "workspace_id": workspace_id,
            "display_name": display_name,
            "route": f"/{workspace_id}",
            "governance_profile": "product_workspace",
            "repository_role": "product_spec_workspace",
        },
        "routing": {
            "specspace_state_namespace_ref": (
                f"specspace-state://workspace/{workspace_id}"
            ),
            "product_artifact_bundle_ref": f"workspaces/{workspace_id}",
            "product_artifact_manifest_ref": (
                f"workspaces/{workspace_id}/artifact_manifest.json"
            ),
            "root_artifact_base_url": "https://specgraph.tech",
            "product_artifact_base_url": (
                f"https://specgraph.tech/workspaces/{workspace_id}"
            ),
            "product_artifact_manifest_url": (
                f"https://specgraph.tech/workspaces/{workspace_id}/artifact_manifest.json"
            ),
        },
        "execution": {
            "workspace_root": f"/tmp/{workspace_id}",
            "workspace_runs_root": f"/tmp/{workspace_id}/runs",
            "platform_default_run_dir_ref": f"runs/{workspace_id}",
            "local_only": True,
        },
        "repository": {
            "repository_role": "product_spec_workspace",
            "workspace_identity": workspace_id,
            "worktree_identity": f"product-workspace/{workspace_id}",
            "creates_worktree": False,
        },
        "provenance": {
            "plan_ref": f"runs/{workspace_id}/plan.json",
            "plan_sha256": "1" * 64,
            "specgraph_initialization_report_ref": (
                f"runs/{workspace_id}/product_workspace_initialization.json"
            ),
            "specgraph_initialization_report_sha256": "2" * 64,
        },
        "privacy_boundary": {
            "public_safe_projection_available": True,
            "local_execution_paths_public": False,
            "raw_idea_public": False,
        },
        "binding_authority": {
            "report_only": True,
            "may_execute_platform": False,
            "may_execute_specgraph": False,
            "may_mutate_specspace_state": False,
            "may_write_catalog": False,
            "may_create_git_commit": False,
        },
    }


def _write_report(runs_dir: Path, workspace_id: str, display_name: str) -> Path:
    path = (
        runs_dir
        / workspace_id
        / product_workspace_binding.INITIALIZATION_REPORT_FILENAME
    )
    path.parent.mkdir(parents=True)
    path.write_text(
        json.dumps(
            {
                "artifact_kind": (
                    "platform_product_workspace_initialization_execution_report"
                ),
                "generated_at": "2026-07-10T12:00:00Z",
                "ok": True,
                "dry_run": False,
                "workspace": {"workspace_id": workspace_id},
                "workspace_binding": _binding(workspace_id, display_name),
                "summary": {
                    "status": "workspace_initialization_executed",
                    "specgraph_executed": True,
                    "catalog_written": True,
                    "workspace_files_created": True,
                    "error_count": 0,
                },
            }
        ),
        encoding="utf-8",
    )
    return path


def test_discovers_ready_binding_and_resolves_bound_runs_dir(tmp_path: Path) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    server = SimpleNamespace(runs_dir=runs_dir)

    projection = product_workspace_binding.discover_binding(
        server,
        workspace_id="pantry-rotation",
    )

    assert projection["status"] == "ready"
    assert projection["trusted"] is True
    assert projection["binding_id"] == (
        "product-workspace-binding://pantry-rotation"
    )
    assert projection["source_ref"] == (
        "runs/pantry-rotation/platform_product_workspace_initialization_execution_report.json"
    )
    assert projection["routing"]["specspace_state_namespace_ref"] == (
        "specspace-state://workspace/pantry-rotation"
    )
    assert "/tmp/pantry-rotation" not in json.dumps(projection)
    assert product_workspace_binding.workspace_runs_dir(
        server,
        workspace_id="pantry-rotation",
    ) == runs_dir / "pantry-rotation"


def test_projects_public_initialization_binding_without_local_paths(tmp_path: Path) -> None:
    report_path = _write_report(tmp_path / "runs", "pantry-rotation", "Pantry Rotation")
    report_bytes = report_path.read_bytes()

    projection = product_workspace_binding.project_published_initialization_binding(
        json.loads(report_bytes),
        workspace_id="pantry-rotation",
        source_ref="runs/platform_product_workspace_initialization_execution_report.json",
        source_sha256=hashlib.sha256(report_bytes).hexdigest(),
    )

    assert projection["status"] == "ready"
    assert projection["trusted"] is True
    assert projection["routing"]["platform_default_run_dir_ref"] == (
        "runs/pantry-rotation"
    )
    assert "/tmp/pantry-rotation" not in json.dumps(projection)


def test_readonly_provider_binding_survives_missing_local_binding() -> None:
    local_binding = {
        "available": False,
        "status": "missing",
        "trusted": False,
        "workspace_id": "pantry-rotation",
    }
    with tempfile.TemporaryDirectory() as tmp:
        report_path = _write_report(Path(tmp) / "runs", "pantry-rotation", "Pantry Rotation")
        report_bytes = report_path.read_bytes()
        provider_binding = product_workspace_binding.project_published_initialization_binding(
            json.loads(report_bytes),
            workspace_id="pantry-rotation",
            source_ref="runs/platform_product_workspace_initialization_execution_report.json",
            source_sha256=hashlib.sha256(report_bytes).hexdigest(),
        )

    selected = specspace_v1_api._select_workspace_binding(
        local_binding,
        provider_binding,
        workspace_id="pantry-rotation",
    )

    assert selected is provider_binding


def test_local_ready_binding_has_priority_over_provider_projection() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        local_path = _write_report(root / "local", "pantry-rotation", "Pantry Rotation")
        provider_path = _write_report(root / "provider", "pantry-rotation", "Pantry Rotation")
        local_bytes = local_path.read_bytes()
        provider_bytes = provider_path.read_bytes()
        local_binding = product_workspace_binding.project_published_initialization_binding(
            json.loads(local_bytes),
            workspace_id="pantry-rotation",
            source_ref="runs/pantry-rotation/platform_product_workspace_initialization_execution_report.json",
            source_sha256=hashlib.sha256(local_bytes).hexdigest(),
        )
        provider_binding = product_workspace_binding.project_published_initialization_binding(
            json.loads(provider_bytes),
            workspace_id="pantry-rotation",
            source_ref="runs/platform_product_workspace_initialization_execution_report.json",
            source_sha256=hashlib.sha256(provider_bytes).hexdigest(),
        )

    selected = specspace_v1_api._select_workspace_binding(
        local_binding,
        provider_binding,
        workspace_id="pantry-rotation",
    )

    assert selected is local_binding


def test_spoofed_provider_binding_is_not_selected() -> None:
    local_binding = {
        "available": False,
        "status": "legacy_read_only",
        "trusted": False,
        "workspace_id": "pantry-rotation",
    }
    provider_binding = {
        "available": True,
        "status": "ready",
        "trusted": True,
        "workspace_id": "pantry-rotation",
        "binding_id": "product-workspace-binding://pantry-rotation",
        "authority_boundary": {"report_only": True, "may_execute_platform": True},
    }

    selected = specspace_v1_api._select_workspace_binding(
        local_binding,
        provider_binding,
        workspace_id="pantry-rotation",
    )

    assert selected is local_binding


def test_http_workspace_bootstrap_binding_loads_scoped_candidate(tmp_path: Path) -> None:
    report_path = _write_report(tmp_path / "runs", "pantry-rotation", "Pantry Rotation")
    report_bytes = report_path.read_bytes()
    active_candidate = {
        "artifact_kind": "active_idea_to_spec_candidate",
        "canonical_mutations_allowed": False,
        "source_mode": "active_candidate",
        "candidate": {
            "candidate_id": "pantry-rotation",
            "display_name": "Pantry Rotation",
            "public_route": "/pantry-rotation",
            "target_repository_role": "product_spec_workspace",
            "governance_profile": "product_workspace",
        },
        "readiness": {"ready": True, "blocked_by": []},
    }
    active_bytes = json.dumps(active_candidate).encode()
    initialization_path = (
        "runs/platform_product_workspace_initialization_execution_report.json"
    )
    active_path = "runs/pantry-rotation/active_idea_to_spec_candidate.json"
    manifest = {
        "artifact_kind": "specgraph_static_artifact_manifest",
        "files": [
            {
                "path": initialization_path,
                "sha256": hashlib.sha256(report_bytes).hexdigest(),
            },
            {
                "path": active_path,
                "sha256": hashlib.sha256(active_bytes).hexdigest(),
            },
        ],
    }
    delegate = specspace_provider.HttpSpecGraphProvider(
        base_url="https://specgraph.tech/workspaces/pantry-rotation",
        cache=specspace_provider.HttpArtifactCache(
            manifest=manifest,
            manifest_loaded_at=float("inf"),
        ),
    )
    provider = specspace_provider.ProductWorkspaceHttpProvider(
        delegate=delegate,
        workspace_id="pantry-rotation",
    )

    def get_text(url: str, **_kwargs: object) -> tuple[HTTPStatus, str, None]:
        if url.endswith(initialization_path):
            return HTTPStatus.OK, report_bytes.decode(), None
        if url.endswith(active_path):
            return HTTPStatus.OK, active_bytes.decode(), None
        raise AssertionError(f"unexpected artifact fetch: {url}")

    with mock.patch.object(specspace_provider, "http_get_text", side_effect=get_text):
        artifacts, binding = provider._workspace_artifacts(manifest)
        status, payload = provider.read_idea_to_spec_workspace()

    assert binding["status"] == "ready"
    assert "active_idea_to_spec_candidate.json" in artifacts
    assert status == HTTPStatus.OK
    assert payload["workspace"]["id"] == "pantry-rotation"
    assert payload["workspace_binding"]["status"] == "ready"
    assert payload["workspace_binding"]["trusted"] is True


def test_bound_http_workspace_does_not_fallback_to_shared_candidate(tmp_path: Path) -> None:
    report_path = _write_report(tmp_path / "runs", "pantry-rotation", "Pantry Rotation")
    report_bytes = report_path.read_bytes()
    shared_candidate = {
        "artifact_kind": "active_idea_to_spec_candidate",
        "canonical_mutations_allowed": False,
        "candidate": {
            "candidate_id": "team-decision-log",
            "public_route": "/team-decision-log",
        },
        "readiness": {"ready": True, "blocked_by": []},
    }
    shared_bytes = json.dumps(shared_candidate).encode()
    initialization_path = (
        "runs/platform_product_workspace_initialization_execution_report.json"
    )
    shared_path = "runs/active_idea_to_spec_candidate.json"
    manifest = {
        "artifact_kind": "specgraph_static_artifact_manifest",
        "files": [
            {
                "path": initialization_path,
                "sha256": hashlib.sha256(report_bytes).hexdigest(),
            },
            {
                "path": shared_path,
                "sha256": hashlib.sha256(shared_bytes).hexdigest(),
            },
        ],
    }
    delegate = specspace_provider.HttpSpecGraphProvider(
        base_url="https://specgraph.tech/workspaces/pantry-rotation",
        cache=specspace_provider.HttpArtifactCache(
            manifest=manifest,
            manifest_loaded_at=float("inf"),
        ),
    )
    provider = specspace_provider.ProductWorkspaceHttpProvider(
        delegate=delegate,
        workspace_id="pantry-rotation",
    )

    def get_text(url: str, **_kwargs: object) -> tuple[HTTPStatus, str, None]:
        if url.endswith(initialization_path):
            return HTTPStatus.OK, report_bytes.decode(), None
        if url.endswith(shared_path):
            return HTTPStatus.OK, shared_bytes.decode(), None
        raise AssertionError(f"unexpected artifact fetch: {url}")

    with mock.patch.object(specspace_provider, "http_get_text", side_effect=get_text):
        artifacts, binding = provider._workspace_artifacts(manifest)

    assert binding["status"] == "ready"
    assert "active_idea_to_spec_candidate.json" not in artifacts


def test_http_workspace_rejects_bootstrap_digest_mismatch(tmp_path: Path) -> None:
    report_path = _write_report(tmp_path / "runs", "pantry-rotation", "Pantry Rotation")
    report_bytes = report_path.read_bytes()
    initialization_path = (
        "runs/platform_product_workspace_initialization_execution_report.json"
    )
    manifest = {
        "artifact_kind": "specgraph_static_artifact_manifest",
        "files": [{"path": initialization_path, "sha256": "0" * 64}],
    }
    delegate = specspace_provider.HttpSpecGraphProvider(
        base_url="https://specgraph.tech/workspaces/pantry-rotation",
        cache=specspace_provider.HttpArtifactCache(
            manifest=manifest,
            manifest_loaded_at=float("inf"),
        ),
    )
    provider = specspace_provider.ProductWorkspaceHttpProvider(
        delegate=delegate,
        workspace_id="pantry-rotation",
    )

    with mock.patch.object(
        specspace_provider,
        "http_get_text",
        return_value=(HTTPStatus.OK, report_bytes.decode(), None),
    ):
        artifacts, binding = provider._workspace_artifacts(manifest)

    assert artifacts == {}
    assert binding["status"] == "invalid"
    assert binding["trusted"] is False


def test_ready_binding_uses_local_runs_before_static_workspace_bundle_exists(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    server = SimpleNamespace(
        runs_dir=runs_dir,
        artifact_base_url=None,
        product_workspace_artifact_base_urls={},
        spec_dir=None,
        specgraph_dir=tmp_path,
    )

    assert specspace_provider.artifact_base_url_for_workspace(
        server,
        "pantry-rotation",
    ) is None
    assert specspace_provider.provider_from_server(
        server,
        "pantry-rotation",
    ).kind == "file-product-workspace"


def test_ready_binding_keeps_http_provider_when_static_base_is_configured(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    server = SimpleNamespace(
        runs_dir=runs_dir,
        artifact_base_url="https://specgraph.tech",
        product_workspace_artifact_base_urls={},
    )

    assert specspace_provider.artifact_base_url_for_workspace(
        server,
        "pantry-rotation",
    ) == "https://specgraph.tech/workspaces/pantry-rotation"


def test_ready_binding_keeps_local_runs_for_unrelated_bootstrap_base(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    server = SimpleNamespace(
        runs_dir=runs_dir,
        artifact_base_url="https://bootstrap.example",
        product_workspace_artifact_base_urls={},
    )

    assert specspace_provider.artifact_base_url_for_workspace(
        server,
        "pantry-rotation",
    ) is None
    assert specspace_provider.provider_from_server(
        server,
        "pantry-rotation",
    ).kind == "file-product-workspace"


def test_ready_binding_scopes_logical_run_refs_once(tmp_path: Path) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    projection = product_workspace_binding.discover_binding(
        SimpleNamespace(runs_dir=runs_dir),
        workspace_id="pantry-rotation",
    )

    assert product_workspace_binding.bound_run_ref(
        projection,
        "runs/idea_to_spec_repair_session.json",
    ) == "runs/pantry-rotation/idea_to_spec_repair_session.json"
    assert product_workspace_binding.bound_run_ref(
        projection,
        "runs/pantry-rotation/idea_to_spec_repair_session.json",
    ) == "runs/pantry-rotation/idea_to_spec_repair_session.json"


def test_workspace_scoped_runs_dir_keeps_globally_unambiguous_source_ref(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    workspace_runs_dir = runs_dir / "pantry-rotation"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    server = SimpleNamespace(runs_dir=workspace_runs_dir)

    projection = product_workspace_binding.discover_binding(
        server,
        workspace_id="pantry-rotation",
    )

    assert projection["status"] == "ready"
    assert projection["source_ref"] == (
        "runs/pantry-rotation/platform_product_workspace_initialization_execution_report.json"
    )


def test_ready_binding_rehydrates_initialization_after_restart(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    restarted_server = SimpleNamespace(runs_dir=runs_dir)
    projection = product_workspace_binding.discover_binding(
        restarted_server,
        workspace_id="pantry-rotation",
    )
    payload = {
        "workspace_initialization": {
            "available": False,
            "initialized": False,
            "execution": {"available": False},
        }
    }

    specspace_v1_api._apply_durable_workspace_binding_initialization(
        payload,
        projection,
    )

    initialization = payload["workspace_initialization"]
    assert initialization["initialized"] is True
    assert initialization["execution"]["status"] == (
        "workspace_initialization_executed"
    )
    assert initialization["binding"]["binding_id"] == (
        "product-workspace-binding://pantry-rotation"
    )
    assert str(tmp_path) not in json.dumps(initialization)


def test_tampered_binding_is_invalid_and_does_not_resolve_foreign_dir(
    tmp_path: Path,
) -> None:
    runs_dir = tmp_path / "runs"
    path = _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    report = json.loads(path.read_text(encoding="utf-8"))
    report["workspace_binding"]["routing"][
        "specspace_state_namespace_ref"
    ] = "specspace-state://workspace/foreign"
    report["workspace_binding"]["routing"][
        "product_artifact_manifest_url"
    ] = "file:///tmp/foreign/manifest.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    server = SimpleNamespace(runs_dir=runs_dir)

    projection = product_workspace_binding.discover_binding(
        server,
        workspace_id="pantry-rotation",
    )

    assert projection["status"] == "invalid"
    assert "workspace_binding_state_namespace_mismatch" in projection["reasons"]
    assert "workspace_binding_artifact_manifest_url_mismatch" in projection[
        "reasons"
    ]
    assert product_workspace_binding.workspace_runs_dir(
        server,
        workspace_id="pantry-rotation",
    ) == runs_dir


def test_two_workspace_bindings_remain_isolated(tmp_path: Path) -> None:
    runs_dir = tmp_path / "runs"
    _write_report(runs_dir, "pantry-rotation", "Pantry Rotation")
    _write_report(runs_dir, "cash-flow-control", "Cash Flow Control")
    server = SimpleNamespace(runs_dir=runs_dir)

    pantry = product_workspace_binding.discover_binding(
        server,
        workspace_id="pantry-rotation",
    )
    cash = product_workspace_binding.discover_binding(
        server,
        workspace_id="cash-flow-control",
    )

    assert pantry["binding_id"] != cash["binding_id"]
    assert pantry["routing"]["platform_default_run_dir_ref"] == (
        "runs/pantry-rotation"
    )
    assert cash["routing"]["platform_default_run_dir_ref"] == (
        "runs/cash-flow-control"
    )
