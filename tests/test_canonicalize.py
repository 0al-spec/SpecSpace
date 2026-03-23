"""Tests for viewer/canonicalize.py — apply lineage manifest to produce canonical files."""

import json
import os
import tempfile
import unittest

from viewer.canonicalize import apply_manifest
from viewer import schema


def _write_json(directory: str, name: str, data: dict) -> str:
    path = os.path.join(directory, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    return path


def _source_file(title: str, messages: list[dict]) -> dict:
    return {
        "title": title,
        "source_file": title + ".json",
        "message_count": len(messages),
        "messages": messages,
    }


def _msg(mid: str, role: str = "user", content: str = "hello") -> dict:
    return {"message_id": mid, "role": role, "content": content}


def _manifest(conversations: list[dict]) -> dict:
    return {
        "generated_by": "detect_lineage.py",
        "file_count": len(conversations),
        "root_count": sum(1 for c in conversations if "lineage" not in c),
        "branch_count": sum(1 for c in conversations if "lineage" in c),
        "conversations": conversations,
    }


class TestApplyManifestRoots(unittest.TestCase):
    def test_root_gets_empty_lineage(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            src = _source_file("Root", [_msg("m1"), _msg("m2", "assistant")])
            _write_json(d, "Root.json", src)
            manifest = _manifest([{"file": "Root.json", "conversation_id": "Root", "message_count": 2}])
            _write_json(d, "lineage.json", manifest)

            written, errors = apply_manifest(d, out)

            self.assertEqual(written, 1)
            self.assertEqual(errors, 0)
            with open(os.path.join(out, "Root.json"), encoding="utf-8") as fh:
                result = json.load(fh)
            self.assertEqual(result["conversation_id"], "Root")
            self.assertEqual(result["lineage"], {"parents": []})
            self.assertTrue(schema.is_canonical_conversation(result))

    def test_branch_gets_parent_lineage(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            root_src = _source_file("Root", [_msg("m1"), _msg("m2", "assistant")])
            branch_src = _source_file("Branch", [_msg("m1"), _msg("m2", "assistant"), _msg("m3")])
            _write_json(d, "Root.json", root_src)
            _write_json(d, "Branch.json", branch_src)
            manifest = _manifest([
                {"file": "Root.json", "conversation_id": "Root", "message_count": 2},
                {
                    "file": "Branch.json",
                    "conversation_id": "Branch",
                    "message_count": 3,
                    "lineage": {
                        "parents": [{
                            "conversation_id": "Root",
                            "message_id": "m2",
                            "link_type": "branch",
                        }]
                    },
                },
            ])
            _write_json(d, "lineage.json", manifest)

            written, errors = apply_manifest(d, out)

            self.assertEqual(written, 2)
            self.assertEqual(errors, 0)
            with open(os.path.join(out, "Branch.json"), encoding="utf-8") as fh:
                result = json.load(fh)
            self.assertEqual(result["conversation_id"], "Branch")
            parents = result["lineage"]["parents"]
            self.assertEqual(len(parents), 1)
            self.assertEqual(parents[0]["conversation_id"], "Root")
            self.assertEqual(parents[0]["message_id"], "m2")
            self.assertEqual(parents[0]["link_type"], "branch")
            self.assertTrue(schema.is_canonical_conversation(result))

    def test_output_files_pass_schema_validation(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            src = _source_file("Conv", [_msg("a1"), _msg("a2", "assistant", "reply")])
            _write_json(d, "Conv.json", src)
            manifest = _manifest([{"file": "Conv.json", "conversation_id": "conv-slug", "message_count": 2}])
            _write_json(d, "lineage.json", manifest)

            apply_manifest(d, out)

            with open(os.path.join(out, "Conv.json"), encoding="utf-8") as fh:
                result = json.load(fh)
            validation = schema.validate_conversation(result)
            self.assertEqual(len(validation.errors), 0)

    def test_idempotent(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            src = _source_file("Idem", [_msg("i1")])
            _write_json(d, "Idem.json", src)
            manifest = _manifest([{"file": "Idem.json", "conversation_id": "Idem", "message_count": 1}])
            _write_json(d, "lineage.json", manifest)

            apply_manifest(d, out)
            with open(os.path.join(out, "Idem.json"), encoding="utf-8") as fh:
                first = fh.read()

            apply_manifest(d, out)
            with open(os.path.join(out, "Idem.json"), encoding="utf-8") as fh:
                second = fh.read()

            self.assertEqual(first, second)

    def test_bad_source_file_counts_as_error_does_not_abort(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            good_src = _source_file("Good", [_msg("g1")])
            _write_json(d, "Good.json", good_src)
            # Bad.json is missing entirely
            manifest = _manifest([
                {"file": "Good.json", "conversation_id": "Good", "message_count": 1},
                {"file": "Bad.json", "conversation_id": "Bad", "message_count": 1},
            ])
            _write_json(d, "lineage.json", manifest)

            written, errors = apply_manifest(d, out)

            self.assertEqual(written, 1)
            self.assertEqual(errors, 1)
            self.assertTrue(os.path.exists(os.path.join(out, "Good.json")))
            self.assertFalse(os.path.exists(os.path.join(out, "Bad.json")))

    def test_preserves_original_messages(self):
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as out:
            messages = [_msg("x1", "user", "Hello"), _msg("x2", "assistant", "World")]
            src = _source_file("Preserve", messages)
            _write_json(d, "Preserve.json", src)
            manifest = _manifest([{"file": "Preserve.json", "conversation_id": "Preserve", "message_count": 2}])
            _write_json(d, "lineage.json", manifest)

            apply_manifest(d, out)

            with open(os.path.join(out, "Preserve.json"), encoding="utf-8") as fh:
                result = json.load(fh)
            self.assertEqual(result["messages"][0]["content"], "Hello")
            self.assertEqual(result["messages"][1]["content"], "World")


if __name__ == "__main__":
    unittest.main()
