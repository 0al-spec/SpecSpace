#!/usr/bin/env python3
"""Minimal JSON dialog viewer server with folder read/write/delete APIs."""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
if __package__ in {None, ""}:  # pragma: no cover - allows running `python viewer/server.py`
    sys.path.insert(0, str(REPO_ROOT))

from viewer import schema  # noqa: E402

NON_BLOCKING_GRAPH_ERROR_CODES = frozenset(
    {
        "missing_parent_conversation",
        "ambiguous_parent_conversation",
        "missing_parent_message",
    }
)


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


def graph_error_is_blocking(error: schema.NormalizationError) -> bool:
    return error.code not in NON_BLOCKING_GRAPH_ERROR_CODES


def base_conversation_kind(normalized: dict[str, Any] | None) -> str:
    if isinstance(normalized, dict):
        return schema.classify_conversation(normalized)
    return "invalid"


def serialize_graph_diagnostics(
    *,
    file_name: str,
    conversation_id: str | None,
    errors: tuple[schema.NormalizationError, ...] | list[schema.NormalizationError],
    scope: str,
    edge_id: str | None = None,
) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for error in errors:
        item: dict[str, Any] = {
            "scope": scope,
            "file_name": file_name,
            "code": error.code,
            "message": error.message,
        }
        if conversation_id is not None:
            item["conversation_id"] = conversation_id
        if edge_id is not None:
            item["edge_id"] = edge_id
        diagnostics.append(item)
    return diagnostics


def build_checkpoint(message: dict[str, Any], index: int) -> dict[str, Any]:
    checkpoint = {
        "message_id": message["message_id"],
        "index": index,
        "role": message["role"],
        "content": message["content"],
        "child_edge_ids": [],
    }
    for field in ("turn_id", "source"):
        value = message.get(field)
        if isinstance(value, str) and value:
            checkpoint[field] = value
    return checkpoint


def sort_graph_diagnostics(diagnostics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        diagnostics,
        key=lambda item: (
            str(item.get("file_name", "")),
            str(item.get("conversation_id", "")),
            str(item.get("scope", "")),
            str(item.get("edge_id", "")),
            str(item.get("code", "")),
            str(item.get("message", "")),
        ),
    )


