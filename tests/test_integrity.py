"""Regression tests for schema validation and graph integrity failure paths.

Covers every error code emitted by collect_normalization_errors,
collect_canonical_validation_errors, and validate_file_name that is not
already exercised by test_validation.py, test_normalization.py, or test_graph.py.
"""
import unittest
from copy import deepcopy

from viewer import schema


# ---------------------------------------------------------------------------
# Minimal valid payloads used as mutation bases
# ---------------------------------------------------------------------------

_VALID_IMPORTED: dict = {
    "title": "Imported Root",
    "source_file": "/examples/chat.html",
    "message_count": 1,
    "messages": [
        {"message_id": "msg-1", "role": "user", "content": "Hello."},
    ],
}

_VALID_CANONICAL_ROOT: dict = {
    "conversation_id": "conv-root",
    "title": "Root",
    "messages": [
        {"message_id": "msg-1", "role": "user", "content": "Hello."},
    ],
    "lineage": {"parents": []},
}

_VALID_CANONICAL_BRANCH: dict = {
    "conversation_id": "conv-branch",
    "title": "Branch",
    "messages": [
        {"message_id": "msg-b1", "role": "user", "content": "Continue."},
    ],
    "lineage": {
        "parents": [
            {"conversation_id": "conv-root", "message_id": "msg-1", "link_type": "branch"},
        ]
    },
}

_VALID_CANONICAL_MERGE: dict = {
    "conversation_id": "conv-merge",
    "title": "Merge",
    "messages": [
        {"message_id": "msg-m1", "role": "user", "content": "Merge."},
    ],
    "lineage": {
        "parents": [
            {"conversation_id": "conv-root", "message_id": "msg-1", "link_type": "merge"},
            {"conversation_id": "conv-branch", "message_id": "msg-b1", "link_type": "merge"},
        ]
    },
}


def _errors(payload: dict) -> set[str]:
    """Return the set of error codes from collect_canonical_validation_errors."""
    return {e.code for e in schema.collect_canonical_validation_errors(payload)}


def _norm_errors(payload: dict) -> set[str]:
    """Return the set of error codes from collect_normalization_errors."""
    return {e.code for e in schema.collect_normalization_errors(payload)}


# ---------------------------------------------------------------------------
# validate_file_name
# ---------------------------------------------------------------------------

class FileNameValidationTests(unittest.TestCase):
    def test_valid_json_filename_passes(self) -> None:
        self.assertEqual(schema.validate_file_name("chat.json"), ())

    def test_empty_string_is_invalid(self) -> None:
        codes = {e.code for e in schema.validate_file_name("")}
        self.assertIn("invalid_filename", codes)

    def test_non_json_extension_is_invalid(self) -> None:
        codes = {e.code for e in schema.validate_file_name("chat.txt")}
        self.assertIn("invalid_filename", codes)

    def test_forward_slash_is_invalid(self) -> None:
        codes = {e.code for e in schema.validate_file_name("sub/chat.json")}
        self.assertIn("invalid_filename", codes)

    def test_backslash_is_invalid(self) -> None:
        codes = {e.code for e in schema.validate_file_name("sub\\chat.json")}
        self.assertIn("invalid_filename", codes)


# ---------------------------------------------------------------------------
# collect_normalization_errors — imported-root validation
# ---------------------------------------------------------------------------

class NormalizationErrorTests(unittest.TestCase):
    def test_non_mapping_payload_is_invalid(self) -> None:
        codes = _norm_errors([])  # type: ignore[arg-type]
        self.assertIn("invalid_payload", codes)

    def test_missing_top_level_fields_are_reported(self) -> None:
        payload = {"title": "T", "message_count": 0, "messages": []}
        # missing "source_file"
        codes = _norm_errors(payload)
        self.assertIn("missing_top_level_fields", codes)

    def test_messages_not_a_list_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"] = "not a list"
        codes = _norm_errors(payload)
        self.assertIn("invalid_messages", codes)

    def test_message_not_a_dict_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"] = ["not a dict"]
        payload["message_count"] = 1
        codes = _norm_errors(payload)
        self.assertIn("invalid_message_payload", codes)

    def test_message_empty_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"][0]["message_id"] = ""
        codes = _norm_errors(payload)
        self.assertIn("invalid_message_id", codes)

    def test_message_non_string_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"][0]["message_id"] = 42
        codes = _norm_errors(payload)
        self.assertIn("invalid_message_id", codes)

    def test_message_empty_role_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"][0]["role"] = ""
        codes = _norm_errors(payload)
        self.assertIn("invalid_message_role", codes)

    def test_message_non_string_content_is_reported(self) -> None:
        payload = deepcopy(_VALID_IMPORTED)
        payload["messages"][0]["content"] = None
        codes = _norm_errors(payload)
        self.assertIn("invalid_message_content", codes)


# ---------------------------------------------------------------------------
# collect_canonical_validation_errors — canonical-conversation validation
# ---------------------------------------------------------------------------

