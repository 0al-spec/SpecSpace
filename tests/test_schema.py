import json
import unittest
from pathlib import Path

from viewer import schema


REPO_ROOT = Path(__file__).resolve().parent.parent
IMPORTED_FIXTURES = sorted((REPO_ROOT / "real_examples" / "import_json").glob("*.json"))
CANONICAL_FIXTURES = sorted((REPO_ROOT / "real_examples" / "canonical_json").glob("*.json"))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class ConversationSchemaTests(unittest.TestCase):
    def test_real_examples_match_imported_root_contract(self) -> None:
        self.assertTrue(IMPORTED_FIXTURES)

        for path in IMPORTED_FIXTURES:
            with self.subTest(path=path.name):
                payload = load_json(path)
                self.assertEqual(schema.classify_conversation(payload), "imported-root")
                self.assertEqual(payload["message_count"], len(payload["messages"]))

    def test_real_examples_preserve_distinct_turn_and_message_ids(self) -> None:
        found_distinct_ids = False

        for path in IMPORTED_FIXTURES:
            payload = load_json(path)
            for message in payload["messages"]:
                if message["turn_id"] != message["message_id"]:
                    found_distinct_ids = True
                    provenance = schema.imported_message_provenance(message)
                    self.assertIn("turn_id", provenance)
                    self.assertIn("source", provenance)
                    self.assertEqual(schema.message_anchor(message), message["message_id"])
                    break

        self.assertTrue(found_distinct_ids)

    def test_canonical_examples_cover_root_branch_and_merge(self) -> None:
        expected = {
            "branch_conversation.json": "canonical-branch",
            "merge_conversation.json": "canonical-merge",
            "root_conversation.json": "canonical-root",
        }
        self.assertEqual({path.name for path in CANONICAL_FIXTURES}, set(expected))

        for path in CANONICAL_FIXTURES:
            with self.subTest(path=path.name):
                payload = load_json(path)
                self.assertEqual(schema.classify_conversation(payload), expected[path.name])

    def test_parent_reference_requires_all_fields(self) -> None:
        self.assertTrue(
            schema.is_parent_reference(
                {
                    "conversation_id": "conv-root",
                    "message_id": "msg-2",
                    "link_type": "branch",
                }
            )
        )
        self.assertFalse(schema.is_parent_reference({"conversation_id": "conv-root"}))


if __name__ == "__main__":
    unittest.main()
