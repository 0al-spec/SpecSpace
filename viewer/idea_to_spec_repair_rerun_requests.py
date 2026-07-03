"""SpecSpace-owned request state for idea-to-spec repair draft reruns."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

RERUN_REQUEST_ARTIFACT_KIND = "specspace_idea_to_spec_repair_rerun_request_state"
RERUN_REQUEST_SCHEMA_VERSION = 1
RERUN_REQUEST_FILENAME = "idea_to_spec_repair_rerun_requests.json"
REQUESTED_ACTION = "prepare_repair_draft_rerun"
IMPORT_PREVIEW_ARTIFACT_KEY = "specspace_repair_draft_import_preview"
RERUN_REPORT_ARTIFACT_KEY = "specspace_repair_draft_rerun_report"
PLATFORM_IMPORT_EXECUTION_ARTIFACT_KEY = "product_repair_draft_import_execution"
IMPORT_PREVIEW_PATH = "runs/specspace_repair_draft_import_preview.json"
RERUN_REPORT_PATH = "runs/specspace_repair_draft_rerun_report.json"
REPAIR_SESSION_PATH = "runs/idea_to_spec_repair_session.json"
REPAIR_DRAFT_STATE_REF = "specspace-state://idea_to_spec_repair_drafts.json"
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_apply_answers",
    "may_apply_decisions",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
)
AUTHORITY_FALSE_FIELDS = (
    "rerun_request_state_is_authority",
    "specgraph_execution_authority",
    "specgraph_artifact_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
REQUEST_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_run_make_target",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / RERUN_REQUEST_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def request_id_for(workspace_id: str, timestamp: str) -> str:
    safe_timestamp = (
        timestamp.replace(":", "")
        .replace("-", "")
        .replace(".", "")
        .replace("+", "")
    )
    return f"repair-rerun-request.{workspace_id}.{safe_timestamp}.{uuid.uuid4().hex[:12]}"


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": RERUN_REQUEST_ARTIFACT_KIND,
        "schema_version": RERUN_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "requests": [],
        "summary": {
            "status": "no_rerun_requests",
            "request_count": 0,
            "workspace_count": 0,
            "next_gap": "request_repair_draft_rerun_after_specgraph_import_preview",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_product_repair_workflow": True,
            "may_execute_specgraph": False,
            "may_execute_prompt_agent": False,
            "may_apply_to_specgraph": False,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_execute_git_service_operation": False,
        },
        "authority_boundary": {
            "rerun_request_state_is_authority": False,
            "specgraph_execution_authority": False,
            "specgraph_artifact_authority": False,
            "ontology_authority": False,
            "git_service_authority": False,
            "canonical_mutations_allowed": False,
        },
    }


def read_state(
    server: Any,
    *,
    workspace_id: str | None = None,
    workspace_payload: dict[str, Any] | None = None,
    repair_draft_state: dict[str, Any] | None = None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    status, state = _read_persisted_state(server)
    if status != HTTPStatus.OK:
        return status, state
    return HTTPStatus.OK, _with_workflow_status(
        _filtered_state(state, workspace_id),
        workspace_payload=workspace_payload,
        repair_draft_state=repair_draft_state,
    )


def _read_persisted_state(server: Any) -> tuple[HTTPStatus, dict[str, Any]]:
    path = state_path(server)
    if not path.exists():
        return HTTPStatus.OK, empty_state(path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"{RERUN_REQUEST_FILENAME} is not valid JSON",
            "detail": str(exc),
            "path": str(path),
        }
    state, error = normalize_state(raw, path)
    if error is not None:
        error["path"] = str(path)
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, state


def normalize_state(raw: Any, path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{RERUN_REQUEST_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != RERUN_REQUEST_ARTIFACT_KIND:
        return None, {"error": "Invalid repair rerun request state artifact_kind"}
    if raw.get("schema_version") != RERUN_REQUEST_SCHEMA_VERSION:
        return None, {"error": "Unsupported repair rerun request state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Repair rerun request state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Repair rerun request state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {
            "error": f"Repair rerun request consumer_boundary cannot claim {mutation_field}"
        }
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {
            "error": f"Repair rerun request authority_boundary cannot claim {mutation_field}"
        }

    state = empty_state(path)
    requests = []
    for entry in raw.get("requests", []):
        if not isinstance(entry, dict):
            continue
        mutation_field = _first_true(entry, REQUEST_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {"error": f"Repair rerun request record cannot claim {mutation_field}"}
        request = _normalize_existing_request(entry)
        if request is not None:
            requests.append(request)
    requests.sort(key=lambda entry: (entry["workspace_id"], entry["created_at"], entry["id"]))
    state["requests"] = requests
    state["source_artifacts"] = _string_map(raw.get("source_artifacts"))
    _refresh_summary(state)
    return state, None


def save_rerun_request(
    server: Any,
    payload: dict[str, Any],
    workspace_payload: dict[str, Any],
    repair_draft_state: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    requested_action = _text(payload.get("requested_action")) or REQUESTED_ACTION
    if requested_action != REQUESTED_ACTION:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Unsupported repair rerun request action: {requested_action}",
            "field": "requested_action",
        }
    mutation_field = _first_true(payload, REQUEST_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Repair rerun request payload cannot claim {mutation_field}",
            "field": mutation_field,
        }

    workspace = _record(workspace_payload.get("workspace"))
    selected_workspace_id = workspace_id or _text(workspace.get("id"))
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if payload_workspace_id and selected_workspace_id and payload_workspace_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = selected_workspace_id or payload_workspace_id
    if workspace_id_value is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Repair rerun request requires workspace_id.",
            "field": "workspace_id",
        }

    repair_session = _record(workspace_payload.get("repair_session"))
    if repair_session.get("available") is not True or repair_session.get("source_mode") != "journal":
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires a readable repair session journal.",
            "reason": "repair_session_journal_required",
        }
    session_readiness = _record(repair_session.get("readiness"))
    if session_readiness.get("ready") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires a ready repair session journal.",
            "reason": "repair_session_not_ready",
            "review_state": session_readiness.get("review_state"),
        }

    artifacts = _record(workspace_payload.get("artifacts"))
    session = _record(repair_session.get("session"))
    candidate_id = _text(session.get("candidate_id")) or _text(workspace.get("id")) or workspace_id_value
    repair_session_id = _text(session.get("session_id"))
    repair_session_artifact = _record(artifacts.get("repair_session"))
    repair_session_ref = _text(repair_session_artifact.get("path")) or REPAIR_SESSION_PATH
    workspace_drafts = [
        draft
        for draft in _records(repair_draft_state.get("drafts"))
        if draft.get("workspace_id") == workspace_id_value
    ]
    drafts = _current_session_drafts(
        workspace_drafts,
        repair_session_id=repair_session_id,
        repair_session_ref=repair_session_ref,
    )

    import_preview_status = _effective_import_preview_status(artifacts)
    if import_preview_status.get("available") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires ready SpecGraph repair draft import preview.",
            "reason": "import_preview_missing",
            "artifact": IMPORT_PREVIEW_PATH,
        }
    if import_preview_status.get("status") != "repair_draft_import_preview_ready":
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires ready SpecGraph repair draft import preview.",
            "reason": "import_preview_not_ready",
            "status": import_preview_status.get("status"),
        }
    accepted_count = _number(_record(import_preview_status.get("summary")).get("accepted_for_rerun_count"))
    if accepted_count <= 0:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires at least one accepted draft import.",
            "reason": "accepted_draft_imports_missing",
        }
    if not drafts and import_preview_status.get("source") != (
        "platform_product_repair_draft_import_execution"
    ):
        stale_reason = "repair_drafts_stale" if workspace_drafts else "repair_drafts_missing"
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun request requires saved SpecSpace repair drafts for the current repair session.",
            "reason": stale_reason,
        }
    draft_count = len(drafts) if drafts else accepted_count

    import_preview_ref = _text(import_preview_status.get("path")) or IMPORT_PREVIEW_PATH
    operator_ref = _text(payload.get("operator_ref")) or "operator://specspace-local"
    now = now_iso()

    request_id = request_id_for(workspace_id_value, now)
    request = {
        "id": request_id,
        "status": "requested",
        "requested_action": REQUESTED_ACTION,
        "workspace_id": workspace_id_value,
        "candidate_id": candidate_id,
        "repair_session_id": repair_session_id,
        "repair_session_ref": repair_session_ref,
        "draft_state_ref": REPAIR_DRAFT_STATE_REF,
        "import_preview_ref": import_preview_ref,
        "rerun_report_ref": RERUN_REPORT_PATH,
        "requested_by": operator_ref,
        "created_at": now,
        "updated_at": now,
        "draft_count": draft_count,
        "accepted_for_rerun_count": accepted_count,
        "operator_command": _operator_command(import_preview_ref),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "may_execute_specgraph": False,
        "may_run_make_target": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_execute_git_service_operation": False,
    }

    with _STATE_LOCK:
        status, state = _read_persisted_state(server)
        if status != HTTPStatus.OK:
            return status, state
        path = state_path(server)
        requests = _records(state.get("requests"))
        for existing in requests:
            if existing.get("workspace_id") == workspace_id_value and existing.get("status") == "requested":
                existing["status"] = "superseded"
                existing["superseded_by"] = request_id
                existing["updated_at"] = now
        requests.append(request)
        state["requests"] = sorted(
            requests,
            key=lambda entry: (entry["workspace_id"], entry["created_at"], entry["id"]),
        )
        state["source_artifacts"] = {
            **_record(state.get("source_artifacts")),
            "idea_to_spec_repair_session": repair_session_ref,
            "idea_to_spec_repair_drafts": REPAIR_DRAFT_STATE_REF,
            "specspace_repair_draft_import_preview": import_preview_ref,
        }
        _refresh_summary(state)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(f"{path.suffix}.tmp")
        tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(path)
        return read_state(
            server,
            workspace_id=workspace_id,
            workspace_payload=workspace_payload,
            repair_draft_state=repair_draft_state,
        )


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["requests"] = [
        entry
        for entry in state.get("requests", [])
        if isinstance(entry, dict) and entry.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def _with_workflow_status(
    state: dict[str, Any],
    *,
    workspace_payload: dict[str, Any] | None,
    repair_draft_state: dict[str, Any] | None,
) -> dict[str, Any]:
    artifacts = _record((workspace_payload or {}).get("artifacts"))
    repair_session = _record((workspace_payload or {}).get("repair_session"))
    session = _record(repair_session.get("session"))
    current_session_id = _text(session.get("session_id"))
    current_session_ref = _text(_record(artifacts.get("repair_session")).get("path")) or REPAIR_SESSION_PATH
    import_preview = _effective_import_preview_status(artifacts)
    rerun_report = _record(artifacts.get(RERUN_REPORT_ARTIFACT_KEY))
    latest_request = _latest_active_request(state)
    latest_journal_state = "not_requested"
    if latest_request is not None:
        latest_journal_state = (
            "fresh"
            if (
                latest_request.get("repair_session_id") == current_session_id
                and latest_request.get("repair_session_ref") == current_session_ref
            )
            else "stale"
        )
    import_preview_status = "missing"
    if import_preview.get("available") is True:
        import_preview_status = (
            "ready"
            if import_preview.get("status") == "repair_draft_import_preview_ready"
            else "not_ready"
        )
    rerun_status = "not_prepared"
    if rerun_report.get("available") is True:
        rerun_status = (
            "prepared"
            if rerun_report.get("status") == "repair_draft_rerun_ready"
            else "not_ready"
        )
    repair_session_ready = (
        repair_session.get("available") is True
        and repair_session.get("source_mode") == "journal"
        and _record(repair_session.get("readiness")).get("ready") is True
    )
    accepted_for_rerun_count = _number(
        _record(import_preview.get("summary")).get("accepted_for_rerun_count")
    )
    drafts = [
        draft
        for draft in _records((repair_draft_state or {}).get("drafts"))
        if draft.get("workspace_id") == state.get("selected_workspace_id")
    ]
    current_drafts = _current_session_drafts(
        drafts,
        repair_session_id=current_session_id,
        repair_session_ref=current_session_ref,
    )
    draft_count = len(current_drafts)
    if draft_count == 0 and import_preview.get("source") == (
        "platform_product_repair_draft_import_execution"
    ):
        draft_count = accepted_for_rerun_count
    command = _operator_command(_text(import_preview.get("path")) or IMPORT_PREVIEW_PATH)
    state["workflow_status"] = {
        "drafts_saved": draft_count > 0,
        "draft_count": draft_count,
        "repair_session_status": "ready" if repair_session_ready else "not_ready",
        "import_preview_status": import_preview_status,
        "import_preview_ref": _text(import_preview.get("path")) or IMPORT_PREVIEW_PATH,
        "accepted_for_rerun_count": accepted_for_rerun_count,
        "rerun_status": rerun_status,
        "rerun_report_ref": _text(rerun_report.get("path")) or RERUN_REPORT_PATH,
        "latest_journal_state": latest_journal_state,
        "operator_command": command,
        "request_ready": (
            draft_count > 0
            and repair_session_ready
            and import_preview_status == "ready"
            and accepted_for_rerun_count > 0
        ),
    }
    return state


def _current_session_drafts(
    drafts: list[dict[str, Any]],
    *,
    repair_session_id: str | None,
    repair_session_ref: str | None,
) -> list[dict[str, Any]]:
    return [
        draft
        for draft in drafts
        if (
            (not repair_session_id or draft.get("repair_session_id") == repair_session_id)
            and (not repair_session_ref or draft.get("repair_session_ref") == repair_session_ref)
        )
    ]


def _effective_import_preview_status(artifacts: dict[str, Any]) -> dict[str, Any]:
    import_preview = _record(artifacts.get(IMPORT_PREVIEW_ARTIFACT_KEY))
    if import_preview.get("available") is True:
        return import_preview
    platform_report = _record(artifacts.get(PLATFORM_IMPORT_EXECUTION_ARTIFACT_KEY))
    if platform_report.get("available") is not True:
        return import_preview
    if (
        platform_report.get("artifact_kind")
        != "platform_product_repair_draft_import_preview_execution_report"
    ):
        return import_preview
    if platform_report.get("ok") is not True or platform_report.get("dry_run") is True:
        return import_preview
    if _first_true(
        platform_report.get("authority_boundary"),
        (
            "executes_git_commands",
            "opens_pull_requests",
            "merges_pull_requests",
            "writes_ontology_packages",
            "accepts_ontology_terms",
            "mutates_canonical_specs",
            "publishes_private_artifacts",
        ),
    ):
        return import_preview
    output = _record(_record(platform_report.get("output_artifacts")).get("import_preview"))
    if output.get("ready") is not True:
        return import_preview
    status = _text(output.get("status")) or "repair_draft_import_preview_ready"
    return {
        "available": True,
        "path": _text(output.get("path")) or IMPORT_PREVIEW_PATH,
        "status": status,
        "artifact_kind": output.get("artifact_kind"),
        "contract_ref": output.get("contract_ref"),
        "summary": {
            **_record(output.get("summary")),
            "status": status,
        },
        "readiness": {
            "ready": True,
            "review_state": status,
            "blocked_by": [],
        },
        "source": "platform_product_repair_draft_import_execution",
    }


def _refresh_summary(state: dict[str, Any]) -> None:
    requests = [entry for entry in state.get("requests", []) if isinstance(entry, dict)]
    workspaces = {
        entry["workspace_id"]
        for entry in requests
        if isinstance(entry.get("workspace_id"), str) and entry["workspace_id"]
    }
    active_count = sum(1 for entry in requests if entry.get("status") == "requested")
    state["summary"] = {
        "status": "rerun_requested" if active_count else "no_rerun_requests",
        "request_count": len(requests),
        "active_request_count": active_count,
        "workspace_count": len(workspaces),
        "next_gap": (
            "execute_specgraph_repair_draft_rerun_in_controlled_environment"
            if active_count
            else "request_repair_draft_rerun_after_specgraph_import_preview"
        ),
    }


def _normalize_existing_request(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = _text(entry.get("workspace_id"))
    candidate_id = _text(entry.get("candidate_id"))
    request_id = _text(entry.get("id"))
    requested_action = _text(entry.get("requested_action"))
    status = _text(entry.get("status")) or "requested"
    if (
        workspace_id is None
        or candidate_id is None
        or request_id is None
        or requested_action != REQUESTED_ACTION
    ):
        return None
    return {
        **entry,
        "id": request_id,
        "status": status,
        "requested_action": REQUESTED_ACTION,
        "workspace_id": workspace_id,
        "candidate_id": candidate_id,
        "repair_session_ref": _text(entry.get("repair_session_ref")) or REPAIR_SESSION_PATH,
        "draft_state_ref": _text(entry.get("draft_state_ref")) or REPAIR_DRAFT_STATE_REF,
        "import_preview_ref": _text(entry.get("import_preview_ref")) or IMPORT_PREVIEW_PATH,
        "rerun_report_ref": _text(entry.get("rerun_report_ref")) or RERUN_REPORT_PATH,
        "operator_command": _text(entry.get("operator_command"))
        or _operator_command(_text(entry.get("import_preview_ref")) or IMPORT_PREVIEW_PATH),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "may_execute_specgraph": False,
        "may_run_make_target": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_execute_git_service_operation": False,
    }


def _latest_active_request(state: dict[str, Any]) -> dict[str, Any] | None:
    requests = [entry for entry in _records(state.get("requests")) if entry.get("status") == "requested"]
    if not requests:
        return None
    return sorted(requests, key=lambda entry: _text(entry.get("created_at")) or "")[-1]


def _operator_command(import_preview_ref: str) -> str:
    return (
        "make product-workspace-repair-draft-rerun "
        f"SPECSPACE_REPAIR_DRAFT_RERUN_IMPORT_PREVIEW={import_preview_ref}"
    )


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _string_map(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        key: item
        for key, item in value.items()
        if isinstance(key, str) and isinstance(item, str) and item
    }


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _number(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    return value if isinstance(value, int) and value >= 0 else 0


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
