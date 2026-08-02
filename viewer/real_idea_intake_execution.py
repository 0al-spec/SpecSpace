"""Managed Platform execution for real idea intake requests."""

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

from viewer import real_idea_entry_requests, real_idea_intake_execution_requests
from viewer import specspace_provider, specspace_state_backend

EXECUTION_REPORT_ARTIFACT = "platform_real_idea_entry_intake_execution_report.json"
PLATFORM_REPORT_ARTIFACT_KIND = "platform_real_idea_entry_intake_execution_report"
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


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def _changed_snapshot_sources(
    snapshot_sources: tuple[tuple[Path, Path], ...],
    snapshot_digests: dict[str, str],
) -> list[str]:
    try:
        return [
            str(source)
            for snapshot, source in snapshot_sources
            if _file_sha256(source) != snapshot_digests[snapshot.name]
        ]
    except OSError:
        return [str(source) for _snapshot, source in snapshot_sources]


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
    lease_path = lease_dir / "real-idea-intake.json"
    payload = {
        "artifact_kind": "specspace_local_managed_operation_lease",
        "schema_version": 1,
        "operation_id": "real_idea_intake_execute",
        "workspace_id": workspace_id,
        "request_id": request_id,
        "status": "active",
        "started_at": real_idea_intake_execution_requests.now_iso(),
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


def _update_workspace_execution_lease(lease_path: Path, *, status: str) -> None:
    try:
        payload = json.loads(lease_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    payload["status"] = status
    payload["updated_at"] = real_idea_intake_execution_requests.now_iso()
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
) -> tuple[subprocess.CompletedProcess[str] | None, bool, bool]:
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        terminated = _terminate_process_group(process)
        if terminated:
            process.communicate()
        return None, True, terminated
    return subprocess.CompletedProcess(command, process.returncode), False, True


def _public_platform_report(report: dict[str, Any]) -> dict[str, Any]:
    summary = _record(report.get("summary"))
    authority = _record(report.get("authority_boundary"))
    return {
        "artifact_kind": report.get("artifact_kind"),
        "schema_version": report.get("schema_version"),
        "ok": report.get("ok"),
        "dry_run": report.get("dry_run"),
        "run_dir": report.get("run_dir"),
        "summary": {
            "status": summary.get("status"),
            "workspace_id": summary.get("workspace_id"),
            "intake_session_status": summary.get("intake_session_status"),
            "answer_template_status": summary.get("answer_template_status"),
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


def _load_valid_platform_report(
    report_path: Path,
    *,
    expected_run_dir: str,
    expected_execution_request: Path,
    expected_entry_requests: Path,
    expected_initialization: Path,
    expected_workspace_id: str,
) -> tuple[dict[str, Any] | None, str | None]:
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, "Platform did not write a readable intake report."
    if not isinstance(report, dict):
        return None, "Platform intake report must be a JSON object."
    if report.get("artifact_kind") != PLATFORM_REPORT_ARTIFACT_KIND:
        return None, "Platform intake report artifact_kind is invalid."
    if report.get("ok") is not True or report.get("dry_run") is not False:
        return None, "Platform intake report is not a completed execution."
    summary = _record(report.get("summary"))
    if summary.get("status") != "completed":
        return None, "Platform intake report summary is not completed."
    if summary.get("workspace_id") != expected_workspace_id:
        return None, "Platform intake report workspace_id does not match."
    if report.get("run_dir") != expected_run_dir:
        return None, "Platform intake report run_dir does not match the workspace."
    for field, expected_path in (
        ("execution_request_ref", expected_execution_request),
        ("entry_requests_source_ref", expected_entry_requests),
    ):
        value = _text(report.get(field))
        if value is None:
            return None, f"Platform intake report omits {field}."
        try:
            report_path_value = Path(value).resolve()
        except OSError:
            return None, f"Platform intake report {field} is invalid."
        if report_path_value != expected_path.resolve():
            return None, f"Platform intake report {field} references another input."
    initialization_source_ref = _text(
        _record(report.get("workspace_initialization")).get("source_ref")
    )
    if initialization_source_ref is None:
        return None, "Platform intake report omits workspace initialization source_ref."
    try:
        initialization_source_path = Path(initialization_source_ref).resolve()
    except OSError:
        return None, "Platform intake report initialization source_ref is invalid."
    if initialization_source_path != expected_initialization.resolve():
        return None, "Platform intake report references another initialization input."
    expected_entry_digest = _file_sha256(expected_entry_requests).removeprefix("sha256:")
    if report.get("entry_requests_source_digest") != expected_entry_digest:
        return None, "Platform intake report entry request digest does not match."
    if report.get("canonical_mutations_allowed") is not False:
        return None, "Platform intake report must keep canonical mutations disabled."
    if report.get("tracked_artifacts_written") is not False:
        return None, "Platform intake report must keep tracked artifacts unwritten."
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
            return None, f"Platform intake report must keep {field}=false."
    expanded = _first_expanded_authority(report)
    if expanded is not None:
        return None, f"Platform intake report expands authority at {expanded}."
    return report, None


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


def _execute_requested_intake_locked(
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
    output_run_relative = output_dir.resolve().relative_to(runs_dir.resolve())
    output_run_dir_ref = (
        "runs"
        if output_run_relative == Path(".")
        else f"runs/{output_run_relative.as_posix()}"
    )
    state_dir = getattr(server, "specspace_state_dir", None)
    if not isinstance(state_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local intake execution requires a persistent SpecSpace state directory."
        )

    expected_request_digest = real_idea_intake_execution_requests.request_digest(request)
    request_id_value = str(request.get("request_id"))
    attempt_key = (
        f"{request_id_value[:32]}."
        f"{expected_request_digest.removeprefix('sha256:')}"
    )
    workspace_attempt_root = (
        state_dir / ".managed-operation-attempts" / selected_workspace_id
    )
    if list(workspace_attempt_root.glob("*/ambiguous.json")):
        return HTTPStatus.CONFLICT, {
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "ambiguous_execution_requires_recovery",
            "workspace_id": selected_workspace_id,
            "error": (
                "A previous intake process group could not be confirmed stopped. "
                "Inspect private attempt evidence before retrying."
            ),
            "summary": {"executed": False, "retry_allowed": False},
        }
    attempt_dir = workspace_attempt_root / attempt_key
    pending_attempt_dir: Path | None = None
    try:
        workspace_attempt_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        workspace_attempt_root.chmod(0o700)
        pending_attempt_dir = Path(
            tempfile.mkdtemp(prefix=".pending-real-idea-intake-", dir=workspace_attempt_root)
        )
        pending_attempt_dir.chmod(0o700)
        execution_request_snapshot = pending_attempt_dir / "execution-request.json"
        entry_requests_snapshot = pending_attempt_dir / "entry-requests.json"
        initialization_snapshot = pending_attempt_dir / "workspace-initialization.json"
        request_snapshot = dict(state_or_error or {})
        request_snapshot["requests"] = [request]
        execution_request_snapshot.write_text(
            json.dumps(request_snapshot, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        shutil.copyfile(entry_requests_path, entry_requests_snapshot)
        shutil.copyfile(initialization_path, initialization_snapshot)
        for snapshot in (
            execution_request_snapshot,
            entry_requests_snapshot,
            initialization_snapshot,
        ):
            snapshot.chmod(0o600)
    except OSError:
        if pending_attempt_dir is not None:
            shutil.rmtree(pending_attempt_dir, ignore_errors=True)
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "execution_snapshot_failed",
            "workspace_id": selected_workspace_id,
            "request_id": request.get("request_id"),
            "output_ref": output_ref,
            "error": "Private intake input snapshots could not be created.",
            "summary": {
                "status": "managed_real_idea_intake_snapshot_failed",
                "executed": False,
            },
        }

    snapshot_sources = (
        (entry_requests_snapshot, entry_requests_path),
        (initialization_snapshot, initialization_path),
    )
    attempt_promoted = False
    try:
        snapshot_digests = {
            snapshot.name: _file_sha256(snapshot)
            for snapshot, _source in snapshot_sources
        }
        pending_attempt_dir.replace(attempt_dir)
        attempt_promoted = True
        execution_request_snapshot = attempt_dir / "execution-request.json"
        entry_requests_snapshot = attempt_dir / "entry-requests.json"
        initialization_snapshot = attempt_dir / "workspace-initialization.json"
        snapshot_sources = (
            (entry_requests_snapshot, entry_requests_path),
            (initialization_snapshot, initialization_path),
        )
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_intake_execute",
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
        if pending_attempt_dir is not None:
            shutil.rmtree(pending_attempt_dir, ignore_errors=True)
        if attempt_promoted and attempt_dir.is_dir():
            shutil.rmtree(attempt_dir, ignore_errors=True)
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "attempt_evidence_persistence_failed",
            "workspace_id": selected_workspace_id,
            "request_id": request_id_value,
            "error": "Private intake attempt evidence could not be prepared.",
            "summary": {"executed": False, "retry_requires_new_request": False},
        }

    consume_status, consume_body = (
        real_idea_intake_execution_requests.claim_request_for_execution(
            server,
            workspace_id=selected_workspace_id,
            request_id=request_id_value,
            expected_request_digest=expected_request_digest,
        )
    )
    if consume_status != HTTPStatus.OK:
        shutil.rmtree(attempt_dir, ignore_errors=True)
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

    changed_inputs = _changed_snapshot_sources(snapshot_sources, snapshot_digests)
    if changed_inputs:
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_intake_execute",
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
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": "execution_input_changed",
            "workspace_id": selected_workspace_id,
            "request_id": request_id_value,
            "error": "Intake inputs changed while the request was being claimed.",
            "attempt_report_ref": _private_state_ref(state_dir, attempt_report_path),
            "summary": {"executed": False, "retry_requires_new_request": True},
        }

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    with tempfile.TemporaryDirectory(
        prefix=".specspace-intake-output-",
        dir=output_dir,
    ) as output_tmp:
        staged_output_path = Path(output_tmp) / EXECUTION_REPORT_ARTIFACT
        command = [
            sys.executable,
            str(platform_script),
            "product-real-idea-intake",
            "execute-requested",
            "--execution-request",
            str(execution_request_snapshot),
            "--specgraph-dir",
            str(specgraph_dir),
            "--entry-requests",
            str(entry_requests_snapshot),
            "--workspace-initialization",
            str(initialization_snapshot),
            "--workspace-id",
            selected_workspace_id,
            # Platform's --request-id selects the raw idea entry request. The
            # SpecSpace request id identifies only the execution handoff above.
            "--request-id",
            str(request.get("entry_request_id")),
            "--output",
            str(staged_output_path),
            "--format",
            "json",
        ]
        _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_intake_execute",
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
            completed, timed_out, process_group_terminated = _run_platform_process(
                command,
                cwd=platform_script.parent.parent,
                timeout_seconds=timeout_seconds,
            )
        except OSError:
            attempt_report_path = _write_private_attempt_report(
                attempt_dir,
                {
                    "artifact_kind": "specspace_local_managed_operation_attempt_report",
                    "schema_version": 1,
                    "operation_id": "real_idea_intake_execute",
                    "workspace_id": selected_workspace_id,
                    "request_id": request_id_value,
                    "request_digest": expected_request_digest,
                    "status": "platform_execution_start_failed",
                    "executed": False,
                    "authority_boundary": {"executes_platform": False},
                },
            )
            return HTTPStatus.BAD_GATEWAY, {
                "artifact_kind": "specspace_managed_real_idea_intake_execution",
                "ok": False,
                "status": "platform_execution_start_failed",
                "workspace_id": selected_workspace_id,
                "request_id": request.get("request_id"),
                "entry_request_id": request.get("entry_request_id"),
                "output_ref": output_ref,
                "error": "The allowlisted Platform intake process could not start.",
                "attempt_report_ref": _private_state_ref(
                    state_dir, attempt_report_path
                ),
                "summary": {
                    "status": "managed_real_idea_intake_start_failed",
                    "executed": False,
                    "retry_requires_new_request": True,
                },
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

        if timed_out:
            timeout_status = (
                "platform_execution_timeout"
                if process_group_terminated
                else "platform_execution_ambiguous"
            )
            attempt_report_payload = {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_intake_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": timeout_status,
                "executed": True,
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
                    "artifact_kind": "specspace_managed_real_idea_intake_execution",
                    "ok": False,
                    "status": timeout_status,
                    "workspace_id": selected_workspace_id,
                    "request_id": request_id_value,
                    "entry_request_id": request.get("entry_request_id"),
                    "output_ref": output_ref,
                    "process_group_terminated": process_group_terminated,
                    "attempt_report_ref": _private_state_ref(
                        state_dir, attempt_report_path
                    ),
                    "summary": {
                        "status": "managed_real_idea_intake_timeout"
                        if process_group_terminated
                        else "managed_real_idea_intake_ambiguous",
                        "executed": False,
                        "timeout_seconds": timeout_seconds,
                        "retry_requires_new_request": True,
                        "retry_allowed": process_group_terminated,
                    },
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
                },
            )

        assert completed is not None
        report: dict[str, Any] = {}
        report_error: str | None = None
        if completed.returncode == 0:
            valid_report, report_error = _load_valid_platform_report(
                staged_output_path,
                expected_run_dir=output_run_dir_ref,
                expected_execution_request=execution_request_snapshot,
                expected_entry_requests=entry_requests_snapshot,
                expected_initialization=initialization_snapshot,
                expected_workspace_id=selected_workspace_id,
            )
            if valid_report is not None:
                report = valid_report
                os.replace(staged_output_path, output_path)
        else:
            report_error = "Platform intake execution failed."
        success = completed.returncode == 0 and report_error is None
        attempt_report_path = _write_private_attempt_report(
            attempt_dir,
            {
                "artifact_kind": "specspace_local_managed_operation_attempt_report",
                "schema_version": 1,
                "operation_id": "real_idea_intake_execute",
                "workspace_id": selected_workspace_id,
                "request_id": request_id_value,
                "request_digest": expected_request_digest,
                "status": "completed" if success else "failed",
                "executed": True,
                "platform_returncode": completed.returncode,
                "output_published": success,
                "output_digest": _file_sha256(output_path) if success else None,
                "authority_boundary": {
                    "executes_platform": True,
                    "mutates_canonical_specs": False,
                },
            },
        )

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
        "platform_report": _public_platform_report(report),
        "error": report_error,
        "attempt_report_ref": _private_state_ref(state_dir, attempt_report_path),
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                success
                and _record(report.get("authority_boundary")).get(
                    "executes_specgraph_make_target"
                )
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
            "retry_requires_new_request": not success,
        },
    }
    return (
        HTTPStatus.OK if success else HTTPStatus.BAD_GATEWAY,
        response,
    )


def execute_requested_intake(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return _execute_requested_intake_locked(
            server,
            payload,
            workspace_id=workspace_id,
        )
    if specspace_state_backend.backend(server).kind != "file":
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local Platform execution requires the restart-persistent file state backend."
        )
    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if selected_workspace_id is None or (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return _execute_requested_intake_locked(
            server,
            payload,
            workspace_id=workspace_id,
        )
    state_dir = getattr(server, "specspace_state_dir", None)
    if not isinstance(state_dir, Path):
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Local intake execution requires a persistent SpecSpace state directory."
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
            "artifact_kind": "specspace_managed_real_idea_intake_execution",
            "ok": False,
            "status": (
                "ambiguous_execution_requires_recovery"
                if ambiguous
                else "workspace_execution_in_progress_or_recovery_required"
            ),
            "workspace_id": selected_workspace_id,
            "operation_lease_ref": _private_state_ref(state_dir, lease_path),
            "error": (
                "A prior intake execution is active or ended without a clean lease "
                "release. Inspect local processes and private attempt evidence."
            ),
            "summary": {"executed": False, "retry_allowed": False},
        }

    try:
        status, response = _execute_requested_intake_locked(
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