def build_graph_snapshot(
    discovered: list[tuple[dict[str, Any], dict[str, Any] | None, tuple[schema.NormalizationError, ...]]],
    reports: dict[str, schema.FileValidationReport],
) -> dict[str, Any]:
    diagnostics: list[dict[str, Any]] = []
    blocked_files: list[dict[str, Any]] = []
    nodes_by_conversation: dict[str, dict[str, Any]] = {}
    reports_by_file_name: dict[str, schema.FileValidationReport] = {}
    normalized_reports_by_conversation: dict[str, list[schema.FileValidationReport]] = {}
    checkpoints_by_conversation: dict[str, dict[str, dict[str, Any]]] = {}

    for meta, payload, load_errors in discovered:
        file_name = meta["name"]
        if load_errors or payload is None:
            file_diagnostics = serialize_graph_diagnostics(
                file_name=file_name,
                conversation_id=None,
                errors=load_errors,
                scope="file",
            )
            blocked_files.append(
                {
                    "file_name": file_name,
                    "conversation_id": None,
                    "kind": "invalid",
                    "diagnostics": file_diagnostics,
                }
            )
            diagnostics.extend(file_diagnostics)
            continue

        report = reports[file_name]
        reports_by_file_name[file_name] = report
        normalized = report.normalized
        conversation_id = None
        if isinstance(normalized, dict):
            value = normalized.get("conversation_id")
            if isinstance(value, str):
                conversation_id = value
                normalized_reports_by_conversation.setdefault(value, []).append(report)

        blocking_errors = [error for error in report.errors if graph_error_is_blocking(error)]
        kind = base_conversation_kind(normalized)
        if normalized is None or blocking_errors:
            file_diagnostics = serialize_graph_diagnostics(
                file_name=file_name,
                conversation_id=conversation_id,
                errors=report.errors,
                scope="file",
            )
            blocked_files.append(
                {
                    "file_name": file_name,
                    "conversation_id": conversation_id,
                    "kind": kind,
                    "diagnostics": file_diagnostics,
                }
            )
            diagnostics.extend(file_diagnostics)
            continue

        node_diagnostics = serialize_graph_diagnostics(
            file_name=file_name,
            conversation_id=conversation_id,
            errors=report.errors,
            scope="node",
        )
        checkpoints = [build_checkpoint(message, index) for index, message in enumerate(normalized["messages"])]
        node = {
            "conversation_id": conversation_id,
            "file_name": file_name,
            "kind": kind,
            "title": normalized.get("title", ""),
            "source_file": normalized.get("source_file"),
            "message_count": len(normalized["messages"]),
            "checkpoint_count": len(checkpoints),
            "checkpoints": checkpoints,
            "parent_edge_ids": [],
            "child_edge_ids": [],
            "diagnostics": node_diagnostics,
        }
        nodes_by_conversation[conversation_id] = node
        checkpoints_by_conversation[conversation_id] = {
            checkpoint["message_id"]: checkpoint for checkpoint in checkpoints
        }
        diagnostics.extend(node_diagnostics)

    edges: list[dict[str, Any]] = []
    for file_name, report in sorted(reports_by_file_name.items()):
        normalized = report.normalized
        if normalized is None:
            continue

        conversation_id = normalized.get("conversation_id")
        if not isinstance(conversation_id, str) or conversation_id not in nodes_by_conversation:
            continue

        node = nodes_by_conversation[conversation_id]
        for index, parent in enumerate(normalized["lineage"]["parents"]):
            edge_id = (
                f"{conversation_id}:{index}:{parent['conversation_id']}:{parent['message_id']}:{parent['link_type']}"
            )
            edge_errors: list[schema.NormalizationError] = []
            parent_file_name: str | None = None
            parent_conversation_id = parent["conversation_id"]
            parent_reports = normalized_reports_by_conversation.get(parent_conversation_id, [])

            if not parent_reports:
                edge_errors.append(
                    schema.NormalizationError(
                        "missing_parent_conversation",
                        f"Parent conversation `{parent_conversation_id}` is missing or invalid.",
                    )
                )
            elif len(parent_reports) > 1:
                edge_errors.append(
                    schema.NormalizationError(
                        "ambiguous_parent_conversation",
                        f"Parent conversation `{parent_conversation_id}` is ambiguous because the workspace contains duplicates.",
                    )
                )
            else:
                parent_report = parent_reports[0]
                parent_file_name = parent_report.file_name
                parent_node = nodes_by_conversation.get(parent_conversation_id)
                if parent_node is None:
                    edge_errors.append(
                        schema.NormalizationError(
                            "missing_parent_conversation",
                            f"Parent conversation `{parent_conversation_id}` is missing or invalid.",
                        )
                    )
                else:
                    checkpoint_map = checkpoints_by_conversation[parent_conversation_id]
                    checkpoint = checkpoint_map.get(parent["message_id"])
                    if checkpoint is None:
                        edge_errors.append(
                            schema.NormalizationError(
                                "missing_parent_message",
                                f"Parent message `{parent['message_id']}` does not exist in conversation `{parent_conversation_id}`.",
                            )
                        )
                    else:
                        checkpoint["child_edge_ids"].append(edge_id)
                        parent_node["child_edge_ids"].append(edge_id)

            edge_diagnostics = serialize_graph_diagnostics(
                file_name=file_name,
                conversation_id=conversation_id,
                errors=edge_errors,
                scope="edge",
                edge_id=edge_id,
            )
            node["parent_edge_ids"].append(edge_id)
            edges.append(
                {
                    "edge_id": edge_id,
                    "link_type": parent["link_type"],
                    "parent_conversation_id": parent_conversation_id,
                    "parent_file_name": parent_file_name,
                    "parent_message_id": parent["message_id"],
                    "child_conversation_id": conversation_id,
                    "child_file_name": file_name,
                    "status": "broken" if edge_errors else "resolved",
                    "diagnostics": edge_diagnostics,
                }
            )
            diagnostics.extend(edge_diagnostics)

    nodes = sorted(nodes_by_conversation.values(), key=lambda node: (node["conversation_id"], node["file_name"]))
    for node in nodes:
        node["child_edge_ids"].sort()
        node["parent_edge_ids"].sort()
        for checkpoint in node["checkpoints"]:
            checkpoint["child_edge_ids"].sort()
        node["diagnostics"] = sort_graph_diagnostics(node["diagnostics"])

    blocked_files = sorted(blocked_files, key=lambda item: item["file_name"])
    for blocked in blocked_files:
        blocked["diagnostics"] = sort_graph_diagnostics(blocked["diagnostics"])

    edges = sorted(
        edges,
        key=lambda edge: (
            edge["child_file_name"],
            edge["parent_conversation_id"],
            edge["parent_message_id"],
            edge["link_type"],
        ),
    )
    roots = sorted(node["conversation_id"] for node in nodes if not node["parent_edge_ids"])

    return {
        "nodes": nodes,
        "edges": edges,
        "roots": roots,
        "blocked_files": blocked_files,
        "diagnostics": sort_graph_diagnostics(diagnostics),
    }


