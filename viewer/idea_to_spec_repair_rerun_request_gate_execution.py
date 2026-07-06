"""Managed Platform execution for idea-to-spec repair rerun request gates."""

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
)

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


def _workspace_hygiene(
    server: Any,
    *,
    workspace_id: str,
) -> tuple[HTTPStatus, dict[str, Any]]:
    provider = specspace_provider.provider_from_server(server, workspace_id)
    workspace_status, workspace_payload = provider.read_idea_to_spec_workspace()
    if workspace_status != HTTPStatus.OK:
        return workspace_status, {
            "error": "Cannot execute repair rerun request gate without readable idea-to-spec workspace.",
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
    if repair_session_id and _text(request.get("repair_session_id")) != repair_session_id:
        return False
    if repair_session_ref and _text(request.get("repair_session_ref")) != repair_session_ref:
        return False
    return True


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
    consume_status, consume_body = idea_to_spec_repair_rerun_requests.mark_request_consumed(
        server,
        workspace_id=selected_workspace_id,
        request_id=str(request.get("id")),
    )
    if consume_status != HTTPStatus.OK:
        return consume_status, {
            "artifact_kind": "specspace_managed_repair_rerun_request_gate_execution",
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
            "output_gate_ref": output_gate_ref,
            "output_ref": output_report_ref,
            "summary": {
                "status": "managed_repair_rerun_request_gate_request_not_active",
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
                "applies_repair_drafts": False,
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
