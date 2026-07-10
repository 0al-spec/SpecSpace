from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

from viewer import product_workspace_binding, specspace_v1_api


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
