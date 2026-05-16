from __future__ import annotations

import os
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
API_DIGEST = "1" * 64
UI_DIGEST = "2" * 64


def run_script(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    return subprocess.run(
        args,
        cwd=REPO_ROOT,
        env=merged_env,
        text=True,
        capture_output=True,
        check=False,
    )


def test_render_timeweb_deploy_branch_creates_manifest_only_tree(tmp_path: Path) -> None:
    result = run_script(
        "scripts/render-timeweb-deploy-branch.sh",
        str(tmp_path),
        env={
            "SPECSPACE_API_IMAGE_REF": f"ghcr.io/0al-spec/specspace-api@sha256:{API_DIGEST}",
            "SPECSPACE_UI_IMAGE_REF": f"ghcr.io/0al-spec/specspace-ui@sha256:{UI_DIGEST}",
            "SPECSPACE_RELEASE_COMMIT": "test-release",
            "SPECSPACE_RELEASE_CREATED_AT": "1970-01-01T00:00:00Z",
        },
    )

    assert result.returncode == 0, result.stderr
    assert sorted(path.name for path in tmp_path.iterdir()) == [
        "README.md",
        "docker-compose.yml",
    ]

    check = run_script("scripts/check-timeweb-deploy-tree.sh", str(tmp_path))
    assert check.returncode == 0, check.stderr


def test_check_timeweb_deploy_tree_rejects_source_build_compose(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text("# deploy\n", encoding="utf-8")
    (tmp_path / "docker-compose.yml").write_text(
        """
name: specspace

services:
  app:
    build:
      context: .
    image: specspace-ui:local
  specspace-api:
    image: ghcr.io/0al-spec/specspace-api@sha256:{api_digest}
    command:
      - python
      - viewer/server.py
      - --artifact-base-url
      - https://specgraph.tech
""".format(api_digest=API_DIGEST),
        encoding="utf-8",
    )

    result = run_script("scripts/check-timeweb-deploy-tree.sh", str(tmp_path))

    assert result.returncode != 0
    assert "must not build from source" in result.stderr


def test_render_timeweb_deploy_branch_rejects_latest_tag(tmp_path: Path) -> None:
    result = run_script(
        "scripts/render-timeweb-deploy-branch.sh",
        str(tmp_path),
        env={
            "SPECSPACE_API_IMAGE_REF": "ghcr.io/0al-spec/specspace-api:latest",
            "SPECSPACE_UI_IMAGE_REF": f"ghcr.io/0al-spec/specspace-ui@sha256:{UI_DIGEST}",
        },
    )

    assert result.returncode != 0
    assert "must not use the mutable latest tag" in result.stderr
