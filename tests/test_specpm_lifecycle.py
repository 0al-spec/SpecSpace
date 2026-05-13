import json
import tempfile
import unittest
from pathlib import Path

from viewer import server


class SpecPMLifecycleTests(unittest.TestCase):
    def test_lifecycle_packages_include_graph_node_source_refs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            specgraph_dir = Path(tmp)
            runs = specgraph_dir / "runs"
            runs.mkdir()
            (runs / "specpm_export_preview.json").write_text(
                json.dumps(
                    {
                        "generated_at": "2026-05-13T00:00:00Z",
                        "entry_count": 1,
                        "entries": [
                            {
                                "export_id": "fallback_export",
                                "export_status": "draft_preview_only",
                                "review_state": "draft_preview_only",
                                "next_gap": "review_draft_specpm_boundary",
                                "package_preview": {
                                    "metadata": {
                                        "id": "specgraph.core_repository_facade",
                                    },
                                },
                                "boundary_source_preview": {
                                    "root_spec_id": "SG-SPEC-0001",
                                    "source_specs": [
                                        {"spec_id": "SG-SPEC-0001"},
                                        {"spec_id": "SG-SPEC-0054"},
                                    ],
                                },
                                "contract_summary": {
                                    "root_spec_id": "SG-SPEC-0001",
                                    "source_spec_ids": [
                                        "SG-SPEC-0001",
                                        "SG-SPEC-0061",
                                    ],
                                },
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )

            lifecycle = server._build_specpm_lifecycle(specgraph_dir)

        self.assertEqual(lifecycle["package_count"], 1)
        package = lifecycle["packages"][0]
        self.assertEqual(package["package_key"], "specgraph.core_repository_facade")
        self.assertEqual(package["root_spec_id"], "SG-SPEC-0001")
        self.assertEqual(
            package["source_spec_ids"],
            ["SG-SPEC-0001", "SG-SPEC-0054", "SG-SPEC-0061"],
        )
        self.assertEqual(package["export"]["status"], "draft_preview_only")


if __name__ == "__main__":
    unittest.main()
