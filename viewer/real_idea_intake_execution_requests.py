"""SpecSpace-owned request state for controlled real idea intake execution."""

from __future__ import annotations

import json
import re
import secrets
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

EXECUTION_REQUEST_ARTIFACT_KIND = "specspace_real_idea_intake_execution_request_state"
EXECUTION_REQUEST_SCHEMA_VERSION = 1
EXECUTION_REQUEST_FILENAME = "real_idea_intake_execution_requests.json"
MAX_SUPERSEDED_PER_WORKSPACE = 20
REQUEST_STATUSES = {"requested", "superseded", "consumed", "blocked"}
FALSE_FIELDS = (
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
AUTHORITY_FALSE_FIELDS = (
    "real_idea_intake_execution_request_state_is_authority",
    "specgraph_artifact_authority",
    "platform_execution_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / EXECUTION_REQUEST_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_state() -> dict[str, Any]:
    return {
        "artifact_kind": EXECUTION_REQUEST_ARTIFACT_KIND,
        "schema_version": EXECUTION_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "selected_workspace_id": None,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "requests": [],
        "summary": {
            "status": "no_real_idea_intake_execution_requests",
            "request_count": 0,
            "requested_count": 0,
            "superseded_count": 0,
            "consumed_count": 0,
            "blocked_count": 0,
            "active_requested_count": 0,
            "invalid_request_count": 0,
            "workspace_count": 0,
            "next_gap": "request_real_idea_intake_execution",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_real_idea_intake_execution": True,
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
            "real_idea_intake_execution_request_state_is_authority": False,
            "specgraph_artifact_authority": False,
            "platform_execution_authority": False,
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
        return HTTPStatus.OK, _filtered_state(empty_state(), workspace_id)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"{EXECUTION_REQUEST_FILENAME} is not valid JSON",
            "detail": str(exc),
        }
    state, error = normalize_state(raw)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, _filtered_state(state, workspace_id)


def normalize_state(raw: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{EXECUTION_REQUEST_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != EXECUTION_REQUEST_ARTIFACT_KIND:
        return None, {"error": "Invalid real idea intake execution request state artifact_kind"}
    if raw.get("schema_version") != EXECUTION_REQUEST_SCHEMA_VERSION:
        return None, {"error": "Unsupported real idea intake execution request schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Real idea intake execution request state must be owned by SpecSpace"}
    expanded = _first_true(raw, FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Real idea intake execution state cannot claim {expanded}"}
    expanded = _first_true(_record(raw.get("consumer_boundary")), FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Real idea intake execution consumer_boundary cannot claim {expanded}"}
    expanded = _first_true(_record(raw.get("authority_boundary")), AUTHORITY_FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Real idea intake execution authority_boundary cannot claim {expanded}"}
    state = empty_state()
    invalid_request_count = 0
    requests: list[dict[str, Any]] = []
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
    expanded = _first_true(payload, FALSE_FIELDS)
    if expanded is not None:
        return HTTPStatus.BAD_REQUEST, {
            "error": f"Real idea intake execution request payload cannot claim {expanded}",
            "field": expanded,
        }
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id") if isinstance(payload.get("workspace_id"), str) else None
    )
    if workspace_id and payload_workspace_id and workspace_id != payload_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Real idea intake execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    workspace_id_value = workspace_id or payload_workspace_id
    if not workspace_id_value:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: workspace_id",
            "field": "workspace_id",
        }
    entry_request_id = _clean_text(payload.get("entry_request_id"))
    if entry_request_id is None or not _safe_request_id(entry_request_id):
        return HTTPStatus.BAD_REQUEST, {
            "error": "Invalid or missing entry_request_id.",
            "field": "entry_request_id",
        }
    workspace_initialization_ref = _safe_ref(payload.get("workspace_initialization_ref"))
    if workspace_initialization_ref is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: workspace_initialization_ref",
            "field": "workspace_initialization_ref",
        }
    entry_requests_ref = _safe_ref(payload.get("entry_requests_ref")) or "specspace-state://real_idea_entry_requests.json"
    status = _clean_text(payload.get("status")) or "requested"
    if status != "requested":
        return HTTPStatus.BAD_REQUEST, {
            "error": "New real idea intake execution requests must start as requested.",
            "field": "status",
        }
    now = now_iso()
    request_id = _clean_text(payload.get("request_id")) or (
        f"real-idea-intake-execute.{workspace_id_value}.{_timestamp_id(now)}.{secrets.token_hex(3)}"
    )
    if not _safe_request_id(request_id):
        return HTTPStatus.BAD_REQUEST, {
            "error": "Invalid real idea intake execution request_id.",
            "field": "request_id",
        }
    operator_ref = _clean_text(payload.get("operator_ref")) or "operator://specspace-local"

    with _STATE_LOCK:
        status_code, state = read_state(server)
        if status_code != HTTPStatus.OK:
            return status_code, state
        path = state_path(server)
        existing = [
            item
            for item in state.get("requests", [])
            if isinstance(item, dict)
            and not (
                item.get("workspace_id") == workspace_id_value
                and item.get("request_id") == request_id
            )
        ]
        existing = [
            {**item, "status": "superseded", "superseded_at": now}
            if item.get("workspace_id") == workspace_id_value
            and item.get("status") == "requested"
            else item
            for item in existing
        ]
        record = {
            "request_id": request_id,
            "workspace_id": workspace_id_value,
            "entry_request_id": entry_request_id,
            "entry_requests_ref": entry_requests_ref,
            "workspace_initialization_ref": workspace_initialization_ref,
            "operator_ref": operator_ref,
            "status": "requested",
            "created_at": now,
            "updated_at": now,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "consumer_boundary": empty_state()["consumer_boundary"],
            "authority_boundary": empty_state()["authority_boundary"],
        }
        existing.append(record)
        state["requests"] = _cap_superseded_history(existing)
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
        return HTTPStatus.OK, _filtered_state(state, workspace_id_value)


def _normalize_existing_request(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = specspace_provider.normalize_workspace_id(
        entry.get("workspace_id") if isinstance(entry.get("workspace_id"), str) else None
    )
    request_id = _clean_text(entry.get("request_id"))
    entry_request_id = _clean_text(entry.get("entry_request_id"))
    status = _clean_text(entry.get("status")) or "requested"
    if (
        workspace_id is None
        or request_id is None
        or entry_request_id is None
        or status not in REQUEST_STATUSES
        or not _safe_request_id(request_id)
        or not _safe_request_id(entry_request_id)
        or _first_true(entry, FALSE_FIELDS) is not None
    ):
        return None
    expanded = _first_true(_record(entry.get("consumer_boundary")), FALSE_FIELDS)
    if expanded is not None:
        return None
    expanded = _first_true(_record(entry.get("authority_boundary")), AUTHORITY_FALSE_FIELDS)
    if expanded is not None:
        return None
    workspace_initialization_ref = _safe_ref(entry.get("workspace_initialization_ref"))
    if workspace_initialization_ref is None:
        return None
    return {
        "request_id": request_id,
        "workspace_id": workspace_id,
        "entry_request_id": entry_request_id,
        "entry_requests_ref": _safe_ref(entry.get("entry_requests_ref")) or "specspace-state://real_idea_entry_requests.json",
        "workspace_initialization_ref": workspace_initialization_ref,
        "operator_ref": _clean_text(entry.get("operator_ref")) or "operator://specspace-local",
        "status": status,
        "created_at": _clean_text(entry.get("created_at")) or "unknown",
        "updated_at": _clean_text(entry.get("updated_at")) or _clean_text(entry.get("created_at")) or "unknown",
        "superseded_at": _clean_text(entry.get("superseded_at")),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "consumer_boundary": empty_state()["consumer_boundary"],
        "authority_boundary": empty_state()["authority_boundary"],
    }


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


def _refresh_summary(
    state: dict[str, Any],
    *,
    invalid_request_count: int | None = None,
) -> None:
    requests = [item for item in state.get("requests", []) if isinstance(item, dict)]
    requested = [item for item in requests if item.get("status") == "requested"]
    consumed = [item for item in requests if item.get("status") == "consumed"]
    blocked = [item for item in requests if item.get("status") == "blocked"]
    if invalid_request_count is None:
        invalid_request_count = _number(_record(state.get("summary")).get("invalid_request_count"))
    workspaces = {
        item["workspace_id"]
        for item in requests
        if isinstance(item.get("workspace_id"), str) and item["workspace_id"]
    }
    state["summary"] = {
        "status": "real_idea_intake_execution_requested"
        if requested
        else "real_idea_intake_execution_consumed"
        if consumed
        else "real_idea_intake_execution_blocked"
        if blocked
        else "no_real_idea_intake_execution_requests",
        "request_count": len(requests),
        "requested_count": len(requested),
        "superseded_count": sum(1 for item in requests if item.get("status") == "superseded"),
        "consumed_count": len(consumed),
        "blocked_count": len(blocked),
        "active_requested_count": len(requested),
        "invalid_request_count": invalid_request_count,
        "workspace_count": len(workspaces),
        "next_gap": "run_platform_real_idea_intake_execution"
        if requested
        else "request_real_idea_intake_execution",
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


def _safe_ref(value: Any) -> str | None:
    text = _clean_text(value)
    if text is None:
        return None
    if text.startswith("specspace-state://"):
        return text
    if text.startswith("/") or ".." in text.split("/"):
        return None
    if not re.fullmatch(r"[A-Za-z0-9._:/-]{1,240}", text):
        return None
    return text


def _safe_request_id(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,180}", value))


def _timestamp_id(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "", value)[:16] or "now"


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = "".join(ch for ch in value.strip() if ch >= " " or ch in "\n\t")
    return text if text else None


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _number(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
