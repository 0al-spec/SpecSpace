import io
import unittest

from viewer.request_body import JsonBodyObjectError, read_json_object_request_body


def headers_for(body: bytes) -> dict[str, str]:
    return {"Content-Length": str(len(body))}


class RequestBodyTests(unittest.TestCase):
    def test_reads_json_object(self) -> None:
        body = b'{"name":"graph.json"}'

        payload = read_json_object_request_body(headers_for(body), io.BytesIO(body))

        self.assertEqual(payload, {"name": "graph.json"})

    def test_allow_empty_returns_empty_object(self) -> None:
        payload = read_json_object_request_body({}, io.BytesIO(b""), allow_empty=True)

        self.assertEqual(payload, {})

    def test_rejects_non_object_json(self) -> None:
        body = b"[]"

        with self.assertRaises(JsonBodyObjectError):
            read_json_object_request_body(headers_for(body), io.BytesIO(body))
