"""Regression tests for Markdown export, .hc generation, and compile_graph_nodes.

Covers export_graph_nodes, generate_hc_root, _render_node_markdown, and
compile_graph_nodes, which are not exercised by test_compile.py.
"""
import json
import os
import stat
import tempfile
import textwrap
import unittest
from http import HTTPStatus
from pathlib import Path

from viewer import server


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"

ROOT_ID = "conv-trust-social-root"
BRANCH_ID = "conv-trust-social-branding-branch"
MERGE_ID = "conv-contextbuilder-merge"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_workspace(dialog_dir: Path, payloads: dict[str, dict]) -> None:
    for name, payload in payloads.items():
        (dialog_dir / name).write_text(json.dumps(payload), encoding="utf-8")


def make_stub_binary(directory: Path, exit_code: int = 0, write_output: bool = True) -> str:
    """Create a minimal shell stub that mimics the Hyperprompt CLI contract."""
    if write_output:
        script = textwrap.dedent("""\
            #!/bin/sh
            out=""
            manifest=""
            while [ $# -gt 0 ]; do
                case "$1" in
                    --output) shift; out="$1" ;;
                    --manifest) shift; manifest="$1" ;;
                esac
                shift
            done
            [ -n "$out" ] && echo "# compiled" > "$out"
            [ -n "$manifest" ] && echo '{}' > "$manifest"
            exit 0
        """)
    else:
        script = f"#!/bin/sh\nexit {exit_code}\n"
    stub = directory / "hp_stub"
    stub.write_text(script, encoding="utf-8")
    stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
    return str(stub)


def make_structure_validating_stub_binary(directory: Path) -> str:
    """Stub compiler that fails with exit 2 when root.hc has multiple depth-0 nodes."""
    script = textwrap.dedent("""\
        #!/bin/sh
        hc="$1"
        shift
        out=""
        manifest=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --output) shift; out="$1" ;;
                --manifest) shift; manifest="$1" ;;
            esac
            shift
        done

        roots=0
        while IFS= read -r line || [ -n "$line" ]; do
            case "$line" in
                ""|\\#*) continue ;;
                " "*) continue ;;
                *) roots=$((roots + 1)) ;;
            esac
        done < "$hc"

        if [ "$roots" -ne 1 ]; then
            echo "Multiple root nodes (depth 0) found." >&2
            exit 2
        fi

        [ -n "$out" ] && echo "# compiled" > "$out"
        [ -n "$manifest" ] && echo '{}' > "$manifest"
        exit 0
    """)
    stub = directory / "hp_structure_stub"
    stub.write_text(script, encoding="utf-8")
    stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
    return str(stub)


# ---------------------------------------------------------------------------
# _render_node_markdown
# ---------------------------------------------------------------------------

class RenderNodeMarkdownTests(unittest.TestCase):
    def _checkpoint(self, **kwargs) -> dict:
        base = {
            "message_id": "msg-1",
            "role": "user",
            "content": "Hello world.",
            "index": 0,
        }
        base.update(kwargs)
        return base

    def test_output_contains_provenance_comment(self) -> None:
        md = server._render_node_markdown("conv-root", self._checkpoint())
        self.assertIn("<!-- ", md)
        self.assertIn("conversation_id: conv-root", md)
        self.assertIn("message_id: msg-1", md)
        self.assertIn("role: user", md)

    def test_output_contains_content_after_comment(self) -> None:
        md = server._render_node_markdown("conv-root", self._checkpoint())
        comment_end = md.index("-->")
        content_part = md[comment_end:]
        self.assertIn("Hello world.", content_part)

    def test_turn_id_and_source_appear_when_present(self) -> None:
        cp = self._checkpoint(turn_id="turn-1", source="s1")
        md = server._render_node_markdown("conv-root", cp)
        self.assertIn("turn_id: turn-1", md)
        self.assertIn("source: s1", md)

    def test_turn_id_and_source_absent_when_not_present(self) -> None:
        md = server._render_node_markdown("conv-root", self._checkpoint())
        self.assertNotIn("turn_id:", md)
        self.assertNotIn("source:", md)

    def test_output_ends_with_newline(self) -> None:
        md = server._render_node_markdown("conv-root", self._checkpoint())
        self.assertTrue(md.endswith("\n"))


