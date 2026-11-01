"""Quality infrastructure must not turn failures into a green empty report."""

import importlib.util
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("quality_runner", ROOT / "quality/run.py")
assert spec and spec.loader
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def finding(key):
    return {"fingerprint": key}


def test_new_duplicate_does_not_hide_under_an_existing_fingerprint():
    old = finding("same")
    assert runner.regressions([old, old], {"same": 1}) == [old]
    assert runner.regressions([old], {"same": 2}) == []


def test_source_change_has_a_different_fingerprint_but_line_moves_do_not():
    key = runner.fingerprint("lint", "src/a.py", "rule", "message", "x = f()")
    assert key == runner.fingerprint("lint", "src/a.py", "rule", "message", "  x = f() ")
    assert key != runner.fingerprint("lint", "src/a.py", "rule", "message", "x = bad()")
    assert runner.fingerprint(
        "lint", "a.py", "rule", "Duplicate from line 20", "x"
    ) == runner.fingerprint("lint", "a.py", "rule", "Duplicate from line 42", "x")


def test_missing_tool_is_an_error_not_empty_success(tmp_path):
    collector = runner.Collector(tmp_path)
    with patch.object(collector, "collect", side_effect=FileNotFoundError("tool missing")):
        collector.execute("ruff", [])
    assert collector.errors and not collector.completed


def test_invalid_analyzer_json_is_an_error(tmp_path):
    collector = runner.Collector(tmp_path)
    with patch.object(collector, "collect", side_effect=ValueError("invalid JSON")):
        collector.execute("eslint", [])
    assert collector.errors and not collector.completed


def test_nonzero_empty_analysis_is_not_success(tmp_path):
    collector = runner.Collector(tmp_path)

    def broken(*_):
        collector.returncodes.append(1)

    with patch.object(collector, "collect", side_effect=broken):
        collector.execute("bandit", [])
    assert collector.errors and not collector.completed


def test_secrets_can_never_be_accepted_by_baseline():
    secret = {"tool": "gitleaks", "fingerprint": "known"}
    assert runner.regressions([secret], {"known": 1}) == [secret]


def test_formatter_fingerprint_changes_when_any_file_content_changes(tmp_path):
    source = tmp_path / "a.py"
    source.write_text("x=1\n")
    with patch.object(runner, "ROOT", tmp_path):
        first = runner.Collector(tmp_path)
        first.add("python-format", "a.py", "format", "format", whole=True)
        source.write_text("x=1\ny=2\n")
        second = runner.Collector(tmp_path)
        second.add("python-format", "a.py", "format", "format", whole=True)
    assert first.findings[0]["fingerprint"] != second.findings[0]["fingerprint"]


def test_embedded_absolute_codeframes_do_not_change_fingerprint(tmp_path):
    (tmp_path / "a.ts").write_text("state()\n")
    with patch.object(runner, "ROOT", tmp_path):
        collector = runner.Collector(tmp_path)
        collector.add("eslint", "a.ts", "rule", f"Explanation\n{tmp_path}/a.ts:1:2\n> 1 | state()")
        collector.add("eslint", "a.ts", "rule", "Explanation")
    assert collector.findings[0]["fingerprint"] == collector.findings[1]["fingerprint"]


def test_incomplete_run_cannot_write_baseline(tmp_path):
    with (
        patch.object(
            runner.sys,
            "argv",
            ["run.py", "--output", str(tmp_path / "report"), "--tools", "ruff", "--write-baseline"],
        ),
        patch.object(runner, "CONFIG", tmp_path),
        patch.object(runner.Collector, "execute"),
        patch.object(runner, "source_files", return_value=[]),
    ):
        import pytest

        with pytest.raises(SystemExit, match="incomplete"):
            runner.main()
    assert not (tmp_path / "baseline.json").exists()


def test_dependency_audit_distinguishes_vulnerabilities_from_empty_failure(tmp_path):
    import json
    import subprocess  # nosec B404 # only constructs mock CompletedProcess results

    import pytest

    module_spec = importlib.util.spec_from_file_location(
        "dependency_audit", ROOT / "quality/audit_dependencies.py"
    )
    assert module_spec and module_spec.loader
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    command = ["npm", "audit", "--json"]
    payload = {"metadata": {"vulnerabilities": {"high": 2}}, "vulnerabilities": {}}
    with patch.object(
        module.subprocess,
        "run",
        return_value=subprocess.CompletedProcess(command, 1, json.dumps(payload)),
    ):
        assert module.audit(command, tmp_path, tmp_path / "audit.json") == 2
    payload["metadata"]["vulnerabilities"]["high"] = 0
    with (
        patch.object(
            module.subprocess,
            "run",
            return_value=subprocess.CompletedProcess(command, 1, json.dumps(payload)),
        ),
        pytest.raises(RuntimeError, match="Nonzero"),
    ):
        module.audit(command, tmp_path, tmp_path / "audit.json")


def test_changed_profile_cannot_reuse_baseline(tmp_path):
    import json

    (tmp_path / "baseline.json").write_text(
        json.dumps({"counts": {}, "schema_version": 1, "profile_digest": "old"})
    )
    with (
        patch.object(
            runner.sys, "argv", ["run.py", "--output", str(tmp_path / "out"), "--tools", "ruff"]
        ),
        patch.object(runner, "CONFIG", tmp_path),
        patch.object(runner.Collector, "execute"),
        patch.object(runner, "source_files", return_value=[]),
    ):
        assert runner.main() == 1
    report = json.loads((tmp_path / "out/report.json").read_text())
    assert report["errors"][0]["tool"] == "baseline"


def test_gitleaks_copy_failure_removes_partial_input(tmp_path):
    source = tmp_path / "source"
    output = tmp_path / "output"
    source.mkdir()
    output.mkdir()
    (source / "one.py").write_text("sample")
    (source / "two.py").write_text("sample")
    original = runner.shutil.copyfile

    def copy(source_path, target):
        if source_path.name == "two.py":
            raise PermissionError("synthetic")
        return original(source_path, target)

    collector = runner.Collector(output)
    with (
        patch.object(runner, "ROOT", source),
        patch.object(runner.shutil, "copyfile", side_effect=copy),
    ):
        collector.execute("gitleaks", ["one.py", "two.py"])
    assert collector.errors
    assert not (output / "secret-scan-input").exists()


def test_dependency_audit_checks_runtime_and_quality_separately(tmp_path):
    module_spec = importlib.util.spec_from_file_location(
        "dependency_audit", ROOT / "quality/audit_dependencies.py"
    )
    assert module_spec and module_spec.loader
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    calls = []

    def fake_audit(command, cwd, output):
        calls.append(command)
        return 0

    with (
        patch.object(
            module.sys, "argv", ["audit_dependencies.py", "--output", str(tmp_path / "report")]
        ),
        patch.object(module, "audit", side_effect=fake_audit),
    ):
        assert module.main() == 0
    python_requirements = [
        command[command.index("--requirement") + 1]
        for command in calls
        if "--requirement" in command
    ]
    assert set(python_requirements) == {"requirements.txt", "quality/requirements.txt"}
