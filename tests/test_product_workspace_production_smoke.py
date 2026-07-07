from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "product_workspace_production_smoke.py"
spec = importlib.util.spec_from_file_location(
    "product_workspace_production_smoke", SCRIPT_PATH
)
assert spec is not None
smoke = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["product_workspace_production_smoke"] = smoke
spec.loader.exec_module(smoke)


def _config(**overrides):
    data = {
        "base_url": "https://specgraph.space",
        "workspace": "team-decision-log",
        "artifact_base": "https://specgraph.tech/workspaces/team-decision-log",
        "expect_managed_mode": "read_only",
        "timeout_seconds": 1.0,
        "require_deployment_metadata": True,
    }
    data.update(overrides)
    return smoke.SmokeConfig(**data)


def _health():
    return {
        "api_version": "v1",
        "deployment": {
            "version": "0.0.1",
            "commit": "abc123",
        },
    }


def _workspace_payload(**overrides):
    payload = {
        "selected_workspace_id": "team-decision-log",
        "workspace": {"id": "team-decision-log"},
        "source": {
            "provider": "http-product-workspace",
            "artifact_base_url": "https://specgraph.tech/workspaces/team-decision-log",
        },
        "managed_mode_readiness": {
            "status": "read_only",
            "mode": "read_only",
            "executor": {
                "enabled": False,
                "configured": False,
            },
            "operations": {
                "registered_count": 12,
                "enabled_count": 0,
                "disabled_count": 12,
            },
            "authority_boundary": {
                "may_execute_platform": False,
                "may_execute_specgraph": False,
                "may_create_branch_or_commit": False,
            },
        },
        "managed_operations_observability": {
            "summary": {
                "operation_count": 12,
            },
            "authority_boundary": {
                "may_execute_platform": False,
                "may_create_branch_or_commit": False,
            },
            "operations": [
                {
                    "operation_id": "product_workspace_initialization",
                    "phase": "workspace",
                    "status": "disabled_missing_inputs",
                    "authority_boundary": {
                        "may_execute_platform": False,
                        "may_create_branch_or_commit": False,
                    },
                }
            ],
        },
    }
    payload.update(overrides)
    return payload


def _report(payload=None, html="<html><body>SpecSpace</body></html>", health=None):
    return smoke.validate_smoke_payloads(
        _config(),
        health=health or _health(),
        workspace_payload=payload or _workspace_payload(),
        shell_html=html,
    )


class ProductWorkspaceProductionSmokeTests(unittest.TestCase):
    def assert_error_check(self, report, check: str) -> None:
        self.assertIn(check, {error["check"] for error in report["errors"]})

    def test_happy_production_read_only_workspace_passes(self) -> None:
        report = _report()

        self.assertTrue(report["ok"])
        self.assertEqual(report["summary"]["status"], "passed")
        self.assertEqual(report["summary"]["managed_mode"], "read_only")
        self.assertEqual(report["summary"]["provider"], "http-product-workspace")
        self.assertEqual(report["summary"]["operation_count"], 1)

    def test_wrong_managed_mode_blocks(self) -> None:
        payload = _workspace_payload(
            managed_mode_readiness={
                "status": "backend_managed_ready",
                "mode": "backend_managed",
                "executor": {"enabled": True, "configured": True},
                "operations": {"enabled_count": 1},
                "authority_boundary": {"may_execute_platform": False},
            }
        )

        report = _report(payload)

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "managed_mode_readiness")

    def test_missing_managed_readiness_blocks(self) -> None:
        payload = _workspace_payload(managed_mode_readiness={})

        report = _report(payload)

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "managed_mode_readiness")

    def test_bootstrap_artifact_provider_blocks(self) -> None:
        payload = _workspace_payload(
            source={
                "provider": "http",
                "artifact_base_url": "https://specgraph.tech",
            }
        )

        report = _report(payload)

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "product_provider")

    def test_legacy_contextbuilder_shell_blocks(self) -> None:
        report = _report(html="<html><body>ContextBuilder Viewer</body></html>")

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "app_shell")

    def test_truthy_write_authority_flag_blocks(self) -> None:
        payload = _workspace_payload()
        payload["managed_operations_observability"]["operations"][0][
            "authority_boundary"
        ]["may_create_branch_or_commit"] = "false"

        report = _report(payload)

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "authority_boundary")

    def test_missing_deployment_metadata_blocks_when_required(self) -> None:
        report = _report(health={"api_version": "v1", "deployment": {}})

        self.assertFalse(report["ok"])
        self.assert_error_check(report, "health")


if __name__ == "__main__":
    unittest.main()
