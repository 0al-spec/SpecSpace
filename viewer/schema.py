"""Schema helpers for imported and canonical conversation payloads."""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
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


@dataclass(frozen=True)
class NormalizationError:
    code: str
    message: str


@dataclass(frozen=True)
class NormalizationResult:
    kind: str
    normalized: dict[str, Any] | None
    errors: tuple[NormalizationError, ...] = ()


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


def collect_normalization_errors(payload: dict[str, Any]) -> tuple[NormalizationError, ...]:
    if not _is_mapping(payload):
        return (NormalizationError("invalid_payload", "Payload must be a JSON object."),)

    if is_canonical_conversation(payload):
        return ()

    missing_fields = [field for field in IMPORTED_ROOT_REQUIRED_FIELDS if field not in payload]
    if missing_fields:
        return (
            NormalizationError(
                "missing_top_level_fields",
                f"Imported conversation is missing required top-level fields: {', '.join(missing_fields)}.",
            ),
        )

    messages = payload.get("messages")
    if not isinstance(messages, list):
        return (NormalizationError("invalid_messages", "`messages` must be a list."),)

    errors: list[NormalizationError] = []
    if payload.get("message_count") != len(messages):
        errors.append(
            NormalizationError(
                "message_count_mismatch",
                "`message_count` does not match the number of messages.",
            )
        )

    message_ids: list[str] = []
    for index, message in enumerate(messages):
        if not _is_mapping(message):
            errors.append(
                NormalizationError(
                    "invalid_message_payload",
                    f"Message at index {index} is not a JSON object.",
                )
            )
            continue

        missing_message_fields = [field for field in MESSAGE_REQUIRED_FIELDS if field not in message]
        if missing_message_fields:
            errors.append(
                NormalizationError(
                    "missing_message_fields",
                    f"Message at index {index} is missing required fields: {', '.join(missing_message_fields)}.",
                )
            )
            continue

        message_id = message.get("message_id")
        if isinstance(message_id, str) and message_id:
            message_ids.append(message_id)
        else:
            errors.append(
                NormalizationError(
                    "invalid_message_id",
                    f"Message at index {index} has an invalid `message_id`.",
                )
            )

    if len(message_ids) != len(set(message_ids)):
        errors.append(
            NormalizationError(
                "duplicate_message_ids",
                "Imported conversation contains duplicate `message_id` values.",
            )
        )

    return tuple(errors)


def derive_conversation_id(payload: dict[str, Any]) -> str:
    if is_canonical_conversation(payload):
        return str(payload["conversation_id"])

    basis = {
        "source_file": payload.get("source_file", ""),
        "title": payload.get("title", ""),
        "message_ids": [message.get("message_id", "") for message in payload.get("messages", []) if _is_mapping(message)],
    }
    digest = hashlib.sha1(
        json.dumps(basis, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]
    return f"conv-{digest}"


def normalize_conversation(payload: dict[str, Any]) -> NormalizationResult:
    if is_canonical_conversation(payload):
        return NormalizationResult(
            kind=classify_conversation(payload),
            normalized=copy.deepcopy(payload),
        )

    errors = collect_normalization_errors(payload)
    if errors:
        return NormalizationResult(kind="invalid", normalized=None, errors=errors)

    normalized = copy.deepcopy(payload)
    normalized["conversation_id"] = derive_conversation_id(payload)
    normalized["lineage"] = {"parents": []}

    return NormalizationResult(kind="canonical-root", normalized=normalized)
