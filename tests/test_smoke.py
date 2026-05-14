import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


class ContextBuilderSmokeTests(unittest.TestCase):
    def test_react_app_source_exists(self) -> None:
        self.assertTrue((REPO_ROOT / "viewer" / "app" / "src" / "App.tsx").is_file())
        self.assertTrue((REPO_ROOT / "viewer" / "app" / "package.json").is_file())
        self.assertTrue((REPO_ROOT / "viewer" / "server.py").is_file())

    def test_legacy_viewer_removed(self) -> None:
        self.assertFalse((REPO_ROOT / "viewer" / "index.html").exists())

    def test_react_app_has_graph_components(self) -> None:
        app_src = REPO_ROOT / "viewer" / "app" / "src"
        self.assertTrue((app_src / "ConversationNode.tsx").is_file())
        self.assertTrue((app_src / "MessageNode.tsx").is_file())
        self.assertTrue((app_src / "SubflowHeader.tsx").is_file())

    def test_react_app_has_data_hooks(self) -> None:
        app_src = REPO_ROOT / "viewer" / "app" / "src"
        self.assertTrue((app_src / "useGraphData.ts").is_file())
        self.assertTrue((app_src / "useSessionState.ts").is_file())

    def test_expanded_subflow_title_is_decorative_not_a_node(self) -> None:
        app_src = REPO_ROOT / "viewer" / "app" / "src"
        app_tsx = (app_src / "App.tsx").read_text()
        use_graph_data = (app_src / "useGraphData.ts").read_text()
        subflow_header = (app_src / "SubflowHeader.tsx").read_text()
        subflow_header_css = (app_src / "SubflowHeader.css").read_text()

        self.assertIn("group:", app_tsx)
        self.assertNotIn("subflowHeader:", app_tsx)
        self.assertNotIn('type: "subflowHeader"', use_graph_data)
        self.assertNotIn("Handle", subflow_header)
        self.assertNotIn(".react-flow__handle", subflow_header_css)
        self.assertNotIn("top: 50%", subflow_header_css)

    def test_react_app_has_sidebar_and_inspector(self) -> None:
        app_src = REPO_ROOT / "viewer" / "app" / "src"
        self.assertTrue((app_src / "Sidebar.tsx").is_file())
        self.assertTrue((app_src / "InspectorOverlay.tsx").is_file())

    def test_react_app_uses_react_flow(self) -> None:
        app_tsx = (REPO_ROOT / "viewer" / "app" / "src" / "App.tsx").read_text()
        self.assertIn("ReactFlow", app_tsx)
        self.assertIn("MiniMap", app_tsx)
        self.assertIn("Background", app_tsx)
        self.assertIn("Controls", app_tsx)

    def test_react_app_has_session_persistence(self) -> None:
        session_state = (REPO_ROOT / "viewer" / "app" / "src" / "useSessionState.ts").read_text()
        self.assertIn("sessionStorage", session_state)
        self.assertIn("useSessionString", session_state)
        self.assertIn("useSessionSet", session_state)

    def test_react_app_fetches_graph_api(self) -> None:
        hook = (REPO_ROOT / "viewer" / "app" / "src" / "useGraphData.ts").read_text()
        self.assertIn('"/api/graph"', hook)
        self.assertIn("computeBasePositions", hook)

    def test_vite_config_proxies_api(self) -> None:
        vite_config = (REPO_ROOT / "viewer" / "app" / "vite.config.ts").read_text()
        self.assertIn("/api", vite_config)
        self.assertIn("http://localhost:8001", vite_config)

    def test_server_serves_from_dist(self) -> None:
        server_py = (REPO_ROOT / "viewer" / "server.py").read_text()
        static_api_py = (REPO_ROOT / "viewer" / "static_api.py").read_text()
        self.assertIn("static_api", server_py)
        self.assertIn("viewer", static_api_py)
        self.assertIn("app", static_api_py)
        self.assertIn("dist", static_api_py)

    def test_server_module_loads(self) -> None:
        module_path = REPO_ROOT / "viewer" / "server.py"
        spec = importlib.util.spec_from_file_location("contextbuilder_server", module_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        self.assertTrue(hasattr(module, "main"))
        self.assertTrue(hasattr(module, "ViewerHandler"))
