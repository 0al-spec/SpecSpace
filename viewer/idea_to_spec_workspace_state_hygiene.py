"""Read-only workspace-scoped state hygiene for idea-to-spec workflows."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from viewer import (
    idea_to_spec_candidate_approval_intents,
    idea_to_spec_repair_drafts,
    idea_to_spec_repair_rerun_requests,
)

ARTIFACT_KIND = "specspace_idea_to_spec_workspace_state_hygiene"
SCHEMA_VERSION = 1


def build_hygiene(
    server: Any,
    *,
    workspace_id: str | None,
    workspace_payload: dict[str, Any] | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    payload = workspace_payload or {}
    current = _current_identity(workspace_id=workspace_id, workspace_payload=payload)
    states = [
        _state_status(
            kind="repair_drafts",
            state_status=idea_to_spec_repair_drafts.read_state(server),
            records_key="drafts",
            current=current,
            blocks=["repair_draft_import_preview", "repair_rerun_request"],
            missing_next_action="Save repair drafts for the current repair session.",
            stale_next_action="Replace repair drafts for the current workspace and repair session.",
        ),
        _state_status(
            kind="repair_rerun_request",
            state_status=idea_to_spec_repair_rerun_requests.read_state(server),
            records_key="requests",
            current=current,
            blocks=["repair_rerun_smoke", "repair_rerun_execution"],
            missing_next_action="Request a repair rerun after drafts and import preview are ready.",
            stale_next_action="Replace the rerun request for the current workspace and repair session.",
            active_status="requested",
        ),
        _state_status(
            kind="candidate_approval_intent",
            state_status=idea_to_spec_candidate_approval_intents.read_state(server),
            records_key="intents",
            current=current,
            blocks=["candidate_approval_gate", "candidate_approval_materialization"],
            missing_next_action="Record approval intent after the repaired candidate is approval-ready.",
            stale_next_action="Record a fresh approval intent for the current workspace and repair session.",
            active_status="requested",
        ),
    ]
    states.extend(_artifact_state_statuses(payload, current))
    return HTTPStatus.OK, {
        "api_version": "v1",
        "artifact_kind": ARTIFACT_KIND,
        "schema_version": SCHEMA_VERSION,
        "workspace_id": current["workspace_id"],
        "candidate_id": current["candidate_id"],
        "repair_session_id": current["repair_session_id"],
        "repair_session_ref": current["repair_session_ref"],
        "summary": _summary(states),
        "states": states,
        "authority_boundary": {
            "workspace_state_hygiene_is_authority": False,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_execute_git_service": False,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
        },
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_clear_state": False,
            "may_apply_state": False,
            "may_delete_state": False,
        },
    }


def _current_identity(
    *,
    workspace_id: str | None,
    workspace_payload: dict[str, Any],
) -> dict[str, str | None]:
    workspace = _record(workspace_payload.get("workspace"))
    repair_session = _record(workspace_payload.get("repair_session"))
    session = _record(repair_session.get("session"))
    artifacts = _record(workspace_payload.get("artifacts"))
    repaired_selected = _text(repair_session.get("source_mode")) == "repaired_handoff"
    repair_session_key = (
        "repaired_repair_session" if repaired_selected else "repair_session"
    )
    repair_session_artifact = _record(artifacts.get(repair_session_key))
    repair_session_ref = _text(repair_session_artifact.get("path"))
    if repair_session_ref is None:
        repair_session_ref = (
            "runs/repaired_idea_to_spec_repair_session.json"
            if repaired_selected
            else "runs/idea_to_spec_repair_session.json"
        )
    selected_workspace = workspace_id or _text(workspace.get("id"))
    return {
        "workspace_id": selected_workspace,
        "candidate_id": _text(session.get("candidate_id")) or selected_workspace,
        "repair_session_id": _text(session.get("session_id")),
        "repair_session_ref": repair_session_ref,
    }


def _state_status(
    *,
    kind: str,
    state_status: tuple[HTTPStatus, dict[str, Any]],
    records_key: str,
    current: dict[str, str | None],
    blocks: list[str],
    missing_next_action: str,
    stale_next_action: str,
    active_status: str | None = None,
) -> dict[str, Any]:
    status, state = state_status
    base = {
        "kind": kind,
        "artifact_type": "specspace_owned_state",
        "status": "unknown",
        "path": _text(state.get("state_path")),
        "stored_workspace_id": None,
        "stored_candidate_id": None,
        "stored_repair_session_id": None,
        "stored_repair_session_ref": None,
        "current_workspace_id": current["workspace_id"],
        "current_candidate_id": current["candidate_id"],
        "current_repair_session_id": current["repair_session_id"],
        "current_repair_session_ref": current["repair_session_ref"],
        "record_count": 0,
        "current_record_count": 0,
        "stale_record_count": 0,
        "blocks": blocks,
        "next_action": missing_next_action,
    }
    if status != HTTPStatus.OK:
        return {
            **base,
            "status": "invalid",
            "reason": _text(state.get("error")) or "state_unreadable",
            "next_action": f"Repair malformed {kind} state before continuing.",
        }
    records = _records(state.get(records_key))
    records_for_current = records
    if active_status is not None:
        records_for_current = [
            item for item in records if _text(item.get("status")) == active_status
        ]
    if not records_for_current:
        return {
            **base,
            "status": "missing",
            "reason": "no_state_records",
            "record_count": len(records),
        }
    current_matches = [
        item for item in records_for_current if _matches_current(item, current)
    ]
    workspace_matches = [
        item
        for item in records_for_current
        if _text(item.get("workspace_id")) == current["workspace_id"]
    ]
    latest = _latest_record(workspace_matches or records_for_current)
    result = {
        **base,
        "path": _text(state.get("state_path")),
        "stored_workspace_id": _text(latest.get("workspace_id")),
        "stored_candidate_id": _text(latest.get("candidate_id")),
        "stored_repair_session_id": _text(latest.get("repair_session_id")),
        "stored_repair_session_ref": _text(latest.get("repair_session_ref")),
        "record_count": len(records),
        "current_record_count": len(current_matches),
        "stale_record_count": len(records_for_current) - len(current_matches),
    }
    if current_matches:
        return {
            **result,
            "status": "usable",
            "reason": "current_workspace_session_state_present",
            "next_action": "Continue with the current idea-to-spec workflow.",
        }
    return {
        **result,
        "status": "stale",
        "reason": _stale_reason(latest, current),
        "next_action": stale_next_action,
    }


def _artifact_state_statuses(
    workspace_payload: dict[str, Any],
    current: dict[str, str | None],
) -> list[dict[str, Any]]:
    artifacts = _record(workspace_payload.get("artifacts"))
    return [
        _artifact_state_status(
            kind="repair_draft_import_preview",
            artifact=_record(artifacts.get("specspace_repair_draft_import_preview")),
            current=current,
            blocks=["repair_rerun_request"],
            missing_next_action="Run SpecGraph repair draft import preview for the current repair session.",
        ),
        _artifact_state_status(
            kind="repair_rerun_request_gate",
            artifact=_record(artifacts.get("specspace_repair_rerun_request_gate")),
            current=current,
            blocks=["repair_rerun_execution", "repair_rerun_smoke"],
            missing_next_action="Run SpecGraph rerun request gate for the current request.",
        ),
    ]


def _artifact_state_status(
    *,
    kind: str,
    artifact: dict[str, Any],
    current: dict[str, str | None],
    blocks: list[str],
    missing_next_action: str,
) -> dict[str, Any]:
    status = _text(artifact.get("status"))
    available = artifact.get("available") is True
    source_refs = _record(artifact.get("source_artifacts"))
    session_ref = _source_ref(source_refs, "idea_to_spec_repair_session")
    summary = _record(artifact.get("summary"))
    stored_workspace_id = _text(summary.get("workspace_id"))
    current_ref = current["repair_session_ref"]
    base = {
        "kind": kind,
        "artifact_type": "specgraph_handoff_artifact",
        "status": "missing",
        "path": _text(artifact.get("path")),
        "stored_workspace_id": stored_workspace_id,
        "stored_candidate_id": _text(summary.get("candidate_id")),
        "stored_repair_session_id": None,
        "stored_repair_session_ref": session_ref,
        "current_workspace_id": current["workspace_id"],
        "current_candidate_id": current["candidate_id"],
        "current_repair_session_id": current["repair_session_id"],
        "current_repair_session_ref": current_ref,
        "record_count": 1 if available else 0,
        "current_record_count": 0,
        "stale_record_count": 0,
        "blocks": blocks,
        "next_action": missing_next_action,
    }
    if not available:
        return {**base, "reason": "artifact_missing"}
    if session_ref and current_ref and session_ref != current_ref:
        return {
            **base,
            "status": "stale",
            "reason": "repair_session_ref_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the current repair session.",
        }
    if stored_workspace_id and current["workspace_id"] and stored_workspace_id != current["workspace_id"]:
        return {
            **base,
            "status": "stale",
            "reason": "workspace_id_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the selected workspace.",
        }
    ready_statuses = {
        "repair_draft_import_preview_ready",
        "specspace_repair_rerun_request_gate_ready",
        "repair_rerun_request_gate_ready",
    }
    if status not in ready_statuses:
        return {
            **base,
            "status": "invalid",
            "reason": status or "artifact_not_ready",
            "next_action": f"Repair {kind} before using it as a handoff.",
        }
    return {
        **base,
        "status": "usable",
        "reason": "current_workspace_session_artifact_ready",
        "current_record_count": 1,
        "next_action": "Continue with the current idea-to-spec workflow.",
    }


def _summary(states: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, int] = {"usable": 0, "missing": 0, "stale": 0, "invalid": 0}
    for state in states:
        status = _text(state.get("status")) or "invalid"
        counts[status] = counts.get(status, 0) + 1
    blockers = [
        state
        for state in states
        if _text(state.get("status")) in {"stale", "invalid"}
    ]
    status = "ready" if not blockers else "blocked"
    next_action = "Continue with the current idea-to-spec workflow."
    if blockers:
        next_action = _text(blockers[0].get("next_action")) or "Resolve stale workspace state."
    elif counts.get("missing", 0):
        status = "partial"
        missing = next(
            (state for state in states if _text(state.get("status")) == "missing"),
            {},
        )
        next_action = _text(missing.get("next_action")) or next_action
    return {
        "status": status,
        "usable_state_count": counts.get("usable", 0),
        "missing_state_count": counts.get("missing", 0),
        "stale_state_count": counts.get("stale", 0),
        "invalid_state_count": counts.get("invalid", 0),
        "blocking_state_count": len(blockers),
        "next_action": next_action,
    }


def _matches_current(item: dict[str, Any], current: dict[str, str | None]) -> bool:
    workspace_id = _text(item.get("workspace_id"))
    candidate_id = _text(item.get("candidate_id"))
    repair_session_id = _text(item.get("repair_session_id"))
    repair_session_ref = _text(item.get("repair_session_ref"))
    return (
        workspace_id == current["workspace_id"]
        and (not current["candidate_id"] or candidate_id == current["candidate_id"])
        and (
            not current["repair_session_id"]
            or repair_session_id == current["repair_session_id"]
        )
        and (
            not current["repair_session_ref"]
            or repair_session_ref == current["repair_session_ref"]
        )
    )


def _stale_reason(item: dict[str, Any], current: dict[str, str | None]) -> str:
    if _text(item.get("workspace_id")) != current["workspace_id"]:
        return "workspace_id_mismatch"
    if _text(item.get("candidate_id")) != current["candidate_id"]:
        return "candidate_id_mismatch"
    if current["repair_session_id"] and _text(item.get("repair_session_id")) != current["repair_session_id"]:
        return "repair_session_id_mismatch"
    if current["repair_session_ref"] and _text(item.get("repair_session_ref")) != current["repair_session_ref"]:
        return "repair_session_ref_mismatch"
    return "current_session_state_missing"


def _latest_record(records: list[dict[str, Any]]) -> dict[str, Any]:
    if not records:
        return {}
    return max(records, key=lambda item: _text(item.get("updated_at") or item.get("created_at")) or "")


def _source_ref(source_refs: dict[str, Any], key: str) -> str | None:
    value = source_refs.get(key)
    if isinstance(value, str):
        return _text(value)
    if isinstance(value, dict):
        return _text(value.get("source_ref") or value.get("path"))
    return None


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
