"""Tests for Hyperprompt compiler invocation: invoke_hyperprompt and compile_graph_nodes."""

from __future__ import annotations

import json
import os
import stat
import tempfile
import textwrap
import threading
import unittest
from http import HTTPStatus
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from http.server import ThreadingHTTPServer

from viewer import server

REPO_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Helpers shared with other API contract tests
# ---------------------------------------------------------------------------

def write_workspace(dialog_dir: Path, payloads: dict[str, dict]) -> None:
    for file_name, payload in payloads.items():
        (dialog_dir / file_name).write_text(json.dumps(payload), encoding="utf-8")


def start_test_server(dialog_dir: Path, hyperprompt_binary: str = "") -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = hyperprompt_binary
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, t, f"http://127.0.0.1:{httpd.server_port}"


def stop_test_server(httpd: ThreadingHTTPServer, t: threading.Thread) -> None:
    httpd.shutdown()
    t.join()
    httpd.server_close()


def post_json(url: str, data: object) -> tuple[int, object]:
    body = json.dumps(data).encode("utf-8")
    req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


# ---------------------------------------------------------------------------
# Minimal canonical conversation fixture
# ---------------------------------------------------------------------------

ROOT_CONV = {
    "conversation_id": "root-compile-test",
    "title": "Compile Test Root",
    "messages": [
        {"message_id": "msg-1", "role": "user", "content": "Hello", "turn_id": "t1", "source": "s1"},
        {"message_id": "msg-2", "role": "assistant", "content": "Hi", "turn_id": "t2", "source": "s2"},
    ],
    "lineage": {"parents": []},
}


# ---------------------------------------------------------------------------
# Unit tests for invoke_hyperprompt
# ---------------------------------------------------------------------------

class TestInvokeHyperprompt(unittest.TestCase):

    def _make_export_dir(self, tmp: Path, include_hc: bool = True) -> Path:
        export_dir = tmp / "export"
        export_dir.mkdir()
        if include_hc:
            (export_dir / "root.hc").write_text("# ContextBuilder export\n", encoding="utf-8")
        return export_dir

    def test_missing_binary_returns_422(self):
        with tempfile.TemporaryDirectory() as td:
            export_dir = self._make_export_dir(Path(td))
            status, payload = server.invoke_hyperprompt(export_dir, "/nonexistent/hyperprompt")
        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("Hyperprompt not found", payload["error"])
        self.assertIsNone(payload["exit_code"])

    def test_default_binary_falls_back_to_arm64_release_layout(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            default_binary = td_path / ".build" / "release" / "hyperprompt"
            arm64_binary = td_path / ".build" / "arm64-apple-macosx" / "release" / "hyperprompt"
            arm64_binary.parent.mkdir(parents=True, exist_ok=True)
            arm64_binary.write_text(
                textwrap.dedent("""\
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
                """),
                encoding="utf-8",
            )
            arm64_binary.chmod(arm64_binary.stat().st_mode | stat.S_IEXEC)

            original_default = server.DEFAULT_HYPERPROMPT_BINARY
            try:
                server.DEFAULT_HYPERPROMPT_BINARY = str(default_binary)
                status, payload = server.invoke_hyperprompt(export_dir, str(default_binary))
            finally:
                server.DEFAULT_HYPERPROMPT_BINARY = original_default

        self.assertEqual(status, HTTPStatus.OK, payload)
        self.assertEqual(payload["exit_code"], 0)
        self.assertEqual(payload["binary_path"], str(arm64_binary))

    def test_missing_default_binary_reports_checked_fallback_candidates(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            default_binary = td_path / ".build" / "release" / "hyperprompt"

            original_default = server.DEFAULT_HYPERPROMPT_BINARY
            try:
                server.DEFAULT_HYPERPROMPT_BINARY = str(default_binary)
                status, payload = server.invoke_hyperprompt(export_dir, str(default_binary))
            finally:
                server.DEFAULT_HYPERPROMPT_BINARY = original_default

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("Hyperprompt not found", payload["error"])
        # The configured (default) path must always appear in checked_paths.
        self.assertIn(str(default_binary), payload["checked_paths"])
        # Arch-specific subdirectories are found via glob only when they exist;
        # since none were created in this tmpdir, only the configured path and
        # the deps fallback are checked (deps may be deduplicated if it equals default).
        self.assertGreaterEqual(len(payload["checked_paths"]), 1)

    def test_explicit_binary_override_does_not_use_default_fallbacks(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            explicit_binary = td_path / "custom" / "hyperprompt"

            status, payload = server.invoke_hyperprompt(export_dir, str(explicit_binary))

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["checked_paths"], [str(explicit_binary)])

    def test_missing_hc_file_returns_400(self):
        with tempfile.TemporaryDirectory() as td:
            export_dir = self._make_export_dir(Path(td), include_hc=False)
            # Create a dummy binary that exists
            dummy_bin = Path(td) / "hp"
            dummy_bin.write_text("#!/bin/sh\nexit 0\n")
            dummy_bin.chmod(dummy_bin.stat().st_mode | stat.S_IEXEC)
            status, payload = server.invoke_hyperprompt(export_dir, str(dummy_bin))
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("root.hc not found", payload["error"])
        self.assertIsNone(payload["exit_code"])

    def test_success_path(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            # Stub binary: write compiled.md and manifest.json, exit 0
            stub = td_path / "hp"
            stub.write_text(
                textwrap.dedent("""\
                    #!/bin/sh
                    # Write outputs to --output and --manifest paths
                    out=""
                    manifest=""
                    while [ $# -gt 0 ]; do
                        case "$1" in
                            --output) shift; out="$1" ;;
                            --manifest) shift; manifest="$1" ;;
                        esac
                        shift
                    done
                    [ -n "$out" ] && echo "compiled content" > "$out"
                    [ -n "$manifest" ] && echo '{"files":[]}' > "$manifest"
                    exit 0
                """),
                encoding="utf-8",
            )
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)

            status, payload = server.invoke_hyperprompt(export_dir, str(stub))

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["exit_code"], 0)
        self.assertIn("compiled_md", payload)
        self.assertIn("manifest_json", payload)

    def test_non_zero_exit_returns_422(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            stub = td_path / "hp"
            stub.write_text("#!/bin/sh\necho 'syntax error' >&2\nexit 2\n", encoding="utf-8")
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)

            status, payload = server.invoke_hyperprompt(export_dir, str(stub))

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["exit_code"], 2)
        self.assertIn("Syntax error", payload["error"])
        self.assertIn("syntax error", payload["stderr"])

    def test_exit_code_1_io_error(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            stub = td_path / "hp"
            stub.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)

            status, payload = server.invoke_hyperprompt(export_dir, str(stub))

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["exit_code"], 1)
        self.assertIn("IO error", payload["error"])

    def test_exit_code_3_resolution_error(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            stub = td_path / "hp"
            stub.write_text("#!/bin/sh\nexit 3\n", encoding="utf-8")
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)

            status, payload = server.invoke_hyperprompt(export_dir, str(stub))

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["exit_code"], 3)
        self.assertIn("Resolution", payload["error"])

    def test_exit_code_4_internal_error(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            export_dir = self._make_export_dir(td_path)
            stub = td_path / "hp"
            stub.write_text("#!/bin/sh\nexit 4\n", encoding="utf-8")
            stub.chmod(stub.stat().st_mode | stat.S_IEXEC)

            status, payload = server.invoke_hyperprompt(export_dir, str(stub))

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["exit_code"], 4)
        self.assertIn("Internal compiler error", payload["error"])