class CanonicalValidationErrorTests(unittest.TestCase):
    def test_non_mapping_payload_is_invalid(self) -> None:
        codes = _errors([])  # type: ignore[arg-type]
        self.assertIn("invalid_payload", codes)

    def test_missing_canonical_fields_are_reported(self) -> None:
        payload = {"title": "T", "messages": [], "lineage": {"parents": []}}
        # missing "conversation_id"
        codes = _errors(payload)
        self.assertIn("missing_canonical_fields", codes)

    def test_empty_conversation_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["conversation_id"] = ""
        codes = _errors(payload)
        self.assertIn("invalid_conversation_id", codes)

    def test_non_string_title_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["title"] = 42
        codes = _errors(payload)
        self.assertIn("invalid_title", codes)

    def test_messages_not_a_list_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"] = "not a list"
        codes = _errors(payload)
        self.assertIn("invalid_messages", codes)

    def test_message_not_a_dict_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"] = ["not a dict"]
        codes = _errors(payload)
        self.assertIn("invalid_message_payload", codes)

    def test_message_empty_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"][0]["message_id"] = ""
        codes = _errors(payload)
        self.assertIn("invalid_message_id", codes)

    def test_message_empty_role_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"][0]["role"] = ""
        codes = _errors(payload)
        self.assertIn("invalid_message_role", codes)

    def test_message_non_string_content_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"][0]["content"] = 123
        codes = _errors(payload)
        self.assertIn("invalid_message_content", codes)

    def test_lineage_not_a_dict_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["lineage"] = "not a dict"
        codes = _errors(payload)
        self.assertIn("invalid_lineage", codes)

    def test_lineage_parents_not_a_list_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["lineage"] = {"parents": "not a list"}
        codes = _errors(payload)
        self.assertIn("invalid_lineage_parents", codes)

    def test_parent_reference_not_a_dict_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"] = ["not a dict"]
        codes = _errors(payload)
        self.assertIn("invalid_parent_reference", codes)

    def test_parent_reference_missing_fields_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"] = [{"conversation_id": "conv-root"}]
        codes = _errors(payload)
        self.assertIn("invalid_parent_reference", codes)

    def test_parent_reference_empty_conversation_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"][0]["conversation_id"] = ""
        codes = _errors(payload)
        self.assertIn("invalid_parent_reference", codes)

    def test_parent_reference_empty_message_id_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"][0]["message_id"] = ""
        codes = _errors(payload)
        self.assertIn("invalid_parent_reference", codes)

    def test_unsupported_link_type_is_reported(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"][0]["link_type"] = "unknown"
        codes = _errors(payload)
        self.assertIn("invalid_parent_link_type", codes)

    def test_duplicate_parent_reference_is_reported(self) -> None:
        parent = {"conversation_id": "conv-root", "message_id": "msg-1", "link_type": "merge"}
        payload = deepcopy(_VALID_CANONICAL_MERGE)
        payload["lineage"]["parents"] = [parent, deepcopy(parent)]
        codes = _errors(payload)
        self.assertIn("duplicate_parent_reference", codes)

    def test_single_parent_with_merge_link_type_is_invalid(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_BRANCH)
        payload["lineage"]["parents"][0]["link_type"] = "merge"
        codes = _errors(payload)
        self.assertIn("invalid_branch_lineage", codes)

    def test_multi_parent_with_branch_link_type_is_invalid(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_MERGE)
        for parent in payload["lineage"]["parents"]:
            parent["link_type"] = "branch"
        codes = _errors(payload)
        self.assertIn("invalid_merge_lineage", codes)

    def test_valid_root_produces_no_errors(self) -> None:
        self.assertEqual(_errors(deepcopy(_VALID_CANONICAL_ROOT)), set())

    def test_valid_branch_produces_no_errors(self) -> None:
        self.assertEqual(_errors(deepcopy(_VALID_CANONICAL_BRANCH)), set())

    def test_valid_merge_produces_no_errors(self) -> None:
        self.assertEqual(_errors(deepcopy(_VALID_CANONICAL_MERGE)), set())


# ---------------------------------------------------------------------------
# validate_conversation — dispatch and integration
# ---------------------------------------------------------------------------

class ValidateConversationDispatchTests(unittest.TestCase):
    def test_valid_imported_root_normalises_to_canonical_root(self) -> None:
        result = schema.validate_conversation(deepcopy(_VALID_IMPORTED))
        self.assertEqual(result.kind, "canonical-root")
        self.assertEqual(result.errors, ())
        self.assertIsNotNone(result.normalized)

    def test_invalid_imported_payload_returns_errors(self) -> None:
        payload = {"title": "T", "messages": [], "message_count": 0}
        # missing "source_file"
        result = schema.validate_conversation(payload)
        self.assertEqual(result.kind, "invalid")
        self.assertTrue(result.errors)

    def test_valid_canonical_branch_passes_without_errors(self) -> None:
        result = schema.validate_conversation(deepcopy(_VALID_CANONICAL_BRANCH))
        self.assertEqual(result.kind, "canonical-branch")
        self.assertEqual(result.errors, ())

    def test_canonical_with_invalid_message_returns_errors(self) -> None:
        payload = deepcopy(_VALID_CANONICAL_ROOT)
        payload["messages"][0]["message_id"] = ""
        result = schema.validate_conversation(payload)
        self.assertEqual(result.kind, "invalid")
        codes = {e.code for e in result.errors}
        self.assertIn("invalid_message_id", codes)


if __name__ == "__main__":
    unittest.main()