def graph_diagnostic_is_blocking(diagnostic: dict[str, Any]) -> bool:
    code = diagnostic.get("code")
    return not isinstance(code, str) or code not in NON_BLOCKING_GRAPH_ERROR_CODES


def split_graph_diagnostics(diagnostics: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    blocking = [item for item in diagnostics if graph_diagnostic_is_blocking(item)]
    non_blocking = [item for item in diagnostics if not graph_diagnostic_is_blocking(item)]
    return {
        "blocking": sort_graph_diagnostics(blocking),
        "non_blocking": sort_graph_diagnostics(non_blocking),
    }


def build_graph_summary(graph: dict[str, Any]) -> dict[str, Any]:
    integrity = split_graph_diagnostics(graph["diagnostics"])
    return {
        "node_count": len(graph["nodes"]),
        "edge_count": len(graph["edges"]),
        "root_count": len(graph["roots"]),
        "blocked_file_count": len(graph["blocked_files"]),
        "diagnostic_count": len(graph["diagnostics"]),
        "blocking_issue_count": len(integrity["blocking"]),
        "non_blocking_issue_count": len(integrity["non_blocking"]),
        "has_blocking_issues": bool(integrity["blocking"]),
    }


def collect_graph_api(dialog_dir: Path) -> dict[str, Any]:
    workspace = collect_workspace_listing(dialog_dir)
    graph = workspace["graph"]
    return {
        "dialog_dir": workspace["dialog_dir"],
        "graph": graph,
        "summary": build_graph_summary(graph),
        "integrity": split_graph_diagnostics(graph["diagnostics"]),
    }


def build_graph_indexes(
    graph: dict[str, Any],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, list[dict[str, Any]]],
]:
    nodes_by_conversation = {
        node["conversation_id"]: node
        for node in graph["nodes"]
        if isinstance(node.get("conversation_id"), str)
    }
    edges_by_id = {
        edge["edge_id"]: edge
        for edge in graph["edges"]
        if isinstance(edge.get("edge_id"), str)
    }
    blocked_by_conversation: dict[str, list[dict[str, Any]]] = {}
    for blocked in graph["blocked_files"]:
        conversation_id = blocked.get("conversation_id")
        if isinstance(conversation_id, str):
            blocked_by_conversation.setdefault(conversation_id, []).append(blocked)
    return nodes_by_conversation, edges_by_id, blocked_by_conversation


def sort_lineage_paths(paths: list[list[str]]) -> list[list[str]]:
    unique_paths = {tuple(path) for path in paths}
    return [list(path) for path in sorted(unique_paths, key=lambda item: (len(item), item))]


def build_lineage_paths(
    conversation_id: str,
    nodes_by_conversation: dict[str, dict[str, Any]],
    edges_by_id: dict[str, dict[str, Any]],
    active_stack: tuple[str, ...] = (),
) -> list[list[str]]:
    if conversation_id in active_stack:
        return [[conversation_id]]

    node = nodes_by_conversation[conversation_id]
    resolved_parent_edges = [
        edges_by_id[edge_id]
        for edge_id in node["parent_edge_ids"]
        if edge_id in edges_by_id
        and edges_by_id[edge_id]["status"] == "resolved"
        and edges_by_id[edge_id]["parent_conversation_id"] in nodes_by_conversation
    ]
    if not resolved_parent_edges:
        return [[conversation_id]]

    paths: list[list[str]] = []
    next_stack = (*active_stack, conversation_id)
    for edge in resolved_parent_edges:
        parent_paths = build_lineage_paths(
            edge["parent_conversation_id"],
            nodes_by_conversation,
            edges_by_id,
            next_stack,
        )
        for parent_path in parent_paths:
            paths.append(parent_path + [conversation_id])
    return sort_lineage_paths(paths)


