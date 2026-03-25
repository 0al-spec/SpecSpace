"""Regression tests for compile-target selection and branch/merge write-validation.

Covers compile-target payload fields and ordering not exercised by
test_api_contracts.py or test_compile.py.
"""
import json
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path

from viewer import server


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_workspace(dialog_dir: Path, payloads: dict[str, dict]) -> None:
    for file_name, payload in payloads.items():
        (dialog_dir / file_name).write_text(json.dumps(payload), encoding="utf-8")


# Conversation IDs from canonical fixtures
ROOT_ID = "conv-trust-social-root"
BRANCH_ID = "conv-trust-social-branding-branch"
MERGE_ID = "conv-contextbuilder-merge"


class CompileTargetKindTests(unittest.TestCase):
    """target_kind reflects the node's conversation kind."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls._dialog_dir = Path(cls._tmp.name)
        write_workspace(
            cls._dialog_dir,
            {
                "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                "merge.json": load_json(CANONICAL_FIXTURES / "merge_conversation.json"),
            },
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def _get_compile_target(self, conversation_id: str) -> dict:
        status, payload = server.collect_conversation_api(self._dialog_dir, conversation_id)
        self.assertEqual(status, HTTPStatus.OK)
        return payload["compile_target"]

    def test_root_target_kind_is_canonical_root(self) -> None:
        ct = self._get_compile_target(ROOT_ID)
        self.assertEqual(ct["target_kind"], "canonical-root")

    def test_branch_target_kind_is_canonical_branch(self) -> None:
        ct = self._get_compile_target(BRANCH_ID)
        self.assertEqual(ct["target_kind"], "canonical-branch")

    def test_merge_target_kind_is_canonical_merge(self) -> None:
        ct = self._get_compile_target(MERGE_ID)
        self.assertEqual(ct["target_kind"], "canonical-merge")


class CompileTargetLineageFieldsTests(unittest.TestCase):
    """root_conversation_ids, merge_parent_conversation_ids, and lineage_conversation_ids."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls._dialog_dir = Path(cls._tmp.name)
        write_workspace(
            cls._dialog_dir,
            {
                "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                "merge.json": load_json(CANONICAL_FIXTURES / "merge_conversation.json"),
            },
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def _ct(self, conversation_id: str) -> dict:
        status, payload = server.collect_conversation_api(self._dialog_dir, conversation_id)
        self.assertEqual(status, HTTPStatus.OK)
        return payload["compile_target"]

    def test_root_conversation_has_itself_as_root_conversation_id(self) -> None:
        ct = self._ct(ROOT_ID)
        self.assertEqual(ct["root_conversation_ids"], [ROOT_ID])

    def test_branch_root_conversation_ids_points_to_root(self) -> None:
        ct = self._ct(BRANCH_ID)
        self.assertEqual(ct["root_conversation_ids"], [ROOT_ID])

    def test_merge_root_conversation_ids_points_to_shared_root(self) -> None:
        ct = self._ct(MERGE_ID)
        # Both branch and merge paths lead to the same root
        self.assertEqual(ct["root_conversation_ids"], [ROOT_ID])

    def test_root_has_no_merge_parent_conversation_ids(self) -> None:
        ct = self._ct(ROOT_ID)
        self.assertEqual(ct["merge_parent_conversation_ids"], [])

    def test_branch_has_no_merge_parent_conversation_ids(self) -> None:
        ct = self._ct(BRANCH_ID)
        self.assertEqual(ct["merge_parent_conversation_ids"], [])

    def test_merge_has_two_merge_parent_conversation_ids(self) -> None:
        ct = self._ct(MERGE_ID)
        self.assertEqual(sorted(ct["merge_parent_conversation_ids"]), sorted([ROOT_ID, BRANCH_ID]))

    def test_root_lineage_conversation_ids_contains_only_root(self) -> None:
        ct = self._ct(ROOT_ID)
        self.assertEqual(ct["lineage_conversation_ids"], [ROOT_ID])

    def test_branch_lineage_conversation_ids_is_ordered_oldest_first(self) -> None:
        ct = self._ct(BRANCH_ID)
        # Root must appear before branch (oldest-first ordering)
        ids = ct["lineage_conversation_ids"]
        self.assertIn(ROOT_ID, ids)
        self.assertIn(BRANCH_ID, ids)
        self.assertLess(ids.index(ROOT_ID), ids.index(BRANCH_ID))

    def test_merge_lineage_conversation_ids_ends_with_merge(self) -> None:
        ct = self._ct(MERGE_ID)
        ids = ct["lineage_conversation_ids"]
        self.assertEqual(ids[-1], MERGE_ID)
        self.assertIn(ROOT_ID, ids)
        self.assertIn(BRANCH_ID, ids)


class CompileTargetCheckpointScopeTests(unittest.TestCase):
    """target_checkpoint_index and target_checkpoint_role are set for checkpoint scope."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls._dialog_dir = Path(cls._tmp.name)
        write_workspace(
            cls._dialog_dir,
            {
                "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                "merge.json": load_json(CANONICAL_FIXTURES / "merge_conversation.json"),
            },
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_checkpoint_scope_has_target_checkpoint_index(self) -> None:
        status, payload = server.collect_checkpoint_api(
            self._dialog_dir, ROOT_ID, "msg-root-2"
        )
        self.assertEqual(status, HTTPStatus.OK)
        ct = payload["compile_target"]
        self.assertIn("target_checkpoint_index", ct)
        self.assertIsInstance(ct["target_checkpoint_index"], int)

    def test_checkpoint_scope_has_target_checkpoint_role(self) -> None:
        status, payload = server.collect_checkpoint_api(
            self._dialog_dir, ROOT_ID, "msg-root-2"
        )
        self.assertEqual(status, HTTPStatus.OK)
        ct = payload["compile_target"]
        self.assertIn("target_checkpoint_role", ct)
        self.assertIsInstance(ct["target_checkpoint_role"], str)
        self.assertTrue(ct["target_checkpoint_role"])

    def test_checkpoint_index_corresponds_to_message_position(self) -> None:
        # msg-root-2 is the second message (index 1)
        status, payload = server.collect_checkpoint_api(
            self._dialog_dir, ROOT_ID, "msg-root-2"
        )
        self.assertEqual(status, HTTPStatus.OK)
        ct = payload["compile_target"]
        self.assertEqual(ct["target_checkpoint_index"], 1)
        self.assertEqual(ct["target_checkpoint_role"], "assistant")

    def test_first_checkpoint_has_index_zero(self) -> None:
        status, payload = server.collect_checkpoint_api(
            self._dialog_dir, ROOT_ID, "msg-root-1"
        )
        self.assertEqual(status, HTTPStatus.OK)
        ct = payload["compile_target"]
        self.assertEqual(ct["target_checkpoint_index"], 0)
        self.assertEqual(ct["target_checkpoint_role"], "user")

    def test_conversation_scope_does_not_have_checkpoint_fields(self) -> None:
        status, payload = server.collect_conversation_api(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        ct = payload["compile_target"]
        self.assertNotIn("target_checkpoint_index", ct)
        self.assertNotIn("target_checkpoint_role", ct)


class CompileTargetDeterminismTests(unittest.TestCase):
    """Compile target export_dir is stable across repeated calls."""

    def test_export_dir_is_identical_on_repeated_calls(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            _, p1 = server.collect_conversation_api(dialog_dir, ROOT_ID)
            _, p2 = server.collect_conversation_api(dialog_dir, ROOT_ID)

        self.assertEqual(p1["compile_target"]["export_dir"], p2["compile_target"]["export_dir"])

    def test_checkpoint_export_dir_is_identical_on_repeated_calls(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            _, p1 = server.collect_checkpoint_api(dialog_dir, ROOT_ID, "msg-root-2")
            _, p2 = server.collect_checkpoint_api(dialog_dir, ROOT_ID, "msg-root-2")

        self.assertEqual(p1["compile_target"]["export_dir"], p2["compile_target"]["export_dir"])

    def test_different_conversations_produce_different_export_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {
                    "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                    "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                },
            )

            _, p_root = server.collect_conversation_api(dialog_dir, ROOT_ID)
            _, p_branch = server.collect_conversation_api(dialog_dir, BRANCH_ID)

        self.assertNotEqual(
            p_root["compile_target"]["export_dir"],
            p_branch["compile_target"]["export_dir"],
        )


class BranchMergeWriteValidationTests(unittest.TestCase):
    """validate_write_request accepts canonical branch and merge payloads."""

    def test_canonical_branch_payload_is_accepted(self) -> None:
        branch_data = {
            "conversation_id": "conv-test-branch",
            "title": "Test Branch",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "branch",
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Parent must be present so workspace validation can resolve the reference.
            write_workspace(
                Path(tmp_dir),
                {"root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json")},
            )
            normalized, errors = server.validate_write_request(
                Path(tmp_dir), "test-branch.json", branch_data, overwrite=False
            )

        self.assertEqual(errors, ())
        self.assertIsNotNone(normalized)
        self.assertEqual(normalized["conversation_id"], "conv-test-branch")

    def test_canonical_merge_payload_is_accepted(self) -> None:
        merge_data = {
            "conversation_id": "conv-test-merge",
            "title": "Test Merge",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                    {
                        "conversation_id": "conv-trust-social-branding-branch",
                        "message_id": "msg-branch-2",
                        "link_type": "merge",
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Both parent conversations must be present in the workspace.
            write_workspace(
                Path(tmp_dir),
                {
                    "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                    "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                },
            )
            normalized, errors = server.validate_write_request(
                Path(tmp_dir), "test-merge.json", merge_data, overwrite=False
            )

        self.assertEqual(errors, ())
        self.assertIsNotNone(normalized)
        self.assertEqual(normalized["conversation_id"], "conv-test-merge")

    def test_branch_payload_with_merge_link_type_is_rejected(self) -> None:
        bad_branch = {
            "conversation_id": "conv-bad-branch",
            "title": "Bad Branch",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",  # wrong — single parent must use "branch"
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            normalized, errors = server.validate_write_request(
                Path(tmp_dir), "bad-branch.json", bad_branch, overwrite=False
            )

        self.assertIsNone(normalized)
        self.assertTrue(errors)
        self.assertIn("invalid_branch_lineage", {e.code for e in errors})


if __name__ == "__main__":
    unittest.main()
