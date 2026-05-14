"""Schema helpers for imported and canonical conversation payloads."""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
from typing import Any, TypeGuard, TypedDict


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

ALLOWED_PARENT_LINK_TYPES = (
    "branch",
    "merge",
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


@dataclass(frozen=True)
class ValidationResult:
    kind: str
    normalized: dict[str, Any] | None
    errors: tuple[NormalizationError, ...] = ()


@dataclass(frozen=True)
class FileValidationReport:
    file_name: str
    kind: str
    normalized: dict[str, Any] | None
    errors: tuple[NormalizationError, ...] = ()


class CompileTargetPayload(TypedDict, total=False):
    """Serialized compile-target payload returned by the conversation and checkpoint APIs."""

    scope: str                                   # "conversation" | "checkpoint"
    target_conversation_id: str
    target_message_id: str | None                # present for checkpoint scope
    target_kind: str                             # "root" | "branch" | "merge"
    lineage_conversation_ids: list[str]          # ordered oldest-first
    lineage_edge_ids: list[str]                  # sorted
    lineage_paths: list[list[str]]               # sorted paths to roots
    root_conversation_ids: list[str]             # sorted; empty when is_lineage_complete is False
    merge_parent_conversation_ids: list[str]     # sorted
    unresolved_parent_edge_ids: list[str]        # sorted
    is_lineage_complete: bool
    export_dir: str                              # absolute path for export artifacts
    target_checkpoint_index: int                 # present for checkpoint scope
    target_checkpoint_role: str                  # present for checkpoint scope


def _is_mapping(value: Any) -> TypeGuard[dict[str, Any]]:
    return isinstance(value, dict)


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


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
    if not _is_mapping(payload) or not has_required_fields(payload, MESSAGE_REQUIRED_FIELDS):
        return False

    if not _is_non_empty_string(payload.get("message_id")):
        return False

    if not _is_non_empty_string(payload.get("role")):
        return False

    return isinstance(payload.get("content"), str)


def is_canonical_conversation(payload: dict[str, Any]) -> bool:
    if not _is_mapping(payload) or not has_required_fields(payload, CANONICAL_CONVERSATION_REQUIRED_FIELDS):
        return False

    if not _is_non_empty_string(payload.get("conversation_id")):
        return False

    if not isinstance(payload.get("title"), str):
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
    if not _is_mapping(payload) or not has_required_fields(payload, PARENT_REFERENCE_REQUIRED_FIELDS):
        return False

    if not _is_non_empty_string(payload.get("conversation_id")):
        return False

    if not _is_non_empty_string(payload.get("message_id")):
        return False

    return payload.get("link_type") in ALLOWED_PARENT_LINK_TYPES


def looks_like_canonical_conversation(payload: dict[str, Any]) -> bool:
    return _is_mapping(payload) and ("conversation_id" in payload or "lineage" in payload)


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


def validate_file_name(name: str) -> tuple[NormalizationError, ...]:
    if not _is_non_empty_string(name):
        return (NormalizationError("invalid_filename", "File name must be a non-empty `.json` file name."),)

    if "/" in name or "\\" in name:
        return (NormalizationError("invalid_filename", "File name must not include path separators."),)

    if not name.endswith(".json"):
        return (NormalizationError("invalid_filename", "File name must end with `.json`."),)

    return ()


def _validate_messages(messages: list[Any], errors: list[NormalizationError]) -> list[str]:
    """Validate each item in *messages*, appending errors to *errors* in-place.

    Returns the list of valid ``message_id`` values encountered (for duplicate
    detection by the caller).  Validation stops for each individual message on
    the first structural error (missing fields, bad id, etc.) so that subsequent
    checks are not run against incomplete data.
    """
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

        if not _is_non_empty_string(message.get("message_id")):
            errors.append(
                NormalizationError(
                    "invalid_message_id",
                    f"Message at index {index} has an invalid `message_id`.",
                )
            )
            continue

        if not _is_non_empty_string(message.get("role")):
            errors.append(
                NormalizationError(
                    "invalid_message_role",
                    f"Message at index {index} has an invalid `role`.",
                )
            )
            continue

        if not isinstance(message.get("content"), str):
            errors.append(
                NormalizationError(
                    "invalid_message_content",
                    f"Message at index {index} has invalid `content`.",
                )
            )
            continue

        message_ids.append(message["message_id"])
    return message_ids


def collect_normalization_errors(payload: dict[str, Any]) -> tuple[NormalizationError, ...]:
    if not _is_mapping(payload):
        return (NormalizationError("invalid_payload", "Payload must be a JSON object."),)

    if is_canonical_conversation(payload):
        return ()

    errors: list[NormalizationError] = []
    missing_fields = [field for field in IMPORTED_ROOT_REQUIRED_FIELDS if field not in payload]
    if missing_fields:
        errors.append(
            NormalizationError(
                "missing_top_level_fields",
                f"Imported conversation is missing required top-level fields: {', '.join(missing_fields)}.",
            )
        )

    messages = payload.get("messages")
    if not isinstance(messages, list):
        errors.append(NormalizationError("invalid_messages", "`messages` must be a list."))
        return tuple(errors)

    if payload.get("message_count") != len(messages):
        errors.append(
            NormalizationError(
                "message_count_mismatch",
                "`message_count` does not match the number of messages.",
            )
        )

    message_ids = _validate_messages(messages, errors)
    if len(message_ids) != len(set(message_ids)):
        errors.append(
            NormalizationError(
                "duplicate_message_ids",
                "Conversation contains duplicate `message_id` values.",
            )
        )

    return tuple(errors)


def collect_canonical_validation_errors(payload: dict[str, Any]) -> tuple[NormalizationError, ...]:
    if not _is_mapping(payload):
        return (NormalizationError("invalid_payload", "Payload must be a JSON object."),)

    errors: list[NormalizationError] = []
    missing_fields = [field for field in CANONICAL_CONVERSATION_REQUIRED_FIELDS if field not in payload]
    if missing_fields:
        errors.append(
            NormalizationError(
                "missing_canonical_fields",
                f"Canonical conversation is missing required fields: {', '.join(missing_fields)}.",
            )
        )

    if "conversation_id" in payload and not _is_non_empty_string(payload.get("conversation_id")):
        errors.append(
            NormalizationError(
                "invalid_conversation_id",
                "Canonical conversation must include a non-empty `conversation_id`.",
            )
        )

    if "title" in payload and not isinstance(payload.get("title"), str):
        errors.append(NormalizationError("invalid_title", "Canonical conversation `title` must be a string."))

    messages = payload.get("messages")
    if "messages" in payload and not isinstance(messages, list):
        errors.append(NormalizationError("invalid_messages", "`messages` must be a list."))
    elif isinstance(messages, list):
        message_ids = _validate_messages(messages, errors)
        if len(message_ids) != len(set(message_ids)):
            errors.append(
                NormalizationError(
                    "duplicate_message_ids",
                    "Conversation contains duplicate `message_id` values.",
                )
            )

    lineage = payload.get("lineage")
    parent_links: list[str] = []
    if "lineage" in payload and not _is_mapping(lineage):
        errors.append(NormalizationError("invalid_lineage", "`lineage` must be a JSON object."))
    elif _is_mapping(lineage):
        parents = lineage.get("parents")
        if not isinstance(parents, list):
            errors.append(NormalizationError("invalid_lineage_parents", "`lineage.parents` must be a list."))
        else:
            seen_parents: set[tuple[str, str, str]] = set()
            for index, parent in enumerate(parents):
                if not _is_mapping(parent):
                    errors.append(
                        NormalizationError(
                            "invalid_parent_reference",
                            f"Parent reference at index {index} is not a JSON object.",
                        )
                    )
                    continue

                missing_parent_fields = [field for field in PARENT_REFERENCE_REQUIRED_FIELDS if field not in parent]
                if missing_parent_fields:
                    errors.append(
                        NormalizationError(
                            "invalid_parent_reference",
                            f"Parent reference at index {index} is missing required fields: {', '.join(missing_parent_fields)}.",
                        )
                    )
                    continue

                if not _is_non_empty_string(parent.get("conversation_id")) or not _is_non_empty_string(
                    parent.get("message_id")
                ):
                    errors.append(
                        NormalizationError(
                            "invalid_parent_reference",
                            f"Parent reference at index {index} must include non-empty conversation and message IDs.",
                        )
                    )
                    continue

                if parent.get("link_type") not in ALLOWED_PARENT_LINK_TYPES:
                    errors.append(
                        NormalizationError(
                            "invalid_parent_link_type",
                            f"Parent reference at index {index} has unsupported `link_type`.",
                        )
                    )
                    continue

                key = (
                    parent["conversation_id"],
                    parent["message_id"],
                    parent["link_type"],
                )
                if key in seen_parents:
                    errors.append(
                        NormalizationError(
                            "duplicate_parent_reference",
                            "Canonical conversation contains duplicate parent references.",
                        )
                    )
                    continue

                seen_parents.add(key)
                parent_links.append(parent["link_type"])

            if len(parents) == 1 and parent_links and parent_links[0] != "branch":
                errors.append(
                    NormalizationError(
                        "invalid_branch_lineage",
                        "Single-parent conversations must use `branch` as the parent `link_type`.",
                    )
                )

            if len(parents) > 1 and any(link_type != "merge" for link_type in parent_links):
                errors.append(
                    NormalizationError(
                        "invalid_merge_lineage",
                        "Multi-parent conversations must use `merge` as the parent `link_type`.",
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
    digest = hashlib.sha256(
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


def validate_conversation(payload: dict[str, Any]) -> ValidationResult:
    if looks_like_canonical_conversation(payload):
        normalized_payload = copy.deepcopy(payload)
        errors = collect_canonical_validation_errors(normalized_payload)
        if errors:
            return ValidationResult(kind="invalid", normalized=normalized_payload, errors=errors)
        return ValidationResult(kind=classify_conversation(normalized_payload), normalized=normalized_payload)

    normalized_result = normalize_conversation(payload)
    if normalized_result.errors:
        return ValidationResult(kind="invalid", normalized=None, errors=normalized_result.errors)

    normalized = normalized_result.normalized
    if normalized is None:
        return ValidationResult(
            kind="invalid",
            normalized=None,
            errors=(NormalizationError("invalid_payload", "Failed to normalize payload."),),
        )

    errors = collect_canonical_validation_errors(normalized)
    if errors:
        return ValidationResult(kind="invalid", normalized=normalized, errors=errors)

    return ValidationResult(kind=normalized_result.kind, normalized=normalized)


def validate_workspace(entries: list[tuple[str, dict[str, Any]]]) -> tuple[FileValidationReport, ...]:
    initial_reports: list[FileValidationReport] = []
    errors_by_name: dict[str, list[NormalizationError]] = {}

    for file_name, payload in entries:
        result = validate_conversation(payload)
        initial_reports.append(
            FileValidationReport(
                file_name=file_name,
                kind=result.kind,
                normalized=result.normalized,
                errors=result.errors,
            )
        )
        errors_by_name[file_name] = list(result.errors)

    conversation_groups: dict[str, list[FileValidationReport]] = {}
    for report in initial_reports:
        if report.normalized is None or errors_by_name[report.file_name]:
            continue
        conversation_id = report.normalized["conversation_id"]
        conversation_groups.setdefault(conversation_id, []).append(report)

    for conversation_id, reports in conversation_groups.items():
        if len(reports) < 2:
            continue
        for report in reports:
            errors_by_name[report.file_name].append(
                NormalizationError(
                    "duplicate_conversation_id",
                    f"`conversation_id` `{conversation_id}` appears in multiple workspace files.",
                )
            )

    for report in initial_reports:
        report_errors = errors_by_name[report.file_name]
        if report.normalized is None or report_errors:
            continue

        parents = report.normalized["lineage"]["parents"]
        for parent in parents:
            parent_reports = conversation_groups.get(parent["conversation_id"])
            if not parent_reports:
                report_errors.append(
                    NormalizationError(
                        "missing_parent_conversation",
                        f"Parent conversation `{parent['conversation_id']}` is missing or invalid.",
                    )
                )
                continue

            if len(parent_reports) > 1:
                report_errors.append(
                    NormalizationError(
                        "ambiguous_parent_conversation",
                        f"Parent conversation `{parent['conversation_id']}` is ambiguous because the workspace contains duplicates.",
                    )
                )
                continue

            parent_normalized = parent_reports[0].normalized
            if parent_normalized is None:
                continue

            parent_messages = {
                message["message_id"]
                for message in parent_normalized["messages"]
                if _is_mapping(message) and _is_non_empty_string(message.get("message_id"))
            }
            if parent["message_id"] not in parent_messages:
                report_errors.append(
                    NormalizationError(
                        "missing_parent_message",
                        f"Parent message `{parent['message_id']}` does not exist in conversation `{parent['conversation_id']}`.",
                    )
                )

    final_reports: list[FileValidationReport] = []
    for report in initial_reports:
        merged_errors = tuple(errors_by_name[report.file_name])
        final_reports.append(
            FileValidationReport(
                file_name=report.file_name,
                kind=report.kind if not merged_errors else "invalid",
                normalized=report.normalized,
                errors=merged_errors,
            )
        )

    return tuple(final_reports)
