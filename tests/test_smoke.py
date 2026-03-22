import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


class ContextBuilderSmokeTests(unittest.TestCase):
    def test_viewer_assets_exist(self) -> None:
        self.assertTrue((REPO_ROOT / "viewer" / "index.html").is_file())
        self.assertTrue((REPO_ROOT / "viewer" / "server.py").is_file())

    def test_viewer_index_exposes_graph_canvas_shell(self) -> None:
        html = (REPO_ROOT / "viewer" / "index.html").read_text(encoding="utf-8")

        self.assertIn('id="graphPanel"', html)
        self.assertIn('id="graphSummary"', html)
        self.assertIn('id="graphViewport"', html)
        self.assertIn('id="graphCanvas"', html)
        self.assertIn("Graph canvas", html)

    def test_viewer_index_requests_graph_api_and_tracks_panning_state(self) -> None:
        html = (REPO_ROOT / "viewer" / "index.html").read_text(encoding="utf-8")

        self.assertIn('api("/api/graph")', html)
        self.assertIn("graphState =", html)
        self.assertIn("panState =", html)
        self.assertIn("pointerdown", html)
        self.assertIn("pointermove", html)

    def test_server_module_loads(self) -> None:
        module_path = REPO_ROOT / "viewer" / "server.py"
        spec = importlib.util.spec_from_file_location("contextbuilder_server", module_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        self.assertTrue(hasattr(module, "main"))
        self.assertTrue(hasattr(module, "ViewerHandler"))
