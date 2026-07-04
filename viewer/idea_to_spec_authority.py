"""Shared authority-boundary checks for idea-to-spec handoff projections."""

from __future__ import annotations

from typing import Any, Iterable


def authority_boundary_has_disallowed_true(
    boundary: Any,
    *,
    allowed_true_fields: Iterable[str] = (),
) -> str | None:
    """Return the first write-capable authority flag set to literal true."""

    if not isinstance(boundary, dict):
        return None
    allowed = set(allowed_true_fields)
    for key in sorted(boundary):
        if key in allowed:
            continue
        if key.startswith(
            (
                "may_",
                "executes_",
                "opens_",
                "merges_",
                "writes_",
                "accepts_",
                "mutates_",
                "publishes_",
            )
        ) and boundary.get(key) is True:
            return key
    return None
