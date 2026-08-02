"""Managed Platform execution for product workspace initialization requests."""

from __future__ import annotations

import json
import hashlib
import subprocess
import sys
import threading
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import (
    product_workspace_creation_requests,
    specspace_provider,
    specspace_state_backend,
)

INITIALIZATION_PLAN_ARTIFACT = "product_workspace_initialization_plan.json"
EXECUTION_REQUEST_ARTIFACT = "product_workspace_initialization_execution_request.json"
EXECUTION_REPORT_ARTIFACT = "platform_product_workspace_initialization_execution_report.json"
_PREPARATION_LOCK = threading.Lock()


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _safe_runs_ref_to_path(server: Any, ref: str | None) -> Path | None:
    if ref is None or not ref.startswith("runs/"):
        return None
    rel = ref.removeprefix("runs/")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return None
    candidate = (runs_dir / rel).resolve()
    try:
        candidate.relative_to(runs_dir.resolve())
    except ValueError:
        return None
    if candidate.name != EXECUTION_REQUEST_ARTIFACT:
        return None
    return candidate


def _read_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _platform_script(server: Any) -> Path | None:
    platform_dir = getattr(server, "platform_dir", None)
    if not isinstance(platform_dir, Path):
        return None
    candidate = platform_dir / "scripts" / "platform.py"
    return candidate if candidate.is_file() else None


def _execution_disabled_payload() -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_workspace_initialization_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": (
                "Start SpecSpace with --enable-platform-execution and "
                "--platform-dir to run managed workspace initialization."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "creates_workspace_files": False,
            "updates_workspace_catalog": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
    }


