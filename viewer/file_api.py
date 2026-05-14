"""File workspace API handlers for the viewer HTTP server."""

from __future__ import annotations

import json
from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer import schema
from viewer.graph import serialize_errors, serialize_validation
from viewer.http_response import json_response
from viewer.request_query import query_params, query_value


class FileApiHandler(Protocol):
    server: Any
    collect_workspace_listing: Callable[[Path], dict[str, Any]]
    load_json_file: Callable[[Path], tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]]
    validate_write_request: Callable[
        [Path, str, Any, bool],
        tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]],
    ]
    get_workspace_cache: Callable[[Path], Any]

    def read_json_body(self) -> dict[str, Any] | None: ...

    def safe_dialog_path(self, name: str) -> Path | None: ...


def handle_list_files(handler: FileApiHandler) -> None:
    json_response(handler, HTTPStatus.OK, handler.collect_workspace_listing(handler.server.dialog_dir))


def handle_get_file(handler: FileApiHandler, parsed: Any) -> None:
    params = query_params(parsed)
    name = query_value(params, "name", "")
    filename_errors = schema.validate_file_name(name)
    if filename_errors:
        json_response(
            handler,
            HTTPStatus.BAD_REQUEST,
            {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
        )
        return

    path = handler.safe_dialog_path(name)
    if not path or not path.exists():
        json_response(handler, HTTPStatus.NOT_FOUND, {"error": "File not found"})
        return

    data, errors = handler.load_json_file(path)
    if errors or data is None:
        json_response(
            handler,
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {"error": "File contains invalid JSON", "errors": serialize_errors(errors), "name": path.name},
        )
        return

    workspace = handler.collect_workspace_listing(handler.server.dialog_dir)
    file_entry = next((file for file in workspace["files"] if file["name"] == path.name), None)

    json_response(
        handler,
        HTTPStatus.OK,
        {
            "name": path.name,
            "data": data,
            "validation": file_entry["validation"] if file_entry else serialize_validation("invalid", None, ()),
            "workspace_diagnostics": workspace["diagnostics"],
        },
    )


def handle_write_file(handler: FileApiHandler) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return

    name = payload.get("name", "")
    data = payload.get("data")
    overwrite = bool(payload.get("overwrite", False))
    normalized, errors = handler.validate_write_request(handler.server.dialog_dir, name, data, overwrite)
    if errors or normalized is None:
        status = HTTPStatus.CONFLICT if errors and errors[0].code == "file_exists" else HTTPStatus.BAD_REQUEST
        message = "File already exists" if status == HTTPStatus.CONFLICT else "Validation failed"
        json_response(
            handler,
            status,
            {
                "error": message,
                "name": name,
                "errors": serialize_errors(errors),
            },
        )
        return

    path = handler.safe_dialog_path(name)
    if path is None:
        json_response(
            handler,
            HTTPStatus.BAD_REQUEST,
            {
                "error": "Invalid file name",
                "errors": serialize_errors(schema.validate_file_name(name)),
            },
        )
        return

    try:
        path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        json_response(handler, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to write file: {exc}"})
        return

    handler.get_workspace_cache(handler.server.dialog_dir).invalidate()

    validation = schema.validate_conversation(normalized)
    json_response(
        handler,
        HTTPStatus.OK,
        {
            "ok": True,
            "name": path.name,
            "data": normalized,
            "validation": serialize_validation(validation.kind, validation.normalized, validation.errors),
        },
    )


def handle_delete_file(handler: FileApiHandler, parsed: Any) -> None:
    params = query_params(parsed)
    name = query_value(params, "name", "")
    filename_errors = schema.validate_file_name(name)
    if filename_errors:
        json_response(
            handler,
            HTTPStatus.BAD_REQUEST,
            {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
        )
        return

    path = handler.safe_dialog_path(name)
    if not path or not path.exists():
        json_response(handler, HTTPStatus.NOT_FOUND, {"error": "File not found"})
        return

    try:
        path.unlink()
    except Exception as exc:
        json_response(handler, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to delete file: {exc}"})
        return

    handler.get_workspace_cache(handler.server.dialog_dir).invalidate()

    json_response(handler, HTTPStatus.OK, {"ok": True, "name": name})
