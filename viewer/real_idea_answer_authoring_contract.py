"""Contract guards for real-idea answer authoring artifacts."""

from __future__ import annotations

from typing import Any


def real_idea_answer_authoring_contract_error(value: Any) -> dict[str, Any] | None:
    record = _record(value)
    mutation_field = _first_true(record.get("authority_boundary"))
    if mutation_field is not None:
        return {
            "reason": "real_idea_answer_authoring_authority_expanded",
            "detail": f"real idea answer authoring cannot claim {mutation_field}.",
            "field": mutation_field,
        }
    mutation_field = _first_true(record.get("privacy_boundary"), prefix="raw_")
    if mutation_field is not None:
        return {
            "reason": "real_idea_answer_authoring_privacy_expanded",
            "detail": f"real idea answer authoring cannot publish {mutation_field}.",
            "field": mutation_field,
        }
    for field in ("canonical_mutations_allowed", "tracked_artifacts_written"):
        if record.get(field) is True:
            return {
                "reason": "real_idea_answer_authoring_authority_expanded",
                "detail": f"{field} must not be true.",
                "field": field,
            }
    return None


def real_idea_answer_set_contract_error(value: Any) -> dict[str, Any] | None:
    record = _record(value)
    for field in ("canonical_mutations_allowed", "tracked_artifacts_written"):
        if record.get(field) is True:
            return {
                "reason": "real_idea_answer_set_authority_expanded",
                "detail": f"{field} must not be true.",
                "field": field,
            }
    raw_field = _nested_raw_field(record.get("answers"))
    if raw_field is not None:
        return {
            "reason": "real_idea_answer_set_raw_field_published",
            "detail": "real idea answer set must not publish raw answer fields.",
            "field": raw_field,
        }
    return None


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _first_true(
    value: Any,
    *,
    prefix: str | None = None,
) -> str | None:
    for key, item in _record(value).items():
        if item is not True:
            continue
        if not isinstance(key, str):
            continue
        if prefix is None or key.startswith(prefix):
            return key
    return None


def _nested_raw_field(value: Any) -> str | None:
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str) and key.startswith("raw_"):
                return key
            found = _nested_raw_field(item)
            if found is not None:
                return found
    if isinstance(value, list):
        for item in value:
            found = _nested_raw_field(item)
            if found is not None:
                return found
    return None
