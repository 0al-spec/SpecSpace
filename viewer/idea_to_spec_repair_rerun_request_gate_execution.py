"""Managed Platform execution for idea-to-spec repair rerun request gates."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import idea_to_spec_repair_rerun_requests, specspace_provider

EXECUTION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_request_gate_execution_report.json"
)
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
        "artifact_kind": "specspace_managed_repair_rerun_request_gate_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed repair rerun request gate execution."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "executes_repair_rerun": False,
            "applies_repair_drafts": False,
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
    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return None
    candidate = (runs_dir / rel).resolve()
    try:
        candidate.relative_to(runs_dir.resolve())
    except ValueError:
        return None
    if candidate.name not in filenames:
        return None
    return candidate


def _active_requested_gate(
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


def execute_requested_request_gate(
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
            "error": "Repair rerun request gate execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed repair rerun request gate execution."
        }

    request_id = _text(payload.get("request_id"))
    status, state_or_error, request = _active_requested_gate(
        server,
        workspace_id=selected_workspace_id,
        request_id=request_id,
    )
    if status is not None:
        assert state_or_error is not None
        return status, state_or_error
    assert request is not None

    request_state_path = idea_to_spec_repair_rerun_requests.state_path(server)
    if not request_state_path.is_file():
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

    output_gate_path = runs_dir / REQUEST_GATE_ARTIFACT
    output_report_path = runs_dir / EXECUTION_REPORT_ARTIFACT
    output_gate_ref = (
        f"runs/{output_gate_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    )
    output_report_ref = (
        f"runs/{output_report_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    )

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "product-repair-rerun",
        "request-gate",
        "--specgraph-dir",
        str(specgraph_dir),
        "--rerun-request",
        str(request_state_path),
        "--import-preview",
        str(import_preview_path),
        "--repair-session",
        str(repair_session_path),
        "--workspace-id",
        selected_workspace_id,
        "--output-gate",
        str(output_gate_path),
        "--output",
        str(output_report_path),
        "--format",
        "json",
    ]
    completed = subprocess.run(
        command,
        cwd=str(platform_script.parent.parent),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        report = {}

    response = {
        "artifact_kind": "specspace_managed_repair_rerun_request_gate_execution",
        "ok": completed.returncode == 0,
        "status": "completed" if completed.returncode == 0 else "failed",
        "workspace_id": selected_workspace_id,
        "request_id": request.get("id"),
        "rerun_request_ref": (
            "specspace-state://"
            f"{idea_to_spec_repair_rerun_requests.RERUN_REQUEST_FILENAME}"
        ),
        "import_preview_ref": import_preview_ref,
        "repair_session_ref": repair_session_ref,
        "output_gate_ref": output_gate_ref,
        "output_ref": output_report_ref,
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
            ),
            "executes_repair_rerun": False,
            "applies_repair_drafts": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_repair_rerun_request_gate_executed"
            if completed.returncode == 0
            else "managed_repair_rerun_request_gate_failed",
            "executed": True,
            "output_gate_ref": output_gate_ref,
            "output_ref": output_report_ref,
        },
    }
    return (
        HTTPStatus.OK if completed.returncode == 0 else HTTPStatus.BAD_GATEWAY,
        response,
    )
