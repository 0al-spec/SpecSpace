"""HTTP response helpers shared by viewer API handlers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, Protocol


class JsonResponseHandler(Protocol):
    wfile: Any

    def send_response(self, code: int, message: str | None = None) -> None: ...

    def send_header(self, keyword: str, value: str) -> None: ...

    def end_headers(self) -> None: ...


def json_response(
    handler: JsonResponseHandler,
    status: int,
    payload: dict[str, Any],
    *,
    headers: Mapping[str, str] | None = None,
) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    try:
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            handler.send_header(name, value)
        handler.end_headers()
        handler.wfile.write(body)
    except (BrokenPipeError, ConnectionResetError):
        return
