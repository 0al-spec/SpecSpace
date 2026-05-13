import json
import subprocess
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest.mock import patch

from viewer import supervisor_build


VALID_EXPLORATION_ARTIFACT = {
    "artifact_kind": "exploration_preview",
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
    "nodes": [],
    "edges": [],
}


class SupervisorBuildTests(unittest.TestCase):
    def _make_supervisor(self, specgraph_dir: Path) -> None:
        tools = specgraph_dir / "tools"
        tools.mkdir(parents=True)
        (tools / "supervisor.py").write_text("# stub", encoding="utf-8")

    def test_missing_supervisor_returns_422(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            specgraph_dir.mkdir()

            status, payload = supervisor_build.build_specpm_preview(specgraph_dir)

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("supervisor.py not found", payload["error"])
        self.assertTrue(payload["expected"].endswith("tools/supervisor.py"))

    def test_viewer_surfaces_build_parses_json_stdout_report(self) -> None:
        result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({"written": ["graph_dashboard.json"]}),
            stderr="",
        )
        captured: list[list[str]] = []

        def fake_run(cmd, **kwargs):
            captured.append(cmd)
            self.assertFalse(kwargs.get("shell", False), "shell=True must never be used")
            return result

        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            self._make_supervisor(specgraph_dir)
            with patch("subprocess.run", side_effect=fake_run):
                status, payload = supervisor_build.build_viewer_surfaces(specgraph_dir)

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["exit_code"], 0)
        self.assertEqual(payload["report"], {"written": ["graph_dashboard.json"]})
        self.assertIn("built_at", payload)
        self.assertEqual(captured[0][-1], "--build-viewer-surfaces")

    def test_specpm_build_nonzero_returns_tail_and_artifact_path(self) -> None:
        stderr_lines = [f"err {index}" for index in range(45)]
        result = subprocess.CompletedProcess(
            args=[],
            returncode=7,
            stdout="out a\nout b\n",
            stderr="\n".join(stderr_lines),
        )

        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            self._make_supervisor(specgraph_dir)
            with patch("subprocess.run", return_value=result):
                status, payload = supervisor_build.build_specpm_artifact(
                    specgraph_dir,
                    "--build-specpm-import-preview",
                    "specpm_import_preview.json",
                )

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["exit_code"], 7)
        self.assertEqual(payload["path"], str(specgraph_dir / "runs" / "specpm_import_preview.json"))
        self.assertNotIn("err 0", payload["stderr_tail"])
        self.assertIn("err 44", payload["stderr_tail"])
        self.assertEqual(payload["stdout_tail"], "out a\nout b")

    def test_exploration_build_uses_list_command_and_keeps_intent_literal(self) -> None:
        result = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        captured: list[list[str]] = []

        def fake_run(cmd, **kwargs):
            captured.append(cmd)
            self.assertFalse(kwargs.get("shell", False), "shell=True must never be used")
            return result

        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            (specgraph_dir / "runs").mkdir(parents=True)
            self._make_supervisor(specgraph_dir)
            (specgraph_dir / "runs" / "exploration_preview.json").write_text(
                json.dumps(VALID_EXPLORATION_ARTIFACT),
                encoding="utf-8",
            )
            with patch("subprocess.run", side_effect=fake_run):
                status, payload = supervisor_build.build_exploration_preview(
                    specgraph_dir,
                    "Explore $(evil)",
                )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(payload["artifact_exists"])
        self.assertIn("--build-exploration-preview", captured[0])
        self.assertIn("--exploration-intent", captured[0])
        self.assertEqual(captured[0][-1], "Explore $(evil)")

    def test_exploration_build_rejects_bad_artifact_after_successful_run(self) -> None:
        result = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        bad_artifact = dict(VALID_EXPLORATION_ARTIFACT, canonical_mutations_allowed=True)

        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            (specgraph_dir / "runs").mkdir(parents=True)
            self._make_supervisor(specgraph_dir)
            (specgraph_dir / "runs" / "exploration_preview.json").write_text(
                json.dumps(bad_artifact),
                encoding="utf-8",
            )
            with patch("subprocess.run", return_value=result):
                status, payload = supervisor_build.build_exploration_preview(specgraph_dir, "Test")

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("boundary check", payload["error"])


if __name__ == "__main__":
    unittest.main()
