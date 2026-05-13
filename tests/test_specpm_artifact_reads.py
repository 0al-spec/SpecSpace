import json
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path

from viewer import specpm


class SpecPMArtifactReadTests(unittest.TestCase):
    def test_preview_missing_returns_not_found_with_build_hint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            specgraph_dir.mkdir()

            status, payload = specpm.read_specpm_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.NOT_FOUND)
        self.assertEqual(payload["error"], "Preview artifact not built yet")
        self.assertEqual(payload["hint"], "POST /api/specpm/preview/build to create it")
        self.assertTrue(payload["preview_path"].endswith("runs/specpm_export_preview.json"))

    def test_preview_returns_envelope(self) -> None:
        preview = {"entries": [{"export_id": "pkg-1"}]}
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "specpm_export_preview.json").write_text(json.dumps(preview), encoding="utf-8")

            status, payload = specpm.read_specpm_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["preview"], preview)
        self.assertIn("mtime", payload)
        self.assertIn("mtime_iso", payload)

    def test_artifact_missing_returns_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            specgraph_dir.mkdir()

            status, payload = specpm.read_specpm_artifact_response(
                specgraph_dir,
                "specpm_import_preview.json",
            )

        self.assertEqual(status, HTTPStatus.NOT_FOUND)
        self.assertEqual(payload["error"], "Artifact not built yet")
        self.assertTrue(payload["path"].endswith("runs/specpm_import_preview.json"))

    def test_artifact_invalid_json_returns_422(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "specpm_handoff_packets.json").write_text("not json", encoding="utf-8")

            status, payload = specpm.read_specpm_artifact_response(
                specgraph_dir,
                "specpm_handoff_packets.json",
            )

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("Failed to read artifact", payload["error"])

    def test_artifact_returns_envelope(self) -> None:
        artifact = {"entries": [{"handoff_id": "h-1"}]}
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "specpm_handoff_packets.json").write_text(json.dumps(artifact), encoding="utf-8")

            status, payload = specpm.read_specpm_artifact_response(
                specgraph_dir,
                "specpm_handoff_packets.json",
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["data"], artifact)
        self.assertIn("mtime", payload)
        self.assertIn("mtime_iso", payload)


if __name__ == "__main__":
    unittest.main()
