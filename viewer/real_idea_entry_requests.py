"""SpecSpace-owned raw idea entry request state."""

from __future__ import annotations

import re
import secrets
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider, specspace_state_backend

ENTRY_REQUEST_ARTIFACT_KIND = "specspace_real_idea_entry_request_state"
ENTRY_REQUEST_SCHEMA_VERSION = 1
ENTRY_REQUEST_FILENAME = "real_idea_entry_requests.json"
MAX_IDEA_TEXT_LENGTH = 8000
MAX_HINT_LENGTH = 500
MAX_HINTS = 20
MAX_SUPERSEDED_PER_WORKSPACE = 20
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_mutate_user_intent",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
    "may_publish_read_model",
)
AUTHORITY_FALSE_FIELDS = (
    "real_idea_entry_request_state_is_authority",
    "specgraph_artifact_authority",
    "platform_execution_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
REQUEST_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_mutate_user_intent",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
    "may_publish_read_model",
)
REQUEST_STATUSES = {"draft", "submitted", "superseded"}
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / ENTRY_REQUEST_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": ENTRY_REQUEST_ARTIFACT_KIND,
        "schema_version": ENTRY_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "selected_workspace_id": None,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "requests": [],
        "summary": {
            "status": "no_real_idea_entry_requests",
            "request_count": 0,
            "draft_count": 0,
            "submitted_count": 0,
            "superseded_count": 0,
            "active_submitted_count": 0,
            "workspace_count": 0,
            "next_gap": "submit_real_idea_entry_request",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_real_idea_intake_workflow": True,
            "raw_idea_text_local_only": True,
            "public_safe": False,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_execute_prompt_agent": False,
            "may_apply_to_specgraph": False,
            "may_mutate_user_intent": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_execute_git_service_operation": False,
            "may_publish_read_model": False,
        },
        "authority_boundary": {
            "real_idea_entry_request_state_is_authority": False,
            "specgraph_artifact_authority": False,
            "platform_execution_authority": False,
            "ontology_authority": False,
            "git_service_authority": False,
            "canonical_mutations_allowed": False,
        },
        "privacy_boundary": {
            "raw_idea_text_local_only": True,
            "raw_idea_text_public_safe": False,
            "public_safe": False,
        },
    }


def read_state(
    server: Any,
    *,
    workspace_id: str | None = None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    path = state_path(server)
    try:
        raw = specspace_state_backend.read_state(
            server,
            ENTRY_REQUEST_FILENAME,
            workspace_id=workspace_id,
        )
    except specspace_state_backend.StateBackendUnavailable:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "External SpecSpace state is unavailable.",
            "reason": "external_state_unavailable",
        }
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"{ENTRY_REQUEST_FILENAME} is unreadable",
            "path": str(path),
        }
    if raw is None:
        return HTTPStatus.OK, _filtered_state(empty_state(path), workspace_id)
    state, error = normalize_state(raw, path)
    if error is not None:
        error["path"] = str(path)
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, _filtered_state(state, workspace_id)