def build_compile_target(
    graph: dict[str, Any],
    conversation_id: str,
    *,
    scope: str,
    dialog_dir: Path,
    target_message_id: str | None = None,
    checkpoint: dict[str, Any] | None = None,
) -> dict[str, Any]:
    nodes_by_conversation, edges_by_id, _ = build_graph_indexes(graph)
    node = nodes_by_conversation[conversation_id]
    visited_conversations: set[str] = set()
    visited_edges: set[str] = set()
    unresolved_parent_edge_ids: set[str] = set()
    ordered_conversations: list[str] = []

    def visit(current_id: str) -> None:
        if current_id in visited_conversations:
            return
        visited_conversations.add(current_id)
        current_node = nodes_by_conversation[current_id]
        for edge_id in current_node["parent_edge_ids"]:
            edge = edges_by_id.get(edge_id)
            if edge is None:
                continue
            visited_edges.add(edge_id)
            if edge["status"] != "resolved" or edge["parent_conversation_id"] not in nodes_by_conversation:
                unresolved_parent_edge_ids.add(edge_id)
                continue
            visit(edge["parent_conversation_id"])
        ordered_conversations.append(current_id)

    visit(conversation_id)
    lineage_paths = build_lineage_paths(conversation_id, nodes_by_conversation, edges_by_id)
    root_conversation_ids = sorted({path[0] for path in lineage_paths if path})
    merge_parent_conversation_ids = sorted(
        {
            edges_by_id[edge_id]["parent_conversation_id"]
            for edge_id in visited_edges
            if edge_id in edges_by_id and edges_by_id[edge_id]["link_type"] == "merge"
        }
    )
    if target_message_id is not None:
        export_subdir = f"{conversation_id}--{target_message_id}"
    else:
        export_subdir = conversation_id
    export_dir = str(dialog_dir / "export" / export_subdir)

    payload = {
        "scope": scope,
        "target_conversation_id": conversation_id,
        "target_message_id": target_message_id,
        "target_kind": node["kind"],
        "lineage_conversation_ids": ordered_conversations,
        "lineage_edge_ids": sorted(visited_edges),
        "lineage_paths": lineage_paths,
        "root_conversation_ids": root_conversation_ids,
        "merge_parent_conversation_ids": merge_parent_conversation_ids,
        "unresolved_parent_edge_ids": sorted(unresolved_parent_edge_ids),
        "is_lineage_complete": not unresolved_parent_edge_ids,
        "export_dir": export_dir,
    }
    if checkpoint is not None:
        payload["target_checkpoint_index"] = checkpoint["index"]
        payload["target_checkpoint_role"] = checkpoint["role"]
    return payload


