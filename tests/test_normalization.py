import json
import unittest
from pathlib import Path

from viewer import schema


REPO_ROOT = Path(__file__).resolve().parent.parent
IMPORTED_FIXTURES = sorted((REPO_ROOT / "real_examples" / "import_json").glob("*.json"))
CANONICAL_FIXTURES = sorted((REPO_ROOT / "real_examples" / "canonical_json").glob("*.json"))
INVALID_FIXTURES = sorted((REPO_ROOT / "real_examples" / "invalid_json").glob("*.json"))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class ConversationNormalizationTests(unittest.TestCase):
    def test_imported_examples_normalize_to_canonical_roots(self) -> None:
        self.assertTrue(IMPORTED_FIXTURES)

        for path in IMPORTED_FIXTURES:
            with self.subTest(path=path.name):
                payload = load_json(path)
                result = schema.normalize_conversation(payload)
                self.assertEqual(result.kind, "canonical-root")
                self.assertEqual(result.errors, ())
                self.assertIsNotNone(result.normalized)
                self.assertEqual(result.normalized["lineage"]["parents"], [])
                self.assertTrue(result.normalized["conversation_id"].startswith("conv-"))

    def test_normalization_is_deterministic_for_imported_payloads(self) -> None:
        payload = load_json(IMPORTED_FIXTURES[0])

        first = schema.normalize_conversation(payload)
        second = schema.normalize_conversation(payload)

        self.assertEqual(first.kind, "canonical-root")
        self.assertEqual(first.normalized["conversation_id"], second.normalized["conversation_id"])

    def test_canonical_examples_pass_through_without_losing_lineage(self) -> None:
        self.assertTrue(CANONICAL_FIXTURES)

        for path in CANONICAL_FIXTURES:
            with self.subTest(path=path.name):
                payload = load_json(path)
                result = schema.normalize_conversation(payload)
                self.assertEqual(result.kind, schema.classify_conversation(payload))
                self.assertEqual(result.normalized, payload)

    def test_invalid_examples_return_actionable_errors(self) -> None:
        expected_codes = {
            "missing_message_id.json": "missing_message_fields",
            "mismatched_message_count.json": "message_count_mismatch",
        }
        self.assertEqual({path.name for path in INVALID_FIXTURES}, set(expected_codes))

        for path in INVALID_FIXTURES:
            with self.subTest(path=path.name):
                payload = load_json(path)
                result = schema.normalize_conversation(payload)
                self.assertEqual(result.kind, "invalid")
                self.assertIsNone(result.normalized)
                self.assertTrue(result.errors)
                self.assertEqual(result.errors[0].code, expected_codes[path.name])


if __name__ == "__main__":
    unittest.main()
