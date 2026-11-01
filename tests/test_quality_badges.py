"""Stack badges must describe one validated source revision, never PR claims."""

import importlib.util
import json
import urllib.error
from email.message import Message
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("quality_badges", ROOT / "quality/badges.py")
assert spec and spec.loader
badges = importlib.util.module_from_spec(spec)
spec.loader.exec_module(badges)
REVISION = "a" * 40


def source(tmp_path):
    (tmp_path / "Dockerfile").write_text("FROM python:3.12-slim\n")
    (tmp_path / "graphspace").mkdir()
    packages = {
        f"node_modules/{name}": {"version": version}
        for name, version in [
            ("react", "19.2.0"),
            ("typescript", "5.8.3"),
            ("vite", "6.4.2"),
            ("@xyflow/react", "12.10.2"),
        ]
    }
    lock = tmp_path / "graphspace/package-lock.json"
    lock.write_text(json.dumps({"packages": packages}))
    return lock


def test_versions_follow_lock_changes_and_all_outputs_bind_one_revision(tmp_path):
    lock = source(tmp_path)
    first = badges.build(tmp_path, REVISION)
    assert set(first) == {
        "python.svg",
        "react.svg",
        "typescript.svg",
        "vite.svg",
        "react-flow.svg",
        "manifest.json",
    }
    assert all(REVISION in value for value in first.values())
    data = json.loads(lock.read_text())
    data["packages"]["node_modules/react"]["version"] = "19.3.0"
    lock.write_text(json.dumps(data))
    second = badges.build(tmp_path, REVISION)
    assert "19.3.0" in second["react.svg"] and first["react.svg"] != second["react.svg"]
    assert json.loads(second["manifest.json"])["versions"]["react"] == "19.3.0"


def test_missing_or_invalid_versions_fail_instead_of_guessing(tmp_path):
    lock = source(tmp_path)
    with pytest.raises(ValueError, match="full source"):
        badges.build(tmp_path, "short")
    data = json.loads(lock.read_text())
    data["packages"]["node_modules/react"]["version"] = "<script>"
    lock.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="Invalid locked"):
        badges.build(tmp_path, REVISION)


def test_python_patch_version_tracks_docker_tag(tmp_path):
    source(tmp_path)
    (tmp_path / "Dockerfile").write_text("FROM python:3.12.9-slim\n")
    assert (
        json.loads(badges.build(tmp_path, REVISION)["manifest.json"])["versions"]["python"]
        == "3.12.9"
    )
    (tmp_path / "Dockerfile").write_text("FROM python:3.12.10-slim\n")
    assert (
        json.loads(badges.build(tmp_path, REVISION)["manifest.json"])["versions"]["python"]
        == "3.12.10"
    )


def test_dispatch_and_push_do_not_share_concurrency_group():
    import yaml

    workflow = yaml.safe_load((ROOT / ".github/workflows/quality.yml").read_text())
    group = workflow["concurrency"]["group"]
    assert "github.event_name" in group and "github.ref" in group


def test_svg_escapes_text_and_accessible_description():
    svg = badges.svg('A"<&', "<script>&", REVISION)
    assert "<script>" not in svg
    assert 'aria-label="A&quot;&lt;&amp;' in svg
    assert "&lt;script&gt;&amp;" in svg


def environment():
    return {
        "GITHUB_EVENT_NAME": "push",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_SHA": REVISION,
        "GITHUB_REPOSITORY": "0al-spec/SpecSpace",
    }


def test_pull_requests_cannot_publish():
    with (
        patch.dict(badges.os.environ, {**environment(), "GITHUB_EVENT_NAME": "pull_request"}),
        patch.object(badges, "github") as api,
        pytest.raises(ValueError, match="restricted"),
    ):
        badges.publish({}, REVISION)
    api.assert_not_called()


def test_publish_updates_one_ref_without_force_after_complete_tree():
    calls = []

    def api(_repo, path, method="GET", payload=None):
        calls.append((path, method, payload))
        if path == "/git/ref/heads/main":
            return {"object": {"sha": REVISION}}
        if path == "/git/ref/heads/quality-badges":
            return {"object": {"sha": "parent"}}
        return {"sha": "tree" if path == "/git/trees" else "commit"}

    with (
        patch.dict(badges.os.environ, environment()),
        patch.object(badges, "github", side_effect=api),
    ):
        badges.publish({"react.svg": "svg", "manifest.json": "json"}, REVISION)
    assert calls[-1] == (
        "/git/refs/heads/quality-badges",
        "PATCH",
        {"sha": "commit", "force": False},
    )
    assert next(payload for path, _, payload in calls if path == "/git/commits")["parents"] == [
        "parent"
    ]
    assert len(next(payload for path, _, payload in calls if path == "/git/trees")["tree"]) == 2


def test_superseded_main_cannot_replace_badges():
    with (
        patch.dict(badges.os.environ, environment()),
        patch.object(badges, "github", return_value={"object": {"sha": "newer"}}) as api,
    ):
        badges.publish({}, REVISION)
    api.assert_called_once()


def test_initial_publication_creates_only_dedicated_ref():
    calls = []

    def api(_repo, path, method="GET", payload=None):
        calls.append((path, method, payload))
        if path == "/git/ref/heads/main":
            return {"object": {"sha": REVISION}}
        if path == "/git/ref/heads/quality-badges":
            raise urllib.error.HTTPError(
                "https://api.github.com/ref", 404, "not found", Message(), None
            )
        return {"sha": "generated"}

    with (
        patch.dict(badges.os.environ, environment()),
        patch.object(badges, "github", side_effect=api),
    ):
        badges.publish({"react.svg": "svg"}, REVISION)
    assert calls[-1] == (
        "/git/refs",
        "POST",
        {"ref": "refs/heads/quality-badges", "sha": "generated"},
    )


def test_failed_ref_read_cannot_be_treated_as_missing_branch():
    def api(_repo, path, method="GET", payload=None):
        if path == "/git/ref/heads/main":
            return {"object": {"sha": REVISION}}
        raise urllib.error.HTTPError(
            "https://api.github.com/ref", 403, "forbidden", Message(), None
        )

    with (
        patch.dict(badges.os.environ, environment()),
        patch.object(badges, "github", side_effect=api),
        pytest.raises(urllib.error.HTTPError),
    ):
        badges.publish({}, REVISION)


def test_main_moving_during_generation_prevents_ref_update():
    calls = []
    revisions = iter([REVISION, "b" * 40])

    def api(_repo, path, method="GET", payload=None):
        calls.append((path, method))
        if path == "/git/ref/heads/main":
            return {"object": {"sha": next(revisions)}}
        return {"object": {"sha": "parent"}, "sha": "generated"}

    with (
        patch.dict(badges.os.environ, environment()),
        patch.object(badges, "github", side_effect=api),
    ):
        badges.publish({}, REVISION)
    assert not any(method == "PATCH" or path == "/git/refs" for path, method in calls)
