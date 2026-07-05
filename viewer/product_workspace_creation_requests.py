"""SpecSpace-owned product workspace creation request state."""

from __future__ import annotations

import hashlib
import json
import re
import secrets
import tempfile
import threading
import unicodedata
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

CREATION_REQUEST_ARTIFACT_KIND = "specspace_product_workspace_creation_request_state"
CREATION_REQUEST_SCHEMA_VERSION = 1
CREATION_REQUEST_FILENAME = "product_workspace_creation_requests.json"
MAX_TEXT_LENGTH = 500
MAX_ROOT_INTENT_SUMMARY_LENGTH = 2000
MAX_SUPERSEDED_PER_WORKSPACE = 20
REQUEST_STATUSES = {"requested", "superseded", "initialized", "blocked"}
RESERVED_WORKSPACE_IDS = {
    specspace_provider.BOOTSTRAP_WORKSPACE_ID,
    *specspace_provider.BOOTSTRAP_WORKSPACE_ALIASES,
}
FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
    "may_execute_specgraph",
    "may_execute_platform",
    "may_execute_prompt_agent",
    "may_apply_to_specgraph",
    "may_create_workspace",
    "may_initialize_workspace",
    "may_mutate_canonical_specs",
    "may_write_ontology_package",
    "may_accept_ontology_terms",
    "may_create_branch_or_commit",
    "may_open_pull_request",
    "may_execute_git_service_operation",
    "may_publish_read_model",
)
AUTHORITY_FALSE_FIELDS = (
    "product_workspace_creation_request_state_is_authority",
    "specgraph_artifact_authority",
    "platform_execution_authority",
    "workspace_catalog_authority",
    "ontology_authority",
    "git_service_authority",
    "canonical_mutations_allowed",
)
_STATE_LOCK = threading.Lock()


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / CREATION_REQUEST_FILENAME


def now_iso() -> str:
    return (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def empty_state() -> dict[str, Any]:
    return {
        "artifact_kind": CREATION_REQUEST_ARTIFACT_KIND,
        "schema_version": CREATION_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "selected_workspace_id": None,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "requests": [],
        "summary": {
            "status": "no_product_workspace_creation_requests",
            "request_count": 0,
            "requested_count": 0,
            "superseded_count": 0,
            "initialized_count": 0,
            "blocked_count": 0,
            "active_requested_count": 0,
            "workspace_count": 0,
            "next_gap": "submit_product_workspace_creation_request",
        },
        "consumer_boundary": _consumer_boundary(),
        "authority_boundary": _authority_boundary(),
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
            "error": f"{CREATION_REQUEST_FILENAME} is not valid JSON",
            "detail": str(exc),
        }
    state, error = normalize_state(raw, path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, _filtered_state(state, workspace_id)


def normalize_state(
    raw: Any,
    path: Path,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{CREATION_REQUEST_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != CREATION_REQUEST_ARTIFACT_KIND:
        return None, {"error": "Invalid product workspace creation request state artifact_kind"}
    if raw.get("schema_version") != CREATION_REQUEST_SCHEMA_VERSION:
        return None, {"error": "Unsupported product workspace creation request schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Product workspace creation request state must be owned by SpecSpace"}
    expanded = _first_true(raw, FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Product workspace creation state cannot claim {expanded}"}
    expanded = _first_true(_record(raw.get("consumer_boundary")), FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Product workspace creation consumer_boundary cannot claim {expanded}"}
    expanded = _first_true(_record(raw.get("authority_boundary")), AUTHORITY_FALSE_FIELDS)
    if expanded is not None:
        return None, {"error": f"Product workspace creation authority_boundary cannot claim {expanded}"}

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
            "error": f"Product workspace creation request payload cannot claim {expanded}",
            "field": expanded,
        }
    display_name = _clean_text(payload.get("display_name") or payload.get("workspace_display_name"))
    if display_name is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: display_name",
            "field": "display_name",
        }
    if len(display_name) > MAX_TEXT_LENGTH:
        return HTTPStatus.BAD_REQUEST, {
            "error": "display_name is too long",
            "field": "display_name",
            "max_length": MAX_TEXT_LENGTH,
        }

    status = _clean_text(payload.get("status")) or "requested"
    if status != "requested":
        return HTTPStatus.BAD_REQUEST, {
            "error": "New product workspace creation requests must start as requested.",
            "field": "status",
        }

    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        payload.get("workspace_id") if isinstance(payload.get("workspace_id"), str) else None
    )
    route_hint_id = _workspace_id_from_route_hint(payload.get("route") or payload.get("public_route_hint"))
    explicit_workspace_id = payload_workspace_id or route_hint_id
    derived_workspace_id = explicit_workspace_id or workspace_id or _workspace_id_from_display_name(display_name)
    if workspace_id and explicit_workspace_id and workspace_id != explicit_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Product workspace creation workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": explicit_workspace_id,
        }
    workspace_id_value = workspace_id or derived_workspace_id
    if not workspace_id_value:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Could not derive a safe product workspace id.",
            "field": "workspace_id",
        }
    if workspace_id_value in RESERVED_WORKSPACE_IDS:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Reserved workspace id cannot be used for product workspace creation.",
            "field": "workspace_id",
        }
    if _workspace_exists_in_catalog(server, workspace_id_value):
        return HTTPStatus.CONFLICT, {
            "error": "Product workspace already exists in the workspace catalog.",
            "field": "workspace_id",
            "workspace_id": workspace_id_value,
        }

    now = now_iso()
    request_id = _clean_text(payload.get("request_id")) or (
        f"product-workspace-create.{workspace_id_value}.{_timestamp_id(now)}.{secrets.token_hex(3)}"
    )
    if not _safe_request_id(request_id):
        return HTTPStatus.BAD_REQUEST, {
            "error": "Invalid product workspace creation request_id.",
            "field": "request_id",
        }
    operator_ref = _clean_text(payload.get("operator_ref")) or "local_operator"
    root_intent_summary = _clean_text(payload.get("root_intent_summary"))
    if root_intent_summary is not None and len(root_intent_summary) > MAX_ROOT_INTENT_SUMMARY_LENGTH:
        return HTTPStatus.BAD_REQUEST, {
            "error": "root_intent_summary is too long",
            "field": "root_intent_summary",
            "max_length": MAX_ROOT_INTENT_SUMMARY_LENGTH,
        }
    route = specspace_provider.product_workspace_route(workspace_id_value)

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
        if any(
            item.get("workspace_id") == workspace_id_value
            and item.get("status") == "initialized"
            for item in existing
        ):
            return HTTPStatus.CONFLICT, {
                "error": "Product workspace creation request is already initialized.",
                "field": "workspace_id",
                "workspace_id": workspace_id_value,
            }
        if status == "requested":
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
            "display_name": display_name,
            "route": route,
            "operator_ref": operator_ref,
            "root_intent_summary": root_intent_summary,
            "status": status,
            "created_at": now,
            "updated_at": now,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "consumer_boundary": _consumer_boundary(),
            "authority_boundary": _authority_boundary(),
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
        return HTTPStatus.OK, workspace_projection(
            HTTPStatus.OK,
            _filtered_state(state, workspace_id_value),
            workspace_id=workspace_id_value,
        )