def _preparation_disabled_payload() -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_workspace_initialization_preparation",
        "ok": False,
        "status": "initialization_preparation_unavailable",
        "summary": {
            "status": "initialization_preparation_unavailable",
            "prepared": False,
            "next_action": (
                "Configure the local Platform checkout, product workspace root, "
                "and private workspace catalog before preparing initialization."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "creates_workspace_files": False,
            "updates_workspace_catalog": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
    }


def _initialization_plan_error(
    plan: dict[str, Any] | None,
    *,
    selected_workspace_id: str,
    expected_workspace_root: Path,
) -> dict[str, Any] | None:
    if plan is None:
        return {"error": "Workspace initialization plan is not valid JSON."}
    if plan.get("artifact_kind") != "platform_product_workspace_initialization_plan":
        return {"error": "Workspace initialization plan artifact kind mismatch."}
    workspace = _record(plan.get("workspace"))
    if workspace.get("workspace_id") != selected_workspace_id:
        return {"error": "Workspace initialization plan workspace_id mismatch."}
    root = _text(workspace.get("workspace_root"))
    if root is None or Path(root).expanduser().resolve() != expected_workspace_root:
        return {"error": "Workspace initialization plan root mismatch."}
    summary = _record(plan.get("summary"))
    if (
        plan.get("ok") is not True
        or plan.get("dry_run") is True
        or summary.get("ready_for_platform_initialization") is not True
    ):
        return {"error": "Workspace initialization plan is not ready."}
    boundary = _record(plan.get("authority_boundary"))
    if any(value is True for key, value in boundary.items() if key.startswith("may_")):
        return {"error": "Workspace initialization plan expands authority."}
    for key in (
        "executes_specgraph",
        "executes_platform",
        "creates_workspace_files",
        "updates_workspace_catalog",
        "creates_git_commits",
        "opens_pull_requests",
        "publishes_read_models",
        "mutates_canonical_specs",
        "writes_ontology_packages",
        "accepts_ontology_terms",
    ):
        if boundary.get(key) is not False:
            return {"error": f"Workspace initialization plan must set {key}=false."}
    return None


def _run_preparation_command(
    *,
    platform_script: Path,
    command: list[str],
    timeout_seconds: int,
) -> tuple[HTTPStatus, dict[str, Any] | None]:
    try:
        completed = subprocess.run(
            [sys.executable, str(platform_script), *command, "--format", "json"],
            cwd=str(platform_script.parent.parent),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return HTTPStatus.GATEWAY_TIMEOUT, {
            "error": "Platform initialization preparation timed out.",
            "reason": "platform_preparation_timeout",
        }
    if completed.returncode != 0:
        return HTTPStatus.CONFLICT, {
            "error": "Platform rejected workspace initialization preparation.",
            "reason": "platform_preparation_rejected",
        }
    return HTTPStatus.OK, None


def _prepared_request_error(
    request: dict[str, Any] | None,
    *,
    selected_workspace_id: str,
    plan_path: Path,
    expected_workspace_root: Path,
) -> dict[str, Any] | None:
    error = _request_artifact_error(
        request,
        selected_workspace_id=selected_workspace_id,
    )
    if error is not None:
        return error
    assert request is not None
    if (
        request.get("ok") is not True
        or request.get("dry_run") is not False
        or request.get("request_only") is not True
    ):
        return {"error": "Workspace initialization request is not request-only."}
    if _text(request.get("plan_ref")) != str(plan_path):
        return {"error": "Workspace initialization request plan_ref mismatch."}
    if _text(request.get("plan_sha256")) != _file_sha256(plan_path):
        return {"error": "Workspace initialization request plan digest mismatch."}
    workspace = _record(request.get("workspace"))
    root = _text(workspace.get("workspace_root"))
    if root is None or Path(root).expanduser().resolve() != expected_workspace_root:
        return {"error": "Workspace initialization request root mismatch."}
    boundary = _record(request.get("authority_boundary"))
    if any(value is True for key, value in boundary.items() if key.startswith("may_")):
        return {"error": "Workspace initialization request expands authority."}
    for key in (
        "executes_specgraph",
        "executes_platform",
        "creates_workspace_files",
        "updates_workspace_catalog",
        "creates_git_commits",
        "opens_pull_requests",
        "publishes_read_models",
        "mutates_canonical_specs",
        "writes_ontology_packages",
        "accepts_ontology_terms",
    ):
        if boundary.get(key) is not False:
            return {"error": f"Workspace initialization request must set {key}=false."}
    return None


def _prepare_initialization_request(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, _preparation_disabled_payload()
    if getattr(server, "hosted_managed_execution_enabled", False) is True:
        return HTTPStatus.CONFLICT, {
            **_preparation_disabled_payload(),
            "status": "hosted_initialization_preparation_not_supported",
        }
    platform_script = _platform_script(server)
    root_dir = getattr(server, "product_workspace_root_dir", None)
    catalog = getattr(server, "product_workspace_catalog", None)
    runs_dir = getattr(server, "runs_dir", None)
    if not all(isinstance(path, Path) for path in (root_dir, catalog, runs_dir)):
        return HTTPStatus.SERVICE_UNAVAILABLE, _preparation_disabled_payload()
    assert isinstance(root_dir, Path)
    assert isinstance(catalog, Path)
    assert isinstance(runs_dir, Path)
    if platform_script is None or root_dir.is_symlink() or not root_dir.is_dir():
        return HTTPStatus.SERVICE_UNAVAILABLE, _preparation_disabled_payload()
    if catalog.is_symlink() or not catalog.is_file():
        return HTTPStatus.SERVICE_UNAVAILABLE, _preparation_disabled_payload()
    unexpected = sorted(set(payload) - {"workspace_id"})
    if unexpected:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Initialization preparation payload contains unsupported fields.",
            "fields": unexpected,
        }
    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return HTTPStatus.CONFLICT, {
            "error": "Workspace initialization preparation workspace_id mismatch.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {"error": "workspace_id is required."}

    state_status, state = product_workspace_creation_requests.read_state(
        server,
        workspace_id=selected_workspace_id,
    )
    if state_status != HTTPStatus.OK:
        return state_status, state
    active = next(
        (
            entry
            for entry in state.get("requests", [])
            if isinstance(entry, dict)
            and entry.get("workspace_id") == selected_workspace_id
            and entry.get("status") == "requested"
        ),
        None,
    )
    if active is None:
        return HTTPStatus.CONFLICT, {
            "error": "No active workspace creation request is available.",
            "workspace_id": selected_workspace_id,
        }
    creation_path = specspace_state_backend.materialization_path(
        server,
        product_workspace_creation_requests.CREATION_REQUEST_FILENAME,
        workspace_id=selected_workspace_id,
    )
    if creation_path.is_symlink() or not creation_path.is_file():
        return HTTPStatus.CONFLICT, {
            "error": "Workspace creation request materialization is unavailable."
        }

    workspace_root = (root_dir / selected_workspace_id).resolve()
    try:
        workspace_root.relative_to(root_dir.resolve())
    except ValueError:
        return HTTPStatus.CONFLICT, {"error": "Workspace root escaped configured root."}
    workspace_run_dir = (runs_dir / selected_workspace_id).resolve()
    try:
        workspace_run_dir.relative_to(runs_dir.resolve())
    except ValueError:
        return HTTPStatus.CONFLICT, {"error": "Workspace run directory escaped runs root."}
    workspace_run_dir.mkdir(parents=True, exist_ok=True)
    plan_path = workspace_run_dir / INITIALIZATION_PLAN_ARTIFACT
    request_path = workspace_run_dir / EXECUTION_REQUEST_ARTIFACT
    plan_ref = f"runs/{selected_workspace_id}/{INITIALIZATION_PLAN_ARTIFACT}"
    request_ref = f"runs/{selected_workspace_id}/{EXECUTION_REQUEST_ARTIFACT}"

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = max(1, min(int(timeout), 600))
    except (TypeError, ValueError):
        timeout_seconds = 120

    plan = _read_json_object(plan_path) if plan_path.exists() else None
    if plan is None:
        status, error = _run_preparation_command(
            platform_script=platform_script,
            timeout_seconds=timeout_seconds,
            command=[
                "workspace",
                "initialize-from-request",
                "--creation-request",
                str(creation_path),
                "--workspace-id",
                selected_workspace_id,
                "--catalog",
                str(catalog),
                "--path",
                str(workspace_root),
                "--output",
                str(plan_path),
            ],
        )
        if error is not None:
            return status, error
        plan = _read_json_object(plan_path)
    plan_error = _initialization_plan_error(
        plan,
        selected_workspace_id=selected_workspace_id,
        expected_workspace_root=workspace_root,
    )
    if plan_error is not None:
        return HTTPStatus.CONFLICT, plan_error

    request = _read_json_object(request_path) if request_path.exists() else None
    if request is None:
        status, error = _run_preparation_command(
            platform_script=platform_script,
            timeout_seconds=timeout_seconds,
            command=[
                "workspace",
                "request-initialization-execution",
                "--plan",
                str(plan_path),
                "--operator-ref",
                "operator://specspace-local",
                "--output",
                str(request_path),
            ],
        )
        if error is not None:
            return status, error
        request = _read_json_object(request_path)
    request_error = _prepared_request_error(
        request,
        selected_workspace_id=selected_workspace_id,
        plan_path=plan_path,
        expected_workspace_root=workspace_root,
    )
    if request_error is not None:
        return HTTPStatus.CONFLICT, request_error

    return HTTPStatus.OK, {
        "artifact_kind": "specspace_workspace_initialization_preparation",
        "ok": True,
        "status": "initialization_request_prepared",
        "workspace_id": selected_workspace_id,
        "plan_ref": plan_ref,
        "execution_request_ref": request_ref,
        "summary": {
            "status": "initialization_request_prepared",
            "prepared": True,
            "next_action": "Run controlled workspace initialization.",
        },
        "authority_boundary": {
            **_preparation_disabled_payload()["authority_boundary"],
            "specspace_backend_executes_platform": True,
        },
    }


def prepare_initialization_request(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    with _PREPARATION_LOCK:
        return _prepare_initialization_request(
            server,
            payload,
            workspace_id=workspace_id,
        )


def _request_artifact_error(
    request: dict[str, Any] | None,
    *,
    selected_workspace_id: str,
) -> dict[str, Any] | None:
    if request is None:
        return {
            "error": "Workspace initialization execution request artifact is not valid JSON.",
            "field": "execution_request_ref",
        }
    if (
        request.get("artifact_kind")
        != "platform_product_workspace_initialization_execution_request"
    ):
        return {
            "error": "Workspace initialization execution request artifact kind mismatch.",
            "expected": "platform_product_workspace_initialization_execution_request",
            "actual": request.get("artifact_kind"),
        }
    request_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(_record(request.get("workspace")).get("workspace_id"))
    )
    if request_workspace_id != selected_workspace_id:
        return {
            "error": "Workspace initialization execution request workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": request_workspace_id,
        }
    if request.get("requested_operation") != "workspace.execute-initialization-plan":
        return {
            "error": "Workspace initialization execution request operation mismatch.",
            "expected": "workspace.execute-initialization-plan",
            "actual": request.get("requested_operation"),
        }
    summary = _record(request.get("summary"))
    if summary.get("ready_for_managed_execution") is not True:
        return {
            "error": "Workspace initialization execution request is not ready for managed execution.",
            "field": "summary.ready_for_managed_execution",
        }
    return None


def execute_requested_initialization(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    platform_script = _platform_script(server)
    if platform_script is None:
        response = _execution_disabled_payload()
        response["summary"]["next_action"] = (
            "Configured Platform directory does not contain scripts/platform.py."
        )
        return HTTPStatus.SERVICE_UNAVAILABLE, response

    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return HTTPStatus.CONFLICT, {
            "error": "Workspace initialization execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed initialization execution."
        }

    request_ref = _text(payload.get("execution_request_ref"))
    if request_ref is None:
        request_ref = _text(payload.get("initialization_request_ref"))
    request_path = _safe_runs_ref_to_path(server, request_ref)
    if request_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "execution_request_ref must point to a runs/* product workspace initialization execution request.",
            "field": "execution_request_ref",
        }
    if not request_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Workspace initialization execution request artifact not found.",
            "execution_request_ref": request_ref,
        }
    request_artifact = _read_json_object(request_path)
    request_error = _request_artifact_error(
        request_artifact,
        selected_workspace_id=selected_workspace_id,
    )
    if request_error is not None:
        return HTTPStatus.CONFLICT, request_error

    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()
    # Keep the execution receipt in the same workspace-scoped run directory as
    # the digest-pinned request. Legacy root-level requests remain root-level.
    output_path = request_path.parent / EXECUTION_REPORT_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "workspace",
        "execute-requested-initialization",
        "--execution-request",
        str(request_path),
        "--output",
        str(output_path),
        "--format",
        "json",
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=str(platform_script.parent.parent),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired as error:
        return HTTPStatus.GATEWAY_TIMEOUT, {
            "artifact_kind": "specspace_managed_workspace_initialization_execution",
            "ok": False,
            "status": "platform_execution_timeout",
            "workspace_id": selected_workspace_id,
            "execution_request_ref": request_ref,
            "output_ref": output_ref,
            "summary": {
                "status": "managed_initialization_timeout",
                "executed": False,
                "timeout_seconds": timeout_seconds,
            },
            "stderr_tail": (error.stderr or "")[-2000:]
            if isinstance(error.stderr, str)
            else "",
            "authority_boundary": {
                "browser_executes_platform": False,
                "specspace_backend_executes_platform": True,
                "executes_specgraph": False,
                "creates_workspace_files": False,
                "updates_workspace_catalog": False,
                "creates_git_commits": False,
                "opens_pull_requests": False,
                "publishes_read_models": False,
                "writes_ontology_packages": False,
                "accepts_ontology_terms": False,
            },
        }
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError as error:
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": "specspace_managed_workspace_initialization_execution",
            "ok": False,
            "status": "platform_report_invalid_json",
            "workspace_id": selected_workspace_id,
            "execution_request_ref": request_ref,
            "output_ref": output_ref,
            "platform_returncode": completed.returncode,
            "summary": {
                "status": "managed_initialization_invalid_platform_report",
                "executed": completed.returncode == 0,
                "error": str(error),
            },
            "stdout_tail": stdout[-2000:],
            "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
            "authority_boundary": {
                "browser_executes_platform": False,
                "specspace_backend_executes_platform": True,
                "executes_specgraph": False,
                "creates_workspace_files": False,
                "updates_workspace_catalog": False,
                "creates_git_commits": False,
                "opens_pull_requests": False,
                "publishes_read_models": False,
                "writes_ontology_packages": False,
                "accepts_ontology_terms": False,
            },
        }

    response = {
        "artifact_kind": "specspace_managed_workspace_initialization_execution",
        "ok": completed.returncode == 0,
        "status": "completed" if completed.returncode == 0 else "failed",
        "workspace_id": selected_workspace_id,
        "execution_request_ref": request_ref,
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                _record(report.get("summary")).get("specgraph_executed")
            ),
            "creates_workspace_files": bool(
                _record(report.get("summary")).get("workspace_files_created")
            ),
            "updates_workspace_catalog": bool(
                _record(report.get("summary")).get("catalog_written")
            ),
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_initialization_executed"
            if completed.returncode == 0
            else "managed_initialization_failed",
            "executed": True,
            "output_ref": output_ref,
        },
    }
    return (
        HTTPStatus.OK if completed.returncode == 0 else HTTPStatus.BAD_GATEWAY,
        response,
    )
