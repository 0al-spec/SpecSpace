import unittest
from urllib.parse import urlparse

from viewer.request_query import query_bool, query_int, query_params, query_value


class RequestQueryTests(unittest.TestCase):
    def test_query_value_returns_first_value_and_default(self) -> None:
        params = query_params(urlparse("/api/recent-runs?limit=10&limit=20"))

        self.assertEqual(query_value(params, "limit", "50"), "10")
        self.assertEqual(query_value(params, "since", None), None)

    def test_query_bool_accepts_numeric_and_text_values(self) -> None:
        params = query_params(urlparse("/api/spec-compile?objective=0&prompt=true&deps=maybe"))

        self.assertFalse(query_bool(params, "objective", True))
        self.assertTrue(query_bool(params, "prompt", False))
        self.assertFalse(query_bool(params, "deps", False))

    def test_query_int_clamps_and_defaults_invalid_values(self) -> None:
        high = query_params(urlparse("/api/spec-compile?depth=99"))
        invalid = query_params(urlparse("/api/spec-compile?depth=wide"))

        self.assertEqual(query_int(high, "depth", 6, 1, 6), 6)
        self.assertEqual(query_int(invalid, "depth", 6, 1, 6), 6)
