"""SpecSpace-owned project-local ontology review decisions."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

DECISION_STATE_ARTIFACT_KIND = "specspace_project_local_ontology_review_decision_state"
DECISION_STATE_SCHEMA_VERSION = 1
DECISION_STATE_FILENAME = "project_local_ontology_review_decisions.json"

SUPPORTED_ACTIONS = {
    "keep_project_local",
    "bind_existing",
    "alias",
    "reject",
    "request_workspace_promotion",
    "defer",
}

TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_prompt_agent",
    "may_execute_specgraph",
    "may_execute_platform",
    "may_apply_to_specgraph",
    "may_apply_decisions",
    "may_mutate_candidate_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_write_ontology_lockfile",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
)
AUTHORITY_FALSE_FIELDS = (
    "project_local_ontology_review_decision_state_is_authority",
    "specgraph_artifact_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
DECISION_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
    "applies_to_specgraph",
    "applies_to_candidate_artifacts",
    "mutates_canonical_specs",
    "writes_ontology_package",
    "updates_ontology_lockfile",
    "accepts_ontology_terms",
    "creates_branch_or_commit",
    "opens_pull_request",
)

_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / DECISION_STATE_FILENAME


def now_iso() -> str:
    return (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": DECISION_STATE_ARTIFACT_KIND,
        "schema_version": DECISION_STATE_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "decisions": [],
        "summary": {
            "status": "no_project_local_ontology_review_decisions",
            "decision_count": 0,
            "workspace_count": 0,
            "action_counts": {},
            "next_gap": "export_project_local_ontology_review_decisions_for_specgraph_validation",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_project_local_ontology_review": True,
            "may_execute_prompt_agent": False,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_apply_to_specgraph": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_write_ontology_lockfile": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
        },
        "authority_boundary": {
            "project_local_ontology_review_decision_state_is_authority": False,
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
            "error": f"{DECISION_STATE_FILENAME} is not valid JSON",
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
        return None, {"error": f"{DECISION_STATE_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != DECISION_STATE_ARTIFACT_KIND:
        return None, {"error": "Invalid project-local ontology decision state artifact_kind"}
    if raw.get("schema_version") != DECISION_STATE_SCHEMA_VERSION:
        return None, {"error": "Unsupported project-local ontology decision state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Project-local ontology decision state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Project-local ontology decision state cannot claim {mutation_field}"}
    mutation_field = _first_true(_record(raw.get("consumer_boundary")), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Project-local ontology decision consumer_boundary cannot claim {mutation_field}"}
    mutation_field = _first_true(_record(raw.get("authority_boundary")), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Project-local ontology decision authority_boundary cannot claim {mutation_field}"}

    state = empty_state(path)
    decisions = []
    invalid_decisions = []
    for index, entry in enumerate(_records(raw.get("decisions"))):
        mutation_field = _first_true(entry, DECISION_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {"error": f"Project-local ontology decision cannot claim {mutation_field}"}
        decision, invalid_reason = _normalize_existing_decision_result(entry)
        if decision is not None:
            decisions.append(decision)
        else:
            invalid_decisions.append(
                {
                    "index": index,
                    "reason": invalid_reason or "invalid_project_local_ontology_decision",
                }
            )
    decisions.sort(key=lambda entry: (entry["workspace_id"], entry["term_key"]))
    state["decisions"] = decisions
    state["invalid_decision_count"] = len(invalid_decisions)
    state["invalid_decisions"] = invalid_decisions[:20]
    state["source_artifacts"] = _string_map(raw.get("source_artifacts"))
    _refresh_summary(state)
    return state, None


def save_decision(
    server: Any,
    payload: dict[str, Any],
    workspace_payload: dict[str, Any],
    *,
    workspace_id: str | None,
    lane_artifact: dict[str, Any] | None = None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    term_key = _text(payload.get("term_key"))
    action = _text(payload.get("action") or payload.get("review_action"))
    if term_key is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: term_key",
            "field": "term_key",
        }
    if action is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: action",
            "field": "action",
        }
    mutation_field = _first_true(payload, DECISION_FALSE_FIELDS + CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Project-local ontology decision payload cannot claim {mutation_field}",
            "field": mutation_field,
        }

    lane = _record(lane_artifact) or _record(workspace_payload.get("project_local_ontology_review"))
    raw_lane_available = lane_artifact is not None and (
        lane.get("artifact_kind") == "project_local_ontology_review_lane"
    )
    if not raw_lane_available and lane.get("available") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Project-local ontology review decision requires a readable review lane.",
            "reason": "project_local_ontology_review_lane_required",
        }
    term = next(
        (item for item in _records(lane.get("terms")) if item.get("term_key") == term_key),
        None,
    )
    if term is None:
        return HTTPStatus.NOT_FOUND, {
            "error": f"Project-local ontology term '{term_key}' not found.",
            "term_key": term_key,
        }
    lane_actions = _lane_supported_actions(lane)
    suggested_actions = _strings(term.get("suggested_actions"))
    allowed_actions = [
        item for item in suggested_actions if item in lane_actions
    ] or lane_actions
    if action not in SUPPORTED_ACTIONS or action not in allowed_actions:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Action '{action}' is not allowed for project-local ontology term '{term_key}'.",
            "term_key": term_key,
            "allowed_actions": allowed_actions,
        }

    decision_value, value_error = _normalize_decision_value(
        action,
        payload.get("decision_value", payload.get("value")),
        term,
    )
    if value_error is not None:
        return HTTPStatus.BAD_REQUEST, value_error

    selected_workspace_id = (
        workspace_id
        or _text(_record(workspace_payload.get("workspace")).get("id"))
        or _text(payload.get("workspace_id"))
    )
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
    )
    if payload_workspace_id and selected_workspace_id and payload_workspace_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Project-local ontology decision workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": payload_workspace_id,
        }

    workspace_id_value = selected_workspace_id or payload_workspace_id or "default"
    workspace = _record(workspace_payload.get("workspace"))
    repair_session = _record(workspace_payload.get("repair_session"))
    session = _record(repair_session.get("session"))
    artifacts = _record(workspace_payload.get("artifacts"))
    lane_artifact = _record(artifacts.get("project_local_ontology_review"))
    lane_ref = _text(lane_artifact.get("path")) or "runs/project_local_ontology_review_lane.json"
    candidate_id = (
        _text(session.get("candidate_id"))
        or _text(workspace.get("id"))
        or workspace_id_value
    )
    repair_session_id = _text(session.get("session_id"))
    now = now_iso()

    with _STATE_LOCK:
        status, state = read_state(server)
        if status != HTTPStatus.OK:
            return status, state
        path = state_path(server)
        existing_by_key = {
            (entry["workspace_id"], entry["term_key"]): entry
            for entry in state.get("decisions", [])
            if isinstance(entry, dict)
            and isinstance(entry.get("workspace_id"), str)
            and isinstance(entry.get("term_key"), str)
        }
        existing = existing_by_key.get((workspace_id_value, term_key))
        created_at = _text(existing.get("created_at")) if isinstance(existing, dict) else None
        record = {
            "decision_id": f"specspace-project-local-ontology-decision::{workspace_id_value}::{term_key}",
            "workspace_id": workspace_id_value,
            "candidate_id": candidate_id,
            "repair_session_id": repair_session_id,
            "project_local_ontology_review_lane_ref": lane_ref,
            "term_id": _text(term.get("id")),
            "term": _text(term.get("term")) or term_key,
            "term_key": term_key,
            "current_status": _text(term.get("status")) or "unreviewed",
            "review_action": action,
            "decision_value": decision_value,
            "operator_ref": _text(payload.get("operator_ref")) or "local_operator",
            "created_at": created_at or now,
            "updated_at": now,
            "source_artifact": lane_ref,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "applies_to_specgraph": False,
            "applies_to_candidate_artifacts": False,
            "mutates_canonical_specs": False,
            "writes_ontology_package": False,
            "updates_ontology_lockfile": False,
            "accepts_ontology_terms": False,
            "creates_branch_or_commit": False,
            "opens_pull_request": False,
        }
        existing_by_key[(workspace_id_value, term_key)] = record
        state["decisions"] = sorted(
            existing_by_key.values(),
            key=lambda entry: (entry["workspace_id"], entry["term_key"]),
        )
        state["source_artifacts"] = {
            **_record(state.get("source_artifacts")),
            "project_local_ontology_review_lane": lane_ref,
        }
        _refresh_summary(state)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(f"{path.suffix}.tmp")
        tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(path)
        return HTTPStatus.OK, _filtered_state(state, workspace_id)


def _normalize_existing_decision(entry: dict[str, Any]) -> dict[str, Any] | None:
    return _normalize_existing_decision_result(entry)[0]


def _normalize_existing_decision_result(
    entry: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    workspace_id = _text(entry.get("workspace_id"))
    candidate_id = _text(entry.get("candidate_id"))
    term_key = _text(entry.get("term_key"))
    review_action = _text(entry.get("review_action"))
    if workspace_id is None or candidate_id is None or term_key is None or review_action is None:
        return None, "missing_required_fields"
    decision_value, value_error = _normalize_decision_value(
        review_action,
        entry.get("decision_value") if isinstance(entry.get("decision_value"), dict) else {},
        entry,
    )
    if value_error is not None:
        return None, _text(value_error.get("error")) or "invalid_decision_value"
    return {
        **entry,
        "workspace_id": workspace_id,
        "candidate_id": candidate_id,
        "term_key": term_key,
        "review_action": review_action,
        "decision_value": decision_value,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "applies_to_specgraph": False,
        "applies_to_candidate_artifacts": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "updates_ontology_lockfile": False,
        "accepts_ontology_terms": False,
        "creates_branch_or_commit": False,
        "opens_pull_request": False,
    }, None


def _normalize_decision_value(
    action: str,
    raw: Any,
    term: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    value = raw if isinstance(raw, dict) else {}
    mutation_field = _first_true(value, DECISION_FALSE_FIELDS + CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return {}, {"error": f"project-local ontology decision value cannot claim {mutation_field}"}
    term_text = _text(value.get("term")) or _text(term.get("term"))
    if action == "keep_project_local":
        reason = _text(value.get("reason") or value.get("text"))
        return {
            "term": term_text,
            "term_scope": "project_local",
            **({"reason": reason} if reason else {}),
        }, None
    if action == "bind_existing":
        ontology_ref = _text(value.get("ontology_ref") or value.get("text"))
        if ontology_ref is None:
            return {}, {"error": "bind_existing requires decision_value.ontology_ref"}
        return {"term": term_text, "ontology_ref": ontology_ref}, None
    if action == "alias":
        alias_of = _text(value.get("alias_of") or value.get("text"))
        if alias_of is None:
            return {}, {"error": "alias requires decision_value.alias_of"}
        return {"term": term_text, "alias_of": alias_of}, None
    if action in {"reject", "request_workspace_promotion", "defer"}:
        reason = _text(value.get("reason") or value.get("text"))
        if reason is None:
            return {}, {"error": f"{action} requires decision_value.reason"}
        result = {"term": term_text, "reason": reason}
        if action == "request_workspace_promotion":
            result["promotion_scope"] = _text(value.get("promotion_scope")) or "workspace"
        if action == "defer":
            follow_up = _text(value.get("follow_up"))
            if follow_up is not None:
                result["follow_up"] = follow_up
        return result, None
    return {}, {"error": f"Unsupported project-local ontology decision action: {action}"}


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["decisions"] = [
        entry
        for entry in state.get("decisions", [])
        if isinstance(entry, dict) and entry.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def _refresh_summary(state: dict[str, Any]) -> None:
    decisions = [entry for entry in state.get("decisions", []) if isinstance(entry, dict)]
    invalid_decision_count = _non_negative_int(state.get("invalid_decision_count"))
    workspaces = {
        entry["workspace_id"]
        for entry in decisions
        if isinstance(entry.get("workspace_id"), str) and entry["workspace_id"]
    }
    action_counts: dict[str, int] = {}
    for entry in decisions:
        action = _text(entry.get("review_action")) or "unknown"
        action_counts[action] = action_counts.get(action, 0) + 1
    state["summary"] = {
        "status": (
            "project_local_ontology_review_decisions_recorded"
            if decisions
            else "no_project_local_ontology_review_decisions"
        ),
        "decision_count": len(decisions),
        "invalid_decision_count": invalid_decision_count,
        "dropped_decision_count": invalid_decision_count,
        "workspace_count": len(workspaces),
        "action_counts": action_counts,
        "next_gap": "export_project_local_ontology_review_decisions_for_specgraph_validation",
    }


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return (
        [item for item in value if isinstance(item, dict)]
        if isinstance(value, list)
        else []
    )


def _strings(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _string_map(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        key: item
        for key, item in value.items()
        if isinstance(key, str) and isinstance(item, str)
    }


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    for field in fields:
        if value.get(field) is True:
            return field
    return None


def _lane_supported_actions(lane: dict[str, Any]) -> list[str]:
    schema = _record(lane.get("review_decision_schema"))
    actions = _strings(schema.get("supported_actions")) or _strings(
        lane.get("supported_actions")
    )
    allowed = [item for item in actions if item in SUPPORTED_ACTIONS]
    return allowed or sorted(SUPPORTED_ACTIONS)


def _non_negative_int(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0
