from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import io
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import urllib.error

from viewer import (
    hosted_managed_execution,
    idea_to_spec_workspace,
    product_workspace_binding,
    specspace_v1_api,
)


TOKEN = "specspace-hosted-token-0123456789abcdef"


def ready_binding(workspace_id: str = "pantry-control") -> dict:
    return {
        "available": True,
        "status": "ready",
        "trusted": True,
        "workspace_id": workspace_id,
        "binding_id": f"product-workspace-binding://{workspace_id}",
        "binding_revision_sha256": "2" * 64,
        "source_ref": "runs/platform_product_workspace_initialization_execution_report.json",
        "source_sha256": "3" * 64,
        "identity": {
            "workspace_id": workspace_id,
            "route": f"/{workspace_id}",
            "repository_role": "product_spec_workspace",
        },
        "routing": {
            "specspace_state_namespace_ref": f"specspace-state://workspace/{workspace_id}",
            "platform_default_run_dir_ref": f"runs/{workspace_id}",
            "product_artifact_bundle_ref": f"workspaces/{workspace_id}",
        },
        "repository": {
            "repository_role": "product_spec_workspace",
            "workspace_identity": workspace_id,
            "worktree_identity": f"product-workspace/{workspace_id}",
            "creates_worktree": False,
        },
        "authority_boundary": {
            "report_only": True,
            "workspace_binding_is_execution_authority": False,
            "may_execute_platform": False,
        },
    }


class PlatformStubHandler(BaseHTTPRequestHandler):
    received: list[dict] = []

    def log_message(self, format: str, *args: object) -> None:
        return

    def _write(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/v1/health":
            self._write(
                200,
                {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 12,
                    "adapter": "postgresql",
                },
            )
            return
        request_id = self.path.split("request_id=", 1)[-1].split("&", 1)[0]
        from urllib.parse import unquote_plus

        request_id = unquote_plus(request_id)
        self._write(
            200,
            {
                "artifact_kind": "platform_hosted_managed_operation_status_report",
                "schema_version": 1,
                "ok": True,
                "job": {
                    "request_id": request_id,
                    "status": "running",
                    "attempt": 1,
                    "receipt": {"status": "running", "output_reports": []},
                },
                "events": [],
                "summary": {"status": "running", "terminal": False},
                "authority_boundary": {
                    "status_is_execution_authority": False,
                    "queue_status_is_lifecycle_evidence": False,
                    "platform_output_reports_are_authoritative": True,
                },
            },
        )

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length))
        type(self).received.append(payload)
        operation_id = payload["operation_id"]
        workspace_id = payload["workspace_id"]
        request_id = (
            f"managed-operation://{workspace_id}/{operation_id}/0123456789abcdef01234567"
        )
        self._write(
            202,
            {
                "artifact_kind": "platform_hosted_managed_operation_enqueue_report",
                "schema_version": 1,
                "ok": True,
                "request": {
                    "artifact_kind": "platform_hosted_managed_operation_request",
                    "request_id": request_id,
                    "idempotency_key": "1" * 64,
                    "generated_at": "2026-07-10T00:00:00Z",
                    "operation": {"operation_id": operation_id},
                    "workspace": {"workspace_id": workspace_id},
                    "workspace_binding": {
                        "binding_id": f"product-workspace-binding://{workspace_id}",
                        "binding_revision_sha256": "2" * 64,
                    },
                    "expected_output_reports": [
                        "runs/platform_product_workspace_initialization_execution_report.json"
                    ],
                },
                "receipt": {
                    "status": "queued",
                    "attempt": 0,
                    "request_ref": request_id,
                    "idempotency_key": "1" * 64,
                    "operation_id": operation_id,
                    "workspace_id": workspace_id,
                },
                "summary": {
                    "status": "hosted_managed_operation_queued",
                    "request_id": request_id,
                },
                "authority_boundary": {
                    "enqueue_is_execution_authority": False,
                    "queue_status_is_lifecycle_evidence": False,
                    "platform_output_reports_are_authoritative": True,
                },
            },
        )


