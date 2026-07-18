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
    compose = (tmp_path / "docker-compose.yml").read_text(encoding="utf-8")
    assert (
        f'SPECSPACE_API_IMAGE_REF: "ghcr.io/0al-spec/specspace-api@sha256:{API_DIGEST}"'
        in compose
    )
    assert (
        f'SPECSPACE_UI_IMAGE_REF: "ghcr.io/0al-spec/specspace-ui@sha256:{UI_DIGEST}"'
        in compose
    )
    assert 'SPECSPACE_RELEASE_COMMIT: "test-release"' in compose
    assert "SPECSPACE_RELEASE_CREATED_AT" not in compose
    assert "--specpm-registry-url" in compose
    assert "https://specpm.dev" in compose

    check = run_script("scripts/check-timeweb-deploy-tree.sh", str(tmp_path))
    assert check.returncode == 0, check.stderr


def test_render_timeweb_deploy_branch_allows_custom_specpm_registry_url(tmp_path: Path) -> None:
    result = run_script(
        "scripts/render-timeweb-deploy-branch.sh",
        str(tmp_path),
        env={
            "SPECSPACE_API_IMAGE_REF": f"ghcr.io/0al-spec/specspace-api@sha256:{API_DIGEST}",
            "SPECSPACE_UI_IMAGE_REF": f"ghcr.io/0al-spec/specspace-ui@sha256:{UI_DIGEST}",
            "SPECSPACE_SPECPM_REGISTRY_URL": "https://registry.example.invalid",
        },
    )

    assert result.returncode == 0, result.stderr
    compose = (tmp_path / "docker-compose.yml").read_text(encoding="utf-8")
    assert "https://registry.example.invalid" in compose

    check = run_script(
        "scripts/check-timeweb-deploy-tree.sh",
        str(tmp_path),
        env={"TIMEWEB_REQUIRED_SPECPM_REGISTRY_URL": "https://registry.example.invalid"},
    )
    assert check.returncode == 0, check.stderr


def test_check_timeweb_deploy_tree_requires_specpm_url_on_api_command(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text(
        "SpecPM registry URL: https://specpm.dev\n",
        encoding="utf-8",
    )
    (tmp_path / "docker-compose.yml").write_text(
        """
name: specspace

services:
  app:
    image: ghcr.io/0al-spec/specspace-ui@sha256:{ui_digest}
    environment:
      SPECSPACE_DOCUMENTED_SPECPM_REGISTRY_URL: https://specpm.dev
  specspace-api:
    image: ghcr.io/0al-spec/specspace-api@sha256:{api_digest}
    command:
      - python
      - viewer/server.py
      - --artifact-base-url
      - https://specgraph.tech
      - --specpm-registry-url
      - https://registry.example.invalid
""".format(api_digest=API_DIGEST, ui_digest=UI_DIGEST),
        encoding="utf-8",
    )

    result = run_script("scripts/check-timeweb-deploy-tree.sh", str(tmp_path))

    assert result.returncode != 0
    assert "specspace-api command must point at SpecPM registry URL" in result.stderr


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
      - --specpm-registry-url
      - https://specpm.dev
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


def test_platform_publish_threads_external_state_profile() -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(
        encoding="utf-8"
    )

    assert "PLATFORM_TIMEWEB_HOSTED_MANAGED_EXTERNAL_STATE_ENABLED" in workflow
    assert "PLATFORM_TIMEWEB_HOSTED_MANAGED_EXECUTOR_URL" in workflow
    assert "PLATFORM_TIMEWEB_EXTERNAL_STATE_URL" in workflow
    assert '"hosted_managed_external_state_enabled"' in workflow
    assert '"hosted_managed_executor_url"' in workflow
    assert '"external_state_url"' in workflow
    assert "SPECSPACE_EXTERNAL_STATE_TOKEN" not in workflow


def test_production_smoke_defaults_to_bound_hosted_workspace() -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(
        encoding="utf-8"
    )

    assert (
        "vars.SPECSPACE_PRODUCT_WORKSPACE_ID || 'hosted-operation-canary'"
        in workflow
    )
    assert (
        "vars.SPECSPACE_PRODUCT_WORKSPACE_ARTIFACT_BASE_URL || "
        "'https://specgraph.tech/workspaces/hosted-operation-canary'"
        in workflow
    )
    assert (
        "vars.SPECSPACE_PRODUCT_WORKSPACE_MANAGED_MODE || "
        "'hosted_managed_ready'"
        in workflow
    )
    assert '--expect-managed-mode "$SPECSPACE_PRODUCT_WORKSPACE_MANAGED_MODE"' in workflow
