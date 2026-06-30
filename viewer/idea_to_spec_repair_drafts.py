"""SpecSpace-owned draft state for idea-to-spec repair answers."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

REPAIR_DRAFT_ARTIFACT_KIND = "specspace_idea_to_spec_repair_draft_state"
REPAIR_DRAFT_SCHEMA_VERSION = 1
REPAIR_DRAFT_FILENAME = "idea_to_spec_repair_drafts.json"
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
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
)
AUTHORITY_FALSE_FIELDS = (
    "repair_draft_state_is_authority",
    "specgraph_artifact_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
DRAFT_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
    "applies_to_specgraph",
    "applies_to_candidate_artifacts",
    "mutates_canonical_specs",
    "writes_ontology_package",
    "accepts_ontology_terms",
    "creates_branch_or_commit",
    "opens_pull_request",
)
ONTOLOGY_ACTIONS = {
    "bind_existing_term",
    "alias",
    "propose_project_local_term",
    "reject",
    "defer",
}
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / REPAIR_DRAFT_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": REPAIR_DRAFT_ARTIFACT_KIND,
        "schema_version": REPAIR_DRAFT_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "drafts": [],
        "summary": {
            "status": "no_repair_drafts",
            "draft_count": 0,
            "workspace_count": 0,
            "next_gap": "operator_repair_drafts_available_for_specgraph_export",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_product_repair_workflow": True,
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
        },
        "authority_boundary": {
            "repair_draft_state_is_authority": False,
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
) -> tuple[HTTPStatus, dict[str, Any]]:
    path = state_path(server)
    if not path.exists():
        return HTTPStatus.OK, _filtered_state(empty_state(path), workspace_id)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"{REPAIR_DRAFT_FILENAME} is not valid JSON",
            "detail": str(exc),
            "path": str(path),
        }
    state, error = normalize_state(raw, path)
    if error is not None:
        error["path"] = str(path)
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, _filtered_state(state, workspace_id)


def normalize_state(raw: Any, path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{REPAIR_DRAFT_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != REPAIR_DRAFT_ARTIFACT_KIND:
        return None, {"error": "Invalid repair draft state artifact_kind"}
    if raw.get("schema_version") != REPAIR_DRAFT_SCHEMA_VERSION:
        return None, {"error": "Unsupported repair draft state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Repair draft state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Repair draft state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Repair draft consumer_boundary cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Repair draft authority_boundary cannot claim {mutation_field}"}

    state = empty_state(path)
    drafts = []
    for entry in raw.get("drafts", []):
        if not isinstance(entry, dict):
            continue
        mutation_field = _first_true(entry, DRAFT_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {"error": f"Repair draft record cannot claim {mutation_field}"}
        draft = _normalize_existing_draft(entry)
        if draft is not None:
            drafts.append(draft)
    drafts.sort(key=lambda entry: (entry["workspace_id"], entry["request_id"]))
    state["drafts"] = drafts
    state["source_artifacts"] = _string_map(raw.get("source_artifacts"))
    _refresh_summary(state)
    return state, None


def save_repair_draft(
    server: Any,
    payload: dict[str, Any],
    workspace_payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    request_id = _text(payload.get("request_id"))
    action = _text(payload.get("action") or payload.get("allowed_action"))
    if request_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: request_id",
            "field": "request_id",
        }
    if action is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: action",
            "field": "action",
        }
    mutation_field = _first_true(payload, DRAFT_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Repair draft payload cannot claim {mutation_field}",
            "field": mutation_field,
        }

    workspace = _record(workspace_payload.get("workspace"))
    repair_session = _record(workspace_payload.get("repair_session"))
    repair_review = _record(workspace_payload.get("repair_review"))
    if repair_session.get("available") is not True or repair_session.get("source_mode") != "journal":
        return HTTPStatus.CONFLICT, {
            "error": "Repair draft requires a readable repair session journal.",
            "reason": "repair_session_journal_required",
        }
    session_readiness = _record(repair_session.get("readiness"))
    if session_readiness.get("ready") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Repair draft requires a ready repair session journal.",
            "reason": "repair_session_not_ready",
            "review_state": session_readiness.get("review_state"),
        }

    requests = _records(_record(repair_review.get("clarification_requests")).get("requests"))
    request = next((item for item in requests if item.get("id") == request_id), None)
    if request is None:
        return HTTPStatus.NOT_FOUND, {
            "error": f"Clarification request '{request_id}' not found.",
            "request_id": request_id,
        }
    allowed_actions = _string_list(request.get("suggested_actions"))
    if action not in allowed_actions:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Action '{action}' is not allowed for request '{request_id}'.",
            "request_id": request_id,
            "allowed_actions": allowed_actions,
        }
    target_ref = _text(payload.get("target_ref")) or _text(request.get("target_ref"))
    if _text(payload.get("target_ref")) and payload.get("target_ref") != request.get("target_ref"):
        return HTTPStatus.BAD_REQUEST, {
            "error": "Repair draft target_ref does not match clarification request.",
            "request_id": request_id,
            "expected": request.get("target_ref"),
            "actual": payload.get("target_ref"),
        }

    answer_value, value_error = _normalize_answer_value(
        action,
        payload.get("answer_value", payload.get("value")),
    )
    if value_error is not None:
        return HTTPStatus.BAD_REQUEST, value_error

    selected_workspace_id = workspace_id or _text(workspace.get("id")) or _text(payload.get("workspace_id"))
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
    )
    if payload_workspace_id and selected_workspace_id and payload_workspace_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Repair draft workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = selected_workspace_id or payload_workspace_id or "default"
    session = _record(repair_session.get("session"))
    candidate_id = _text(session.get("candidate_id")) or _text(workspace.get("id")) or workspace_id_value
    repair_session_id = _text(session.get("session_id"))
    artifacts = _record(workspace_payload.get("artifacts"))
    repair_session_artifact = _record(artifacts.get("repair_session"))
    repair_session_ref = _text(repair_session_artifact.get("path")) or "runs/idea_to_spec_repair_session.json"
    now = now_iso()

    with _STATE_LOCK:
        status, state = read_state(server)
        if status != HTTPStatus.OK:
            return status, state
        path = state_path(server)
        existing_by_key = {
            (entry["workspace_id"], entry["request_id"]): entry
            for entry in state.get("drafts", [])
            if isinstance(entry, dict)
            and isinstance(entry.get("workspace_id"), str)
            and isinstance(entry.get("request_id"), str)
        }
        existing = existing_by_key.get((workspace_id_value, request_id))
        created_at = _text(existing.get("created_at")) if isinstance(existing, dict) else None
        record = {
            "draft_id": f"specspace-repair-draft::{workspace_id_value}::{request_id}",
            "workspace_id": workspace_id_value,
            "candidate_id": candidate_id,
            "repair_session_id": repair_session_id,
            "repair_session_ref": repair_session_ref,
            "request_id": request_id,
            "request_kind": _text(request.get("kind")) or "clarification",
            "request_status": _text(request.get("status")) or "open",
            "target_ref": target_ref,
            "target_artifact": _text(payload.get("target_artifact")),
            "allowed_action": action,
            "answer_value": answer_value,
            "operator_ref": _text(payload.get("operator_ref")) or "local_operator",
            "created_at": created_at or now,
            "updated_at": now,
            "source_artifact": repair_session_ref,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "applies_to_specgraph": False,
            "applies_to_candidate_artifacts": False,
            "mutates_canonical_specs": False,
            "writes_ontology_package": False,
            "accepts_ontology_terms": False,
            "creates_branch_or_commit": False,
            "opens_pull_request": False,
        }
        existing_by_key[(workspace_id_value, request_id)] = record
        state["drafts"] = sorted(
            existing_by_key.values(),
            key=lambda entry: (entry["workspace_id"], entry["request_id"]),
        )
        state["source_artifacts"] = {
            **_record(state.get("source_artifacts")),
            "idea_to_spec_repair_session": repair_session_ref,
        }
        _refresh_summary(state)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(f"{path.suffix}.tmp")
        tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(path)
        return HTTPStatus.OK, _filtered_state(state, workspace_id)


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["drafts"] = [
        entry
        for entry in state.get("drafts", [])
        if isinstance(entry, dict) and entry.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def _refresh_summary(state: dict[str, Any]) -> None:
    drafts = [entry for entry in state.get("drafts", []) if isinstance(entry, dict)]
    workspaces = {
        entry["workspace_id"]
        for entry in drafts
        if isinstance(entry.get("workspace_id"), str) and entry["workspace_id"]
    }
    action_counts: dict[str, int] = {}
    for entry in drafts:
        action = _text(entry.get("allowed_action")) or "unknown"
        action_counts[action] = action_counts.get(action, 0) + 1
    state["summary"] = {
        "status": "repair_drafts_recorded" if drafts else "no_repair_drafts",
        "draft_count": len(drafts),
        "workspace_count": len(workspaces),
        "action_counts": action_counts,
        "next_gap": "export_repair_drafts_for_specgraph_validation",
    }


def _normalize_existing_draft(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = _text(entry.get("workspace_id"))
    request_id = _text(entry.get("request_id"))
    action = _text(entry.get("allowed_action"))
    candidate_id = _text(entry.get("candidate_id"))
    if workspace_id is None or request_id is None or action is None or candidate_id is None:
        return None
    answer_value = entry.get("answer_value") if isinstance(entry.get("answer_value"), dict) else {}
    return {
        **entry,
        "workspace_id": workspace_id,
        "candidate_id": candidate_id,
        "request_id": request_id,
        "allowed_action": action,
        "answer_value": answer_value,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "applies_to_specgraph": False,
        "applies_to_candidate_artifacts": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "accepts_ontology_terms": False,
        "creates_branch_or_commit": False,
        "opens_pull_request": False,
    }


def _normalize_answer_value(action: str, raw: Any) -> tuple[dict[str, Any], dict[str, Any] | None]:
    value = raw if isinstance(raw, dict) else {}
    if action == "bind_existing_term":
        term = _text(value.get("term"))
        if term is None:
            return {}, {"error": "bind_existing_term requires answer_value.term"}
        ontology_ref = _text(value.get("ontology_ref") or value.get("text"))
        if ontology_ref is None:
            return {}, {"error": "bind_existing_term requires answer_value.ontology_ref"}
        return {"term": term, "ontology_ref": ontology_ref}, None
    if action == "alias":
        term = _text(value.get("term"))
        if term is None:
            return {}, {"error": "alias requires answer_value.term"}
        alias_of = _text(value.get("alias_of") or value.get("text"))
        if alias_of is None:
            return {}, {"error": "alias requires answer_value.alias_of"}
        return {"term": term, "alias_of": alias_of}, None
    if action == "propose_project_local_term":
        terms = _string_list(value.get("terms"))
        term = _text(value.get("term") or value.get("text"))
        if not terms and term is not None:
            terms = [term]
        if not terms:
            return {}, {"error": "propose_project_local_term requires at least one term"}
        return {"terms": terms, "term_scope": "project_local"}, None
    if action in {"reject", "defer"}:
        reason = _text(value.get("reason") or value.get("text"))
        if reason is None:
            return {}, {"error": f"{action} requires answer_value.reason"}
        result = {"reason": reason}
        term = _text(value.get("term"))
        if action == "reject" and term is not None:
            result["term"] = term
        return result, None
    if action not in ONTOLOGY_ACTIONS:
        text = _text(value.get("text"))
        if text is None:
            return {}, {"error": "repair draft requires a non-empty answer_value"}
        return {"text": text}, None
    return {}, {"error": f"Unsupported repair draft action: {action}"}


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


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
