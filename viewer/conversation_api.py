"""Conversation graph API handlers for the viewer HTTP server."""

from __future__ import annotations

from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol

from viewer.http_response import json_response
from viewer.request_query import query_params, query_value


class ConversationApiHandler(Protocol):
    server: Any
    collect_checkpoint_api: Callable[[Path, str, str], tuple[int, dict[str, Any]]]
    collect_conversation_api: Callable[[Path, str], tuple[int, dict[str, Any]]]
    collect_graph_api: Callable[[Path], dict[str, Any]]
    compile_graph_nodes: Callable[[Path, str, str | None, str], tuple[int, dict[str, Any]]]
    export_graph_nodes: Callable[[Path, str, str | None], tuple[int, dict[str, Any]]]

    def read_json_body(self) -> dict[str, Any] | None: ...


def handle_graph(handler: ConversationApiHandler) -> None:
    json_response(handler, HTTPStatus.OK, handler.collect_graph_api(handler.server.dialog_dir))


def handle_get_conversation(handler: ConversationApiHandler, parsed: Any) -> None:
    params = query_params(parsed)
    conversation_id = query_value(params, "conversation_id", "")
    status, payload = handler.collect_conversation_api(handler.server.dialog_dir, conversation_id)
    json_response(handler, status, payload)


def handle_get_checkpoint(handler: ConversationApiHandler, parsed: Any) -> None:
    params = query_params(parsed)
    conversation_id = query_value(params, "conversation_id", "")
    message_id = query_value(params, "message_id", "")
    status, payload = handler.collect_checkpoint_api(handler.server.dialog_dir, conversation_id, message_id)
    json_response(handler, status, payload)


def handle_export(handler: ConversationApiHandler) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    conversation_id = payload.get("conversation_id", "")
    message_id = payload.get("message_id") or None
    status, response = handler.export_graph_nodes(handler.server.dialog_dir, conversation_id, message_id)
    json_response(handler, status, response)


def handle_compile(handler: ConversationApiHandler) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    conversation_id = payload.get("conversation_id", "")
    message_id = payload.get("message_id") or None
    status, response = handler.compile_graph_nodes(
        handler.server.dialog_dir,
        conversation_id,
        message_id,
        handler.server.hyperprompt_binary,
    )
    json_response(handler, status, response)