def collect_related_diagnostics(
    node: dict[str, Any],
    parent_edges: list[dict[str, Any]],
    child_edges: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    diagnostics = list(node["diagnostics"])
    for edge in parent_edges + child_edges:
        diagnostics.extend(edge["diagnostics"])
    return split_graph_diagnostics(diagnostics)


def collect_conversation_api(dialog_dir: Path, conversation_id: str) -> tuple[int, dict[str, Any]]:
    if not conversation_id:
        return HTTPStatus.BAD_REQUEST, {"error": "conversation_id is required"}

    workspace = collect_workspace_listing(dialog_dir)
    graph = workspace["graph"]
    nodes_by_conversation, edges_by_id, blocked_by_conversation = build_graph_indexes(graph)

    node = nodes_by_conversation.get(conversation_id)
    if node is None:
        blocked_files = blocked_by_conversation.get(conversation_id, [])
        if blocked_files:
            diagnostics = sort_graph_diagnostics(
                [
                    diagnostic
                    for blocked in blocked_files
                    for diagnostic in blocked["diagnostics"]
                ]
            )
            return HTTPStatus.CONFLICT, {
                "error": "Conversation is blocked by validation errors",
                "conversation_id": conversation_id,
                "blocked_files": blocked_files,
                "diagnostics": diagnostics,
            }
        return HTTPStatus.NOT_FOUND, {"error": "Conversation not found", "conversation_id": conversation_id}

    parent_edges = [edges_by_id[edge_id] for edge_id in node["parent_edge_ids"] if edge_id in edges_by_id]
    child_edges = [edges_by_id[edge_id] for edge_id in node["child_edge_ids"] if edge_id in edges_by_id]
    return HTTPStatus.OK, {
        "conversation": node,
        "parent_edges": parent_edges,
        "child_edges": child_edges,
        "compile_target": build_compile_target(graph, conversation_id, scope="conversation", dialog_dir=dialog_dir),
        "integrity": collect_related_diagnostics(node, parent_edges, child_edges),
    }


def collect_checkpoint_api(dialog_dir: Path, conversation_id: str, message_id: str) -> tuple[int, dict[str, Any]]:
    if not conversation_id:
        return HTTPStatus.BAD_REQUEST, {"error": "conversation_id is required"}
    if not message_id:
        return HTTPStatus.BAD_REQUEST, {"error": "message_id is required", "conversation_id": conversation_id}

    workspace = collect_workspace_listing(dialog_dir)
    graph = workspace["graph"]
    nodes_by_conversation, edges_by_id, blocked_by_conversation = build_graph_indexes(graph)

    node = nodes_by_conversation.get(conversation_id)
    if node is None:
        blocked_files = blocked_by_conversation.get(conversation_id, [])
        if blocked_files:
            diagnostics = sort_graph_diagnostics(
                [
                    diagnostic
                    for blocked in blocked_files
                    for diagnostic in blocked["diagnostics"]
                ]
            )
            return HTTPStatus.CONFLICT, {
                "error": "Conversation is blocked by validation errors",
                "conversation_id": conversation_id,
                "message_id": message_id,
                "blocked_files": blocked_files,
                "diagnostics": diagnostics,
            }
        return HTTPStatus.NOT_FOUND, {"error": "Conversation not found", "conversation_id": conversation_id}

    checkpoint = next((item for item in node["checkpoints"] if item["message_id"] == message_id), None)
    if checkpoint is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "Checkpoint not found",
            "conversation_id": conversation_id,
            "message_id": message_id,
        }

    child_edges = [edges_by_id[edge_id] for edge_id in checkpoint["child_edge_ids"] if edge_id in edges_by_id]
    return HTTPStatus.OK, {
        "conversation": node,
        "checkpoint": checkpoint,
        "child_edges": child_edges,
        "compile_target": build_compile_target(
            graph,
            conversation_id,
            scope="checkpoint",
            dialog_dir=dialog_dir,
            target_message_id=message_id,
            checkpoint=checkpoint,
        ),
        "integrity": collect_related_diagnostics(node, [], child_edges),
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
        "graph": build_graph_snapshot(discovered, reports),
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
        if parsed.path == "/api/graph":
            self.handle_graph()
            return
        if parsed.path == "/api/conversation":
            self.handle_get_conversation(parsed)
            return
        if parsed.path == "/api/checkpoint":
            self.handle_get_checkpoint(parsed)
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

    def handle_graph(self) -> None:
        json_response(self, HTTPStatus.OK, collect_graph_api(self.server.dialog_dir))

    def handle_get_conversation(self, parsed) -> None:
        params = parse_qs(parsed.query)
        conversation_id = params.get("conversation_id", [""])[0]
        status, payload = collect_conversation_api(self.server.dialog_dir, conversation_id)
        json_response(self, status, payload)

    def handle_get_checkpoint(self, parsed) -> None:
        params = parse_qs(parsed.query)
        conversation_id = params.get("conversation_id", [""])[0]
        message_id = params.get("message_id", [""])[0]
        status, payload = collect_checkpoint_api(self.server.dialog_dir, conversation_id, message_id)
        json_response(self, status, payload)

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
        dist_dir = self.server.repo_root / "viewer" / "app" / "dist"
        relative = request_path.lstrip("/")

        if not relative:
            path = dist_dir / "index.html"
        else:
            candidate = (dist_dir / relative).resolve()
            if str(candidate).startswith(str(dist_dir.resolve())) and candidate.exists() and not candidate.is_dir():
                path = candidate
            elif "." in relative.split("/")[-1]:
                # Request has a file extension but file not found — 404
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            else:
                # SPA fallback: serve index.html for non-file routes
                path = dist_dir / "index.html"

        if not path.exists():
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

    print(f"Serving ContextBuilder at http://localhost:{args.port}/")
    print(f"Dialog folder: {server.dialog_dir}")
    server.serve_forever()


if __name__ == "__main__":
    main()
