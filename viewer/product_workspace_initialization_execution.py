"""Managed Platform execution for product workspace initialization requests."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

EXECUTION_REQUEST_ARTIFACT = "product_workspace_initialization_execution_request.json"
EXECUTION_REPORT_ARTIFACT = "platform_product_workspace_initialization_execution_report.json"


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
    output_path = runs_dir / EXECUTION_REPORT_ARTIFACT
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
    except json.JSONDecodeError:
        report = {}

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
