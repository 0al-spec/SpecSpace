import argparse
import tempfile
from pathlib import Path
from types import SimpleNamespace

from viewer import server_runtime


def test_runs_watch_path_prefers_spec_dir_layout() -> None:
    spec_dir = Path("/repo/specs/nodes")
    specgraph_dir = Path("/other")

    assert server_runtime.runs_watch_path(spec_dir, specgraph_dir) == Path("/repo/runs")


def test_runs_watch_path_falls_back_to_specgraph_dir() -> None:
    specgraph_dir = Path("/repo")

    assert server_runtime.runs_watch_path(None, specgraph_dir) == Path("/repo/runs")


def test_configure_server_sets_runtime_capabilities() -> None:
    spec_watchers: list[Path] = []
    runs_watchers: list[Path] = []

    def resolve_hyperprompt_binary(binary: str):
        return binary, [], ""

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
            spec_dir=root / "specgraph" / "specs" / "nodes",
            specgraph_dir=None,
            agent=True,
        )
        server = SimpleNamespace()

        server_runtime.configure_server(
            server,
            args,
            repo_root=root,
            resolve_hyperprompt_binary=resolve_hyperprompt_binary,
            spec_watcher_factory=spec_watcher_factory,
            runs_watcher_factory=runs_watcher_factory,
        )

        assert server.repo_root == root
        assert server.dialog_dir == (root / "dialogs").resolve()
        assert server.dialog_dir.exists()
        assert server.hyperprompt_binary == "/bin/hyperprompt"
        assert server.compile_available is True
        assert server.spec_dir == (root / "specgraph" / "specs" / "nodes").resolve()
        assert spec_watchers == [server.spec_dir]
        assert runs_watchers == [(root / "specgraph" / "runs").resolve()]
        assert server.agent_available is True
