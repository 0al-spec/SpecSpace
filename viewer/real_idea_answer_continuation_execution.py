"""Managed Platform execution for real idea answer continuation requests."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import (
    idea_to_spec_intake_clarification_answers,
    real_idea_answer_continuation_execution_requests,
    specspace_state_backend,
)
from viewer import specspace_provider

EXECUTION_REPORT_ARTIFACT = (
    "platform_real_idea_answer_continuation_execution_report.json"
)
INTAKE_EXECUTION_REPORT_ARTIFACT = "platform_real_idea_entry_intake_execution_report.json"
WORKSPACE_INITIALIZATION_REPORT_ARTIFACT = (
    "platform_product_workspace_initialization_execution_report.json"
)
ANSWER_TEMPLATE_ARTIFACT = "real_idea_answer_template.json"
PLATFORM_REPORT_ARTIFACT_KIND = (
    "platform_real_idea_answer_continuation_execution_report"
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def _first_expanded_authority(value: Any, *, path: str = "report") -> str | None:
    if isinstance(value, dict):
        for key, item in value.items():
            child_path = f"{path}.{key}"
            if key.startswith("may_") and item is not False:
                return child_path
            expanded = _first_expanded_authority(item, path=child_path)
            if expanded is not None:
                return expanded
    elif isinstance(value, list):
        for index, item in enumerate(value):
            expanded = _first_expanded_authority(item, path=f"{path}[{index}]")
            if expanded is not None:
                return expanded
    return None


def _write_private_attempt_report(attempt_dir: Path, payload: dict[str, Any]) -> Path:
    path = attempt_dir / "specspace-attempt-report.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.chmod(0o600)
    os.replace(temporary, path)
    return path


def _private_state_ref(state_dir: Path, path: Path) -> str:
    relative = path.resolve().relative_to(state_dir.resolve())
    return f"specspace-private-state://{relative.as_posix()}"


def _create_workspace_execution_lease(
    state_dir: Path,
    *,
    workspace_id: str,
    request_id: str | None,
) -> tuple[Path, bool]:
    lease_dir = state_dir / ".managed-operation-leases" / workspace_id
    lease_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    lease_dir.chmod(0o700)
    lease_path = lease_dir / "real-idea-answer-continuation.json"
    payload = {
        "artifact_kind": "specspace_local_managed_operation_lease",
        "schema_version": 1,
        "operation_id": "real_idea_answer_continuation_execute",
        "workspace_id": workspace_id,
        "request_id": request_id,
        "status": "active",
        "started_at": real_idea_answer_continuation_execution_requests.now_iso(),
        "recovery_required_after_unclean_shutdown": True,
        "authority_boundary": {"execution_authority": False},
    }
    try:
        descriptor = os.open(
            lease_path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
    except FileExistsError:
        return lease_path, False
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        lease_path.unlink(missing_ok=True)
        raise
    return lease_path, True


def _update_workspace_execution_lease(
    lease_path: Path,
    *,
    status: str,
) -> None:
    try:
        payload = json.loads(lease_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    payload["status"] = status
    payload["updated_at"] = real_idea_answer_continuation_execution_requests.now_iso()
    temporary = lease_path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.chmod(0o600)
    os.replace(temporary, lease_path)


def _workspace_execution_lease_status(lease_path: Path) -> str:
    try:
        payload = json.loads(lease_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "recovery_required"
    if not isinstance(payload, dict):
        return "recovery_required"
    return _text(payload.get("status")) or "recovery_required"


def _public_platform_report(report: dict[str, Any]) -> dict[str, Any]:
    summary = _record(report.get("summary"))
    authority = _record(report.get("authority_boundary"))
    return {
        "artifact_kind": report.get("artifact_kind"),
        "schema_version": report.get("schema_version"),
        "ok": report.get("ok"),
        "dry_run": report.get("dry_run"),
        "workspace_id": report.get("workspace_id"),
        "request_id": report.get("request_id"),
        "continuation_mode": report.get("continuation_mode"),
        "summary": {
            "status": summary.get("status"),
            "specgraph_executed": summary.get("specgraph_executed"),
        },
        "authority_boundary": {
            field: authority.get(field)
            for field in (
                "executes_specgraph_make_target",
                "executes_git_commands",
                "creates_git_commits",
                "opens_pull_requests",
                "merges_pull_requests",
                "publishes_read_models",
                "writes_ontology_packages",
                "accepts_ontology_terms",
                "mutates_canonical_specs",
                "publishes_private_artifacts",
            )
        },
    }


def _process_group_exists(process_group_id: int) -> bool:
    try:
        os.killpg(process_group_id, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _wait_for_process_group_exit(process_group_id: int, *, timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while _process_group_exists(process_group_id):
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)
    return True


def _terminate_process_group(process: subprocess.Popen[str]) -> bool:
    process_group_id = process.pid
    try:
        os.killpg(process_group_id, signal.SIGTERM)
    except ProcessLookupError:
        return True
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    if _wait_for_process_group_exit(process_group_id, timeout_seconds=0.25):
        return True
    try:
        os.killpg(process_group_id, signal.SIGKILL)
    except ProcessLookupError:
        return True
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    return _wait_for_process_group_exit(process_group_id, timeout_seconds=5)


def _run_platform_process(
    command: list[str],
    *,
    cwd: Path,
    timeout_seconds: int,
) -> tuple[subprocess.CompletedProcess[str] | None, str, str, bool, bool]:
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as error:
        terminated = _terminate_process_group(process)
        if terminated:
            stdout, stderr = process.communicate()
        else:
            stdout = error.stdout if isinstance(error.stdout, str) else ""
            stderr = error.stderr if isinstance(error.stderr, str) else ""
        return None, stdout, stderr, True, terminated
    return (
        subprocess.CompletedProcess(command, process.returncode, stdout, stderr),
        stdout,
        stderr,
        False,
        True,
    )


def _load_valid_platform_report(
    report_path: Path,
    *,
    expected_run_dir: str,
    expected_execution_request: Path,
    expected_workspace_id: str,
    expected_request_id: str,
) -> tuple[dict[str, Any] | None, str | None]:
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, "Platform did not write a readable continuation report."
    if not isinstance(report, dict):
        return None, "Platform continuation report must be a JSON object."
    if report.get("artifact_kind") != PLATFORM_REPORT_ARTIFACT_KIND:
        return None, "Platform continuation report artifact_kind is invalid."
    if report.get("ok") is not True or report.get("dry_run") is not False:
        return None, "Platform continuation report is not a completed execution."
    if _record(report.get("summary")).get("status") != "completed":
        return None, "Platform continuation report summary is not completed."
    if report.get("run_dir") != expected_run_dir:
        return None, "Platform continuation report run_dir does not match the workspace."
    if report.get("workspace_id") != expected_workspace_id:
        return None, "Platform continuation report workspace_id does not match."
    if report.get("request_id") != expected_request_id:
        return None, "Platform continuation report request_id does not match."
    execution_request_ref = _text(report.get("execution_request_ref"))
    if execution_request_ref is None:
        return None, "Platform continuation report omits execution_request_ref."
    try:
        request_path = Path(execution_request_ref).resolve()
    except OSError:
        return None, "Platform continuation report execution_request_ref is invalid."
    if request_path != expected_execution_request.resolve():
        return None, "Platform continuation report references a different request snapshot."
    authority = _record(report.get("authority_boundary"))
    for field in (
        "executes_git_commands",
        "creates_git_commits",
        "opens_pull_requests",
        "merges_pull_requests",
        "publishes_read_models",
        "writes_ontology_packages",
        "accepts_ontology_terms",
        "mutates_canonical_specs",
        "publishes_private_artifacts",
    ):
        if authority.get(field) is not False:
            return None, f"Platform continuation report must keep {field}=false."
    expanded = _first_expanded_authority(report)
    if expanded is not None:
        return None, f"Platform continuation report expands authority at {expanded}."
    return report, None


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


def _safe_specspace_state_ref_to_path(
    server: Any,
    ref: str | None,
    *,
    filename: str,
    workspace_id: str,
) -> Path | None:
    if ref is None or not ref.startswith("specspace-state://"):
        return None
    rel = ref.removeprefix("specspace-state://")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    if Path(rel).as_posix() != filename:
        return None
    materialized = specspace_state_backend.materialize_state(
        server,
        filename,
        workspace_id=workspace_id,
    )
    return materialized or specspace_state_backend.materialization_path(
        server,
        filename,
        workspace_id=workspace_id,
    )


def _no_clarification_template_ready(
    server: Any,
    *,
    template_ref: str | None,
    workspace_id: str,
) -> bool:
    template_path = _safe_runs_ref_to_path(
        server,
        template_ref,
        filename=ANSWER_TEMPLATE_ARTIFACT,
    )
    if template_path is None or not template_path.is_file():
        return False
    try:
        template = json.loads(template_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    if not isinstance(template, dict):
        return False
    template_ready = (
        template.get("artifact_kind") == "real_idea_answer_template"
        and template.get("contract_ref")
        == "specgraph.idea-to-spec.real-idea-answer-template.v0.2"
        and template.get("workspace_id") == workspace_id
        and template.get("clarification_outcome") == "clarification_not_required"
        and _record(template.get("readiness")).get("ready") is True
        and not template.get("answer_targets")
    )
    if not template_ready:
        return False
    source = _record(
        _record(template.get("source_artifacts")).get("clarification_requests")
    )
    requests_ref = _text(source.get("source_ref"))
    if requests_ref is None:
        return False
    requests_path = _safe_runs_ref_to_path(
        server,
        requests_ref,
        filename="idea_intake_clarification_requests.json",
    )
    if requests_path is None or not requests_path.is_file():
        return False
    try:
        requests = json.loads(requests_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    if not isinstance(requests, dict):
        return False
    stable_requests = {
        key: value for key, value in requests.items() if key != "generated_at"
    }
    encoded = json.dumps(
        stable_requests,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return (
        source.get("source_ref") == requests_ref
        and source.get("source_digest")
        == f"sha256:{hashlib.sha256(encoded).hexdigest()}"
        and requests.get("artifact_kind") == "idea_to_spec_clarification_requests"
        and requests.get("clarification_outcome") == "clarification_not_required"
        and requests.get("workspace_id") == workspace_id
        and not requests.get("clarification_requests")
    )


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


def _execute_requested_continuation_locked(
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
    binding_error = specspace_provider.managed_workspace_binding_error(
        server, selected_workspace_id
    )
    if binding_error is not None:
        return HTTPStatus.CONFLICT, binding_error

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
    no_clarification_ready = _no_clarification_template_ready(
        server,
        template_ref=_text(request.get("answer_template_ref")),
        workspace_id=selected_workspace_id,
    )
    try:
        answer_state_path = _safe_specspace_state_ref_to_path(
            server,
            answer_state_ref,
            filename=idea_to_spec_intake_clarification_answers.INTAKE_ANSWER_FILENAME,
            workspace_id=selected_workspace_id,
        )
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecSpace state provider is unavailable.",
            "reason": "specspace_state_provider_unavailable",
        }
    if answer_state_path is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "answer_state_ref must point to a safe SpecSpace answer state artifact.",
            "field": "answer_state_ref",
        }
    if not answer_state_path.is_file() and not no_clarification_ready:
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

    output_dir = (
        specspace_provider.runs_dir_for_workspace(server, selected_workspace_id)
        or runs_dir
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / EXECUTION_REPORT_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    expected_request_digest = (
        real_idea_answer_continuation_execution_requests.request_digest(request)
    )
    state_dir = getattr(server, "specspace_state_dir", None)
    if not isinstance(state_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local continuation execution requires a persistent SpecSpace state directory."
        )
    request_id_value = str(request.get("request_id"))
    attempt_key = (
        f"{request_id_value[:32]}."
        f"{expected_request_digest.removeprefix('sha256:')}"
    )
    attempt_root = state_dir / ".managed-operation-attempts"
    workspace_attempt_root = attempt_root / selected_workspace_id
    ambiguous_attempts = list(workspace_attempt_root.glob("*/ambiguous.json"))
    if ambiguous_attempts:
        return HTTPStatus.CONFLICT, {
            "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
            "ok": False,
            "status": "ambiguous_execution_requires_recovery",
            "workspace_id": selected_workspace_id,
            "error": (
                "A previous continuation process group could not be confirmed stopped. "
                "Inspect local processes and the private attempt report before retry."
            ),
            "summary": {"executed": False, "retry_allowed": False},
        }
    attempt_dir = workspace_attempt_root / attempt_key

    try:
        attempt_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        attempt_root.chmod(0o700)
        workspace_attempt_root.mkdir(mode=0o700, exist_ok=True)
        workspace_attempt_root.chmod(0o700)
        pending_attempt_dir = Path(
            tempfile.mkdtemp(prefix=".pending-", dir=workspace_attempt_root)
        )
        pending_attempt_dir.chmod(0o700)
        execution_request_path = pending_attempt_dir / "execution-request.json"
        answer_snapshot_path = pending_attempt_dir / "answer-state.json"
        initialization_snapshot_path = pending_attempt_dir / "workspace-initialization.json"
        intake_snapshot_path = pending_attempt_dir / "intake-execution.json"
        request_snapshot = dict(state_or_error or {})
        request_snapshot["requests"] = [request]
        execution_request_path.write_text(
            json.dumps(request_snapshot, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        if answer_state_path.is_file():
            shutil.copyfile(answer_state_path, answer_snapshot_path)
        shutil.copyfile(initialization_path, initialization_snapshot_path)
        shutil.copyfile(intake_execution_path, intake_snapshot_path)
        for snapshot in (
            execution_request_path,
            answer_snapshot_path,
            initialization_snapshot_path,
            intake_snapshot_path,
        ):
            if snapshot.is_file():
                snapshot.chmod(0o600)
    except OSError:
        if "pending_attempt_dir" in locals():
            shutil.rmtree(pending_attempt_dir, ignore_errors=True)
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": (
                "specspace_managed_real_idea_answer_continuation_execution"
            ),
            "ok": False,
            "status": "execution_snapshot_failed",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("request_id"),
            "output_ref": output_ref,
            "error": "Private continuation input snapshots could not be created.",
            "summary": {
                "status": "managed_real_idea_answer_continuation_snapshot_failed",
                "executed": False,
                "retry_requires_new_request": False,
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

    snapshot_sources = [
        (initialization_snapshot_path, initialization_path),
        (intake_snapshot_path, intake_execution_path),
    ]
    if answer_snapshot_path.is_file():
        snapshot_sources.append((answer_snapshot_path, answer_state_path))
    try:
        snapshot_digests = {
            snapshot.name: _file_sha256(snapshot)
            for snapshot, _source in snapshot_sources
        }
    except OSError:
        shutil.rmtree(pending_attempt_dir, ignore_errors=True)
        return HTTPStatus.BAD_GATEWAY, {
            "error": "Continuation input snapshots could not be verified.",
            "status": "execution_snapshot_failed",
            "workspace_id": selected_workspace_id,
        }

    try:
        pending_attempt_dir.replace(attempt_dir)
        execution_request_path = attempt_dir / "execution-request.json"
        answer_snapshot_path = attempt_dir / "answer-state.json"
        initialization_snapshot_path = attempt_dir / "workspace-initialization.json"
        intake_snapshot_path = attempt_dir / "intake-execution.json"
        snapshot_sources = [
            (attempt_dir / snapshot.name, source)
            for snapshot, source in snapshot_sources
        ]
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_answer_continuation_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": "prepared",
                "executed": False,
                "authority_boundary": {
                    "executes_platform": False,
                    "mutates_canonical_specs": False,
                },
            },
        )
    except OSError:
        shutil.rmtree(pending_attempt_dir, ignore_errors=True)
        shutil.rmtree(attempt_dir, ignore_errors=True)
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
            "ok": False,
            "status": "attempt_evidence_persistence_failed",
            "workspace_id": selected_workspace_id,
            "request_id": request_id_value,
            "error": "Private continuation attempt evidence could not be prepared.",
            "summary": {
                "executed": False,
                "retry_requires_new_request": False,
            },
        }

    consume_status, consume_body = (
        real_idea_answer_continuation_execution_requests.claim_request_for_execution(
            server,
            workspace_id=selected_workspace_id,
            request_id=request_id_value,
            expected_request_digest=expected_request_digest,
        )
    )
    if consume_status != HTTPStatus.OK:
        shutil.rmtree(attempt_dir, ignore_errors=True)
        return consume_status, {
            "artifact_kind": (
                "specspace_managed_real_idea_answer_continuation_execution"
            ),
            "ok": False,
            "status": "execution_request_not_active",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("request_id"),
            "execution_request_ref": (
                "specspace-state://"
                f"{real_idea_answer_continuation_execution_requests.EXECUTION_REQUEST_FILENAME}"
            ),
            "output_ref": output_ref,
            "summary": {
                "status": "managed_real_idea_answer_continuation_request_not_active",
                "executed": False,
            },
            "error": consume_body.get("error")
            if isinstance(consume_body.get("error"), str)
            else "Real idea answer continuation execution request is no longer active.",
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

    try:
        changed_inputs = [
            str(source)
            for snapshot, source in snapshot_sources
            if _file_sha256(source) != snapshot_digests[snapshot.name]
        ]
    except OSError:
        changed_inputs = [str(source) for _snapshot, source in snapshot_sources]
    if changed_inputs:
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_answer_continuation_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": "input_snapshot_changed",
                "executed": False,
                "changed_input_count": len(changed_inputs),
                "authority_boundary": {
                    "executes_platform": False,
                    "executes_specgraph": False,
                    "mutates_canonical_specs": False,
                },
            },
        )
        return HTTPStatus.CONFLICT, {
            "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
            "ok": False,
            "status": "execution_input_changed",
            "workspace_id": selected_workspace_id,
            "request_id": request_id_value,
            "error": "Continuation inputs changed while the request was being claimed.",
            "attempt_report_ref": _private_state_ref(state_dir, attempt_report_path),
            "summary": {
                "executed": False,
                "retry_requires_new_request": True,
            },
        }

    with tempfile.TemporaryDirectory(
        prefix=".specspace-continuation-output-",
        dir=output_dir,
    ) as output_tmp:
        staged_output_path = Path(output_tmp) / EXECUTION_REPORT_ARTIFACT

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
            request_id_value,
            "--workspace-initialization",
            str(initialization_snapshot_path),
            "--intake-execution",
            str(intake_snapshot_path),
            "--output",
            str(staged_output_path),
            "--format",
            "json",
        ]
        if answer_snapshot_path.is_file():
            command.extend(["--answer-state", str(answer_snapshot_path)])

        _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_answer_continuation_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": "running",
                "executed": True,
                "authority_boundary": {
                    "executes_platform": True,
                    "mutates_canonical_specs": False,
                },
            },
        )
        try:
            completed, _stdout, _stderr, timed_out, process_group_terminated = (
                _run_platform_process(
                    command,
                    cwd=platform_script.parent.parent,
                    timeout_seconds=timeout_seconds,
                )
            )
        except OSError:
            attempt_report_path = _write_private_attempt_report(
                attempt_dir,
                {
                    "artifact_kind": "specspace_local_managed_operation_attempt_report",
                    "schema_version": 1,
                    "operation_id": "real_idea_answer_continuation_execute",
                    "workspace_id": selected_workspace_id,
                    "request_id": request_id_value,
                    "request_digest": expected_request_digest,
                    "status": "platform_execution_start_failed",
                    "executed": False,
                    "authority_boundary": {"executes_platform": False},
                },
            )
            return HTTPStatus.BAD_GATEWAY, {
                "artifact_kind": (
                    "specspace_managed_real_idea_answer_continuation_execution"
                ),
                "ok": False,
                "status": "platform_execution_start_failed",
                "workspace_id": selected_workspace_id,
                "request_id": request.get("request_id"),
                "output_ref": output_ref,
                "error": "The allowlisted Platform continuation process could not start.",
                "attempt_report_ref": _private_state_ref(
                    state_dir, attempt_report_path
                ),
                "summary": {
                    "status": "managed_real_idea_answer_continuation_start_failed",
                    "executed": False,
                    "retry_requires_new_request": True,
                },
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
            }

        if timed_out:
            timeout_status = (
                "platform_execution_timeout"
                if process_group_terminated
                else "platform_execution_ambiguous"
            )
            attempt_report_payload = {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_answer_continuation_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": timeout_status,
                "executed": False,
                "process_group_terminated": process_group_terminated,
                "authority_boundary": {
                    "executes_platform": True,
                    "mutates_canonical_specs": False,
                },
            }
            attempt_report_path = _write_private_attempt_report(
                attempt_dir,
                attempt_report_payload,
            )
            if not process_group_terminated:
                ambiguous_path = attempt_dir / "ambiguous.json"
                ambiguous_path.write_text(
                    json.dumps(attempt_report_payload, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8",
                )
                ambiguous_path.chmod(0o600)
            return (
                HTTPStatus.GATEWAY_TIMEOUT
                if process_group_terminated
                else HTTPStatus.SERVICE_UNAVAILABLE,
                {
                    "artifact_kind": (
                        "specspace_managed_real_idea_answer_continuation_execution"
                    ),
                    "ok": False,
                    "status": timeout_status,
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
                    "process_group_terminated": process_group_terminated,
                    "attempt_report_ref": _private_state_ref(
                        state_dir, attempt_report_path
                    ),
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
                        "status": (
                            "managed_real_idea_answer_continuation_timeout"
                            if process_group_terminated
                            else "managed_real_idea_answer_continuation_ambiguous"
                        ),
                        "executed": False,
                        "timeout_seconds": timeout_seconds,
                        "output_ref": output_ref,
                        "retry_requires_new_request": True,
                        "retry_allowed": process_group_terminated,
                    },
                },
            )

        assert completed is not None
        report: dict[str, Any] = {}
        if staged_output_path.is_file():
            try:
                loaded_report = json.loads(staged_output_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                loaded_report = {}
            if isinstance(loaded_report, dict):
                report = loaded_report
        report_error: str | None = None
        if completed.returncode == 0:
            valid_report, report_error = _load_valid_platform_report(
                staged_output_path,
                expected_run_dir=f"runs/{selected_workspace_id}",
                expected_execution_request=execution_request_path,
                expected_workspace_id=selected_workspace_id,
                expected_request_id=request_id_value,
            )
            if valid_report is not None:
                report = valid_report
                os.replace(staged_output_path, output_path)

        execution_succeeded = completed.returncode == 0 and report_error is None
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_answer_continuation_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": "completed" if execution_succeeded else "failed",
                "executed": True,
                "platform_returncode": completed.returncode,
                "output_published": execution_succeeded,
                "output_digest": _file_sha256(output_path)
                if execution_succeeded
                else None,
                "authority_boundary": {
                    "executes_platform": True,
                    "mutates_canonical_specs": False,
                },
            },
        )

    response = {
        "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
        "ok": execution_succeeded,
        "status": "completed" if execution_succeeded else "failed",
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
        "platform_report": _public_platform_report(report),
        "error": report_error,
        "attempt_report_ref": _private_state_ref(state_dir, attempt_report_path),
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                execution_succeeded
                and (
                    _record(report.get("authority_boundary")).get(
                        "executes_specgraph_make_target"
                    )
                    or _record(report.get("summary")).get("specgraph_executed")
                )
            ),
            "applies_answers": False,
            "creates_git_commits": False
            if not execution_succeeded
            else _record(report.get("authority_boundary")).get("creates_git_commits"),
            "opens_pull_requests": False,
            "publishes_read_models": False
            if not execution_succeeded
            else _record(report.get("authority_boundary")).get("publishes_read_models"),
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_real_idea_answer_continuation_executed"
            if execution_succeeded
            else "managed_real_idea_answer_continuation_failed",
            "executed": True,
            "output_ref": output_ref,
            "retry_requires_new_request": not execution_succeeded,
        },
    }
    return (
        HTTPStatus.OK if execution_succeeded else HTTPStatus.BAD_GATEWAY,
        response,
    )


def execute_requested_continuation(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return _execute_requested_continuation_locked(
            server,
            payload,
            workspace_id=workspace_id,
        )
    if specspace_state_backend.backend(server).kind != "file":
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local Platform execution requires the restart-persistent file state backend."
        )
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if selected_workspace_id is None or (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return _execute_requested_continuation_locked(
            server,
            payload,
            workspace_id=workspace_id,
        )
    state_dir = getattr(server, "specspace_state_dir", None)
    if not isinstance(state_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local continuation execution requires a persistent SpecSpace state directory."
        )
    try:
        lease_path, acquired = _create_workspace_execution_lease(
            state_dir,
            workspace_id=selected_workspace_id,
            request_id=_text(payload.get("request_id")),
        )
    except OSError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            **_execution_disabled_payload(
                "The private workspace execution lease could not be persisted."
            ),
            "status": "workspace_execution_lease_unavailable",
        }
    if not acquired:
        lease_status = _workspace_execution_lease_status(lease_path)
        ambiguous = lease_status == "ambiguous"
        return HTTPStatus.CONFLICT, {
            "artifact_kind": "specspace_managed_real_idea_answer_continuation_execution",
            "ok": False,
            "status": (
                "ambiguous_execution_requires_recovery"
                if ambiguous
                else "workspace_execution_in_progress_or_recovery_required"
            ),
            "workspace_id": selected_workspace_id,
            "operation_lease_ref": _private_state_ref(state_dir, lease_path),
            "error": (
                "A prior continuation execution is active or ended without a clean "
                "lease release. Inspect local processes and private attempt evidence."
            ),
            "summary": {"executed": False, "retry_allowed": False},
        }

    try:
        status, response = _execute_requested_continuation_locked(
            server,
            payload,
            workspace_id=workspace_id,
        )
    except BaseException:
        _update_workspace_execution_lease(lease_path, status="recovery_required")
        raise
    if response.get("status") == "platform_execution_ambiguous":
        _update_workspace_execution_lease(lease_path, status="ambiguous")
        response["operation_lease_ref"] = _private_state_ref(state_dir, lease_path)
    else:
        lease_path.unlink(missing_ok=True)
    return status, response