# ---------------------------------------------------------------------------
# generate_hc_root
# ---------------------------------------------------------------------------

class GenerateHcRootTests(unittest.TestCase):
    def test_output_starts_with_header_line(self) -> None:
        result = server.generate_hc_root([], {})
        self.assertIn("# ContextBuilder export", result)

    def test_output_contains_conversation_title(self) -> None:
        conversations = [
            {"conversation_id": "conv-root", "files": ["0000_msg-1.md"]},
        ]
        result = server.generate_hc_root(conversations, {"conv-root": "Root Title"})
        self.assertIn('"Root Title"', result)

    def test_output_contains_node_file_paths(self) -> None:
        conversations = [
            {"conversation_id": "conv-root", "files": ["0000_msg-1.md", "0001_msg-2.md"]},
        ]
        result = server.generate_hc_root(conversations, {"conv-root": "Root"})
        self.assertIn('"nodes/conv-root/0000_msg-1.md"', result)
        self.assertIn('"nodes/conv-root/0001_msg-2.md"', result)

    def test_multiple_conversations_appear_in_order(self) -> None:
        conversations = [
            {"conversation_id": "conv-a", "files": ["0000_msg-1.md"]},
            {"conversation_id": "conv-b", "files": ["0000_msg-b1.md"]},
        ]
        result = server.generate_hc_root(
            conversations, {"conv-a": "A", "conv-b": "B"}
        )
        pos_a = result.index('"nodes/conv-a/')
        pos_b = result.index('"nodes/conv-b/')
        self.assertLess(pos_a, pos_b)

    def test_falls_back_to_conv_id_when_title_missing(self) -> None:
        conversations = [
            {"conversation_id": "conv-root", "files": ["0000_msg-1.md"]},
        ]
        result = server.generate_hc_root(conversations, {})
        self.assertIn('"conv-root"', result)

    def test_zero_file_conversation_is_omitted_from_hc(self) -> None:
        conversations = [
            {"conversation_id": "conv-parent", "files": ["0000_msg-1.md"]},
            {"conversation_id": "conv-branch", "files": []},
        ]
        result = server.generate_hc_root(
            conversations, {"conv-parent": "Parent", "conv-branch": "Testing"}
        )
        self.assertNotIn('"Testing"', result)
        self.assertNotIn('"conv-branch"', result)
        self.assertIn('"nodes/conv-parent/0000_msg-1.md"', result)

    def test_all_zero_file_conversations_produces_root_only(self) -> None:
        conversations = [
            {"conversation_id": "conv-branch", "files": []},
        ]
        result = server.generate_hc_root(
            conversations, {"conv-branch": "Testing"}
        )
        non_comment_lines = [
            line for line in result.splitlines() if line and not line.lstrip().startswith("#")
        ]
        self.assertEqual(non_comment_lines, ['"ContextBuilder export root"'])

    def test_depth_zero_root_still_single_with_zero_file_conv(self) -> None:
        conversations = [
            {"conversation_id": "conv-a", "files": ["0000_msg-a.md"]},
            {"conversation_id": "conv-b", "files": []},
        ]
        result = server.generate_hc_root(
            conversations, {"conv-a": "A", "conv-b": "Testing"}
        )
        non_comment_lines = [
            line for line in result.splitlines() if line and not line.lstrip().startswith("#")
        ]
        depth_zero = [line for line in non_comment_lines if not line.startswith(" ")]
        self.assertEqual(len(depth_zero), 1)

    def test_output_contains_provenance_section_when_provided(self) -> None:
        conversations = [
            {"conversation_id": "conv-root", "files": ["0000_msg-1.md"]},
        ]
        result = server.generate_hc_root(
            conversations,
            {"conv-root": "Root"},
            provenance_file="provenance.md",
        )
        self.assertIn('"ContextBuilder compile provenance"', result)
        self.assertIn('"provenance.md"', result)

    def test_output_has_exactly_one_depth_zero_root_node(self) -> None:
        conversations = [
            {"conversation_id": "conv-a", "files": ["0000_msg-a.md"]},
            {"conversation_id": "conv-b", "files": ["0000_msg-b.md"]},
        ]
        result = server.generate_hc_root(
            conversations, {"conv-a": "A", "conv-b": "B"}, provenance_file="provenance.md"
        )
        non_comment_lines = [
            line for line in result.splitlines() if line and not line.lstrip().startswith("#")
        ]
        depth_zero = [line for line in non_comment_lines if not line.startswith(" ")]
        self.assertEqual(len(depth_zero), 1)
        self.assertEqual(depth_zero[0], '"ContextBuilder export root"')