class HostedManagedExecutionTests(unittest.TestCase):
    def setUp(self) -> None:
        PlatformStubHandler.received = []

    def start_stub(self) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
        server = ThreadingHTTPServer(("127.0.0.1", 0), PlatformStubHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server, thread, f"http://127.0.0.1:{server.server_address[1]}"

    def test_initialization_endpoint_enqueues_and_persists_compact_state(self) -> None:
        server, thread, base_url = self.start_stub()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp = Path(temp_dir)
                runtime = SimpleNamespace(
                    repo_root=temp,
                    specspace_state_dir=temp / "state",
                    runs_dir=temp / "runs",
                    hosted_managed_execution_enabled=True,
                    hosted_managed_executor_url=base_url,
                    hosted_managed_executor_token=TOKEN,
                    hosted_managed_executor_timeout_seconds=2,
                )
                status, response = hosted_managed_execution.enqueue_operation(
                    runtime,
                    operation_id="workspace_initialization_execute",
                    workspace_id="pantry-control",
                    payload={
                        "workspace_id": "pantry-control",
                        "execution_request_ref": (
                            "runs/pantry-control/"
                            "product_workspace_initialization_execution_request.json"
                        ),
                    },
                )
                state = hosted_managed_execution.read_state(runtime)
                projection = hosted_managed_execution.refresh_workspace(
                    runtime,
                    workspace_id="pantry-control",
                )
                serialized = hosted_managed_execution.state_path(runtime).read_text(
                    encoding="utf-8"
                )
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertEqual(response["status"], "execution_requested")
        self.assertEqual(len(state["requests"]), 1)
        self.assertEqual(
            projection["operations"]["workspace_initialization_execute"]["status"],
            "running",
        )
        self.assertNotIn(TOKEN, serialized)
        self.assertNotIn(base_url, serialized)
        self.assertNotIn("root_intent", serialized)
        self.assertEqual(
            PlatformStubHandler.received[0]["input_refs"],
            ["runs/product_workspace_initialization_execution_request.json"],
        )

    def test_hosted_operation_uses_scoped_provider_binding_ref(self) -> None:
        server, thread, base_url = self.start_stub()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp = Path(temp_dir)
                runtime = SimpleNamespace(
                    repo_root=temp,
                    specspace_state_dir=temp / "state",
                    runs_dir=temp / "runs",
                    hosted_managed_execution_enabled=True,
                    hosted_managed_executor_url=base_url,
                    hosted_managed_executor_token=TOKEN,
                    hosted_managed_executor_timeout_seconds=2,
                )
                status, _ = hosted_managed_execution.enqueue_operation(
                    runtime,
                    operation_id="review_status_execute",
                    workspace_id="pantry-control",
                    payload={"workspace_id": "pantry-control"},
                    workspace_binding=ready_binding(),
                )
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertEqual(
            PlatformStubHandler.received[0]["workspace_binding_ref"],
            "runs/pantry-control/platform_product_workspace_initialization_execution_report.json",
        )
        self.assertEqual(
            PlatformStubHandler.received[0]["input_refs"],
            ["runs/product_candidate_promotion_execution_report.json"],
        )

    def test_review_status_enqueues_published_review_object_evidence(self) -> None:
        server, thread, base_url = self.start_stub()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp = Path(temp_dir)
                runtime = SimpleNamespace(
                    repo_root=temp,
                    specspace_state_dir=temp / "state",
                    runs_dir=temp / "runs",
                    hosted_managed_execution_enabled=True,
                    hosted_managed_executor_url=base_url,
                    hosted_managed_executor_token=TOKEN,
                    hosted_managed_executor_timeout_seconds=2,
                )
                status, _ = hosted_managed_execution.enqueue_operation(
                    runtime,
                    operation_id="review_status_execute",
                    workspace_id="pantry-control",
                    payload={"workspace_id": "pantry-control"},
                    workspace_binding=ready_binding(),
                    workspace_payload={
                        "artifacts": {
                            "product_promotion_review_object_evidence": {
                                "available": True,
                                "valid": True,
                            }
                        }
                    },
                )
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertEqual(
            PlatformStubHandler.received[0]["input_refs"],
            [
                "runs/product_candidate_promotion_execution_report.json",
                "runs/product_candidate_promotion_review_object_evidence.json",
            ],
        )

    def test_non_loopback_plain_http_executor_is_rejected(self) -> None:
        with self.assertRaises(hosted_managed_execution.HostedExecutionError):
            hosted_managed_execution.HostedManagedOperationClient(
                base_url="http://executor.example.test",
                token=TOKEN,
                timeout_seconds=2,
            )

    def test_client_surfaces_safe_platform_contract_rejection(self) -> None:
        client = hosted_managed_execution.HostedManagedOperationClient(
            base_url="https://executor.example.test",
            token=TOKEN,
            timeout_seconds=2,
        )
        error = urllib.error.HTTPError(
            "https://executor.example.test/v1/managed-operations",
            409,
            "Conflict",
            {},
            io.BytesIO(json.dumps({"error": "workspace binding source is missing"}).encode()),
        )

        with patch("urllib.request.urlopen", side_effect=error), self.assertRaisesRegex(
            hosted_managed_execution.HostedExecutionError,
            "HTTP 409: workspace binding source is missing",
        ):
            client.enqueue({"operation_id": "review_status_execute"})

    def test_remote_error_sanitizer_rejects_local_paths_and_secrets(self) -> None:
        self.assertIsNone(
            hosted_managed_execution._safe_remote_error(
                "token failed at /Users/operator/private"
            )
        )

    def test_enqueue_uses_canonical_receipt_request_identity(self) -> None:
        report = {
            "artifact_kind": "platform_hosted_managed_operation_enqueue_report",
            "ok": True,
            "request": {
                "request_id": "managed-operation://pantry-control/rebuilt",
                "idempotency_key": "2" * 64,
                "generated_at": "2026-07-10T00:00:00Z",
                "operation": {"operation_id": "review_status_execute"},
                "workspace": {"workspace_id": "pantry-control"},
                "workspace_binding": {},
                "expected_output_reports": [],
            },
            "receipt": {
                "status": "queued",
                "request_ref": "managed-operation://pantry-control/canonical",
                "idempotency_key": "1" * 64,
                "operation_id": "review_status_execute",
                "workspace_id": "pantry-control",
            },
            "authority_boundary": {
                "enqueue_is_execution_authority": False,
                "queue_status_is_lifecycle_evidence": False,
                "platform_output_reports_are_authoritative": True,
            },
        }

        record = hosted_managed_execution._compact_enqueue_record(report)

        self.assertEqual(
            record["request_id"], "managed-operation://pantry-control/canonical"
        )
        self.assertEqual(record["idempotency_key"], "1" * 64)

    def test_enqueue_accepts_idempotent_terminal_receipt(self) -> None:
        report = {
            "artifact_kind": "platform_hosted_managed_operation_enqueue_report",
            "ok": True,
            "request": {
                "idempotency_key": "2" * 64,
                "generated_at": "2026-07-10T00:00:00Z",
                "operation": {"operation_id": "review_status_execute"},
                "workspace": {"workspace_id": "pantry-control"},
                "workspace_binding": {},
                "expected_output_reports": [
                    "runs/product_candidate_promotion_review_status_report.json"
                ],
            },
            "receipt": {
                "status": "succeeded",
                "attempt": 1,
                "request_ref": "managed-operation://pantry-control/review/succeeded",
                "idempotency_key": "1" * 64,
                "operation_id": "review_status_execute",
                "workspace_id": "pantry-control",
                "output_reports": [
                    {
                        "logical_ref": "runs/product_candidate_promotion_review_status_report.json",
                        "sha256": "3" * 64,
                    }
                ],
            },
            "authority_boundary": {
                "enqueue_is_execution_authority": False,
                "queue_status_is_lifecycle_evidence": False,
                "platform_output_reports_are_authoritative": True,
            },
        }

        record = hosted_managed_execution._compact_enqueue_record(report)

        self.assertEqual(record["status"], "succeeded")
        self.assertEqual(record["attempt"], 1)
        self.assertEqual(len(record["output_reports"]), 1)

    def test_replay_safe_operator_actions_receive_distinct_refs(self) -> None:
        first = hosted_managed_execution._operator_ref("review_status_execute")
        second = hosted_managed_execution._operator_ref("review_status_execute")

        self.assertNotEqual(first, second)
        self.assertTrue(first.startswith("operator://specspace-"))
        self.assertEqual(
            hosted_managed_execution._operator_ref("real_idea_intake_execute"),
            "operator://specspace-backend",
        )

    def test_enqueue_rejects_nested_authority_expansion(self) -> None:
        report = {
            "artifact_kind": "platform_hosted_managed_operation_enqueue_report",
            "ok": True,
            "request": {
                "request_id": "managed-operation://pantry-control/request",
                "idempotency_key": "1" * 64,
                "operation": {"operation_id": "review_status_execute"},
                "workspace": {"workspace_id": "pantry-control"},
                "authority_boundary": {"may_execute_platform": True},
            },
            "receipt": {
                "status": "queued",
                "request_ref": "managed-operation://pantry-control/request",
                "idempotency_key": "1" * 64,
                "operation_id": "review_status_execute",
                "workspace_id": "pantry-control",
            },
            "authority_boundary": {
                "enqueue_is_execution_authority": False,
                "queue_status_is_lifecycle_evidence": False,
                "platform_output_reports_are_authoritative": True,
            },
        }

        with self.assertRaises(hosted_managed_execution.HostedExecutionError):
            hosted_managed_execution._compact_enqueue_record(report)

    def test_confirmation_is_durable_evidence_without_execution_authority(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = SimpleNamespace(
                repo_root=Path(temp_dir),
                specspace_state_dir=Path(temp_dir) / "state",
            )
            ref = hosted_managed_execution._confirmation_ref(
                runtime,
                "pantry-control",
                "promotion_review_execute",
            )
            path = runtime.specspace_state_dir / ref.removeprefix(
                "specspace-state://"
            )
            payload = json.loads(path.read_text(encoding="utf-8"))

        self.assertTrue(payload["confirmed"])
        self.assertFalse(
            payload["authority_boundary"]["hosted_request_state_is_execution_authority"]
        )
        self.assertFalse(
            payload["authority_boundary"]["specspace_opens_pull_request"]
        )

    def test_managed_execution_routes_to_hosted_boundary_without_local_callback(self) -> None:
        server = SimpleNamespace(hosted_managed_execution_enabled=True)
        with patch.object(
            hosted_managed_execution,
            "enqueue_operation",
            return_value=(HTTPStatus.ACCEPTED, {"status": "execution_requested"}),
        ) as enqueue, patch.object(
            specspace_v1_api.specspace_provider,
            "provider_from_server",
        ) as provider_from_server, patch.object(
            product_workspace_binding,
            "discover_binding",
            return_value=ready_binding(),
        ):
            provider_from_server.return_value.read_idea_to_spec_workspace.return_value = (
                HTTPStatus.OK,
                {"workspace_binding": ready_binding()},
            )
            status, response = specspace_v1_api._managed_execution(
                server,
                operation_id="review_status_execute",
                payload={"workspace_id": "pantry-control"},
                workspace_id="pantry-control",
                local_execute=lambda: self.fail("local executor must not run"),
            )

        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertEqual(response["status"], "execution_requested")
        enqueue.assert_called_once()

    def test_hosted_enqueue_rejects_operation_outside_client_allowlist(self) -> None:
        server = SimpleNamespace(
            hosted_managed_execution_enabled=True,
            hosted_managed_operation_allowlist=frozenset({"review_status_execute"}),
        )

        status, response = hosted_managed_execution.enqueue_operation(
            server,
            operation_id="promotion_execute_dry_run",
            workspace_id="pantry-control",
            payload={},
        )

        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response["reason"],
            "hosted_managed_operation_not_allowlisted",
        )

    def test_hosted_enqueue_rejects_entire_allowlist_with_unknown_id(self) -> None:
        server = SimpleNamespace(
            hosted_managed_execution_enabled=True,
            hosted_managed_operation_allowlist=frozenset(
                {"review_status_execute", "typo"}
            ),
        )

        status, response = hosted_managed_execution.enqueue_operation(
            server,
            operation_id="review_status_execute",
            workspace_id="pantry-control",
            payload={},
        )

        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response["reason"],
            "hosted_managed_operation_not_allowlisted",
        )

    def test_ephemeral_hosted_enqueue_requires_explicit_allowlist(self) -> None:
        server = SimpleNamespace(
            hosted_managed_execution_enabled=True,
            hosted_managed_state_durability="ephemeral",
            hosted_managed_operation_allowlist=None,
        )

        status, response = hosted_managed_execution.enqueue_operation(
            server,
            operation_id="review_status_execute",
            workspace_id="pantry-control",
            payload={},
        )

        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response["reason"],
            "hosted_managed_operation_not_allowlisted",
        )

    def test_workspace_initialization_path_enables_configured_hosted_executor(self) -> None:
        server = SimpleNamespace(
            platform_execution_enabled=False,
            platform_dir=None,
            hosted_managed_execution_enabled=True,
            hosted_managed_executor_url="https://executor.example.test",
            hosted_managed_executor_token=TOKEN,
            hosted_managed_executor_timeout_seconds=2,
        )

        path = specspace_v1_api._workspace_initialization_path(
            server=server,
            workspace_id="pantry-control",
            creation={"summary": {"status": "workspace_creation_requested"}},
        )

        self.assertTrue(path["managed_execution_available"])

    def test_hosted_managed_readiness_does_not_require_local_platform_cli(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            state_dir = temp / "state"
            runs_dir = temp / "runs"
            state_dir.mkdir()
            runs_dir.mkdir()
            server = SimpleNamespace(
                platform_dir=None,
                platform_execution_enabled=False,
                hosted_managed_execution_enabled=True,
                hosted_managed_executor_url="https://executor.example.test",
                hosted_managed_executor_token=TOKEN,
                hosted_managed_executor_timeout_seconds=2,
                specspace_state_dir=state_dir,
                runs_dir=runs_dir,
                artifact_base_url=None,
                product_workspace_artifact_base_urls={},
                team_decision_log_artifact_base_url=None,
                platform_execution_timeout_seconds=120,
            )
            provider = SimpleNamespace(
                health=lambda: {
                    "status": "ok",
                    "provider": "local",
                    "read_only": False,
                }
            )
            client = SimpleNamespace(
                health=lambda: {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 12,
                    "adapter": "postgresql",
                }
            )
            with patch.object(
                hosted_managed_execution,
                "client_from_server",
                return_value=client,
            ):
                readiness = specspace_v1_api._managed_mode_readiness(
                    server=server,
                    provider=provider,
                    workspace_id="pantry-control",
                    observability={"operations": []},
                    workspace_binding=ready_binding(),
                )

        self.assertEqual(readiness["status"], "hosted_managed_ready")
        self.assertEqual(readiness["mode"], "hosted_managed")
        self.assertEqual(readiness["executor"]["transport"], "hosted_queue")
        self.assertTrue(readiness["executor"]["hosted_service_reachable"])
        self.assertEqual(
            readiness["executor"]["hosted_service_adapter"], "postgresql"
        )
        self.assertFalse(readiness["executor"]["platform_cli_present"])

    def test_enabling_local_and_hosted_executors_is_misconfigured(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            state_dir = temp / "state"
            runs_dir = temp / "runs"
            platform_dir = temp / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text("", encoding="utf-8")
            state_dir.mkdir()
            runs_dir.mkdir()
            server = SimpleNamespace(
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                hosted_managed_execution_enabled=True,
                hosted_managed_executor_url="https://executor.example.test",
                hosted_managed_executor_token=TOKEN,
                hosted_managed_executor_timeout_seconds=2,
                specspace_state_dir=state_dir,
                runs_dir=runs_dir,
                artifact_base_url=None,
                product_workspace_artifact_base_urls={},
                team_decision_log_artifact_base_url=None,
                platform_execution_timeout_seconds=120,
            )
            provider = SimpleNamespace(
                health=lambda: {"status": "ok", "provider": "local", "read_only": False}
            )
            client = SimpleNamespace(
                health=lambda: {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 12,
                    "adapter": "postgresql",
                }
            )
            with patch.object(
                hosted_managed_execution,
                "client_from_server",
                return_value=client,
            ):
                readiness = specspace_v1_api._managed_mode_readiness(
                    server=server,
                    provider=provider,
                    workspace_id="pantry-control",
                    observability={"operations": []},
                    workspace_binding=ready_binding(),
                )

        self.assertEqual(readiness["status"], "hosted_managed_misconfigured")
        self.assertIn("multiple_managed_executors_enabled", readiness["disabled_reasons"])

    def test_hosted_allowlist_limits_ready_operation_count(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            state_dir = temp / "state"
            runs_dir = temp / "runs"
            state_dir.mkdir()
            runs_dir.mkdir()
            server = SimpleNamespace(
                platform_dir=None,
                platform_execution_enabled=False,
                hosted_managed_execution_enabled=True,
                hosted_managed_executor_url="https://executor.example.test",
                hosted_managed_executor_token=TOKEN,
                hosted_managed_executor_timeout_seconds=2,
                specspace_state_dir=state_dir,
                runs_dir=runs_dir,
                artifact_base_url=None,
                product_workspace_artifact_base_urls={},
                team_decision_log_artifact_base_url=None,
                platform_execution_timeout_seconds=120,
            )
            provider = SimpleNamespace(
                health=lambda: {
                    "status": "ok",
                    "provider": "local",
                    "read_only": False,
                }
            )
            client = SimpleNamespace(
                health=lambda: {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 1,
                    "enabled_operation_ids": ["review_status_execute"],
                    "adapter": "postgresql",
                }
            )
            observability = {
                "operations": [
                    {"operation_id": "review_status_execute", "status": "ready_to_execute"},
                    {"operation_id": "promotion_review_execute", "status": "ready_to_execute"},
                ]
            }
            with patch.object(
                hosted_managed_execution,
                "client_from_server",
                return_value=client,
            ):
                readiness = specspace_v1_api._managed_mode_readiness(
                    server=server,
                    provider=provider,
                    workspace_id="pantry-control",
                    observability=observability,
                    workspace_binding=ready_binding(),
                )

        self.assertEqual(readiness["status"], "hosted_managed_ready")
        self.assertEqual(readiness["operations"]["enabled_count"], 1)
        self.assertEqual(
            readiness["executor"]["hosted_enabled_operation_ids"],
            ["review_status_execute"],
        )

    def test_ephemeral_client_allowlist_is_reported_and_limits_service_scope(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            state_dir = temp / "state"
            runs_dir = temp / "runs"
            state_dir.mkdir()
            runs_dir.mkdir()
            server = SimpleNamespace(
                platform_dir=None,
                platform_execution_enabled=False,
                hosted_managed_execution_enabled=True,
                hosted_managed_executor_url="https://executor.example.test",
                hosted_managed_executor_token=TOKEN,
                hosted_managed_executor_timeout_seconds=2,
                hosted_managed_state_durability="ephemeral",
                hosted_managed_operation_allowlist=frozenset(
                    {"review_status_execute"}
                ),
                specspace_state_dir=state_dir,
                runs_dir=runs_dir,
                artifact_base_url=None,
                product_workspace_artifact_base_urls={},
                team_decision_log_artifact_base_url=None,
                platform_execution_timeout_seconds=120,
            )
            provider = SimpleNamespace(
                health=lambda: {
                    "status": "ok",
                    "provider": "local",
                    "read_only": False,
                }
            )
            client = SimpleNamespace(
                health=lambda: {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 2,
                    "enabled_operation_ids": [
                        "review_status_execute",
                        "promotion_execute_dry_run",
                    ],
                    "adapter": "postgresql",
                }
            )
            observability = {
                "operations": [
                    {
                        "operation_id": "review_status_execute",
                        "status": "ready_to_execute",
                    },
                    {
                        "operation_id": "promotion_execute_dry_run",
                        "status": "ready_to_execute",
                    },
                ]
            }
            with patch.object(
                hosted_managed_execution,
                "client_from_server",
                return_value=client,
            ):
                readiness = specspace_v1_api._managed_mode_readiness(
                    server=server,
                    provider=provider,
                    workspace_id="pantry-control",
                    observability=observability,
                    workspace_binding=ready_binding(),
                )

        self.assertEqual(readiness["status"], "hosted_managed_ready")
        self.assertEqual(readiness["operations"]["enabled_count"], 1)
        self.assertEqual(
            readiness["executor"]["hosted_service_operation_ids"],
            ["promotion_execute_dry_run", "review_status_execute"],
        )
        self.assertEqual(
            readiness["executor"]["hosted_client_operation_ids"],
            ["review_status_execute"],
        )
        self.assertEqual(
            readiness["executor"]["hosted_enabled_operation_ids"],
            ["review_status_execute"],
        )
        self.assertEqual(readiness["state"]["durability"], "ephemeral")
        self.assertFalse(readiness["state"]["restart_persistent"])

    def test_ephemeral_readiness_without_client_allowlist_is_misconfigured(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            state_dir = temp / "state"
            runs_dir = temp / "runs"
            state_dir.mkdir()
            runs_dir.mkdir()
            server = SimpleNamespace(
                platform_dir=None,
                platform_execution_enabled=False,
                hosted_managed_execution_enabled=True,
                hosted_managed_executor_url="https://executor.example.test",
                hosted_managed_executor_token=TOKEN,
                hosted_managed_executor_timeout_seconds=2,
                hosted_managed_state_durability="ephemeral",
                hosted_managed_operation_allowlist=None,
                specspace_state_dir=state_dir,
                runs_dir=runs_dir,
                artifact_base_url=None,
                product_workspace_artifact_base_urls={},
                team_decision_log_artifact_base_url=None,
                platform_execution_timeout_seconds=120,
            )
            provider = SimpleNamespace(
                health=lambda: {
                    "status": "ok",
                    "provider": "local",
                    "read_only": False,
                }
            )
            client = SimpleNamespace(
                health=lambda: {
                    "artifact_kind": "platform_hosted_managed_operation_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": "platform.hosted-managed-operation.request.v1",
                    "registry_contract_ref": "platform.managed-operation.registry.v1",
                    "operation_count": 1,
                    "enabled_operation_ids": ["review_status_execute"],
                    "adapter": "postgresql",
                }
            )
            with patch.object(
                hosted_managed_execution,
                "client_from_server",
                return_value=client,
            ):
                readiness = specspace_v1_api._managed_mode_readiness(
                    server=server,
                    provider=provider,
                    workspace_id="pantry-control",
                    observability={
                        "operations": [
                            {
                                "operation_id": "review_status_execute",
                                "status": "ready_to_execute",
                            }
                        ]
                    },
                    workspace_binding=ready_binding(),
                )

        self.assertEqual(readiness["status"], "hosted_managed_misconfigured")
        self.assertEqual(readiness["operations"]["enabled_count"], 0)
        self.assertIn(
            "hosted_client_operation_allowlist_invalid",
            readiness["disabled_reasons"],
        )

    def test_queue_success_waits_for_authoritative_platform_report(self) -> None:
        payload = {
            "artifacts": {},
            "hosted_managed_execution": {
                "operations": {
                    "review_status_execute": {
                        "request_id": (
                            "managed-operation://pantry-control/"
                            "review_status_execute/0123456789abcdef01234567"
                        ),
                        "status": "succeeded",
                        "attempt": 1,
                        "output_reports": [
                            {
                                "logical_ref": (
                                    "runs/product_candidate_promotion_"
                                    "review_status_report.json"
                                ),
                                "sha256": "1" * 64,
                            }
                        ],
                    }
                }
            },
        }

        observability = idea_to_spec_workspace._managed_operations_observability(
            payload
        )
        review_status = next(
            item
            for item in observability["operations"]
            if item["operation_id"] == "review_status_execute"
        )

        self.assertEqual(review_status["status"], "running_or_waiting")
        self.assertFalse(
            review_status["hosted_transport"][
                "transport_status_is_lifecycle_evidence"
            ]
        )

    def test_allowlist_blocks_excluded_observability_operation(self) -> None:
        observability = idea_to_spec_workspace._managed_operations_observability(
            {"artifacts": {}},
            allowed_operation_ids={"review_status_execute"},
        )
        promotion_review = next(
            item
            for item in observability["operations"]
            if item["operation_id"] == "promotion_review_execute"
        )

        self.assertEqual(promotion_review["status"], "blocked")
        self.assertIn("deployment allowlist", promotion_review["next_safe_action"])

    def test_rejected_enqueue_is_visible_as_blocked_operation(self) -> None:
        payload = {
            "artifacts": {},
            "hosted_managed_execution": {
                "operations": {
                    "review_status_execute": {
                        "request_id": (
                            "managed-operation://pantry-control/"
                            "review_status_execute/0123456789abcdef01234567"
                        ),
                        "status": "rejected",
                        "attempt": 0,
                        "output_reports": [],
                    }
                }
            },
        }

        observability = idea_to_spec_workspace._managed_operations_observability(
            payload
        )
        review_status = next(
            item
            for item in observability["operations"]
            if item["operation_id"] == "review_status_execute"
        )

        self.assertEqual(review_status["status"], "blocked")
        self.assertEqual(
            review_status["hosted_transport"]["status"], "rejected"
        )
        self.assertIn("rejected", review_status["next_safe_action"])


if __name__ == "__main__":
    unittest.main()
