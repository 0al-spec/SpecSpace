import json
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path

from viewer import specpm


VALID_ARTIFACT = {
    "artifact_kind": "exploration_preview",
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
    "nodes": [],
    "edges": [],
}


class ExplorationPreviewReadTests(unittest.TestCase):
    def test_missing_returns_not_found_with_build_hint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            specgraph_dir.mkdir()

            status, payload = specpm.read_exploration_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.NOT_FOUND)
        self.assertEqual(payload["error"], "Exploration preview artifact not built yet")
        self.assertEqual(payload["hint"], "POST /api/exploration-preview/build to create it")
        self.assertTrue(payload["path"].endswith("runs/exploration_preview.json"))

    def test_invalid_json_returns_422(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text("not json", encoding="utf-8")

            status, payload = specpm.read_exploration_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertIn("Failed to read exploration preview", payload["error"])

    def test_boundary_failure_returns_structured_fields(self) -> None:
        bad_artifact = dict(VALID_ARTIFACT, tracked_artifacts_written=True)
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text(json.dumps(bad_artifact), encoding="utf-8")

            status, payload = specpm.read_exploration_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
        self.assertEqual(payload["error"], "Artifact failed boundary check")
        self.assertTrue(payload["tracked_artifacts_written"])

    def test_valid_artifact_returns_envelope(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp) / "specgraph"
            runs = specgraph_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text(json.dumps(VALID_ARTIFACT), encoding="utf-8")

            status, payload = specpm.read_exploration_preview_response(specgraph_dir)

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["data"], VALID_ARTIFACT)
        self.assertIn("mtime", payload)
        self.assertIn("mtime_iso", payload)


if __name__ == "__main__":
    unittest.main()