def normalize_state(raw: Any, path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{ENTRY_REQUEST_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != ENTRY_REQUEST_ARTIFACT_KIND:
        return None, {"error": "Invalid real idea entry request state artifact_kind"}
    if raw.get("schema_version") != ENTRY_REQUEST_SCHEMA_VERSION:
        return None, {"error": "Unsupported real idea entry request state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Real idea entry request state must be owned by SpecSpace"}
    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Real idea entry request state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Real idea entry consumer_boundary cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Real idea entry authority_boundary cannot claim {mutation_field}"}
    privacy = _record(raw.get("privacy_boundary"))
    if privacy.get("public_safe") is True or privacy.get("raw_idea_text_public_safe") is True:
        return None, {"error": "Real idea entry request state cannot claim public-safe raw text"}

    state = empty_state(path)
    requests: list[dict[str, Any]] = []
    invalid_request_count = 0
    for entry in raw.get("requests", []):
        if not isinstance(entry, dict):
            invalid_request_count += 1
            continue
        normalized = _normalize_existing_request(entry)
        if normalized is None:
            invalid_request_count += 1
            continue
        requests.append(normalized)
    state["requests"] = _cap_superseded_history(requests)
    _refresh_summary(state, invalid_request_count=invalid_request_count)
    return state, None


def save_request(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    mutation_field = _first_true(payload, REQUEST_FALSE_FIELDS)
    if mutation_field is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Real idea entry request payload cannot claim {mutation_field}",
            "field": mutation_field,
        }
    idea_text = _clean_text(payload.get("idea_text"))
    if idea_text is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: idea_text",
            "field": "idea_text",
        }
    if len(idea_text) > MAX_IDEA_TEXT_LENGTH:
        return HTTPStatus.BAD_REQUEST, {
            "error": "idea_text is too long",
            "field": "idea_text",
            "max_length": MAX_IDEA_TEXT_LENGTH,
        }
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id") if isinstance(payload.get("workspace_id"), str) else None
    )
    if workspace_id and payload_workspace_id and workspace_id != payload_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Real idea entry workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = workspace_id or payload_workspace_id
    if not workspace_id_value:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: workspace_id",
            "field": "workspace_id",
        }
    status = _clean_text(payload.get("status")) or "submitted"
    if status not in REQUEST_STATUSES:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Unsupported real idea entry request status.",
            "field": "status",
        }
    now = now_iso()
    request_id = _clean_text(payload.get("request_id")) or (
        f"real-idea-entry.{workspace_id_value}.{_timestamp_id(now)}.{secrets.token_hex(3)}"
    )
    if not _safe_id(request_id):
        return HTTPStatus.BAD_REQUEST, {
            "error": "Invalid real idea entry request_id.",
            "field": "request_id",
        }
    display_name = _clean_text(payload.get("workspace_display_name") or payload.get("display_name"))
    idea_summary_hint = _clean_text(payload.get("idea_summary_hint"))
    domain_hints = _clean_text_list(payload.get("domain_hints"))
    constraints = _clean_text_list(payload.get("constraints"))
    public_route_hint = _clean_text(payload.get("public_route_hint"))
    operator_ref = _clean_text(payload.get("operator_ref")) or "local_operator"

    with _STATE_LOCK:
        status_code, state = read_state(server)
        if status_code != HTTPStatus.OK:
            return status_code, state
        existing = [
            item
            for item in state.get("requests", [])
            if isinstance(item, dict)
            and not (
                item.get("workspace_id") == workspace_id_value
                and item.get("request_id") == request_id
            )
        ]
        if status == "submitted":
            existing = [
                {**item, "status": "superseded", "superseded_at": now}
                if item.get("workspace_id") == workspace_id_value
                and item.get("status") == "submitted"
                else item
                for item in existing
            ]
        record = {
            "request_id": request_id,
            "workspace_id": workspace_id_value,
            "operator_ref": operator_ref,
            "idea_text": idea_text,
            "idea_summary_hint": idea_summary_hint,
            "workspace_display_name": display_name,
            "public_route_hint": public_route_hint,
            "domain_hints": domain_hints,
            "constraints": constraints,
            "status": status,
            "created_at": now,
            "updated_at": now,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "authority_boundary": {
                "may_execute_specgraph": False,
                "may_execute_platform": False,
                "may_execute_prompt_agent": False,
                "may_mutate_user_intent": False,
                "may_mutate_candidate_source_artifacts": False,
                "may_mutate_canonical_specs": False,
                "may_write_ontology_package": False,
                "may_accept_ontology_terms": False,
                "may_create_branch_or_commit": False,
                "may_open_pull_request": False,
                "may_publish_read_model": False,
            },
            "privacy_boundary": {
                "raw_idea_text_local_only": True,
                "raw_idea_text_public_safe": False,
                "public_safe": False,
            },
        }
        existing.append(record)
        state["requests"] = _cap_superseded_history(existing)
        _refresh_summary(state)
        try:
            specspace_state_backend.write_state(
                server,
                ENTRY_REQUEST_FILENAME,
                workspace_id=workspace_id_value,
                state=state,
            )
        except specspace_state_backend.StateBackendConflict:
            return HTTPStatus.CONFLICT, {
                "error": "Real idea entry state changed concurrently.",
                "reason": "external_state_revision_conflict",
            }
        except specspace_state_backend.StateBackendUnavailable:
            return HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "External SpecSpace state is unavailable.",
                "reason": "external_state_unavailable",
            }
        except specspace_state_backend.StateBackendError:
            return HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": "Real idea entry state could not be persisted.",
                "reason": "state_persistence_failed",
            }
        return HTTPStatus.OK, _filtered_state(state, workspace_id_value)


