#!/usr/bin/env python3
"""Minimal JSON dialog viewer server with folder read/write/delete APIs."""

from __future__ import annotations

import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from viewer import schema
except ImportError:  # pragma: no cover - allows running `python viewer/server.py`
    import schema  # type: ignore[no-redef]


REPO_ROOT = Path(__file__).resolve().parent.parent


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def serialize_errors(errors: tuple[schema.NormalizationError, ...]) -> list[dict[str, str]]:
    return [{"code": error.code, "message": error.message} for error in errors]


def serialize_validation(
    kind: str,
    normalized: dict[str, Any] | None,
    errors: tuple[schema.NormalizationError, ...],
) -> dict[str, Any]:
    conversation_id = None
    if isinstance(normalized, dict):
        value = normalized.get("conversation_id")
        if isinstance(value, str):
            conversation_id = value

    return {
        "ok": not errors,
        "kind": kind,
        "conversation_id": conversation_id,
        "errors": serialize_errors(errors),
    }


def dialog_path_for_name(dialog_dir: Path, name: str) -> Path:
    return (dialog_dir / name).resolve()


def load_json_file(path: Path) -> tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, (schema.NormalizationError("invalid_json", f"Failed to read JSON: {exc}"),)

    if not isinstance(data, dict):
        return None, (schema.NormalizationError("invalid_payload", "Payload must be a JSON object."),)

    return data, ()


def load_workspace_payloads(dialog_dir: Path, exclude_name: str | None = None) -> list[tuple[str, dict[str, Any]]]:
    payloads: list[tuple[str, dict[str, Any]]] = []
    for path in sorted(dialog_dir.glob("*.json")):
        if exclude_name and path.name == exclude_name:
            continue
        payload, errors = load_json_file(path)
        if errors or payload is None:
            continue
        payloads.append((path.name, payload))
    return payloads


def collect_workspace_listing(dialog_dir: Path) -> dict[str, Any]:
    discovered: list[tuple[dict[str, Any], dict[str, Any] | None, tuple[schema.NormalizationError, ...]]] = []
    payloads: list[tuple[str, dict[str, Any]]] = []

    for path in sorted(dialog_dir.glob("*.json")):
        stat = path.stat()
        meta = {
            "name": path.name,
            "size": stat.st_size,
            "modified_at": stat.st_mtime,
        }
        payload, errors = load_json_file(path)
        discovered.append((meta, payload, errors))
        if payload is not None and not errors:
            payloads.append((path.name, payload))

    reports = {report.file_name: report for report in schema.validate_workspace(payloads)}
    files: list[dict[str, Any]] = []
    diagnostics: list[dict[str, str]] = []

    for meta, payload, errors in discovered:
        if errors or payload is None:
            validation = serialize_validation("invalid", None, errors)
        else:
            report = reports[meta["name"]]
            validation = serialize_validation(report.kind, report.normalized, report.errors)

        files.append(
            {
                **meta,
                "kind": validation["kind"],
                "validation": validation,
            }
        )
        for error in validation["errors"]:
            diagnostics.append({"file": meta["name"], **error})

    return {
        "files": files,
        "diagnostics": diagnostics,
        "dialog_dir": str(dialog_dir),
    }


def validate_write_request(
    dialog_dir: Path,
    name: str,
    data: Any,
    overwrite: bool,
) -> tuple[dict[str, Any] | None, tuple[schema.NormalizationError, ...]]:
    filename_errors = schema.validate_file_name(name)
    if filename_errors:
        return None, filename_errors

    if not isinstance(data, dict):
        return None, (schema.NormalizationError("invalid_payload", "`data` must be a JSON object."),)

    path = dialog_path_for_name(dialog_dir.resolve(), name)
    if path.exists() and not overwrite:
        return None, (schema.NormalizationError("file_exists", "File already exists."),)

    payloads = load_workspace_payloads(dialog_dir, exclude_name=name if overwrite else None)
    payloads.append((name, data))
    reports = {report.file_name: report for report in schema.validate_workspace(payloads)}
    candidate = reports[name]

    if candidate.errors:
        return None, candidate.errors

    return candidate.normalized, ()


