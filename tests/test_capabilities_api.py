from types import SimpleNamespace

from viewer.capabilities_api import build_capabilities, build_capability_diagnostics


class FakeHandler:
    def __init__(
        self,
        *,
        spec_dir=None,
        specgraph_dir=None,
        compile_available=False,
        hyperprompt_binary=None,
        hyperprompt_resolved_binary=None,
        hyperprompt_checked_paths=None,
        hyperprompt_resolution_source="missing",
        hyperprompt_work_dir=None,
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
            "hyperprompt_compile_available": False,
            "hyperprompt_binary": hyperprompt_binary,
            "hyperprompt_resolved_binary": hyperprompt_resolved_binary,
            "hyperprompt_checked_paths": hyperprompt_checked_paths or [],
            "hyperprompt_resolution_source": hyperprompt_resolution_source,
            "hyperprompt_work_dir": hyperprompt_work_dir,
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
        "spec_markdown_export": False,
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
            "agent_workbench_conversations": False,
            "agent_workbench_writes": False,
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
        "spec_markdown_export": True,
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
            "agent_workbench_conversations": False,
            "agent_workbench_writes": False,
        }


def test_capability_diagnostics_disable_hyperprompt_for_http_provider(tmp_path) -> None:
    binary = tmp_path / "hyperprompt"
    binary.write_text("#!/bin/sh\n", encoding="utf-8")
    binary.chmod(0o755)
    scratch = tmp_path / "scratch"
    scratch.mkdir()

    diagnostics = build_capability_diagnostics(
        FakeHandler(
            spec_dir=object(),
            hyperprompt_binary=str(binary),
            hyperprompt_resolved_binary=str(binary),
            hyperprompt_checked_paths=[str(binary)],
            hyperprompt_resolution_source="configured",
            hyperprompt_work_dir=scratch,
        ),
        provider_kind="http",
        capabilities={"spec_markdown_export": True},
    )

    assert diagnostics["spec_markdown_export"]["available"] is True
    assert diagnostics["hyperprompt_compile"]["available"] is False
    assert diagnostics["hyperprompt_compile"]["status"] == "provider_unsupported"


def test_capability_diagnostics_require_executable_hyperprompt_binary(tmp_path) -> None:
    binary = tmp_path / "hyperprompt"
    binary.write_text("#!/bin/sh\n", encoding="utf-8")
    binary.chmod(0o600)
    scratch = tmp_path / "scratch"
    scratch.mkdir()

    diagnostics = build_capability_diagnostics(
        FakeHandler(
            spec_dir=object(),
            hyperprompt_binary=str(binary),
            hyperprompt_resolved_binary=str(binary),
            hyperprompt_checked_paths=[str(binary)],
            hyperprompt_resolution_source="configured",
            hyperprompt_work_dir=scratch,
        ),
        provider_kind="file",
        capabilities={"spec_markdown_export": True},
    )

    assert diagnostics["hyperprompt_compile"]["available"] is False
    assert diagnostics["hyperprompt_compile"]["status"] == "compiler_not_executable"


def test_capability_diagnostics_require_scratch_workspace(tmp_path) -> None:
    binary = tmp_path / "hyperprompt"
    binary.write_text("#!/bin/sh\n", encoding="utf-8")
    binary.chmod(0o755)

    diagnostics = build_capability_diagnostics(
        FakeHandler(
            spec_dir=object(),
            hyperprompt_binary=str(binary),
            hyperprompt_resolved_binary=str(binary),
            hyperprompt_checked_paths=[str(binary)],
            hyperprompt_resolution_source="configured",
        ),
        provider_kind="file",
        capabilities={"spec_markdown_export": True},
    )

    assert diagnostics["hyperprompt_compile"]["available"] is False
    assert diagnostics["hyperprompt_compile"]["status"] == "scratch_not_configured"


def test_capability_diagnostics_report_available_hyperprompt_compile(tmp_path) -> None:
    binary = tmp_path / "hyperprompt"
    binary.write_text("#!/bin/sh\n", encoding="utf-8")
    binary.chmod(0o755)
    scratch = tmp_path / "scratch"
    scratch.mkdir()

    diagnostics = build_capability_diagnostics(
        FakeHandler(
            spec_dir=object(),
            hyperprompt_binary=str(binary),
            hyperprompt_resolved_binary=str(binary),
            hyperprompt_checked_paths=[str(binary)],
            hyperprompt_resolution_source="configured",
            hyperprompt_work_dir=scratch,
        ),
        provider_kind="file",
        capabilities={"spec_markdown_export": True},
    )

    assert diagnostics["hyperprompt_compile"]["available"] is True
    assert diagnostics["hyperprompt_compile"]["status"] == "available"
