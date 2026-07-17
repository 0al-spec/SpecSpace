"""Managed Platform execution for real idea intake requests."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import real_idea_entry_requests, real_idea_intake_execution_requests
from viewer import specspace_provider, specspace_state_backend

EXECUTION_REPORT_ARTIFACT = "platform_real_idea_entry_intake_execution_report.json"
WORKSPACE_INITIALIZATION_REPORT_ARTIFACT = (
    "platform_product_workspace_initialization_execution_report.json"
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _execution_disabled_payload(next_action: str | None = None) -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_real_idea_intake_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed real idea intake execution."
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


def _platform_script(server: Any) -> Path | None:
    platform_dir = getattr(server, "platform_dir", None)
    if not isinstance(platform_dir, Path):
        return None
    candidate = platform_dir / "scripts" / "platform.py"
    return candidate if candidate.is_file() else None


def _specgraph_dir(server: Any) -> Path | None:
    specgraph_dir = getattr(server, "specgraph_dir", None)
    if not isinstance(specgraph_dir, Path):
        return None
    return specgraph_dir if (specgraph_dir / "Makefile").is_file() else None


def _safe_runs_ref_to_path(server: Any, ref: str | None, *, filename: str) -> Path | None:
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
    if candidate.name != filename:
        return None
    return candidate


def _read_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _initialization_report_error(
    report: dict[str, Any] | None,
    *,
    selected_workspace_id: str,
) -> dict[str, Any] | None:
    if report is None:
        return {
            "error": "Workspace initialization report artifact is not valid JSON.",
            "field": "workspace_initialization_ref",
        }
    if (
        report.get("artifact_kind")
        != "platform_product_workspace_initialization_execution_report"
    ):
        return {
            "error": "Workspace initialization report artifact kind mismatch.",
            "expected": "platform_product_workspace_initialization_execution_report",
            "actual": report.get("artifact_kind"),
        }
    report_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(_record(report.get("workspace")).get("workspace_id"))
    )
    if report_workspace_id != selected_workspace_id:
        return {
            "error": "Workspace initialization report workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": report_workspace_id,
        }
    summary = _record(report.get("summary"))
    if report.get("ok") is not True or report.get("dry_run") is True:
        return {
            "error": "Workspace initialization report is not a successful non-dry-run execution.",
            "field": "workspace_initialization_ref",
        }
    if (
        summary.get("catalog_written") is not True
        or summary.get("workspace_files_created") is not True
    ):
        return {
            "error": "Workspace initialization report does not show initialized workspace files and catalog.",
            "field": "workspace_initialization_ref",
        }
    return None


def _entry_request_error(
    server: Any,
    *,
    selected_workspace_id: str,
    entry_request_id: str | None,
) -> dict[str, Any] | None:
    if entry_request_id is None:
        return {
            "error": "Real idea intake execution request is missing entry_request_id.",
            "field": "entry_request_id",
        }
    status, state = real_idea_entry_requests.read_state(
        server,
        workspace_id=selected_workspace_id,
    )
    if status != HTTPStatus.OK:
        return {
            "error": "Real idea entry request state is not readable.",
            "status": int(status),
        }
    matches = [
        item
        for item in state.get("requests", [])
        if isinstance(item, dict)
        and item.get("workspace_id") == selected_workspace_id
        and item.get("request_id") == entry_request_id
        and item.get("status") == "submitted"
    ]
    if len(matches) != 1:
        return {
            "error": "Real idea entry request is not the active submitted request for this workspace.",
            "workspace_id": selected_workspace_id,
            "entry_request_id": entry_request_id,
        }
    return None


def _active_requested_intake_execution(
    server: Any,
    *,
    workspace_id: str,
    request_id: str | None,
) -> tuple[HTTPStatus | None, dict[str, Any] | None, dict[str, Any] | None]:
    status, state = real_idea_intake_execution_requests.read_state(
        server,
        workspace_id=workspace_id,
    )
    if status != HTTPStatus.OK:
        return status, state, None
    requests = [
        item
        for item in state.get("requests", [])
        if isinstance(item, dict)
        and item.get("status") == "requested"
        and item.get("workspace_id") == workspace_id
        and (request_id is None or item.get("request_id") == request_id)
    ]
    if not requests:
        return (
            HTTPStatus.CONFLICT,
            {
                "error": "No active real idea intake execution request is ready for this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    if len(requests) > 1:
        return (
            HTTPStatus.CONFLICT,
            {
                "error": "Multiple real idea intake execution requests match this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    return None, state, requests[0]


def execute_requested_intake(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    platform_script = _platform_script(server)
    if platform_script is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured Platform directory does not contain scripts/platform.py."
        )
    specgraph_dir = _specgraph_dir(server)
    if specgraph_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured SpecGraph directory does not contain a Makefile."
        )

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
            "error": "Real idea intake execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed real idea intake execution."
        }
    binding_error = specspace_provider.managed_workspace_binding_error(
        server, selected_workspace_id
    )
    if binding_error is not None:
        return HTTPStatus.CONFLICT, binding_error

    request_id = _text(payload.get("request_id"))
    status, state_or_error, request = _active_requested_intake_execution(
        server,
        workspace_id=selected_workspace_id,
        request_id=request_id,
    )
    if status is not None:
        assert state_or_error is not None
        return status, state_or_error
    assert request is not None

    initialization_ref = _text(request.get("workspace_initialization_ref"))
    initialization_path = _safe_runs_ref_to_path(
        server,
        initialization_ref,
        filename=WORKSPACE_INITIALIZATION_REPORT_ARTIFACT,
    )
    if initialization_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_initialization_ref must point to a safe runs/* initialization report.",
            "field": "workspace_initialization_ref",
        }
    if not initialization_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Workspace initialization report artifact not found.",
            "workspace_initialization_ref": initialization_ref,
        }
    initialization_report = _read_json_object(initialization_path)
    initialization_error = _initialization_report_error(
        initialization_report,
        selected_workspace_id=selected_workspace_id,
    )
    if initialization_error is not None:
        return HTTPStatus.CONFLICT, initialization_error

    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    try:
        execution_request_path = specspace_state_backend.materialize_state(
            server,
            real_idea_intake_execution_requests.EXECUTION_REQUEST_FILENAME,
            workspace_id=selected_workspace_id,
        )
        entry_requests_path = specspace_state_backend.materialize_state(
            server,
            real_idea_entry_requests.ENTRY_REQUEST_FILENAME,
            workspace_id=selected_workspace_id,
        )
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecSpace state provider is unavailable.",
            "reason": "specspace_state_provider_unavailable",
        }
    if execution_request_path is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "Real idea intake execution request state artifact not found.",
            "execution_requests_ref": (
                "specspace-state://"
                f"{real_idea_intake_execution_requests.EXECUTION_REQUEST_FILENAME}"
            ),
        }
    if entry_requests_path is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "Real idea entry request state artifact not found.",
            "entry_requests_ref": "specspace-state://real_idea_entry_requests.json",
        }
    entry_error = _entry_request_error(
        server,
        selected_workspace_id=selected_workspace_id,
        entry_request_id=_text(request.get("entry_request_id")),
    )
    if entry_error is not None:
        return HTTPStatus.CONFLICT, entry_error
    output_dir = (
        specspace_provider.runs_dir_for_workspace(server, selected_workspace_id)
        or runs_dir
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / EXECUTION_REPORT_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    consume_status, consume_body = (
        real_idea_intake_execution_requests.mark_request_consumed(
            server,
            workspace_id=selected_workspace_id,
            request_id=str(request.get("request_id")),
        )
    )
    if consume_status != HTTPStatus.OK:
        return consume_status, {
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "execution_request_not_active",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("request_id"),
            "entry_request_id": request.get("entry_request_id"),
            "execution_request_ref": f"specspace-state://{real_idea_intake_execution_requests.EXECUTION_REQUEST_FILENAME}",
            "output_ref": output_ref,
            "summary": {
                "status": "managed_real_idea_intake_request_not_active",
                "executed": False,
            },
            "error": consume_body.get("error")
            if isinstance(consume_body.get("error"), str)
            else "Real idea intake execution request is no longer active.",
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

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "product-real-idea-intake",
        "execute-requested",
        "--execution-request",
        str(execution_request_path),
        "--specgraph-dir",
        str(specgraph_dir),
        "--entry-requests",
        str(entry_requests_path),
        "--workspace-initialization",
        str(initialization_path),
        "--workspace-id",
        selected_workspace_id,
        # Platform's --request-id selects the raw idea entry request. The
        # SpecSpace intake execution request id is only used above to select
        # the active handoff request.
        "--request-id",
        str(request.get("entry_request_id")),
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
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "platform_execution_timeout",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("request_id"),
            "entry_request_id": request.get("entry_request_id"),
            "execution_request_ref": f"specspace-state://{real_idea_intake_execution_requests.EXECUTION_REQUEST_FILENAME}",
            "workspace_initialization_ref": initialization_ref,
            "output_ref": output_ref,
            "summary": {
                "status": "managed_real_idea_intake_timeout",
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

    success = completed.returncode == 0

    response = {
        "artifact_kind": "specspace_managed_real_idea_intake_execution",
        "ok": success,
        "status": "completed" if success else "failed",
        "workspace_id": selected_workspace_id,
        "request_id": request.get("request_id"),
        "entry_request_id": request.get("entry_request_id"),
        "execution_request_ref": f"specspace-state://{real_idea_intake_execution_requests.EXECUTION_REQUEST_FILENAME}",
        "workspace_initialization_ref": initialization_ref,
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                _record(report.get("authority_boundary")).get(
                    "executes_specgraph_make_target"
                )
                or _record(report.get("summary")).get("specgraph_executed")
            ),
            "creates_workspace_files": False,
            "updates_workspace_catalog": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_real_idea_intake_executed"
            if success
            else "managed_real_idea_intake_failed",
            "executed": True,
            "output_ref": output_ref,
        },
    }
    return (
        HTTPStatus.OK if success else HTTPStatus.BAD_GATEWAY,
        response,
    )
