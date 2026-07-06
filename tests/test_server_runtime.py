import argparse
import tempfile
from pathlib import Path
from types import SimpleNamespace

from viewer import server_runtime


def test_build_arg_parser_defaults_to_loopback_host() -> None:
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.host == "127.0.0.1"


def test_build_arg_parser_accepts_container_host() -> None:
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--host", "0.0.0.0", "--dialog-dir", "/tmp/dialogs"])

    assert args.host == "0.0.0.0"


def test_build_arg_parser_strips_hyperprompt_work_dir_env(monkeypatch) -> None:
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_WORK_DIR", "  /tmp/specspace-hyperprompt  ")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.hyperprompt_work_dir == Path("/tmp/specspace-hyperprompt")


def test_build_arg_parser_treats_blank_hyperprompt_work_dir_env_as_unset(monkeypatch) -> None:
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_WORK_DIR", "   ")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.hyperprompt_work_dir is None


def test_build_arg_parser_accepts_http_hyperprompt_compile_env(monkeypatch) -> None:
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED", "true")
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS", "45")
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_MAX_INPUT_BYTES", "1000")
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_MAX_OUTPUT_BYTES", "2000")
    monkeypatch.setenv("SPECSPACE_HYPERPROMPT_BUNDLE_RETENTION_COUNT", "5")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.enable_http_hyperprompt_compile is True
    assert args.hyperprompt_compile_timeout_seconds == "45"
    assert args.hyperprompt_max_input_bytes == "1000"
    assert args.hyperprompt_max_output_bytes == "2000"
    assert args.hyperprompt_bundle_retention_count == "5"


def test_build_arg_parser_accepts_agent_workbench_dir_env(monkeypatch) -> None:
    monkeypatch.setenv("SPECSPACE_AGENT_WORKBENCH_DIR", "  /tmp/specspace-workbench  ")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.agent_workbench_dir == Path("/tmp/specspace-workbench")


def test_build_arg_parser_ignores_malformed_platform_execution_timeout_env(
    monkeypatch,
) -> None:
    monkeypatch.setenv("SPECSPACE_PLATFORM_EXECUTION_TIMEOUT_SECONDS", "not-a-number")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.platform_execution_timeout_seconds == 120


def test_build_arg_parser_treats_blank_agent_workbench_dir_env_as_unset(monkeypatch) -> None:
    monkeypatch.setenv("SPECSPACE_AGENT_WORKBENCH_DIR", "   ")
    parser = server_runtime.build_arg_parser(
        description=None,
        default_hyperprompt_binary="/bin/hyperprompt",
    )
    args = parser.parse_args(["--dialog-dir", "/tmp/dialogs"])

    assert args.agent_workbench_dir is None


def test_runs_watch_path_prefers_spec_dir_layout() -> None:
    spec_dir = Path("/repo/specs/nodes")
    specgraph_dir = Path("/other")

    assert server_runtime.runs_watch_path(spec_dir, specgraph_dir) == Path("/repo/runs")


def test_runs_watch_path_falls_back_to_specgraph_dir() -> None:
    specgraph_dir = Path("/repo")

    assert server_runtime.runs_watch_path(None, specgraph_dir) == Path("/repo/runs")


def test_configure_server_sets_runtime_capabilities() -> None:
    workspace_watchers: list[Path] = []
    spec_watchers: list[Path] = []
    runs_watchers: list[Path] = []

    def resolve_hyperprompt_binary(binary: str):
        return binary, [binary], "configured"

    def workspace_watcher_factory(path: Path):
        workspace_watchers.append(path)
        return ("workspace", path)

    def spec_watcher_factory(path: Path):
        spec_watchers.append(path)
        return ("spec", path)

    def runs_watcher_factory(path: Path):
        runs_watchers.append(path)
        return ("runs", path)

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        args = argparse.Namespace(
            dialog_dir=root / "dialogs",
            hyperprompt_binary="/bin/hyperprompt",
            hyperprompt_work_dir=root / "hyperprompt-work",
            enable_http_hyperprompt_compile=True,
            hyperprompt_compile_timeout_seconds="45",
            hyperprompt_max_input_bytes="1000",
            hyperprompt_max_output_bytes="2000",
            hyperprompt_bundle_retention_count="5",
            spec_dir=root / "specgraph" / "specs" / "nodes",
            specgraph_dir=None,
            runs_dir=None,
            artifact_base_url=None,
            specpm_registry_url=None,
            agent_workbench_dir=root / "workbench",
            agent=True,
        )
        server = SimpleNamespace()

        server_runtime.configure_server(
            server,
            args,
            repo_root=root,
            resolve_hyperprompt_binary=resolve_hyperprompt_binary,
            workspace_watcher_factory=workspace_watcher_factory,
            spec_watcher_factory=spec_watcher_factory,
            runs_watcher_factory=runs_watcher_factory,
        )

        assert server.repo_root == root
        assert server.dialog_dir == (root / "dialogs").resolve()
        assert server.dialog_dir.exists()
        assert workspace_watchers == [server.dialog_dir]
        assert server.hyperprompt_binary == "/bin/hyperprompt"
        assert server.hyperprompt_resolved_binary == "/bin/hyperprompt"
        assert server.hyperprompt_checked_paths == ["/bin/hyperprompt"]
        assert server.hyperprompt_resolution_source == "configured"
        assert server.hyperprompt_work_dir == (root / "hyperprompt-work").resolve()
        assert server.hyperprompt_http_compile_enabled is True
        assert server.hyperprompt_compile_timeout_seconds == "45"
        assert server.hyperprompt_max_input_bytes == "1000"
        assert server.hyperprompt_max_output_bytes == "2000"
        assert server.hyperprompt_bundle_retention_count == "5"
        assert server.hyperprompt_compile_available is False
        assert server.compile_available is True
        assert server.spec_dir == (root / "specgraph" / "specs" / "nodes").resolve()
        assert spec_watchers == [server.spec_dir]
        assert server.runs_dir == (root / "specgraph" / "runs").resolve()
        assert runs_watchers == [(root / "specgraph" / "runs").resolve()]
        assert server.agent_workbench_dir == (root / "workbench").resolve()
        assert server.agent_available is True


def test_configure_server_accepts_explicit_runs_dir() -> None:
    runs_watchers: list[Path] = []

    def resolve_hyperprompt_binary(binary: str):
        return binary, [], ""

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        args = argparse.Namespace(
            dialog_dir=root / "dialogs",
            hyperprompt_binary="/bin/hyperprompt",
            hyperprompt_work_dir=None,
            enable_http_hyperprompt_compile=False,
            hyperprompt_compile_timeout_seconds=None,
            hyperprompt_max_input_bytes=None,
            hyperprompt_max_output_bytes=None,
            hyperprompt_bundle_retention_count=None,
            spec_dir=root / "specgraph" / "specs" / "nodes",
            specgraph_dir=root / "specgraph",
            runs_dir=root / "mounted-runs",
            artifact_base_url=None,
            specpm_registry_url=None,
            agent_workbench_dir=None,
            agent=False,
        )
        server = SimpleNamespace()

        server_runtime.configure_server(
            server,
            args,
            repo_root=root,
            resolve_hyperprompt_binary=resolve_hyperprompt_binary,
            workspace_watcher_factory=lambda path: ("workspace", path),
            spec_watcher_factory=lambda path: ("spec", path),
            runs_watcher_factory=lambda path: runs_watchers.append(path) or ("runs", path),
        )

        assert server.runs_dir == (root / "mounted-runs").resolve()
        assert runs_watchers == [server.runs_dir]
