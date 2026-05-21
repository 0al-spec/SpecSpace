"""Readonly Agent Workbench conversation artifact read models."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

SPECSPACE_API_VERSION = "v1"
CONVERSATION_INDEX_KIND = "specspace_agent_conversation_index"
CONVERSATION_ARTIFACT_KIND = "specspace_agent_conversation"


def _workbench_dir_from_server(server: Any) -> Path | None:
    value = getattr(server, "agent_workbench_dir", None)
    return value if isinstance(value, Path) else None


def _conversation_dir(server: Any) -> Path | None:
    root = _workbench_dir_from_server(server)
    return root / "conversations" if root is not None else None


def agent_workbench_source(server: Any) -> dict[str, Any]:
    workbench_dir = _workbench_dir_from_server(server)
    conversations_dir = _conversation_dir(server)
    if conversations_dir is None:
        return {
            "name": "agent_workbench_conversations",
            "path": None,
            "status": "not_configured",
            "detail": "Agent Workbench conversation store is not configured.",
        }
    try:
        assert workbench_dir is not None
        if not workbench_dir.exists():
            return {
                "name": "agent_workbench_conversations",
                "path": str(workbench_dir),
                "status": "missing",
                "detail": "Configured Agent Workbench store root does not exist.",
            }
        if not workbench_dir.is_dir():
            return {
                "name": "agent_workbench_conversations",
                "path": str(workbench_dir),
                "status": "not_directory",
            }
        if not conversations_dir.exists():
            return {
                "name": "agent_workbench_conversations",
                "path": str(conversations_dir),
                "status": "empty",
                "item_count": 0,
                "detail": "Conversation store has not been initialized yet.",
            }
        if not conversations_dir.is_dir():
            return {
                "name": "agent_workbench_conversations",
                "path": str(conversations_dir),
                "status": "not_directory",
            }
        item_count = len([path for path in conversations_dir.glob("*.json") if path.name != "index.json"])
    except OSError as exc:
        return {
            "name": "agent_workbench_conversations",
            "path": str(conversations_dir),
            "status": "unreadable",
            "detail": str(exc),
        }
    return {
        "name": "agent_workbench_conversations",
        "path": str(conversations_dir),
        "status": "ok" if item_count else "empty",
        "item_count": item_count,
    }


def agent_workbench_read_available(server: Any) -> bool:
    return agent_workbench_source(server)["status"] in {"ok", "empty"}


def _source_unavailable_payload(server: Any) -> tuple[HTTPStatus, dict[str, Any]] | None:
    source = agent_workbench_source(server)
    if source["status"] in {"ok", "empty"}:
        return None
    return (
        HTTPStatus.SERVICE_UNAVAILABLE,
        {
            "api_version": SPECSPACE_API_VERSION,
            "error": "Agent Workbench conversation store is not readable.",
            "reason": "agent_workbench_store_unavailable",
            "source": source,
        },
    )


def _empty_index() -> dict[str, Any]:
    return {
        "api_version": SPECSPACE_API_VERSION,
        "artifact_kind": CONVERSATION_INDEX_KIND,
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "entry_count": 0,
        "entries": [],
    }


def _read_json_object(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, {
            "error": f"{path.name} could not be read.",
            "reason": "artifact_unreadable",
            "detail": str(exc),
        }
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        return None, {
            "error": f"{path.name} is not valid JSON.",
            "reason": "invalid_json",
            "detail": str(exc),
        }
    if not isinstance(payload, dict):
        return None, {
            "error": f"{path.name} did not contain a JSON object.",
            "reason": "invalid_payload",
        }
    return payload, None


def _validate_artifact(
    payload: dict[str, Any],
    *,
    artifact_kind: str,
    path: Path,
) -> dict[str, Any] | None:
    if payload.get("api_version") != SPECSPACE_API_VERSION:
        return {
            "error": f"{path.name} has unsupported api_version.",
            "reason": "unsupported_api_version",
            "api_version": payload.get("api_version"),
        }
    if payload.get("artifact_kind") != artifact_kind:
        return {
            "error": f"{path.name} has unsupported artifact_kind.",
            "reason": "unsupported_artifact_kind",
            "artifact_kind": payload.get("artifact_kind"),
        }
    return None


def read_agent_conversation_index(server: Any) -> tuple[HTTPStatus, dict[str, Any]]:
    unavailable = _source_unavailable_payload(server)
    if unavailable is not None:
        return unavailable

    conversations_dir = _conversation_dir(server)
    assert conversations_dir is not None
    index_path = conversations_dir / "index.json"
    if not index_path.exists():
        return HTTPStatus.OK, {
            "api_version": SPECSPACE_API_VERSION,
            "source": agent_workbench_source(server),
            "data": _empty_index(),
        }

    payload, error = _read_json_object(index_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "source": agent_workbench_source(server),
            **error,
        }
    assert payload is not None
    validation_error = _validate_artifact(payload, artifact_kind=CONVERSATION_INDEX_KIND, path=index_path)
    if validation_error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "source": agent_workbench_source(server),
            **validation_error,
        }
    return HTTPStatus.OK, {
        "api_version": SPECSPACE_API_VERSION,
        "source": agent_workbench_source(server),
        "data": payload,
    }


def _bad_conversation_id(value: str) -> dict[str, Any] | None:
    if not value:
        return {"error": "Missing Agent Workbench conversation id in path."}
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        return {"error": "Agent Workbench conversation id must not contain control characters."}
    if value in {".", ".."}:
        return {"error": "Agent Workbench conversation id must not contain path traversal segments."}
    if "/" in value or "\\" in value:
        return {"error": "Agent Workbench conversation id must not contain path separators."}
    return None


def read_agent_conversation(server: Any, conversation_id: str) -> tuple[HTTPStatus, dict[str, Any]]:
    id_error = _bad_conversation_id(conversation_id)
    if id_error is not None:
        return HTTPStatus.BAD_REQUEST, {"api_version": SPECSPACE_API_VERSION, **id_error}

    unavailable = _source_unavailable_payload(server)
    if unavailable is not None:
        return unavailable

    conversations_dir = _conversation_dir(server)
    assert conversations_dir is not None
    root = conversations_dir.resolve()
    path = (root / f"{conversation_id}.json").resolve()
    if not path.is_relative_to(root):
        return HTTPStatus.BAD_REQUEST, {
            "api_version": SPECSPACE_API_VERSION,
            "error": "Agent Workbench conversation path escaped the configured store.",
        }
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "api_version": SPECSPACE_API_VERSION,
            "error": f"Agent Workbench conversation '{conversation_id}' not found.",
            "conversation_id": conversation_id,
            "source": agent_workbench_source(server),
        }

    payload, error = _read_json_object(path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "conversation_id": conversation_id,
            "source": agent_workbench_source(server),
            **error,
        }
    assert payload is not None
    validation_error = _validate_artifact(payload, artifact_kind=CONVERSATION_ARTIFACT_KIND, path=path)
    if validation_error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "conversation_id": conversation_id,
            "source": agent_workbench_source(server),
            **validation_error,
        }
    if payload.get("conversation_id") != conversation_id:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "api_version": SPECSPACE_API_VERSION,
            "conversation_id": conversation_id,
            "source": agent_workbench_source(server),
            "error": f"{path.name} conversation_id does not match the requested id.",
            "reason": "conversation_id_mismatch",
            "artifact_conversation_id": payload.get("conversation_id"),
        }
    return HTTPStatus.OK, {
        "api_version": SPECSPACE_API_VERSION,
        "conversation_id": conversation_id,
        "source": agent_workbench_source(server),
        "data": payload,
    }
