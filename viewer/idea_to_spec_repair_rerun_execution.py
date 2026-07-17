"""Managed Platform execution for requested idea-to-spec repair reruns."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import (
    idea_to_spec_repair_rerun_requests,
    idea_to_spec_workspace_state_hygiene,
    specspace_provider,
    specspace_state_backend,
)

PLAN_ARTIFACT = "platform_product_repair_rerun_execution_plan.json"
EXECUTION_REPORT_ARTIFACT = "platform_product_repair_rerun_execution_report.json"
REQUEST_GATE_ARTIFACT = "specspace_repair_rerun_request_gate.json"
IMPORT_PREVIEW_ARTIFACT = "specspace_repair_draft_import_preview.json"
REPAIR_SESSION_ARTIFACTS = {
    "idea_to_spec_repair_session.json",
    "repaired_idea_to_spec_repair_session.json",
}


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _execution_disabled_payload(next_action: str | None = None) -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_repair_rerun_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed repair rerun execution."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "executes_repair_rerun": False,
            "builds_repaired_handoff": False,
            "publishes_public_bundle": False,
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


def _safe_runs_ref_to_path(
    server: Any,
    ref: str | None,
    *,
    filenames: set[str],
) -> Path | None:
    if ref is None or not ref.startswith("runs/"):
        return None
    rel = ref.removeprefix("runs/")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    if Path(rel).name not in filenames:
        return None
    roots: list[Path] = []
    runs_dir = getattr(server, "runs_dir", None)
    if isinstance(runs_dir, Path):
        roots.append(runs_dir)
    specgraph_dir = getattr(server, "specgraph_dir", None)
    if isinstance(specgraph_dir, Path):
        roots.append(specgraph_dir / "runs")
    safe_candidates: list[Path] = []
    for root in roots:
        candidate = (root / rel).resolve()
        try:
            candidate.relative_to(root.resolve())
        except ValueError:
            continue
        safe_candidates.append(candidate)
        if candidate.is_file():
            return candidate
    return safe_candidates[0] if safe_candidates else None


def _safe_fragment(value: str | None) -> str:
    text = value or "request"
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in text)[:96]


def _read_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _workspace_hygiene(
    server: Any,
    *,
    workspace_id: str,
) -> tuple[HTTPStatus, dict[str, Any]]:
    provider = specspace_provider.provider_from_server(server, workspace_id)
    workspace_status, workspace_payload = provider.read_idea_to_spec_workspace()
    if workspace_status != HTTPStatus.OK:
        return workspace_status, {
            "error": "Cannot execute repair rerun without readable idea-to-spec workspace.",
            "source_status": int(workspace_status),
            "source": workspace_payload,
        }
    return idea_to_spec_workspace_state_hygiene.build_hygiene(
        server,
        workspace_id=workspace_id,
        workspace_payload=workspace_payload,
    )


def _request_usable_for_current_workspace(
    request: dict[str, Any],
    hygiene: dict[str, Any],
) -> bool:
    request_state = next(
        (
            item
            for item in hygiene.get("states", [])
            if isinstance(item, dict) and item.get("kind") == "repair_rerun_request"
        ),
        {},
    )
    if request_state.get("status") != "usable":
        return False
    workspace_id = _text(hygiene.get("workspace_id"))
    candidate_id = _text(hygiene.get("candidate_id"))
    repair_session_id = _text(hygiene.get("repair_session_id"))
    repair_session_ref = _text(hygiene.get("repair_session_ref"))
    if workspace_id and _text(request.get("workspace_id")) != workspace_id:
        return False
    if candidate_id and _text(request.get("candidate_id")) != candidate_id:
        return False
    if (
        repair_session_id
        and _text(request.get("repair_session_id")) != repair_session_id
    ):
        return False
    if (
        repair_session_ref
        and _text(request.get("repair_session_ref")) != repair_session_ref
    ):
        return False
    return True


def _request_gate_error(
    gate: dict[str, Any] | None,
    *,
    workspace_id: str,
    request: dict[str, Any],
) -> dict[str, Any] | None:
    if gate is None:
        return {
            "reason": "request_gate_unreadable",
            "detail": "Request gate artifact must be readable JSON object.",
        }
    if gate.get("artifact_kind") != "specspace_repair_rerun_request_gate":
        return {
            "reason": "request_gate_invalid",
            "detail": "Request gate artifact_kind must be specspace_repair_rerun_request_gate.",
        }
    readiness = _record(gate.get("readiness"))
    status = _text(gate.get("status")) or _text(
        _record(gate.get("summary")).get("status")
    )
    if readiness.get("ready") is not True and status not in {
        "specspace_repair_rerun_request_gate_ready",
        "repair_rerun_request_gate_ready",
        "ready",
    }:
        return {
            "reason": "request_gate_not_ready",
            "detail": "Request gate artifact is not ready.",
            "status": status,
        }
    summary = _record(gate.get("summary"))
    gate_workspace_id = _text(gate.get("workspace_id")) or _text(summary.get("workspace_id"))
    if gate_workspace_id and gate_workspace_id != workspace_id:
        return {
            "reason": "request_gate_workspace_mismatch",
            "expected": workspace_id,
            "actual": gate_workspace_id,
        }
    gate_candidate_id = _text(gate.get("candidate_id")) or _text(
        summary.get("candidate_id")
    )
    request_candidate_id = _text(request.get("candidate_id"))
    if (
        gate_candidate_id
        and request_candidate_id
        and gate_candidate_id != request_candidate_id
    ):
        return {
            "reason": "request_gate_candidate_mismatch",
            "expected": request_candidate_id,
            "actual": gate_candidate_id,
        }
    gate_session_ref = _text(gate.get("repair_session_ref")) or _text(
        summary.get("repair_session_ref")
    )
    request_session_ref = _text(request.get("repair_session_ref"))
    if (
        gate_session_ref
        and request_session_ref
        and gate_session_ref != request_session_ref
    ):
        return {
            "reason": "request_gate_repair_session_mismatch",
            "expected": request_session_ref,
            "actual": gate_session_ref,
        }
    return None


def _active_requested_rerun(
    server: Any,
    *,
    workspace_id: str,
    request_id: str | None,
) -> tuple[HTTPStatus | None, dict[str, Any] | None, dict[str, Any] | None]:
    status, state = idea_to_spec_repair_rerun_requests.read_state(
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
        and (request_id is None or item.get("id") == request_id)
    ]
    if not requests:
        return (
            HTTPStatus.CONFLICT,
            {
                "error": "No active repair rerun request is ready for this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    if len(requests) > 1:
        return (
            HTTPStatus.CONFLICT,
            {
                "error": "Multiple repair rerun requests match this workspace.",
                "workspace_id": workspace_id,
            },
            None,
        )
    return None, state, requests[0]


def _run_json_command(
    command: list[str],
    *,
    cwd: Path,
    timeout_seconds: int,
) -> tuple[subprocess.CompletedProcess[str], dict[str, Any]]:
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        report = {}
    return completed, report


def execute_requested_rerun(
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
            "error": "Repair rerun execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed repair rerun execution."
        }
    binding_error = specspace_provider.managed_workspace_binding_error(
        server, selected_workspace_id
    )
    if binding_error is not None:
        return HTTPStatus.CONFLICT, binding_error

    request_id = _text(payload.get("request_id"))
    status, state_or_error, request = _active_requested_rerun(
        server,
        workspace_id=selected_workspace_id,
        request_id=request_id,
    )
    if status is not None:
        assert state_or_error is not None
        return status, state_or_error
    assert request is not None

    hygiene_status, hygiene = _workspace_hygiene(
        server,
        workspace_id=selected_workspace_id,
    )
    if hygiene_status != HTTPStatus.OK:
        return hygiene_status, hygiene
    if not _request_usable_for_current_workspace(request, hygiene):
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request is not usable for the current workspace repair session.",
            "reason": "repair_rerun_request_not_usable",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("id"),
            "workspace_state_hygiene": {
                "status": _record(hygiene.get("summary")).get("status"),
                "states": [
                    item
                    for item in hygiene.get("states", [])
                    if isinstance(item, dict)
                    and item.get("kind") == "repair_rerun_request"
                ],
            },
        }

    try:
        request_state_path = specspace_state_backend.materialize_state(
            server,
            idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME,
            workspace_id=selected_workspace_id,
        )
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecSpace state provider is unavailable.",
            "reason": "specspace_state_provider_unavailable",
        }
    if request_state_path is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair rerun request state artifact not found.",
            "rerun_request_ref": (
                "specspace-state://"
                f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
            ),
        }

    import_preview_ref = _text(request.get("import_preview_ref"))
    import_preview_path = _safe_runs_ref_to_path(
        server,
        import_preview_ref,
        filenames={IMPORT_PREVIEW_ARTIFACT},
    )
    if import_preview_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "import_preview_ref must point to a safe runs/* repair draft import preview.",
            "field": "import_preview_ref",
        }
    if not import_preview_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair draft import preview artifact not found.",
            "import_preview_ref": import_preview_ref,
        }

    repair_session_ref = _text(request.get("repair_session_ref"))
    repair_session_path = _safe_runs_ref_to_path(
        server,
        repair_session_ref,
        filenames=REPAIR_SESSION_ARTIFACTS,
    )
    if repair_session_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "repair_session_ref must point to a safe runs/* repair session journal.",
            "field": "repair_session_ref",
        }
    if not repair_session_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair session journal artifact not found.",
            "repair_session_ref": repair_session_ref,
        }

    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    request_gate_path = runs_dir / REQUEST_GATE_ARTIFACT
    if not request_gate_path.is_file():
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun execution requires a ready request gate artifact.",
            "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
            "reason": "request_gate_missing",
        }
    gate_error = _request_gate_error(
        _read_json_object(request_gate_path),
        workspace_id=selected_workspace_id,
        request=request,
    )
    if gate_error is not None:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun execution requires a ready request gate for the selected request.",
            "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
            **gate_error,
        }

    output_dir = (
        specspace_provider.runs_dir_for_workspace(server, selected_workspace_id)
        or runs_dir
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    plan_dir = output_dir / "managed_repair_rerun_plans"
    plan_dir.mkdir(parents=True, exist_ok=True)
    plan_path = plan_dir / f"{_safe_fragment(_text(request.get('id')))}.{PLAN_ARTIFACT}"
    output_path = output_dir / EXECUTION_REPORT_ARTIFACT
    plan_ref = f"runs/{plan_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    consume_status, consume_body = idea_to_spec_repair_rerun_requests.mark_request_consumed(
        server,
        workspace_id=selected_workspace_id,
        request_id=str(request.get("id")),
    )
    if consume_status != HTTPStatus.OK:
        return consume_status, {
            "artifact_kind": "specspace_managed_repair_rerun_execution",
            "ok": False,
            "status": "repair_rerun_request_not_active",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("id"),
            "rerun_request_ref": (
                "specspace-state://"
                f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
            ),
            "import_preview_ref": import_preview_ref,
            "repair_session_ref": repair_session_ref,
            "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
            "plan_ref": plan_ref,
            "output_ref": output_ref,
            "summary": {
                "status": "managed_repair_rerun_request_not_active",
                "executed": False,
            },
            "error": consume_body.get("error")
            if isinstance(consume_body.get("error"), str)
            else "Repair rerun request is no longer active.",
            "authority_boundary": {
                "browser_executes_platform": False,
                "specspace_backend_executes_platform": False,
                "executes_specgraph": False,
                "executes_repair_rerun": False,
                "builds_repaired_handoff": False,
                "publishes_public_bundle": False,
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

    platform_cwd = platform_script.parent.parent
    plan_command = [
        sys.executable,
        str(platform_script),
        "product-repair-rerun",
        "plan",
        "--specgraph-dir",
        str(specgraph_dir),
        "--rerun-request",
        str(request_state_path),
        "--import-preview",
        str(import_preview_path),
        "--repair-session",
        str(repair_session_path),
        "--request-gate",
        str(request_gate_path),
        "--output",
        str(plan_path),
        "--format",
        "json",
    ]
    workspace_initialization_path = (
        specspace_provider.workspace_initialization_report_path(
            server, selected_workspace_id
        )
    )
    if workspace_initialization_path is not None:
        plan_command.extend(
            ["--workspace-initialization", str(workspace_initialization_path)]
        )
    try:
        plan_completed, plan_report = _run_json_command(
            plan_command,
            cwd=platform_cwd,
            timeout_seconds=timeout_seconds,
        )
    except subprocess.TimeoutExpired as error:
        return HTTPStatus.GATEWAY_TIMEOUT, {
            "artifact_kind": "specspace_managed_repair_rerun_execution",
            "ok": False,
            "status": "platform_execution_timeout",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("id"),
            "rerun_request_ref": (
                "specspace-state://"
                f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
            ),
            "import_preview_ref": import_preview_ref,
            "repair_session_ref": repair_session_ref,
            "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
            "plan_ref": plan_ref,
            "output_ref": output_ref,
            "summary": {
                "status": "managed_repair_rerun_plan_timeout",
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
                "executes_repair_rerun": False,
                "builds_repaired_handoff": False,
                "publishes_public_bundle": False,
                "creates_git_commits": False,
                "opens_pull_requests": False,
                "publishes_read_models": False,
                "writes_ontology_packages": False,
                "accepts_ontology_terms": False,
            },
        }

    execute_completed: subprocess.CompletedProcess[str] | None = None
    execution_report: dict[str, Any] = {}
    if plan_completed.returncode == 0 and plan_report.get("ready_to_execute") is True:
        execute_command = [
            sys.executable,
            str(platform_script),
            "product-repair-rerun",
            "execute",
            "--plan",
            str(plan_path),
            "--build-repaired-handoff",
            "--output",
            str(output_path),
            "--format",
            "json",
        ]
        try:
            execute_completed, execution_report = _run_json_command(
                execute_command,
                cwd=platform_cwd,
                timeout_seconds=timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            return HTTPStatus.GATEWAY_TIMEOUT, {
                "artifact_kind": "specspace_managed_repair_rerun_execution",
                "ok": False,
                "status": "platform_execution_timeout",
                "workspace_id": selected_workspace_id,
                "request_id": request.get("id"),
                "rerun_request_ref": (
                    "specspace-state://"
                    f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
                ),
                "import_preview_ref": import_preview_ref,
                "repair_session_ref": repair_session_ref,
                "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
                "plan_ref": plan_ref,
                "output_ref": output_ref,
                "summary": {
                    "status": "managed_repair_rerun_execute_timeout",
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
                    "executes_repair_rerun": False,
                    "builds_repaired_handoff": False,
                    "publishes_public_bundle": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                },
            }

    execution_returncode = (
        execute_completed.returncode if execute_completed is not None else None
    )
    plan_ok = (
        plan_completed.returncode == 0
        and plan_report.get("ready_to_execute") is True
        and plan_report.get("ok") is not False
    )
    execution_ok = (
        execute_completed is not None
        and execute_completed.returncode == 0
        and execution_report.get("ok") is True
    )
    ok = plan_ok and execution_ok
    response = {
        "artifact_kind": "specspace_managed_repair_rerun_execution",
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "request_id": request.get("id"),
        "rerun_request_ref": (
            "specspace-state://"
            f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
        ),
        "import_preview_ref": import_preview_ref,
        "repair_session_ref": repair_session_ref,
        "request_gate_ref": f"runs/{REQUEST_GATE_ARTIFACT}",
        "plan_ref": plan_ref,
        "output_ref": output_ref,
        "platform_returncode": execution_returncode
        if execution_returncode is not None
        else plan_completed.returncode,
        "plan_returncode": plan_completed.returncode,
        "execution_returncode": execution_returncode,
        "plan_report": plan_report,
        "platform_report": execution_report,
        "stderr_tail": (
            execute_completed.stderr[-2000:]
            if execute_completed is not None and execute_completed.stderr
            else plan_completed.stderr[-2000:]
            if plan_completed.stderr
            else ""
        ),
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                _record(execution_report.get("authority_boundary")).get(
                    "executes_specgraph_make_target"
                )
            ),
            "executes_repair_rerun": bool(
                _record(execution_report.get("summary")).get(
                    "executes_specgraph_make_target"
                )
                or any(
                    _record(operation).get("name")
                    == "execute_specgraph_requested_rerun"
                    and _record(operation).get("status") == "succeeded"
                    for operation in execution_report.get("operations", [])
                    if isinstance(operation, dict)
                )
            ),
            "builds_repaired_handoff": bool(
                any(
                    _record(operation).get("name")
                    == "execute_specgraph_repaired_promotion_handoff"
                    and _record(operation).get("status") == "succeeded"
                    for operation in execution_report.get("operations", [])
                    if isinstance(operation, dict)
                )
            ),
            "publishes_public_bundle": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_repair_rerun_executed"
            if ok
            else "managed_repair_rerun_failed",
            "executed": execute_completed is not None,
            "plan_ref": plan_ref,
            "output_ref": output_ref,
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response
