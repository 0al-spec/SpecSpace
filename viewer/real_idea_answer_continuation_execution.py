"""Managed Platform execution for real idea answer continuation requests."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import (
    idea_to_spec_intake_clarification_answers,
    real_idea_answer_continuation_execution_requests,
)
from viewer import specspace_provider

EXECUTION_REPORT_ARTIFACT = (
    "platform_real_idea_answer_continuation_execution_report.json"
)
INTAKE_EXECUTION_REPORT_ARTIFACT = "platform_real_idea_entry_intake_execution_report.json"
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
        "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed answer continuation execution."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "applies_answers": False,
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


def _safe_specspace_state_ref_to_path(server: Any, ref: str | None, *, filename: str) -> Path | None:
    if ref is None or not ref.startswith("specspace-state://"):
        return None
    rel = ref.removeprefix("specspace-state://")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    state_dir = Path(state_dir).resolve()
    candidate = (state_dir / rel).resolve()
    try:
        candidate.relative_to(state_dir)
    except ValueError:
        return None
    if candidate.name != filename:
        return None
    return candidate


def _active_requested_continuation_execution(
    server: Any,
    *,
    workspace_id: str,
    request_id: str | None,
) -> tuple[HTTPStatus | None, dict[str, Any] | None, dict[str, Any] | None]:
    status, state = real_idea_answer_continuation_execution_requests.read_state(
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
                "error": "No active real idea answer continuation execution request is ready for this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    if len(requests) > 1:
        return (
            HTTPStatus.CONFLICT,
            {
                "error": "Multiple real idea answer continuation execution requests match this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    return None, state, requests[0]


def execute_requested_continuation(
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

    payload_workspace_id = specspace_provider.normalize_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return HTTPStatus.CONFLICT, {
            "error": "Real idea answer continuation execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed answer continuation execution."
        }

    request_id = _text(payload.get("request_id"))
    status, state_or_error, request = _active_requested_continuation_execution(
        server,
        workspace_id=selected_workspace_id,
        request_id=request_id,
    )
    if status is not None:
        assert state_or_error is not None
        return status, state_or_error
    assert request is not None

    answer_state_ref = _text(request.get("answer_state_ref"))
    answer_state_path = _safe_specspace_state_ref_to_path(
        server,
        answer_state_ref,
        filename=idea_to_spec_intake_clarification_answers.INTAKE_ANSWER_FILENAME,
    )
    if answer_state_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "answer_state_ref must point to a safe SpecSpace answer state artifact.",
            "field": "answer_state_ref",
        }
    if not answer_state_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Real idea clarification answer state artifact not found.",
            "answer_state_ref": answer_state_ref,
        }

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

    intake_execution_ref = _text(request.get("intake_execution_ref"))
    intake_execution_path = _safe_runs_ref_to_path(
        server,
        intake_execution_ref,
        filename=INTAKE_EXECUTION_REPORT_ARTIFACT,
    )
    if intake_execution_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "intake_execution_ref must point to a safe runs/* intake execution report.",
            "field": "intake_execution_ref",
        }
    if not intake_execution_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Real idea intake execution report artifact not found.",
            "intake_execution_ref": intake_execution_ref,
        }

    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    execution_request_path = (
        real_idea_answer_continuation_execution_requests.state_path(server)
    )
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
        "product-real-idea-continuation",
        "execute-requested",
        "--execution-request",
        str(execution_request_path),
        "--specgraph-dir",
        str(specgraph_dir),
        "--workspace-id",
        selected_workspace_id,
        "--request-id",
        str(request.get("request_id")),
        "--answer-state",
        str(answer_state_path),
        "--workspace-initialization",
        str(initialization_path),
        "--intake-execution",
        str(intake_execution_path),
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
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode("utf-8", errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", errors="replace")
        return (
            HTTPStatus.GATEWAY_TIMEOUT,
            {
                "artifact_kind": (
                    "specspace_managed_real_idea_answer_continuation_execution"
                ),
                "ok": False,
                "status": "platform_execution_timeout",
                "workspace_id": selected_workspace_id,
                "request_id": request.get("request_id"),
                "execution_request_ref": (
                    "specspace-state://"
                    f"{real_idea_answer_continuation_execution_requests.EXECUTION_REQUEST_FILENAME}"
                ),
                "answer_state_ref": answer_state_ref,
                "workspace_initialization_ref": initialization_ref,
                "intake_execution_ref": intake_execution_ref,
                "output_ref": output_ref,
                "platform_returncode": None,
                "platform_report": {},
                "stderr_tail": stderr[-2000:],
                "stdout_tail": stdout[-2000:],
                "authority_boundary": {
                    "browser_executes_platform": False,
                    "specspace_backend_executes_platform": True,
                    "executes_specgraph": False,
                    "applies_answers": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                },
                "summary": {
                    "status": "managed_real_idea_answer_continuation_timeout",
                    "executed": False,
                    "timeout_seconds": timeout_seconds,
                    "output_ref": output_ref,
                },
            },
        )
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        report = {}

    response = {
        "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
        "ok": completed.returncode == 0,
        "status": "completed" if completed.returncode == 0 else "failed",
        "workspace_id": selected_workspace_id,
        "request_id": request.get("request_id"),
        "execution_request_ref": (
            "specspace-state://"
            f"{real_idea_answer_continuation_execution_requests.EXECUTION_REQUEST_FILENAME}"
        ),
        "answer_state_ref": answer_state_ref,
        "workspace_initialization_ref": initialization_ref,
        "intake_execution_ref": intake_execution_ref,
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
            "applies_answers": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_real_idea_answer_continuation_executed"
            if completed.returncode == 0
            else "managed_real_idea_answer_continuation_failed",
            "executed": True,
            "output_ref": output_ref,
        },
    }
    return (
        HTTPStatus.OK if completed.returncode == 0 else HTTPStatus.BAD_GATEWAY,
        response,
    )
