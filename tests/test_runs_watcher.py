import tempfile
import unittest
from pathlib import Path

from viewer.server import RunsWatcher, WorkspaceWatcher


class RunsWatcherTests(unittest.TestCase):
    def test_tracks_timestamped_runs_and_viewer_aggregate_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp)
            (runs_dir / "20260511T120000Z-SG-SPEC-0001-abcdef1.json").write_text("{}", encoding="utf-8")
            (runs_dir / "spec_activity_feed.json").write_text("{}", encoding="utf-8")
            (runs_dir / "implementation_work_index.json").write_text("{}", encoding="utf-8")
            (runs_dir / "proposal_spec_trace_index.json").write_text("{}", encoding="utf-8")
            (runs_dir / "exploration_preview.json").write_text("{}", encoding="utf-8")
            (runs_dir / "unrelated_notes.json").write_text("{}", encoding="utf-8")
            (runs_dir / "README.md").write_text("ignored", encoding="utf-8")

            mtimes = RunsWatcher(runs_dir)._get_mtimes()

        self.assertIn("20260511T120000Z-SG-SPEC-0001-abcdef1.json", mtimes)
        self.assertIn("spec_activity_feed.json", mtimes)
        self.assertIn("implementation_work_index.json", mtimes)
        self.assertIn("proposal_spec_trace_index.json", mtimes)
        self.assertIn("exploration_preview.json", mtimes)
        self.assertNotIn("unrelated_notes.json", mtimes)
        self.assertNotIn("README.md", mtimes)

    def test_tracks_workspace_scoped_json_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp)
            workspace_dir = runs_dir / "local-pantry"
            workspace_dir.mkdir()
            candidate = workspace_dir / "active_idea_to_spec_candidate.json"
            candidate.write_text("{}", encoding="utf-8")
            (workspace_dir / "reviewable_spec.yaml").write_text("ignored", encoding="utf-8")
            nested_dir = workspace_dir / "private"
            nested_dir.mkdir()
            (nested_dir / "raw_idea.json").write_text("ignored", encoding="utf-8")

            mtimes = RunsWatcher(runs_dir)._get_mtimes()

        self.assertTrue(
            any(
                key.startswith("local-pantry/active_idea_to_spec_candidate.json\0")
                for key in mtimes
            )
        )
        self.assertFalse(any("reviewable_spec.yaml" in key for key in mtimes))
        self.assertFalse(any("raw_idea.json" in key for key in mtimes))

    def test_ignores_symlinked_workspace_directories(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            foreign_dir = root / "foreign"
            runs_dir.mkdir()
            foreign_dir.mkdir()
            (foreign_dir / "candidate.json").write_text("{}", encoding="utf-8")
            (runs_dir / "foreign-workspace").symlink_to(foreign_dir, target_is_directory=True)

            mtimes = RunsWatcher(runs_dir)._get_mtimes()

        self.assertFalse(any("foreign-workspace" in key for key in mtimes))


class WorkspaceWatcherTests(unittest.TestCase):
    def test_tracks_workspace_json_files_with_size_in_snapshot_key(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            dialog_dir = Path(tmp)
            (dialog_dir / "root.json").write_text("{}", encoding="utf-8")
            (dialog_dir / "notes.md").write_text("ignored", encoding="utf-8")

            mtimes = WorkspaceWatcher(dialog_dir)._get_mtimes()

        self.assertTrue(any(key.startswith("root.json\0") for key in mtimes))
        self.assertFalse(any(key.startswith("notes.md\0") for key in mtimes))


if __name__ == "__main__":
    unittest.main()