# ---------------------------------------------------------------------------
# export_graph_nodes
# ---------------------------------------------------------------------------

class ExportGraphNodesTests(unittest.TestCase):
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

    def test_successful_export_returns_200(self) -> None:
        status, _ = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)

    def test_export_dir_exists_after_export(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(Path(payload["export_dir"]).exists())

    def test_nodes_subdirectory_exists_with_conv_folder(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        nodes_dir = Path(payload["export_dir"]) / "nodes" / ROOT_ID
        self.assertTrue(nodes_dir.is_dir())

    def test_exported_files_follow_naming_convention(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        nodes_dir = Path(payload["export_dir"]) / "nodes" / ROOT_ID
        for fname in nodes_dir.iterdir():
            name = fname.name
            # Must match {4-digit-index}_{message_id}.md
            self.assertTrue(name.endswith(".md"), f"Unexpected filename: {name}")
            self.assertTrue(name[:4].isdigit(), f"Filename must start with 4-digit index: {name}")

    def test_node_count_matches_conversation_messages(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        expected_count = len(root_payload["messages"])
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        # node_count for root-only export should match root message count
        root_conv = next(c for c in payload["conversations"] if c["conversation_id"] == ROOT_ID)
        self.assertEqual(len(root_conv["files"]), expected_count)

    def test_hc_file_is_created(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(Path(payload["hc_file"]).exists())
        self.assertEqual(Path(payload["hc_file"]).name, "root.hc")

    def test_hc_file_references_exported_node_files(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        hc_content = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertIn("# ContextBuilder export", hc_content)
        self.assertIn(f"nodes/{ROOT_ID}/", hc_content)

    def test_export_writes_provenance_sidecar_files(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn("provenance_json", payload)
        self.assertIn("provenance_md", payload)
        self.assertTrue(Path(payload["provenance_json"]).exists())
        self.assertTrue(Path(payload["provenance_md"]).exists())

    def test_provenance_json_contains_target_and_source_files(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, BRANCH_ID)
        self.assertEqual(status, HTTPStatus.OK)

        provenance = json.loads(Path(payload["provenance_json"]).read_text(encoding="utf-8"))
        self.assertEqual(provenance["schema"], "contextbuilder.compile_provenance.v1")
        self.assertEqual(provenance["target"]["conversation_id"], BRANCH_ID)
        self.assertIsNone(provenance["target"]["message_id"])

        source_ids = [item["conversation_id"] for item in provenance["source_conversations"]]
        self.assertIn(ROOT_ID, source_ids)
        self.assertIn(BRANCH_ID, source_ids)

    def test_branch_export_includes_root_in_lineage(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, BRANCH_ID)
        self.assertEqual(status, HTTPStatus.OK)
        conv_ids = {c["conversation_id"] for c in payload["conversations"]}
        self.assertIn(ROOT_ID, conv_ids)
        self.assertIn(BRANCH_ID, conv_ids)

    def test_re_export_wipes_previous_output(self) -> None:
        """A second export must produce the same files, not accumulate stale ones."""
        server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        nodes_dir = Path(payload["export_dir"]) / "nodes" / ROOT_ID
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        self.assertEqual(len(list(nodes_dir.iterdir())), len(root_payload["messages"]))

    def test_sentinel_written_on_first_export(self) -> None:
        """Export must create the sentinel file in export_dir."""
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        sentinel = Path(payload["export_dir"]) / server.EXPORT_SENTINEL
        self.assertTrue(sentinel.exists(), f"Sentinel {server.EXPORT_SENTINEL} not found after export")

    def test_re_export_with_sentinel_succeeds(self) -> None:
        """A second export on a sentinel-bearing directory must succeed."""
        server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        sentinel = Path(payload["export_dir"]) / server.EXPORT_SENTINEL
        self.assertTrue(sentinel.exists())

    def test_missing_sentinel_blocks_rmtree(self) -> None:
        """A pre-existing directory without the sentinel must be refused."""
        # Use an isolated tmpdir so this test's cleanup doesn't affect siblings.
        with tempfile.TemporaryDirectory() as isolated_tmp:
            isolated_dir = Path(isolated_tmp)
            write_workspace(
                isolated_dir,
                {
                    "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                    "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
                    "merge.json": load_json(CANONICAL_FIXTURES / "merge_conversation.json"),
                },
            )
            # First export to discover where export_dir lives and create sentinel.
            status, payload = server.export_graph_nodes(isolated_dir, ROOT_ID)
            self.assertEqual(status, HTTPStatus.OK)
            export_dir = Path(payload["export_dir"])

            # Remove the sentinel to simulate a foreign/corrupted directory.
            (export_dir / server.EXPORT_SENTINEL).unlink()

            # Second export must fail rather than rmtree the directory.
            status2, payload2 = server.export_graph_nodes(isolated_dir, ROOT_ID)
            self.assertEqual(status2, HTTPStatus.INTERNAL_SERVER_ERROR)
            self.assertIn("sentinel", payload2["error"].lower())
            # The directory must NOT have been deleted.
            self.assertTrue(export_dir.exists())

    def test_export_rejects_conversation_id_that_escapes_export_root(self) -> None:
        with tempfile.TemporaryDirectory() as isolated_tmp:
            isolated_dir = Path(isolated_tmp)
            root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
            root_payload["conversation_id"] = "../escape"
            write_workspace(isolated_dir, {"root.json": root_payload})

            status, payload = server.export_graph_nodes(isolated_dir, "../escape")

            self.assertEqual(status, HTTPStatus.BAD_REQUEST)
            self.assertIn("outside", payload["error"].lower())
            self.assertFalse((isolated_dir / "escape").exists())

    def test_export_rejects_message_id_that_escapes_export_root(self) -> None:
        with tempfile.TemporaryDirectory() as isolated_tmp:
            isolated_dir = Path(isolated_tmp)
            root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
            root_payload["messages"][0]["message_id"] = "../../../escape"
            write_workspace(isolated_dir, {"root.json": root_payload})

            status, payload = server.export_graph_nodes(
                isolated_dir,
                ROOT_ID,
                "../../../escape",
            )

            self.assertEqual(status, HTTPStatus.BAD_REQUEST)
            self.assertIn("outside", payload["error"].lower())
            self.assertFalse((isolated_dir.parent / "escape").exists())

    def test_empty_conversation_id_returns_400(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, "")
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_unknown_conversation_id_returns_404(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, "conv-does-not-exist")
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_exported_markdown_contains_provenance_comment(self) -> None:
        status, payload = server.export_graph_nodes(self._dialog_dir, ROOT_ID)
        self.assertEqual(status, HTTPStatus.OK)
        nodes_dir = Path(payload["export_dir"]) / "nodes" / ROOT_ID
        first_file = sorted(nodes_dir.iterdir())[0]
        content = first_file.read_text(encoding="utf-8")
        self.assertIn("<!-- ", content)
        self.assertIn(f"conversation_id: {ROOT_ID}", content)


class ExportCheckpointScopeTests(unittest.TestCase):
    """Checkpoint-scope export truncates to the target message."""

    def test_checkpoint_scope_truncates_messages(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        all_messages = root_payload["messages"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            # Export up to and including the first message
            first_msg_id = all_messages[0]["message_id"]
            status, payload = server.export_graph_nodes(dialog_dir, ROOT_ID, first_msg_id)

        self.assertEqual(status, HTTPStatus.OK)
        root_conv = next(c for c in payload["conversations"] if c["conversation_id"] == ROOT_ID)
        self.assertEqual(len(root_conv["files"]), 1)

    def test_checkpoint_scope_includes_messages_up_to_target(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        all_messages = root_payload["messages"]
        self.assertGreaterEqual(len(all_messages), 2)
        last_msg_id = all_messages[-1]["message_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            status, payload = server.export_graph_nodes(dialog_dir, ROOT_ID, last_msg_id)

        self.assertEqual(status, HTTPStatus.OK)
        root_conv = next(c for c in payload["conversations"] if c["conversation_id"] == ROOT_ID)
        self.assertEqual(len(root_conv["files"]), len(all_messages))

    def test_unknown_message_id_returns_404(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, ROOT_ID, "msg-does-not-exist")
        self.assertEqual(status, HTTPStatus.NOT_FOUND)


# ---------------------------------------------------------------------------
# compile_graph_nodes — end-to-end with stub binary
# ---------------------------------------------------------------------------

class CompileGraphNodesTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._dialog_dir = Path(self._tmp.name)
        write_workspace(
            self._dialog_dir,
            {"root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json")},
        )
        self._stub = make_stub_binary(self._dialog_dir)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_successful_compile_returns_200_with_export_and_compile(self) -> None:
        status, payload = server.compile_graph_nodes(
            self._dialog_dir, ROOT_ID, None, self._stub
        )
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn("export_dir", payload)
        self.assertIn("hc_file", payload)
        self.assertIn("compile", payload)
        self.assertEqual(payload["compile"]["exit_code"], 0)

    def test_compile_returns_compiled_md_and_manifest(self) -> None:
        status, payload = server.compile_graph_nodes(
            self._dialog_dir, ROOT_ID, None, self._stub
        )
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn("compiled_md", payload["compile"])
        self.assertIn("manifest_json", payload["compile"])
        self.assertIn("provenance_json", payload["compile"])

    def test_empty_conversation_id_returns_400(self) -> None:
        status, payload = server.compile_graph_nodes(
            self._dialog_dir, "", None, self._stub
        )
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_missing_binary_returns_422(self) -> None:
        status, payload = server.compile_graph_nodes(
            self._dialog_dir, ROOT_ID, None, "/nonexistent/hp"
        )
        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)

    def test_compile_failure_propagates_exit_code(self) -> None:
        fail_stub = self._dialog_dir / "hp_fail"
        fail_stub.write_text("#!/bin/sh\nexit 2\n", encoding="utf-8")
        fail_stub.chmod(fail_stub.stat().st_mode | stat.S_IEXEC)

        status, payload = server.compile_graph_nodes(
            self._dialog_dir, ROOT_ID, None, str(fail_stub)
        )
        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["compile"]["exit_code"], 2)

    def test_multi_conversation_chain_compiles_with_single_root_hc_structure(self) -> None:
        write_workspace(
            self._dialog_dir,
            {
                "root.json": load_json(CANONICAL_FIXTURES / "root_conversation.json"),
                "branch.json": load_json(CANONICAL_FIXTURES / "branch_conversation.json"),
            },
        )
        strict_stub = make_structure_validating_stub_binary(self._dialog_dir)

        status, payload = server.compile_graph_nodes(
            self._dialog_dir, BRANCH_ID, None, strict_stub
        )
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["compile"]["exit_code"], 0)


if __name__ == "__main__":
    unittest.main()