def workspace_projection(
    status: HTTPStatus,
    state: dict[str, Any],
    *,
    workspace_id: str | None,
    initialization: dict[str, Any] | None = None,
    include_root_intent_summary: bool = False,
) -> dict[str, Any]:
    if status != HTTPStatus.OK:
        return {
            "artifact_kind": CREATION_REQUEST_ARTIFACT_KIND,
            "schema_version": CREATION_REQUEST_SCHEMA_VERSION,
            "state_owner": "SpecSpace",
            "selected_workspace_id": workspace_id,
            "requests": [],
            "summary": {
                "status": "product_workspace_creation_state_invalid",
                "request_count": 0,
                "active_requested_count": 0,
                "invalid_request_count": 1,
                "next_gap": "repair_product_workspace_creation_request_state",
            },
            "error": {
                "error": _clean_text(state.get("error")) or "Invalid product workspace creation state",
                "detail": _clean_text(state.get("detail")),
            },
            "consumer_boundary": _consumer_boundary(),
            "authority_boundary": _authority_boundary(),
        }
    requests = [
        _public_request(item, include_root_intent_summary=include_root_intent_summary)
        for item in state.get("requests", [])
        if isinstance(item, dict)
    ]
    active = next((item for item in requests if item.get("status") == "requested"), None)
    initialization_record = _record(initialization)
    initialization_workspace_id = _clean_text(
        _record(initialization_record.get("workspace")).get("workspace_id")
    )
    initialized = (
        initialization_record.get("initialized") is True
        and initialization_workspace_id is not None
        and workspace_id is not None
        and initialization_workspace_id == workspace_id
    )
    initialization_trusted = initialization_record.get("trusted") is not False
    projected_initialization = (
        {**initialization_record, "initialized": initialized}
        if initialization_record
        else None
    )
    if initialized and initialization_trusted:
        if active is not None:
            active = {**active, "status": "initialized"}
        requests = [
            {**item, "status": "initialized"}
            if item.get("status") == "requested"
            and item.get("workspace_id") == initialization_workspace_id
            else item
            for item in requests
        ]
    projected_summary = _summary_for_public_requests(
        requests,
        invalid_request_count=_number(_record(state.get("summary")).get("invalid_request_count")),
    )
    status_value = _status_for_public_summary(projected_summary)
    if workspace_id and not requests:
        status_value = "route_only_workspace"
    if initialized and initialization_trusted:
        status_value = "workspace_initialized"
    return {
        "artifact_kind": CREATION_REQUEST_ARTIFACT_KIND,
        "schema_version": CREATION_REQUEST_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "selected_workspace_id": state.get("selected_workspace_id"),
        "requests": requests,
        "active_request": active,
        "summary": {
            "status": status_value,
            "request_count": projected_summary["request_count"],
            "requested_count": projected_summary["requested_count"],
            "superseded_count": projected_summary["superseded_count"],
            "initialized_count": projected_summary["initialized_count"],
            "blocked_count": projected_summary["blocked_count"],
            "active_requested_count": projected_summary["active_requested_count"],
            "invalid_request_count": projected_summary["invalid_request_count"],
            "workspace_count": projected_summary["workspace_count"],
            "next_gap": (
                "start_real_idea_intake"
                if initialized and initialization_trusted
                else "submit_product_workspace_creation_request"
                if workspace_id and not requests
                else "run_platform_workspace_initialization"
                if projected_summary["active_requested_count"]
                else "submit_product_workspace_creation_request"
            ),
        },
        "initialization": projected_initialization,
        "consumer_boundary": state.get("consumer_boundary"),
        "authority_boundary": state.get("authority_boundary"),
    }


