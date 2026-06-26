"""SpecSpace-owned candidate approval intent state for idea-to-spec workspaces."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

APPROVAL_INTENT_ARTIFACT_KIND = "specspace_idea_to_spec_candidate_approval_intent_state"
APPROVAL_INTENT_SCHEMA_VERSION = 1
APPROVAL_INTENT_FILENAME = "idea_to_spec_candidate_approval_intents.json"
REQUESTED_ACTION = "approve_candidate_for_promotion_review"
REPAIR_SESSION_PATH = "runs/idea_to_spec_repair_session.json"
PROMOTION_GATE_PATH = "runs/idea_to_spec_promotion_gate.json"
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_mark_candidate_accepted",
    "may_mark_candidate_graph_accepted",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
)
AUTHORITY_FALSE_FIELDS = (
    "approval_intent_state_is_authority",
    "candidate_approval_intent_state_is_authority",
    "candidate_approval_authority",
    "candidate_approval_decision_authority",
    "specgraph_execution_authority",
    "specgraph_artifact_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
INTENT_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_mark_candidate_accepted",
    "may_mark_candidate_graph_accepted",
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
    return Path(state_dir) / APPROVAL_INTENT_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def intent_id_for(workspace_id: str, timestamp: str) -> str:
    safe_timestamp = (
        timestamp.replace(":", "")
        .replace("-", "")
        .replace(".", "")
        .replace("+", "")
    )
    return f"candidate-approval-intent.{workspace_id}.{safe_timestamp}.{uuid.uuid4().hex[:12]}"


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": APPROVAL_INTENT_ARTIFACT_KIND,
        "schema_version": APPROVAL_INTENT_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "intents": [],
        "summary": {
            "status": "no_candidate_approval_intents",
            "intent_count": 0,
            "active_intent_count": 0,
            "workspace_count": 0,
            "next_gap": "approve_candidate_for_platform_decision_gate",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_product_approval_workflow": True,
            "may_execute_specgraph": False,
            "may_execute_prompt_agent": False,
            "may_apply_to_specgraph": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_mark_candidate_graph_accepted": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_execute_git_service_operation": False,
        },
        "authority_boundary": {
            "candidate_approval_intent_state_is_authority": False,
            "candidate_approval_decision_authority": False,
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
) -> tuple[HTTPStatus, dict[str, Any]]:
    status, state = _read_persisted_state(server)
    if status != HTTPStatus.OK:
        return status, state
    return HTTPStatus.OK, _with_workflow_status(
        _filtered_state(state, workspace_id),
        workspace_payload=workspace_payload,
    )


def _read_persisted_state(server: Any) -> tuple[HTTPStatus, dict[str, Any]]:
    path = state_path(server)
    if not path.exists():
        return HTTPStatus.OK, empty_state(path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"{APPROVAL_INTENT_FILENAME} is not valid JSON",
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
        return None, {"error": f"{APPROVAL_INTENT_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != APPROVAL_INTENT_ARTIFACT_KIND:
        return None, {"error": "Invalid candidate approval intent state artifact_kind"}
    if raw.get("schema_version") != APPROVAL_INTENT_SCHEMA_VERSION:
        return None, {"error": "Unsupported candidate approval intent state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Candidate approval intent state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Candidate approval intent state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {
            "error": f"Candidate approval intent consumer_boundary cannot claim {mutation_field}"
        }
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {
            "error": f"Candidate approval intent authority_boundary cannot claim {mutation_field}"
        }

    state = empty_state(path)
    intents = []
    for entry in raw.get("intents", []):
        if not isinstance(entry, dict):
            continue
        mutation_field = _first_true(entry, INTENT_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {"error": f"Candidate approval intent record cannot claim {mutation_field}"}
        intent = _normalize_existing_intent(entry)
        if intent is not None:
            intents.append(intent)
    intents.sort(key=lambda entry: (entry["workspace_id"], entry["created_at"], entry["id"]))
    state["intents"] = intents
    state["source_artifacts"] = _string_map(raw.get("source_artifacts"))
    _refresh_summary(state)
    return state, None


def save_candidate_approval_intent(
    server: Any,
    payload: dict[str, Any],
    workspace_payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    requested_action = _text(payload.get("requested_action")) or REQUESTED_ACTION
    if requested_action != REQUESTED_ACTION:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Unsupported candidate approval intent action: {requested_action}",
            "field": "requested_action",
        }
    mutation_field = _first_true(payload, INTENT_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Candidate approval intent payload cannot claim {mutation_field}",
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
            "error": "Candidate approval intent workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = selected_workspace_id or payload_workspace_id
    if workspace_id_value is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Candidate approval intent requires workspace_id.",
            "field": "workspace_id",
        }

    workflow_status = _workflow_status(workspace_payload, workspace_id_value)
    if not workflow_status["request_ready"]:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval intent requires an approval-ready repair session.",
            "reason": "candidate_approval_intent_not_ready",
            "blocked_by": workflow_status["blocked_by"],
            "workflow_status": workflow_status,
        }

    repair_session = _record(workspace_payload.get("repair_session"))
    session = _record(repair_session.get("session"))
    candidate_id = _text(session.get("candidate_id")) or _text(workspace.get("id")) or workspace_id_value
    repair_session_id = _text(session.get("session_id"))
    artifacts = _record(workspace_payload.get("artifacts"))
    repair_session_ref = (
        _text(_record(artifacts.get("repair_session")).get("path")) or REPAIR_SESSION_PATH
    )
    promotion_gate_ref = (
        _text(_record(artifacts.get("promotion_gate")).get("path")) or PROMOTION_GATE_PATH
    )
    operator_ref = _text(payload.get("operator_ref")) or _text(session.get("operator_ref")) or "operator://specspace-local"
    reason = _text(payload.get("reason")) or "Approve candidate for promotion review."
    now = now_iso()
    intent_id = intent_id_for(workspace_id_value, now)
    intent = {
        "id": intent_id,
        "status": "requested",
        "requested_action": REQUESTED_ACTION,
        "workspace_id": workspace_id_value,
        "candidate_id": candidate_id,
        "repair_session_id": repair_session_id,
        "repair_session_ref": repair_session_ref,
        "promotion_gate_ref": promotion_gate_ref,
        "requested_by": operator_ref,
        "reason": reason,
        "created_at": now,
        "updated_at": now,
        "ready_for_candidate_approval": True,
        "ready_for_platform_promotion": workflow_status["ready_for_platform_promotion"],
        "blocked_by": [],
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "may_execute_specgraph": False,
        "may_execute_prompt_agent": False,
        "may_apply_to_specgraph": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_mark_candidate_accepted": False,
        "may_mark_candidate_graph_accepted": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_execute_git_service_operation": False,
    }

    with _STATE_LOCK:
        status, state = _read_persisted_state(server)
        if status != HTTPStatus.OK:
            return status, state
        path = state_path(server)
        intents = _records(state.get("intents"))
        for existing in intents:
            if existing.get("workspace_id") == workspace_id_value and existing.get("status") == "requested":
                existing["status"] = "superseded"
                existing["superseded_by"] = intent_id
                existing["updated_at"] = now
        intents.append(intent)
        state["intents"] = sorted(
            intents,
            key=lambda entry: (entry["workspace_id"], entry["created_at"], entry["id"]),
        )
        state["source_artifacts"] = {
            **_record(state.get("source_artifacts")),
            "idea_to_spec_repair_session": repair_session_ref,
            "idea_to_spec_promotion_gate": promotion_gate_ref,
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
        )


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["intents"] = [
        entry
        for entry in state.get("intents", [])
        if isinstance(entry, dict) and entry.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def _with_workflow_status(
    state: dict[str, Any],
    *,
    workspace_payload: dict[str, Any] | None,
) -> dict[str, Any]:
    workspace_id = _text(state.get("selected_workspace_id"))
    state["workflow_status"] = _workflow_status(workspace_payload or {}, workspace_id)
    latest_intent = _latest_active_intent(state)
    session = _record(_record((workspace_payload or {}).get("repair_session")).get("session"))
    current_session_id = _text(session.get("session_id"))
    current_session_ref = _text(
        _record(_record((workspace_payload or {}).get("artifacts")).get("repair_session")).get("path")
    ) or REPAIR_SESSION_PATH
    latest_journal_state = "not_requested"
    if latest_intent is not None:
        latest_journal_state = (
            "fresh"
            if (
                latest_intent.get("repair_session_id") == current_session_id
                and latest_intent.get("repair_session_ref") == current_session_ref
            )
            else "stale"
        )
    state["workflow_status"]["latest_journal_state"] = latest_journal_state
    return state


def _workflow_status(workspace_payload: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    repair_session = _record(workspace_payload.get("repair_session"))
    readiness = _record(repair_session.get("readiness"))
    readiness_impact = _record(repair_session.get("readiness_impact"))
    repair_session_ready = (
        repair_session.get("available") is True
        and repair_session.get("source_mode") == "journal"
        and readiness.get("ready") is True
    )
    ready_for_candidate_approval = readiness_impact.get("ready_for_candidate_approval") is True
    ready_for_platform_promotion = readiness_impact.get("ready_for_platform_promotion") is True
    open_blockers = _records(repair_session.get("open_blockers"))
    execution = _record(_record(workspace_payload.get("repair_review")).get("platform_execution"))
    execution_status = _record(execution.get("execution"))
    publication_status = _record(execution.get("publication"))
    execution_available = execution_status.get("available") is True
    publication_available = publication_status.get("available") is True
    execution_ok = (
        not execution_available
        or (execution_status.get("ok") is True and execution_status.get("dry_run") is not True)
    )
    publication_required = execution_available and execution_ok
    publication_ok = (
        (not publication_available and not publication_required)
        or (publication_status.get("ok") is True and publication_status.get("dry_run") is not True)
    )
    blocked_by = []
    if workspace_id is None:
        blocked_by.append("workspace_required")
    if not repair_session_ready:
        blocked_by.append("repair_session_not_ready")
    if not ready_for_candidate_approval:
        blocked_by.append("candidate_not_ready_for_approval")
    if open_blockers:
        blocked_by.append("repair_session_open_blockers")
    if not execution_ok:
        blocked_by.append("platform_rerun_execution_not_successful")
    if not publication_ok:
        blocked_by.append("platform_rerun_publication_not_successful")
    return {
        "repair_session_status": "ready" if repair_session_ready else "not_ready",
        "repair_session_ready": repair_session_ready,
        "repair_session_ref": (
            _text(_record(_record(workspace_payload.get("artifacts")).get("repair_session")).get("path"))
            or REPAIR_SESSION_PATH
        ),
        "ready_for_candidate_approval": ready_for_candidate_approval,
        "ready_for_platform_promotion": ready_for_platform_promotion,
        "open_blocker_count": len(open_blockers),
        "promotion_gate_ref": (
            _text(_record(_record(workspace_payload.get("artifacts")).get("promotion_gate")).get("path"))
            or PROMOTION_GATE_PATH
        ),
        "platform_rerun_execution_status": _availability_status(
            execution_status,
            ready_label="successful",
            missing_label="missing",
        ),
        "platform_rerun_execution_ok": execution_ok,
        "platform_rerun_publication_status": _availability_status(
            publication_status,
            ready_label="published",
            missing_label="missing",
        ),
        "platform_rerun_publication_ok": publication_ok,
        "request_ready": len(blocked_by) == 0,
        "blocked_by": blocked_by,
        "next_gap": (
            "platform_candidate_approval_decision_gate"
            if len(blocked_by) == 0
            else "resolve_candidate_approval_readiness_blockers"
        ),
    }


def _availability_status(
    item: dict[str, Any],
    *,
    ready_label: str,
    missing_label: str,
) -> str:
    if item.get("available") is not True:
        return missing_label
    if item.get("ok") is True and item.get("dry_run") is not True:
        return ready_label
    if item.get("dry_run") is True:
        return "dry_run"
    return "blocked"


def _refresh_summary(state: dict[str, Any]) -> None:
    intents = [entry for entry in state.get("intents", []) if isinstance(entry, dict)]
    workspaces = {
        entry["workspace_id"]
        for entry in intents
        if isinstance(entry.get("workspace_id"), str) and entry["workspace_id"]
    }
    active_count = sum(1 for entry in intents if entry.get("status") == "requested")
    state["summary"] = {
        "status": "candidate_approval_intent_recorded" if active_count else "no_candidate_approval_intents",
        "intent_count": len(intents),
        "active_intent_count": active_count,
        "workspace_count": len(workspaces),
        "next_gap": (
            "platform_candidate_approval_decision_gate"
            if active_count
            else "approve_candidate_for_platform_decision_gate"
        ),
    }


def _normalize_existing_intent(entry: dict[str, Any]) -> dict[str, Any] | None:
    intent_id = _text(entry.get("id"))
    status = _text(entry.get("status")) or "requested"
    workspace_id = _text(entry.get("workspace_id"))
    candidate_id = _text(entry.get("candidate_id"))
    requested_action = _text(entry.get("requested_action"))
    created_at = _text(entry.get("created_at"))
    if (
        intent_id is None
        or workspace_id is None
        or candidate_id is None
        or requested_action != REQUESTED_ACTION
        or created_at is None
    ):
        return None
    return {
        **entry,
        "id": intent_id,
        "status": status,
        "requested_action": REQUESTED_ACTION,
        "workspace_id": workspace_id,
        "candidate_id": candidate_id,
        "created_at": created_at,
        "updated_at": _text(entry.get("updated_at")) or created_at,
        "repair_session_ref": _text(entry.get("repair_session_ref")) or REPAIR_SESSION_PATH,
        "promotion_gate_ref": _text(entry.get("promotion_gate_ref")) or PROMOTION_GATE_PATH,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "may_execute_specgraph": False,
        "may_execute_prompt_agent": False,
        "may_apply_to_specgraph": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_mark_candidate_accepted": False,
        "may_mark_candidate_graph_accepted": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_execute_git_service_operation": False,
    }


def _latest_active_intent(state: dict[str, Any]) -> dict[str, Any] | None:
    intents = [entry for entry in _records(state.get("intents")) if entry.get("status") == "requested"]
    if not intents:
        return None
    return sorted(intents, key=lambda entry: _text(entry.get("created_at")) or "")[-1]


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


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
