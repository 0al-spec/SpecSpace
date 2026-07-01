"""SpecSpace-owned answer state for real idea intake clarification."""

from __future__ import annotations

import json
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

INTAKE_ANSWER_ARTIFACT_KIND = "specspace_idea_intake_clarification_answer_state"
INTAKE_ANSWER_SCHEMA_VERSION = 1
INTAKE_ANSWER_FILENAME = "idea_to_spec_intake_clarification_answers.json"
ANSWER_SET_CONTRACT_REF = "specgraph.idea-to-spec.clarification-answer-set.v0.1"
REQUESTS_ARTIFACT_KEY = "intake_clarification_requests"
REQUESTS_PATH = "runs/idea_intake_clarification_requests.json"
ANSWER_TEMPLATE_PATH = "runs/real_idea_smoke/real_idea_answer_template.json"
ANSWER_AUTHORITIES = {
    "operator_approved",
    "owner_approved",
    "agent_proposed",
    "deferred_by_operator",
}
ACCEPTED_STATUSES = {"accepted_for_candidate", "accepted_for_review"}
NON_RESOLVING_ANSWER_KINDS = {"defer", "defer_candidate"}
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_apply_answers",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
)
AUTHORITY_FALSE_FIELDS = (
    "intake_answer_state_is_authority",
    "specgraph_artifact_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
ANSWER_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
    "applies_to_specgraph",
    "applies_to_candidate_source",
    "mutates_user_intent",
    "mutates_canonical_specs",
    "writes_ontology_package",
    "accepts_ontology_terms",
    "creates_branch_or_commit",
    "opens_pull_request",
)
VALUE_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_git_service",
    "may_apply_state",
    "may_apply_to_specgraph",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
)
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / INTAKE_ANSWER_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": INTAKE_ANSWER_ARTIFACT_KIND,
        "schema_version": INTAKE_ANSWER_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "selected_workspace_id": None,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "answer_set": {
            "artifact_kind": "idea_to_spec_clarification_answer_set",
            "schema_version": 1,
            "contract_ref": ANSWER_SET_CONTRACT_REF,
            "answers": [],
        },
        "answers": [],
        "summary": {
            "status": "no_intake_clarification_answers",
            "answer_count": 0,
            "accepted_answer_count": 0,
            "invalid_answer_count": 0,
            "workspace_count": 0,
            "next_gap": "export_intake_clarification_answers_for_specgraph_rerun",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_real_idea_intake_workflow": True,
            "may_execute_specgraph": False,
            "may_execute_prompt_agent": False,
            "may_apply_to_specgraph": False,
            "may_apply_answers": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_execute_git_service_operation": False,
        },
        "authority_boundary": {
            "intake_answer_state_is_authority": False,
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
            "error": f"{INTAKE_ANSWER_FILENAME} is not valid JSON",
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
        return None, {"error": f"{INTAKE_ANSWER_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != INTAKE_ANSWER_ARTIFACT_KIND:
        return None, {"error": "Invalid intake clarification answer state artifact_kind"}
    if raw.get("schema_version") != INTAKE_ANSWER_SCHEMA_VERSION:
        return None, {"error": "Unsupported intake clarification answer state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Intake clarification answer state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Intake clarification answer state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Intake clarification consumer_boundary cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Intake clarification authority_boundary cannot claim {mutation_field}"}

    state = empty_state(path)
    answers = []
    invalid_answer_count = 0
    for entry in raw.get("answers", []):
        if not isinstance(entry, dict):
            invalid_answer_count += 1
            continue
        mutation_field = _first_true(entry, ANSWER_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {"error": f"Intake clarification answer cannot claim {mutation_field}"}
        answer = _normalize_existing_answer(entry)
        if answer is not None:
            answers.append(answer)
        else:
            invalid_answer_count += 1
    answers.sort(key=lambda entry: (entry["workspace_id"], entry["request_id"]))
    state["answers"] = answers
    state["source_artifacts"] = _string_map(raw.get("source_artifacts"))
    _refresh_summary(state, invalid_answer_count=invalid_answer_count)
    return state, None


def save_intake_answer(
    server: Any,
    payload: dict[str, Any],
    workspace_payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    request_id = _text(payload.get("request_id"))
    answer_kind = _text(payload.get("answer_kind") or payload.get("action"))
    if request_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: request_id",
            "field": "request_id",
        }
    if answer_kind is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: answer_kind",
            "field": "answer_kind",
        }
    mutation_field = _first_true(payload, ANSWER_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Intake clarification answer payload cannot claim {mutation_field}",
            "field": mutation_field,
        }

    workspace = _record(workspace_payload.get("workspace"))
    intake_clarification = _record(workspace_payload.get("intake_clarification"))
    request_lane = _record(intake_clarification.get("clarification_requests"))
    if request_lane.get("available") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Intake clarification answer requires published clarification requests.",
            "reason": "intake_clarification_requests_required",
        }
    requests_payload, requests_error = _published_requests_payload(
        server,
        workspace_id=workspace_id,
    )
    if requests_error is not None:
        return HTTPStatus.CONFLICT, requests_error
    requests = _records(requests_payload.get("clarification_requests"))
    request = next((item for item in requests if item.get("id") == request_id), None)
    if request is None:
        return HTTPStatus.NOT_FOUND, {
            "error": f"Intake clarification request '{request_id}' not found.",
            "request_id": request_id,
        }
    template_payload, template_error = _published_answer_template_payload(
        server,
        workspace_id=workspace_id,
    )
    if template_error is not None:
        return HTTPStatus.CONFLICT, template_error
    template_target = _template_target_for_request(template_payload, request_id)
    template_actions = _string_list(_record(template_target).get("accepted_actions"))
    allowed_actions = template_actions or _string_list(request.get("suggested_actions"))
    if answer_kind not in allowed_actions:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Answer kind '{answer_kind}' is not allowed for request '{request_id}'.",
            "request_id": request_id,
            "allowed_actions": allowed_actions,
        }
    answer_value, value_error = _normalize_answer_value(
        answer_kind,
        payload.get("value", payload.get("answer_value")),
    )
    if value_error is not None:
        return HTTPStatus.BAD_REQUEST, value_error
    missing_required = _missing_template_required_fields(
        template_target,
        answer_kind,
        answer_value,
    )
    if missing_required:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Intake clarification answer is missing required template fields.",
            "request_id": request_id,
            "answer_kind": answer_kind,
            "missing_fields": missing_required,
        }
    status = _text(payload.get("status")) or (
        "deferred" if answer_kind in NON_RESOLVING_ANSWER_KINDS else "accepted_for_candidate"
    )
    if status not in ACCEPTED_STATUSES and status not in {"proposed", "rejected", "deferred"}:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Unsupported intake clarification answer status.",
            "field": "status",
        }
    authority = _text(payload.get("authority")) or "operator_approved"
    if authority not in ANSWER_AUTHORITIES:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Unsupported intake clarification answer authority.",
            "field": "authority",
        }

    selected_workspace_id = workspace_id or _text(workspace.get("id")) or _text(payload.get("workspace_id"))
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
    )
    if payload_workspace_id and selected_workspace_id and payload_workspace_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Intake clarification answer workspace_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = selected_workspace_id or payload_workspace_id or "default"
    # Product workspaces currently model one active candidate per workspace; keep
    # candidate_id aligned until the workspace projection exposes a separate id.
    candidate_id = _text(workspace.get("id")) or workspace_id_value
    artifacts = _record(workspace_payload.get("artifacts"))
    requests_artifact = _record(artifacts.get(REQUESTS_ARTIFACT_KEY))
    source_ref = _text(requests_artifact.get("path")) or REQUESTS_PATH
    template_ref = ANSWER_TEMPLATE_PATH if template_target else None
    now = now_iso()

    with _STATE_LOCK:
        status_code, state = read_state(server)
        if status_code != HTTPStatus.OK:
            return status_code, state
        path = state_path(server)
        existing_by_key = {
            (entry["workspace_id"], entry["request_id"]): entry
            for entry in state.get("answers", [])
            if isinstance(entry, dict)
            and isinstance(entry.get("workspace_id"), str)
            and isinstance(entry.get("request_id"), str)
        }
        existing = existing_by_key.get((workspace_id_value, request_id))
        created_at = _text(existing.get("created_at")) if isinstance(existing, dict) else None
        record = {
            "answer_id": f"specspace-intake-answer::{workspace_id_value}::{request_id}",
            "workspace_id": workspace_id_value,
            "candidate_id": candidate_id,
            "request_id": request_id,
            "request_kind": _text(request.get("kind")) or "clarification",
            "request_status": _text(request.get("status")) or "open",
            "target_ref": _text(request.get("target_ref")),
            "target_artifact": _text(request.get("target_artifact")),
            "answer_kind": answer_kind,
            "status": status,
            "authority": authority,
            "value": answer_value,
            "operator_ref": _text(payload.get("operator_ref")) or "local_operator",
            "rationale": _text(payload.get("rationale")) or "",
            "created_at": created_at or now,
            "updated_at": now,
            "source_artifact": source_ref,
            "template_ref": template_ref,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "applies_to_specgraph": False,
            "applies_to_candidate_source": False,
            "mutates_user_intent": False,
            "mutates_canonical_specs": False,
            "writes_ontology_package": False,
            "accepts_ontology_terms": False,
            "creates_branch_or_commit": False,
            "opens_pull_request": False,
        }
        existing_by_key[(workspace_id_value, request_id)] = record
        state["answers"] = sorted(
            existing_by_key.values(),
            key=lambda entry: (entry["workspace_id"], entry["request_id"]),
        )
        state["source_artifacts"] = {
            **_record(state.get("source_artifacts")),
            "intake_clarification_requests": source_ref,
            **({"real_idea_answer_template": template_ref} if template_ref else {}),
        }
        _refresh_summary(state)
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w",
            dir=path.parent,
            encoding="utf-8",
            prefix=f"{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as tmp_file:
            tmp_file.write(json.dumps(state, indent=2, sort_keys=True) + "\n")
            tmp = Path(tmp_file.name)
        tmp.replace(path)
        return HTTPStatus.OK, _filtered_state(state, workspace_id)


