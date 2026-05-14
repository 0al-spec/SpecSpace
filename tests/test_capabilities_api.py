from types import SimpleNamespace

from viewer.capabilities_api import build_capabilities


class FakeHandler:
    def __init__(
        self,
        *,
        spec_dir=None,
        specgraph_dir=None,
        compile_available=False,
        agent_available=None,
        graph_dashboard_path=None,
        runs_dir=None,
        exploration_build_available=False,
        viewer_surfaces_build_available=False,
    ) -> None:
        server_fields = {
            "spec_dir": spec_dir,
            "specgraph_dir": specgraph_dir,
            "compile_available": compile_available,
        }
        if agent_available is not None:
            server_fields["agent_available"] = agent_available
        self.server = SimpleNamespace(**server_fields)
        self.graph_dashboard_path = graph_dashboard_path
        self.runs_dir = runs_dir
        self.exploration_build_available = exploration_build_available
        self.viewer_surfaces_build_available = viewer_surfaces_build_available

    def _graph_dashboard_path(self):
        return self.graph_dashboard_path

    def _runs_dir(self):
        return self.runs_dir

    def _exploration_build_available(self):
        return self.exploration_build_available

    def _viewer_surfaces_build_available(self):
        return self.viewer_surfaces_build_available


def test_build_capabilities_reports_unconfigured_defaults() -> None:
    capabilities = build_capabilities(FakeHandler())

    assert capabilities == {
        "spec_graph": False,
        "spec_compile": False,
        "compile": False,
        "graph_dashboard": False,
        "spec_overlay": False,
        "specpm_preview": False,
        "exploration_preview": False,
        "exploration_surfaces": False,
        "exploration_preview_build": False,
        "viewer_surfaces_build": False,
        "agent": False,
    }


def test_build_capabilities_reports_configured_surfaces() -> None:
    capabilities = build_capabilities(
        FakeHandler(
            spec_dir=object(),
            specgraph_dir=object(),
            compile_available=True,
            agent_available=True,
            graph_dashboard_path=object(),
            runs_dir=object(),
            exploration_build_available=True,
            viewer_surfaces_build_available=True,
        )
    )

    assert capabilities == {
        "spec_graph": True,
        "spec_compile": True,
        "compile": True,
        "graph_dashboard": True,
        "spec_overlay": True,
        "specpm_preview": True,
        "exploration_preview": True,
        "exploration_surfaces": True,
        "exploration_preview_build": True,
        "viewer_surfaces_build": True,
        "agent": True,
    }