def _normalize_existing_request(entry: dict[str, Any]) -> dict[str, Any] | None:
    workspace_id = specspace_provider.normalize_product_workspace_id(entry.get("workspace_id"))
    request_id = _clean_text(entry.get("request_id"))
    display_name = _clean_text(entry.get("display_name"))
    status = _clean_text(entry.get("status")) or "requested"
    if (
        workspace_id is None
        or workspace_id in RESERVED_WORKSPACE_IDS
        or request_id is None
        or display_name is None
        or status not in REQUEST_STATUSES
        or not _safe_request_id(request_id)
    ):
        return None
    if _first_true(entry, FALSE_FIELDS) is not None:
        return None
    expanded = _first_true(_record(entry.get("consumer_boundary")), FALSE_FIELDS)
    if expanded is not None:
        return None
    expanded = _first_true(_record(entry.get("authority_boundary")), AUTHORITY_FALSE_FIELDS)
    if expanded is not None:
        return None
    route = _clean_text(entry.get("route")) or specspace_provider.product_workspace_route(workspace_id)
    if route != specspace_provider.product_workspace_route(workspace_id):
        return None
    return {
        "request_id": request_id,
        "workspace_id": workspace_id,
        "display_name": display_name,
        "route": route,
        "operator_ref": _clean_text(entry.get("operator_ref")) or "local_operator",
        "root_intent_summary": _clean_text(entry.get("root_intent_summary")),
        "status": status,
        "created_at": _clean_text(entry.get("created_at")) or "unknown",
        "updated_at": _clean_text(entry.get("updated_at")) or _clean_text(entry.get("created_at")) or "unknown",
        "superseded_at": _clean_text(entry.get("superseded_at")),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "consumer_boundary": _consumer_boundary(),
        "authority_boundary": _authority_boundary(),
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
    if not filtered["requests"]:
        summary = _record(filtered.get("summary"))
        filtered["summary"] = {
            **summary,
            "status": "route_only_workspace",
            "next_gap": "submit_product_workspace_creation_request",
        }
    return filtered


def _refresh_summary(
    state: dict[str, Any],
    *,
    invalid_request_count: int | None = None,
) -> None:
    requests = [item for item in state.get("requests", []) if isinstance(item, dict)]
    requested = [item for item in requests if item.get("status") == "requested"]
    initialized = [item for item in requests if item.get("status") == "initialized"]
    blocked = [item for item in requests if item.get("status") == "blocked"]
    workspaces = {
        item["workspace_id"]
        for item in requests
        if isinstance(item.get("workspace_id"), str) and item["workspace_id"]
    }
    if invalid_request_count is None:
        invalid_request_count = _number(_record(state.get("summary")).get("invalid_request_count"))
    state["summary"] = {
        "status": "workspace_creation_requested"
        if requested
        else "workspace_initialized"
        if initialized
        else "workspace_creation_blocked"
        if blocked
        else "no_product_workspace_creation_requests",
        "request_count": len(requests),
        "requested_count": len(requested),
        "superseded_count": sum(1 for item in requests if item.get("status") == "superseded"),
        "initialized_count": len(initialized),
        "blocked_count": len(blocked),
        "active_requested_count": len(requested),
        "invalid_request_count": invalid_request_count,
        "workspace_count": len(workspaces),
        "next_gap": "run_platform_workspace_initialization"
        if requested
        else "submit_product_workspace_creation_request",
    }


def _summary_for_public_requests(
    requests: list[dict[str, Any]],
    *,
    invalid_request_count: int,
) -> dict[str, int]:
    workspaces = {
        item["workspace_id"]
        for item in requests
        if isinstance(item.get("workspace_id"), str) and item["workspace_id"]
    }
    return {
        "request_count": len(requests),
        "requested_count": sum(1 for item in requests if item.get("status") == "requested"),
        "superseded_count": sum(1 for item in requests if item.get("status") == "superseded"),
        "initialized_count": sum(1 for item in requests if item.get("status") == "initialized"),
        "blocked_count": sum(1 for item in requests if item.get("status") == "blocked"),
        "active_requested_count": sum(1 for item in requests if item.get("status") == "requested"),
        "invalid_request_count": invalid_request_count,
        "workspace_count": len(workspaces),
    }


def _status_for_public_summary(summary: dict[str, int]) -> str:
    if summary["requested_count"]:
        return "workspace_creation_requested"
    if summary["initialized_count"]:
        return "workspace_initialized"
    if summary["blocked_count"]:
        return "workspace_creation_blocked"
    return "no_product_workspace_creation_requests"


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


def _public_request(
    item: dict[str, Any],
    *,
    include_root_intent_summary: bool = False,
) -> dict[str, Any]:
    request = {
        "request_id": item.get("request_id"),
        "workspace_id": item.get("workspace_id"),
        "display_name": item.get("display_name"),
        "route": item.get("route"),
        "operator_ref": item.get("operator_ref"),
        "root_intent_summary_present": _clean_text(item.get("root_intent_summary")) is not None,
        "status": item.get("status"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
        "superseded_at": item.get("superseded_at"),
    }
    if include_root_intent_summary:
        request["root_intent_summary"] = _clean_text(item.get("root_intent_summary"))
    return request


def _request_sort_key(item: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(item.get("workspace_id") or ""),
        str(item.get("created_at") or ""),
        str(item.get("request_id") or ""),
    )


def _workspace_id_from_route_hint(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return specspace_provider.normalize_product_workspace_id(value.strip().lstrip("/"))


def _workspace_id_from_display_name(value: str) -> str | None:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)[:64].strip("-")
    normalized_slug = specspace_provider.normalize_product_workspace_id(slug)
    if normalized_slug is not None:
        return normalized_slug
    digest = hashlib.sha256(value.strip().casefold().encode("utf-8")).hexdigest()[:10]
    return specspace_provider.normalize_product_workspace_id(f"idea-{digest}")


def _workspace_exists_in_catalog(server: Any, workspace_id: str) -> bool:
    catalog = specspace_provider.workspace_catalog(server)
    for item in catalog.get("workspaces", []):
        if (
            isinstance(item, dict)
            and specspace_provider.normalize_product_workspace_id(item.get("id"))
            == workspace_id
        ):
            return True
    return False


def _timestamp_id(value: str) -> str:
    return re.sub(r"[^0-9]", "", value)[:14] or "now"


def _safe_request_id(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9._:-]{3,160}", value))


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = "".join(ch for ch in value.strip() if ch >= " " or ch in "\n\t")
    return text if text else None


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _first_true(record: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(record, dict):
        return None
    return next((field for field in fields if record.get(field) is True), None)


def _number(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _consumer_boundary() -> dict[str, Any]:
    return {
        "specspace_owned_state": True,
        "for_product_workspace_creation": True,
        "public_safe": False,
        "may_execute_specgraph": False,
        "may_execute_platform": False,
        "may_execute_prompt_agent": False,
        "may_apply_to_specgraph": False,
        "may_create_workspace": False,
        "may_initialize_workspace": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_execute_git_service_operation": False,
        "may_publish_read_model": False,
    }


def _authority_boundary() -> dict[str, Any]:
    return {
        "product_workspace_creation_request_state_is_authority": False,
        "specgraph_artifact_authority": False,
        "platform_execution_authority": False,
        "workspace_catalog_authority": False,
        "ontology_authority": False,
        "git_service_authority": False,
        "canonical_mutations_allowed": False,
    }
