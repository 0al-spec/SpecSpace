import io
import json
import unittest
from http import HTTPStatus

from viewer.http_response import json_response


class FakeHandler:
    def __init__(self) -> None:
        self.status: int | None = None
        self.headers: list[tuple[str, str]] = []
        self.ended = False
        self.wfile = io.BytesIO()

    def send_response(self, status: int) -> None:
        self.status = status

    def send_header(self, name: str, value: str) -> None:
        self.headers.append((name, value))

    def end_headers(self) -> None:
        self.ended = True


class HttpResponseTests(unittest.TestCase):
    def test_json_response_writes_utf8_json_with_content_length(self) -> None:
        handler = FakeHandler()

        json_response(handler, HTTPStatus.OK, {"message": "Привет"})

        body = handler.wfile.getvalue()
        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertTrue(handler.ended)
        self.assertIn(("Content-Type", "application/json; charset=utf-8"), handler.headers)
        self.assertIn(("Content-Length", str(len(body))), handler.headers)
        self.assertEqual(json.loads(body), {"message": "Привет"})
