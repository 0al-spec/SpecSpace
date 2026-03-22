import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from viewer import schema, server


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"
IMPORTED_FIXTURES = REPO_ROOT / "real_examples" / "import_json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_canonical(name: str) -> dict:
    return load_json(CANONICAL_FIXTURES / name)


class ConversationValidationTests(unittest.TestCase):
    def test_canonical_fixtures_pass_validation(self) -> None:
        expected = {
            "root_conversation.json": "canonical-root",
            "branch_conversation.json": "canonical-branch",
            "merge_conversation.json": "canonical-merge",
        }

        for file_name, kind in expected.items():
            with self.subTest(file_name=file_name):
                result = schema.validate_conversation(load_canonical(file_name))
                self.assertEqual(result.kind, kind)
                self.assertEqual(result.errors, ())
                self.assertIsNotNone(result.normalized)

    def test_duplicate_message_ids_are_rejected(self) -> None:
        payload = load_canonical("root_conversation.json")
        payload["messages"].append(deepcopy(payload["messages"][0]))

        result = schema.validate_conversation(payload)

        self.assertEqual(result.kind, "invalid")
        self.assertIn("duplicate_message_ids", {error.code for error in result.errors})

    def test_malformed_lineage_payload_is_rejected(self) -> None:
        payload = load_canonical("branch_conversation.json")
        payload["lineage"] = {"parents": {"conversation_id": "conv-root"}}

        result = schema.validate_conversation(payload)

        self.assertEqual(result.kind, "invalid")
        self.assertIn("invalid_lineage_parents", {error.code for error in result.errors})

    def test_workspace_detects_duplicate_conversation_ids(self) -> None:
        root_payload = load_canonical("root_conversation.json")
        branch_payload = load_canonical("branch_conversation.json")
        branch_payload["conversation_id"] = root_payload["conversation_id"]

        reports = {
            report.file_name: report
            for report in schema.validate_workspace(
                [
                    ("root.json", root_payload),
                    ("branch.json", branch_payload),
                ]
            )
        }

        self.assertIn("duplicate_conversation_id", {error.code for error in reports["root.json"].errors})
        self.assertIn("duplicate_conversation_id", {error.code for error in reports["branch.json"].errors})

    def test_workspace_detects_missing_parent_conversation(self) -> None:
        branch_payload = load_canonical("branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["conversation_id"] = "conv-missing"

        reports = {
            report.file_name: report
            for report in schema.validate_workspace([("branch.json", branch_payload)])
        }

        self.assertIn("missing_parent_conversation", {error.code for error in reports["branch.json"].errors})

    def test_workspace_detects_missing_parent_message(self) -> None:
        root_payload = load_canonical("root_conversation.json")
        branch_payload = load_canonical("branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["message_id"] = "msg-missing"

        reports = {
            report.file_name: report
            for report in schema.validate_workspace(
                [
                    ("root.json", root_payload),
                    ("branch.json", branch_payload),
                ]
            )
        }

        self.assertIn("missing_parent_message", {error.code for error in reports["branch.json"].errors})


class ServerValidationTests(unittest.TestCase):
    def test_workspace_listing_surfaces_diagnostics(self) -> None:
        root_payload = load_canonical("root_conversation.json")
        branch_payload = load_canonical("branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["conversation_id"] = "conv-missing"

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            (dialog_dir / "root.json").write_text(json.dumps(root_payload), encoding="utf-8")
            (dialog_dir / "branch.json").write_text(json.dumps(branch_payload), encoding="utf-8")

            listing = server.collect_workspace_listing(dialog_dir)

        files = {file["name"]: file for file in listing["files"]}
        self.assertTrue(files["root.json"]["validation"]["ok"])
        self.assertFalse(files["branch.json"]["validation"]["ok"])
        self.assertIn(
            "missing_parent_conversation",
            {item["code"] for item in files["branch.json"]["validation"]["errors"]},
        )
        self.assertIn(
            "missing_parent_conversation",
            {item["code"] for item in listing["diagnostics"]},
        )

    def test_validate_write_request_rejects_invalid_filename(self) -> None:
        payload = load_canonical("root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            normalized, errors = server.validate_write_request(Path(tmp_dir), "../bad.json", payload, overwrite=False)

        self.assertIsNone(normalized)
        self.assertEqual(errors[0].code, "invalid_filename")

    def test_validate_write_request_rejects_invalid_payload(self) -> None:
        payload = {
            "title": "Draft branch",
            "message_count": 1,
            "messages": [
                {
                    "role": "user",
                    "content": "This draft is missing message IDs.",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            normalized, errors = server.validate_write_request(Path(tmp_dir), "draft.json", payload, overwrite=False)

        self.assertIsNone(normalized)
        self.assertIn("missing_message_fields", {error.code for error in errors})

    def test_validate_write_request_canonicalizes_imported_roots(self) -> None:
        imported_path = sorted(IMPORTED_FIXTURES.glob("*.json"))[0]
        payload = load_json(imported_path)

        with tempfile.TemporaryDirectory() as tmp_dir:
            normalized, errors = server.validate_write_request(
                Path(tmp_dir),
                "normalized.json",
                payload,
                overwrite=False,
            )

        self.assertEqual(errors, ())
        self.assertIsNotNone(normalized)
        self.assertTrue(normalized["conversation_id"].startswith("conv-"))
        self.assertEqual(normalized["lineage"]["parents"], [])


if __name__ == "__main__":
    unittest.main()