class ViewerHandler(BaseHTTPRequestHandler):
    server_version = "ContextBuilderViewer/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/files":
            self.handle_list_files()
            return
        if parsed.path == "/api/file":
            self.handle_get_file(parsed)
            return
        self.handle_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.handle_write_file()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.handle_delete_file(parsed)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def handle_list_files(self) -> None:
        json_response(self, HTTPStatus.OK, collect_workspace_listing(self.server.dialog_dir))

    def handle_get_file(self, parsed) -> None:
        params = parse_qs(parsed.query)
        name = params.get("name", [""])[0]
        filename_errors = schema.validate_file_name(name)
        if filename_errors:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
            )
            return

        path = self.safe_dialog_path(name)
        if not path or not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "File not found"})
            return

        data, errors = load_json_file(path)
        if errors or data is None:
            json_response(
                self,
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "File contains invalid JSON", "errors": serialize_errors(errors), "name": path.name},
            )
            return

        workspace = collect_workspace_listing(self.server.dialog_dir)
        file_entry = next((file for file in workspace["files"] if file["name"] == path.name), None)

        json_response(
            self,
            HTTPStatus.OK,
            {
                "name": path.name,
                "data": data,
                "validation": file_entry["validation"] if file_entry else serialize_validation("invalid", None, ()),
                "workspace_diagnostics": workspace["diagnostics"],
            },
        )

    def handle_write_file(self) -> None:
        payload = self.read_json_body()
        if payload is None:
            return

        name = payload.get("name", "")
        data = payload.get("data")
        overwrite = bool(payload.get("overwrite", False))
        normalized, errors = validate_write_request(self.server.dialog_dir, name, data, overwrite)
        if errors or normalized is None:
            status = HTTPStatus.CONFLICT if errors and errors[0].code == "file_exists" else HTTPStatus.BAD_REQUEST
            message = "File already exists" if status == HTTPStatus.CONFLICT else "Validation failed"
            json_response(
                self,
                status,
                {
                    "error": message,
                    "name": name,
                    "errors": serialize_errors(errors),
                },
            )
            return

        path = self.safe_dialog_path(name)
        if path is None:
            json_response(
                self,
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
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to write file: {exc}"})
            return

        validation = schema.validate_conversation(normalized)
        json_response(
            self,
            HTTPStatus.OK,
            {
                "ok": True,
                "name": path.name,
                "data": normalized,
                "validation": serialize_validation(validation.kind, validation.normalized, validation.errors),
            },
        )

    def handle_delete_file(self, parsed) -> None:
        params = parse_qs(parsed.query)
        name = params.get("name", [""])[0]
        filename_errors = schema.validate_file_name(name)
        if filename_errors:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid file name", "errors": serialize_errors(filename_errors)},
            )
            return

        path = self.safe_dialog_path(name)
        if not path or not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "File not found"})
            return

        try:
            path.unlink()
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Failed to delete file: {exc}"})
            return

        json_response(self, HTTPStatus.OK, {"ok": True, "name": name})

    def handle_static(self, request_path: str) -> None:
        relative = request_path.lstrip("/") or "viewer/index.html"
        path = (self.server.repo_root / relative).resolve()
        if not str(path).startswith(str(self.server.repo_root)) or not path.exists() or path.is_dir():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type, _ = mimetypes.guess_type(str(path))
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length)
            decoded = json.loads(payload.decode("utf-8"))
        except Exception as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})
            return None

        if not isinstance(decoded, dict):
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid JSON body: top-level value must be an object."},
            )
            return None

        return decoded

    def safe_dialog_path(self, name: str) -> Path | None:
        if schema.validate_file_name(name):
            return None
        path = dialog_path_for_name(self.server.dialog_dir.resolve(), name)
        if not str(path).startswith(str(self.server.dialog_dir.resolve())):
            return None
        return path

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--dialog-dir", type=Path, required=True)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ViewerHandler)
    server.repo_root = REPO_ROOT
    server.dialog_dir = args.dialog_dir.resolve()
    server.dialog_dir.mkdir(parents=True, exist_ok=True)

    print(f"Serving ContextBuilder at http://localhost:{args.port}/viewer/index.html")
    print(f"Dialog folder: {server.dialog_dir}")
    server.serve_forever()


if __name__ == "__main__":
    main()
