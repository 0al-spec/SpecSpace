"""HTTP request body parsing helpers for viewer API handlers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, BinaryIO


class JsonBodyObjectError(ValueError):
    """Raised when a JSON request body is valid JSON but not an object."""


def read_json_request_body(
    headers: Mapping[str, str],
    body_stream: BinaryIO,
    *,
    allow_empty: bool = False,
) -> Any:
    length = int(headers.get("Content-Length", "0"))
    if length == 0 and allow_empty:
        return {}

    payload = body_stream.read(length)
    return json.loads(payload.decode("utf-8"))


def read_json_object_request_body(
    headers: Mapping[str, str],
    body_stream: BinaryIO,
    *,
    allow_empty: bool = False,
) -> dict[str, Any]:
    decoded = read_json_request_body(headers, body_stream, allow_empty=allow_empty)
    if not isinstance(decoded, dict):
        raise JsonBodyObjectError("top-level value must be an object.")
    return decoded
