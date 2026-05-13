"""Small SSE helpers for viewer endpoints."""

from __future__ import annotations

from http import HTTPStatus
from typing import Protocol


class ChangeWatcher(Protocol):
    """Polling watcher shape used by viewer SSE streams."""

    def subscribe(self) -> int:
        """Register a stream client and return the current sequence."""

    def unsubscribe(self) -> None:
        """Deregister a stream client."""

    def wait_for_change(self, last_seq: int) -> tuple[bool, int]:
        """Wait until the sequence changes or the keepalive timeout expires."""


def send_sse_headers(handler) -> None:
    """Send the shared SSE response headers."""
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
    handler.send_header("Cache-Control", "no-cache")
    handler.send_header("X-Accel-Buffering", "no")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()


def write_sse_frame(handler, frame: bytes) -> bool:
    """Write one SSE frame and return false when the client disconnected."""
    try:
        handler.wfile.write(frame)
        handler.wfile.flush()
        return True
    except (BrokenPipeError, ConnectionResetError, OSError):
        return False


def stream_change_events(handler, watcher: ChangeWatcher) -> None:
    """Stream standard change events and keepalive comments for a watcher."""
    if not write_sse_frame(handler, b": connected\n\n"):
        return

    last_seq = watcher.subscribe()
    try:
        while True:
            changed, last_seq = watcher.wait_for_change(last_seq)
            frame = b"event: change\ndata: {}\n\n" if changed else b": keepalive\n\n"
            if not write_sse_frame(handler, frame):
                break
    finally:
        watcher.unsubscribe()