# ---------------------------------------------------------------------------
# Integration tests: /api/compile endpoint
# ---------------------------------------------------------------------------

class TestCompileEndpoint(unittest.TestCase):

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._dialog_dir = Path(self._tmp.name)

        # Write a minimal root conversation file
        write_workspace(self._dialog_dir, {"root-1.json": ROOT_CONV})

        # Build a stub binary that succeeds
        stub = self._dialog_dir / "hp_stub"
        stub.write_text(
            textwrap.dedent("""\
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
            """),
            encoding="utf-8",
        )
        stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
        self._stub = str(stub)

        self._httpd, self._thread, self._base = start_test_server(
            self._dialog_dir, hyperprompt_binary=self._stub
        )

    def tearDown(self):
        stop_test_server(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_missing_conversation_id_returns_400(self):
        status, payload = post_json(f"{self._base}/api/compile", {"conversation_id": ""})
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_unknown_conversation_id_returns_404(self):
        status, payload = post_json(f"{self._base}/api/compile", {"conversation_id": "no-such"})
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_successful_compile_returns_200_with_artifacts(self):
        status, payload = post_json(f"{self._base}/api/compile", {"conversation_id": "root-compile-test"})
        self.assertEqual(status, HTTPStatus.OK, payload)
        self.assertIn("compile", payload)
        self.assertEqual(payload["compile"]["exit_code"], 0)
        self.assertIn("compiled_md", payload["compile"])
        self.assertIn("manifest_json", payload["compile"])
        self.assertIn("provenance_json", payload["compile"])

    def test_compile_with_missing_binary_returns_422(self):
        self._httpd.hyperprompt_binary = "/nonexistent/hp"
        status, payload = post_json(f"{self._base}/api/compile", {"conversation_id": "root-compile-test"})
        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        compile_info = payload.get("compile", payload)
        self.assertIn("Hyperprompt not found", compile_info["error"])

    def test_compile_failure_surfaces_exit_code(self):
        # Replace stub with one that exits 2
        fail_stub = self._dialog_dir / "hp_fail"
        fail_stub.write_text("#!/bin/sh\necho 'bad syntax' >&2\nexit 2\n", encoding="utf-8")
        fail_stub.chmod(fail_stub.stat().st_mode | stat.S_IEXEC)
        self._httpd.hyperprompt_binary = str(fail_stub)

        status, payload = post_json(f"{self._base}/api/compile", {"conversation_id": "root-compile-test"})
        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        compile_info = payload.get("compile", payload)
        self.assertEqual(compile_info["exit_code"], 2)
        self.assertIn("stderr", compile_info)


if __name__ == "__main__":
    unittest.main()
