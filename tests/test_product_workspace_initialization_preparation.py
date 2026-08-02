import json
import hashlib
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock

from viewer import (
    product_workspace_creation_requests,
    product_workspace_initialization_execution,
    specspace_provider,
    specspace_v1_api,
)


class ProductWorkspaceInitializationPreparationTests(unittest.TestCase):
    def _server(self, root: Path) -> SimpleNamespace:
        platform_dir = root / "Platform"
        (platform_dir / "scripts").mkdir(parents=True)
        (platform_dir / "scripts" / "platform.py").write_text("", encoding="utf-8")
        workspace_root = root / "private" / "workspaces"
        workspace_root.mkdir(parents=True)
        catalog = root / "private" / "workspaces.local.yaml"
        catalog.write_text(
            "schema_version: 1\n"
            "artifact_kind: platform_workspace_catalog\n"
            "organization_root: .\n"
            "workspaces: []\n"
            "registries: []\n",
            encoding="utf-8",
        )
        return SimpleNamespace(
            repo_root=root,
            platform_dir=platform_dir,
            platform_execution_enabled=True,
            hosted_managed_execution_enabled=False,
            platform_execution_timeout_seconds=30,
            specspace_state_dir=root / "state",
            runs_dir=root / "runs",
            product_workspace_root_dir=workspace_root,
            product_workspace_catalog=catalog,
        )

    def _write_platform_output(self, command: list[str]) -> None:
        output = Path(command[command.index("--output") + 1])
        output.parent.mkdir(parents=True, exist_ok=True)
        if "initialize-from-request" in command:
            workspace_id = command[command.index("--workspace-id") + 1]
            workspace_root = command[command.index("--path") + 1]
            payload = {
                "artifact_kind": "platform_product_workspace_initialization_plan",
                "ok": True,
                "dry_run": False,
                "creation_request_ref": str(
                    Path(command[command.index("--creation-request") + 1]).resolve()
                ),
                "catalog_ref": str(
                    Path(command[command.index("--catalog") + 1]).resolve()
                ),
                "workspace": {
                    "workspace_id": workspace_id,
                    "workspace_root": workspace_root,
                },
                "summary": {"ready_for_platform_initialization": True},
                "authority_boundary": {
                    "executes_specgraph": False,
                    "executes_platform": False,
                    "creates_workspace_files": False,
                    "updates_workspace_catalog": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "mutates_canonical_specs": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                },
            }
        else:
            plan_path = command[command.index("--plan") + 1]
            plan_bytes = Path(plan_path).read_bytes()
            plan = json.loads(plan_bytes)
            payload = {
                "artifact_kind": (
                    "platform_product_workspace_initialization_execution_request"
                ),
                "ok": True,
                "dry_run": False,
                "request_only": True,
                "requested_operation": "workspace.execute-initialization-plan",
                "plan_ref": plan_path,
                "plan_sha256": hashlib.sha256(plan_bytes).hexdigest(),
                "workspace": {
                    "workspace_id": plan["workspace"]["workspace_id"],
                    "workspace_root": plan["workspace"]["workspace_root"],
                },
                "summary": {"ready_for_managed_execution": True},
                "authority_boundary": {
                    "executes_specgraph": False,
                    "executes_platform": False,
                    "creates_workspace_files": False,
                    "updates_workspace_catalog": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "mutates_canonical_specs": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                },
            }
        output.write_text(json.dumps(payload), encoding="utf-8")

    def test_prepares_scoped_plan_and_request_from_creation_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            status, _ = product_workspace_creation_requests.save_request(
                server,
                {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                    "root_intent_summary": "Keep private pantry stock current.",
                },
                workspace_id="pantry-rotation",
            )
            self.assertEqual(status, HTTPStatus.OK)

            commands: list[list[str]] = []

            def run(**kwargs: object) -> tuple[HTTPStatus, None]:
                command = kwargs["command"]
                assert isinstance(command, list)
                commands.append(command)
                self._write_platform_output(command)
                return HTTPStatus.OK, None

            with mock.patch.object(
                product_workspace_initialization_execution,
                "_run_preparation_command",
                side_effect=run,
            ):
                response_status, response = (
                    product_workspace_initialization_execution.prepare_initialization_request(
                        server,
                        {"workspace_id": "pantry-rotation"},
                        workspace_id="pantry-rotation",
                    )
                )

            self.assertEqual(response_status, HTTPStatus.OK)
            self.assertTrue(response["ok"])
            self.assertEqual(response["status"], "initialization_request_prepared")
            self.assertEqual(
                response["execution_request_ref"],
                "runs/pantry-rotation/product_workspace_initialization_execution_request.json",
            )
            self.assertEqual(len(commands), 2)
            self.assertIn("initialize-from-request", commands[0])
            self.assertIn("request-initialization-execution", commands[1])
            self.assertFalse(response["authority_boundary"]["browser_executes_platform"])
            self.assertTrue(
                response["authority_boundary"]["specspace_backend_executes_platform"]
            )
            self.assertNotIn(str(server.product_workspace_root_dir), json.dumps(response))
            self.assertNotIn("Keep private pantry", json.dumps(response))

    def test_rejects_client_supplied_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            status, response = (
                product_workspace_initialization_execution.prepare_initialization_request(
                    server,
                    {
                        "workspace_id": "pantry-rotation",
                        "path": "/tmp/foreign",
                    },
                    workspace_id="pantry-rotation",
                )
            )

        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(response["fields"], ["path"])

    def test_workspace_projection_exposes_local_preparation_readiness(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            creation = {
                "summary": {"status": "workspace_creation_requested"},
                "active_request": {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                    "root_intent_summary_present": True,
                },
            }

            projection = specspace_v1_api._workspace_initialization_path(
                server=server,
                workspace_id="pantry-rotation",
                creation=creation,
            )

        self.assertEqual(projection["status"], "initialization_request_needed")
        self.assertTrue(projection["initialization_preparation_available"])
        self.assertIn("Prepare", projection["next_safe_action"])

    def test_rebuilds_existing_request_after_plan_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            product_workspace_creation_requests.save_request(
                server,
                {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                },
                workspace_id="pantry-rotation",
            )

            def run(**kwargs: object) -> tuple[HTTPStatus, None]:
                command = kwargs["command"]
                assert isinstance(command, list)
                self._write_platform_output(command)
                return HTTPStatus.OK, None

            with mock.patch.object(
                product_workspace_initialization_execution,
                "_run_preparation_command",
                side_effect=run,
            ):
                status, _ = (
                    product_workspace_initialization_execution.prepare_initialization_request(
                        server,
                        {"workspace_id": "pantry-rotation"},
                        workspace_id="pantry-rotation",
                    )
                )
            self.assertEqual(status, HTTPStatus.OK)
            plan_path = (
                server.runs_dir
                / "pantry-rotation"
                / product_workspace_initialization_execution.INITIALIZATION_PLAN_ARTIFACT
            )
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            plan["generated_at"] = "tampered"
            plan_path.write_text(json.dumps(plan), encoding="utf-8")

            commands: list[list[str]] = []

            def rerun_command(**kwargs: object) -> tuple[HTTPStatus, None]:
                command = kwargs["command"]
                assert isinstance(command, list)
                commands.append(command)
                self._write_platform_output(command)
                return HTTPStatus.OK, None

            with mock.patch.object(
                product_workspace_initialization_execution,
                "_run_preparation_command",
                side_effect=rerun_command,
            ):
                response_status, response = (
                    product_workspace_initialization_execution.prepare_initialization_request(
                        server,
                        {"workspace_id": "pantry-rotation"},
                        workspace_id="pantry-rotation",
                    )
                )

        self.assertEqual(response_status, HTTPStatus.OK)
        self.assertTrue(response["ok"])
        self.assertEqual(len(commands), 2)

    def test_rejects_symlinked_preparation_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            product_workspace_creation_requests.save_request(
                server,
                {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                },
                workspace_id="pantry-rotation",
            )
            workspace_runs = server.runs_dir / "pantry-rotation"
            workspace_runs.mkdir(parents=True)
            foreign = Path(tmp) / "foreign.json"
            foreign.write_text("{}\n", encoding="utf-8")
            (workspace_runs / product_workspace_initialization_execution.INITIALIZATION_PLAN_ARTIFACT).symlink_to(
                foreign
            )

            response_status, response = (
                product_workspace_initialization_execution.prepare_initialization_request(
                    server,
                    {"workspace_id": "pantry-rotation"},
                    workspace_id="pantry-rotation",
                )
            )

        self.assertEqual(response_status, HTTPStatus.CONFLICT)
        self.assertIn("must not be symlinks", response["error"])

    def test_rejects_catalog_change_during_plan_generation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            product_workspace_creation_requests.save_request(
                server,
                {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                },
                workspace_id="pantry-rotation",
            )

            def run(**kwargs: object) -> tuple[HTTPStatus, None]:
                command = kwargs["command"]
                assert isinstance(command, list)
                self._write_platform_output(command)
                server.product_workspace_catalog.write_text(
                    server.product_workspace_catalog.read_text(encoding="utf-8")
                    + "# changed\n",
                    encoding="utf-8",
                )
                return HTTPStatus.OK, None

            with mock.patch.object(
                product_workspace_initialization_execution,
                "_run_preparation_command",
                side_effect=run,
            ):
                response_status, response = (
                    product_workspace_initialization_execution.prepare_initialization_request(
                        server,
                        {"workspace_id": "pantry-rotation"},
                        workspace_id="pantry-rotation",
                    )
                )

        self.assertEqual(response_status, HTTPStatus.CONFLICT)
        self.assertIn("changed during planning", response["error"])

    def test_requested_workspace_provider_reads_scoped_preparation_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            server = self._server(Path(tmp))
            product_workspace_creation_requests.save_request(
                server,
                {
                    "workspace_id": "pantry-rotation",
                    "display_name": "Pantry Rotation",
                },
                workspace_id="pantry-rotation",
            )
            workspace_runs = server.runs_dir / "pantry-rotation"
            workspace_runs.mkdir(parents=True)
            (workspace_runs / product_workspace_initialization_execution.INITIALIZATION_PLAN_ARTIFACT).write_text(
                "{}\n", encoding="utf-8"
            )
            (workspace_runs / "active_idea_to_spec_candidate.json").write_text(
                json.dumps(
                    {
                        "artifact_kind": "active_idea_to_spec_candidate",
                        "candidate": {"candidate_id": "pantry-rotation"},
                    }
                ),
                encoding="utf-8",
            )
            server.artifact_base_url = None
            server.product_workspace_artifact_base_urls = {}
            server.spec_dir = None
            server.specgraph_dir = None

            provider = specspace_provider.provider_from_server(
                server,
                "pantry-rotation",
            )

        self.assertEqual(provider.kind, "file-product-workspace")
        self.assertEqual(provider.delegate.runs_dir, workspace_runs)
        self.assertEqual(provider.artifact_run_dir_ref, "runs/pantry-rotation")
        self.assertTrue(provider.pre_candidate_only)
        self.assertNotIn(
            "active_idea_to_spec_candidate.json",
            provider._workspace_artifacts(),
        )


if __name__ == "__main__":
    unittest.main()