def _published_requests_payload(
    server: Any,
    *,
    workspace_id: str | None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    status, content = specspace_provider.provider_from_server(
        server,
        workspace_id,
    ).read_artifact_content(REQUESTS_PATH)
    if status != HTTPStatus.OK:
        return {}, {
            "error": "Intake clarification requests artifact is not readable.",
            "reason": "intake_clarification_requests_unavailable",
            "source_status": int(status),
            "source": content,
        }
    data = _record(content.get("data"))
    if data.get("artifact_kind") != "idea_to_spec_clarification_requests":
        return {}, {
            "error": "Intake clarification requests artifact has invalid artifact_kind.",
            "reason": "intake_clarification_requests_invalid_contract",
            "artifact_kind": data.get("artifact_kind"),
        }
    return data, None


def _published_answer_template_payload(
    server: Any,
    *,
    workspace_id: str | None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    status, content = specspace_provider.provider_from_server(
        server,
        workspace_id,
    ).read_artifact_content(ANSWER_TEMPLATE_PATH)
    if status != HTTPStatus.OK:
        return {}, None
    data = _record(content.get("data"))
    if data.get("artifact_kind") != "real_idea_answer_template":
        return {}, {
            "error": "Real idea answer template has invalid artifact_kind.",
            "reason": "real_idea_answer_template_invalid_contract",
            "artifact_kind": data.get("artifact_kind"),
        }
    mutation_field = _first_true(data.get("authority_boundary"), VALUE_FALSE_FIELDS)
    if mutation_field is not None:
        return {}, {
            "error": f"Real idea answer template cannot claim {mutation_field}",
            "reason": "real_idea_answer_template_authority_expanded",
            "field": mutation_field,
        }
    privacy_boundary = _record(data.get("privacy_boundary"))
    for key, value in privacy_boundary.items():
        if isinstance(key, str) and key.startswith("raw_") and value is True:
            return {}, {
                "error": f"Real idea answer template cannot publish {key}",
                "reason": "real_idea_answer_template_privacy_expanded",
                "field": key,
            }
    return data, None


def _template_target_for_request(
    template: dict[str, Any],
    request_id: str,
) -> dict[str, Any]:
    if not template:
        return {}
    for target in _records(template.get("answer_targets")):
        if target.get("request_id") == request_id:
            return target
    return {}


def _missing_template_required_fields(
    target: dict[str, Any],
    answer_kind: str,
    value: dict[str, Any],
) -> list[str]:
    required_fields = _string_list(
        _record(_record(target).get("required_fields_by_action")).get(answer_kind)
    )
    return [field for field in required_fields if not _template_field_present(value, field)]


def _template_field_present(value: dict[str, Any], field: str) -> bool:
    if field == "value":
        return _substantive(value)
    if not field.startswith("value."):
        return True
    path = field.removeprefix("value.")
    if path.endswith("[]"):
        item = value.get(path[:-2])
        return bool(_string_list(item))
    if path == "context":
        return _substantive(value.get("context") or value.get("text"))
    if path == "answer":
        return _substantive(value.get("answer") or value.get("text"))
    return _substantive(value.get(path))


def _substantive(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(_substantive(item) for item in value)
    if isinstance(value, dict):
        return any(_substantive(item) for item in value.values())
    return value not in (None, False)


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["answers"] = [
        entry
        for entry in state.get("answers", [])
        if isinstance(entry, dict) and entry.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def _refresh_summary(
    state: dict[str, Any],
    *,
    invalid_answer_count: int | None = None,
) -> None:
    answers = [entry for entry in state.get("answers", []) if isinstance(entry, dict)]
    workspaces = {
        entry["workspace_id"]
        for entry in answers
        if isinstance(entry.get("workspace_id"), str) and entry["workspace_id"]
    }
    accepted = [
        entry
        for entry in answers
        if entry.get("status") in ACCEPTED_STATUSES
        and entry.get("answer_kind") not in NON_RESOLVING_ANSWER_KINDS
    ]
    if invalid_answer_count is None:
        invalid_answer_count = _number(_record(state.get("summary")).get("invalid_answer_count"))
    state["answer_set"] = {
        "artifact_kind": "idea_to_spec_clarification_answer_set",
        "schema_version": 1,
        "contract_ref": ANSWER_SET_CONTRACT_REF,
        "answers": [
            {
                "request_id": entry["request_id"],
                "answer_kind": entry["answer_kind"],
                "status": entry["status"],
                "authority": entry["authority"],
                "value": entry["value"],
                "rationale": entry.get("rationale", ""),
            }
            for entry in answers
        ],
    }
    state["summary"] = {
        "status": "intake_clarification_answers_recorded"
        if answers
        else "no_intake_clarification_answers",
        "answer_count": len(answers),
        "accepted_answer_count": len(accepted),
        "invalid_answer_count": invalid_answer_count,
        "workspace_count": len(workspaces),
        "next_gap": "export_intake_clarification_answers_for_specgraph_rerun",
    }


def _normalize_existing_answer(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = _text(entry.get("workspace_id"))
    request_id = _text(entry.get("request_id"))
    answer_kind = _text(entry.get("answer_kind"))
    candidate_id = _text(entry.get("candidate_id"))
    status = _text(entry.get("status")) or "proposed"
    authority = _text(entry.get("authority")) or "operator_approved"
    if (
        workspace_id is None
        or request_id is None
        or answer_kind is None
        or candidate_id is None
        or authority not in ANSWER_AUTHORITIES
        or status
        not in ACCEPTED_STATUSES | {"proposed", "rejected", "deferred"}
    ):
        return None
    value, value_error = _normalize_answer_value(answer_kind, entry.get("value"))
    if value_error is not None:
        return None
    return {
        **entry,
        "workspace_id": workspace_id,
        "candidate_id": candidate_id,
        "request_id": request_id,
        "answer_kind": answer_kind,
        "status": status,
        "authority": authority,
        "value": value,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "applies_to_specgraph": False,
        "applies_to_candidate_source": False,
        "mutates_user_intent": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "accepts_ontology_terms": False,
        "creates_branch_or_commit": False,
        "opens_pull_request": False,
    }


def _normalize_answer_value(answer_kind: str, raw: Any) -> tuple[dict[str, Any], dict[str, Any] | None]:
    value = raw if isinstance(raw, dict) else {}
    mutation_field = _first_true(value, VALUE_FALSE_FIELDS)
    if mutation_field is not None:
        return {}, {"error": f"intake clarification value cannot claim {mutation_field}"}
    if answer_kind in {"answer_question", "provide_candidate_context"}:
        refs = _string_list(value.get("refs"))
        entries = _string_list(value.get("entries"))
        text = _text(value.get("text") or value.get("answer") or value.get("context"))
        result: dict[str, Any] = {}
        if refs:
            result["refs"] = refs
        if entries:
            result["entries"] = entries
        if text is not None:
            result["text"] = text
        if not result:
            return {}, {
                "error": f"{answer_kind} requires value.text, value.refs, or value.entries"
            }
        return result, None
    if answer_kind in {"reject", "defer", "defer_candidate"}:
        reason = _text(value.get("reason") or value.get("follow_up") or value.get("text"))
        if reason is None:
            return {}, {"error": f"{answer_kind} requires value.reason"}
        return {"reason": reason}, None
    text = _text(value.get("text"))
    if text is None:
        return {}, {"error": "intake clarification answer requires a non-empty value"}
    return {"text": text}, None


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


def _number(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
