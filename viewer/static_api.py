"""Static asset and local reveal handlers for the viewer HTTP server."""

from __future__ import annotations

import mimetypes
import subprocess
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer.http_response import json_response
from viewer.request_body import read_json_object_request_body


class StaticApiHandler(Protocol):
    headers: Any
    rfile: Any
    server: Any
    wfile: Any

    def send_error(self, code: int, message: str | None = None) -> None: ...

    def send_header(self, keyword: str, value: str) -> None: ...

    def send_response(self, code: int, message: str | None = None) -> None: ...

    def end_headers(self) -> None: ...


def handle_reveal(handler: StaticApiHandler) -> None:
    """POST /api/reveal — open a file path in Finder (macOS: open -R <path>)."""
    try:
        body = read_json_object_request_body(handler.headers, handler.rfile, allow_empty=True)
        path_str = body.get("path", "")
    except Exception:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Invalid request body"})
        return
    if not path_str:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing path"})
        return
    path = Path(path_str).resolve()
    if not path.exists():
        json_response(handler, HTTPStatus.NOT_FOUND, {"error": f"Path not found: {path}"})
        return
    try:
        subprocess.Popen(["open", "-R", str(path)])
        json_response(handler, HTTPStatus.OK, {"revealed": str(path)})
    except Exception as exc:
        json_response(handler, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})


def handle_static(handler: StaticApiHandler, request_path: str) -> None:
    dist_dir = handler.server.repo_root / "viewer" / "app" / "dist"
    relative = request_path.lstrip("/")

    if not relative:
        path = dist_dir / "index.html"
    else:
        candidate = (dist_dir / relative).resolve()
        if str(candidate).startswith(str(dist_dir.resolve())) and candidate.exists() and not candidate.is_dir():
            path = candidate
        elif "." in relative.split("/")[-1]:
            handler.send_error(HTTPStatus.NOT_FOUND)
            return
        else:
            path = dist_dir / "index.html"

    if not path.exists():
        handler.send_error(HTTPStatus.NOT_FOUND)
        return

    content_type, _ = mimetypes.guess_type(str(path))
    body = path.read_bytes()
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", content_type or "application/octet-stream")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)