def _normalize_existing_request(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = _clean_text(entry.get("workspace_id"))
    request_id = _clean_text(entry.get("request_id"))
    idea_text = _clean_text(entry.get("idea_text"))
    status = _clean_text(entry.get("status")) or "draft"
    if (
        workspace_id is None
        or request_id is None
        or idea_text is None
        or status not in REQUEST_STATUSES
        or not _safe_id(request_id)
        or len(idea_text) > MAX_IDEA_TEXT_LENGTH
    ):
        return None
    if _first_true(entry, REQUEST_FALSE_FIELDS) is not None:
        return None
    privacy = _record(entry.get("privacy_boundary"))
    if privacy.get("public_safe") is True or privacy.get("raw_idea_text_public_safe") is True:
        return None
    return {
        "request_id": request_id,
        "workspace_id": workspace_id,
        "idea_text": idea_text,
        "idea_summary_hint": _clean_text(entry.get("idea_summary_hint")),
        "workspace_display_name": _clean_text(entry.get("workspace_display_name")),
        "public_route_hint": _clean_text(entry.get("public_route_hint")),
        "domain_hints": _clean_text_list(entry.get("domain_hints")),
        "constraints": _clean_text_list(entry.get("constraints")),
        "status": status,
        "operator_ref": _clean_text(entry.get("operator_ref")) or "local_operator",
        "created_at": _clean_text(entry.get("created_at")) or "unknown",
        "updated_at": _clean_text(entry.get("updated_at")) or _clean_text(entry.get("created_at")) or "unknown",
        "superseded_at": _clean_text(entry.get("superseded_at")),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "authority_boundary": {
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_execute_prompt_agent": False,
            "may_mutate_user_intent": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
        },
        "privacy_boundary": {
            "raw_idea_text_local_only": True,
            "raw_idea_text_public_safe": False,
            "public_safe": False,
        },
    }


def _request_sort_key(item: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(item.get("workspace_id") or ""),
        str(item.get("created_at") or ""),
        str(item.get("request_id") or ""),
    )


def _cap_superseded_history(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    active = [item for item in requests if item.get("status") != "superseded"]
    superseded_by_workspace: dict[str, list[dict[str, Any]]] = {}
    for item in requests:
        if item.get("status") != "superseded":
            continue
        workspace_id = str(item.get("workspace_id") or "")
        superseded_by_workspace.setdefault(workspace_id, []).append(item)
    capped: list[dict[str, Any]] = [*active]
    for items in superseded_by_workspace.values():
        capped.extend(sorted(items, key=_request_sort_key)[-MAX_SUPERSEDED_PER_WORKSPACE:])
    return sorted(capped, key=_request_sort_key)


def _filtered_state(state: dict[str, Any], workspace_id: str | None) -> dict[str, Any]:
    if not workspace_id:
        return state
    filtered = {**state}
    filtered["selected_workspace_id"] = workspace_id
    filtered["requests"] = [
        item
        for item in state.get("requests", [])
        if isinstance(item, dict) and item.get("workspace_id") == workspace_id
    ]
    _refresh_summary(filtered)
    return filtered


def workspace_projection(
    status: HTTPStatus,
    state: dict[str, Any],
    *,
    workspace_id: str | None,
) -> dict[str, Any]:
    if status != HTTPStatus.OK:
        return {
            "artifact_kind": ENTRY_REQUEST_ARTIFACT_KIND,
            "schema_version": ENTRY_REQUEST_SCHEMA_VERSION,
            "state_owner": "SpecSpace",
            "selected_workspace_id": workspace_id,
            "requests": [],
            "summary": {
                "status": "real_idea_entry_state_invalid",
                "request_count": 0,
                "draft_count": 0,
                "submitted_count": 0,
                "superseded_count": 0,
                "active_submitted_count": 0,
                "invalid_request_count": 1,
                "workspace_count": 0,
                "next_gap": "repair_real_idea_entry_request_state",
            },
            "error": {
                "error": _clean_text(state.get("error")) or "Invalid real idea entry state",
                "detail": _clean_text(state.get("detail")),
            },
            "consumer_boundary": empty_state(Path(ENTRY_REQUEST_FILENAME))["consumer_boundary"],
            "authority_boundary": empty_state(Path(ENTRY_REQUEST_FILENAME))["authority_boundary"],
            "privacy_boundary": empty_state(Path(ENTRY_REQUEST_FILENAME))["privacy_boundary"],
        }

    summary = _record(state.get("summary"))
    requests: list[dict[str, Any]] = []
    for item in state.get("requests", []):
        if not isinstance(item, dict):
            continue
        requests.append(
            {
                "request_id": item.get("request_id"),
                "workspace_id": item.get("workspace_id"),
                "operator_ref": item.get("operator_ref"),
                "status": item.get("status"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
                "superseded_at": item.get("superseded_at"),
                "idea_summary_hint_present": bool(_clean_text(item.get("idea_summary_hint"))),
                "workspace_display_name_present": bool(
                    _clean_text(item.get("workspace_display_name"))
                ),
                "public_route_hint": item.get("public_route_hint"),
                "domain_hint_count": len(_clean_text_list(item.get("domain_hints"))),
                "constraint_count": len(_clean_text_list(item.get("constraints"))),
            }
        )
    return {
        "artifact_kind": ENTRY_REQUEST_ARTIFACT_KIND,
        "schema_version": ENTRY_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "selected_workspace_id": state.get("selected_workspace_id"),
        "requests": requests,
        "summary": {
            "status": summary.get("status"),
            "request_count": summary.get("request_count"),
            "draft_count": summary.get("draft_count"),
            "submitted_count": summary.get("submitted_count"),
            "superseded_count": summary.get("superseded_count"),
            "active_submitted_count": summary.get("active_submitted_count"),
            "invalid_request_count": summary.get("invalid_request_count"),
            "workspace_count": summary.get("workspace_count"),
            "next_gap": summary.get("next_gap"),
        },
        "consumer_boundary": state.get("consumer_boundary"),
        "authority_boundary": state.get("authority_boundary"),
        "privacy_boundary": state.get("privacy_boundary"),
    }


def _refresh_summary(
    state: dict[str, Any],
    *,
    invalid_request_count: int | None = None,
) -> None:
    requests = [item for item in state.get("requests", []) if isinstance(item, dict)]
    workspaces = {
        item["workspace_id"]
        for item in requests
        if isinstance(item.get("workspace_id"), str) and item["workspace_id"]
    }
    submitted = [item for item in requests if item.get("status") == "submitted"]
    if invalid_request_count is None:
        invalid_request_count = _number(_record(state.get("summary")).get("invalid_request_count"))
    state["summary"] = {
        "status": "real_idea_entry_submitted"
        if submitted
        else "real_idea_entry_draft"
        if requests
        else "no_real_idea_entry_requests",
        "request_count": len(requests),
        "draft_count": sum(1 for item in requests if item.get("status") == "draft"),
        "submitted_count": len(submitted),
        "superseded_count": sum(1 for item in requests if item.get("status") == "superseded"),
        "active_submitted_count": len(submitted),
        "invalid_request_count": invalid_request_count,
        "workspace_count": len(workspaces),
        "next_gap": "import_real_idea_entry_request_for_specgraph_intake"
        if submitted
        else "submit_real_idea_entry_request",
    }


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = "".join(ch for ch in value.strip() if ch >= " " or ch in "\n\t")
    return text if text else None


def _clean_text_list(value: Any) -> list[str]:
    if isinstance(value, str):
        values = re.split(r"[,;\n]+", value)
    elif isinstance(value, list):
        values = value
    else:
        values = []
    result = []
    for item in values[:MAX_HINTS]:
        text = _clean_text(item)
        if text is not None:
            result.append(text[:MAX_HINT_LENGTH])
    return result


def _safe_id(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,180}", value))


def _timestamp_id(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "", value)[:16] or "now"


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _number(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
