"""HTTP query string parsing helpers for viewer API handlers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import overload
from urllib.parse import ParseResult, parse_qs

QueryParams = Mapping[str, list[str]]


def query_params(parsed: ParseResult) -> dict[str, list[str]]:
    return parse_qs(parsed.query or "")


@overload
def query_value(params: QueryParams, name: str, default: str = "") -> str: ...


@overload
def query_value(params: QueryParams, name: str, default: None) -> str | None: ...


def query_value(params: QueryParams, name: str, default: str | None = "") -> str | None:
    values = params.get(name)
    if not values:
        return default
    return values[0]


def query_bool(params: QueryParams, name: str, default: bool) -> bool:
    value = query_value(params, name, "")
    if not isinstance(value, str):
        return default
    if value == "1" or value.lower() == "true":
        return True
    if value == "0" or value.lower() == "false":
        return False
    return default


def query_int(params: QueryParams, name: str, default: int, min_value: int, max_value: int) -> int:
    value = query_value(params, name, "")
    try:
        parsed = int(value) if isinstance(value, str) else default
    except ValueError:
        return default
    return max(min_value, min(max_value, parsed))
