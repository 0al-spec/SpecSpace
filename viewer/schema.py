"""Schema helpers for imported and canonical conversation payloads."""

from __future__ import annotations

from typing import Any


IMPORTED_ROOT_REQUIRED_FIELDS = (
    "title",
    "source_file",
    "message_count",
    "messages",
)

CANONICAL_CONVERSATION_REQUIRED_FIELDS = (
    "conversation_id",
    "title",
    "messages",
    "lineage",
)

MESSAGE_REQUIRED_FIELDS = (
    "message_id",
    "role",
    "content",
)

OPTIONAL_IMPORTED_MESSAGE_FIELDS = (
    "turn_id",
    "source",
)

PARENT_REFERENCE_REQUIRED_FIELDS = (
    "conversation_id",
    "message_id",
    "link_type",
)


def _is_mapping(value: Any) -> bool:
    return isinstance(value, dict)


def has_required_fields(payload: dict[str, Any], required_fields: tuple[str, ...]) -> bool:
    return all(field in payload for field in required_fields)


def is_imported_root_conversation(payload: dict[str, Any]) -> bool:
    if not _is_mapping(payload) or not has_required_fields(payload, IMPORTED_ROOT_REQUIRED_FIELDS):
        return False

    messages = payload.get("messages")
    if not isinstance(messages, list):
        return False

    if payload.get("message_count") != len(messages):
        return False

    return all(is_message_payload(message) for message in messages)


def is_message_payload(payload: dict[str, Any]) -> bool:
    return _is_mapping(payload) and has_required_fields(payload, MESSAGE_REQUIRED_FIELDS)


def is_canonical_conversation(payload: dict[str, Any]) -> bool:
    if not _is_mapping(payload) or not has_required_fields(payload, CANONICAL_CONVERSATION_REQUIRED_FIELDS):
        return False

    messages = payload.get("messages")
    lineage = payload.get("lineage")
    if not isinstance(messages, list) or not _is_mapping(lineage):
        return False

    if not all(is_message_payload(message) for message in messages):
        return False

    parents = lineage.get("parents")
    if not isinstance(parents, list):
        return False

    return all(is_parent_reference(parent) for parent in parents)


def is_parent_reference(payload: dict[str, Any]) -> bool:
    return _is_mapping(payload) and has_required_fields(payload, PARENT_REFERENCE_REQUIRED_FIELDS)


def classify_conversation(payload: dict[str, Any]) -> str:
    if is_canonical_conversation(payload):
        parent_count = len(payload["lineage"]["parents"])
        if parent_count == 0:
            return "canonical-root"
        if parent_count == 1:
            return "canonical-branch"
        return "canonical-merge"

    if is_imported_root_conversation(payload):
        return "imported-root"

    return "invalid"


def message_anchor(payload: dict[str, Any]) -> str | None:
    if not is_message_payload(payload):
        return None
    return payload["message_id"]


def imported_message_provenance(payload: dict[str, Any]) -> dict[str, str]:
    if not is_message_payload(payload):
        return {}

    provenance: dict[str, str] = {}
    for field in OPTIONAL_IMPORTED_MESSAGE_FIELDS:
        value = payload.get(field)
        if isinstance(value, str) and value:
            provenance[field] = value
    return provenance
