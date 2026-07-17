from __future__ import annotations

from contextlib import contextmanager
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
import urllib.parse

from scripts import migrate_specspace_state
from viewer import real_idea_entry_requests, specspace_state_backend


TOKEN = "specspace-state-consumer-test-token-0123456789"
FILENAME = "real_idea_entry_requests.json"


def authority_boundary() -> dict[str, bool]:
    return {
        "state_service_is_execution_authority": False,
        "executes_managed_operations": False,
        "executes_platform_wrappers": False,
        "mutates_specgraph_artifacts": False,
        "mutates_canonical_specs": False,
        "writes_ontology_packages": False,
        "creates_git_commits": False,
        "opens_pull_requests": False,
        "publishes_read_models": False,
        "persists_private_specspace_state": True,
    }


def state(workspace_id: str, value: str) -> dict:
    return {
        "artifact_kind": "specspace_real_idea_entry_request_state",
        "schema_version": 1,
        "state_owner": "SpecSpace",
        "state_path": f"specspace-state://{FILENAME}",
        "requests": [
            {
                "workspace_id": workspace_id,
                "request_id": f"entry-{workspace_id}",
                "status": "requested",
                "raw_idea": value,
            }
        ],
    }


class StateServiceHandler(BaseHTTPRequestHandler):
    records: dict[tuple[str, str], dict] = {}
    force_conflict = False
    trusted_health = True

    def log_message(self, format: str, *args: object) -> None:
        return

    def _write(self, status: HTTPStatus, payload: dict) -> None:
        encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _authorized(self) -> bool:
        return self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/v1/health":
            boundary = authority_boundary()
            if not type(self).trusted_health:
                boundary["executes_platform_wrappers"] = True
            self._write(
                HTTPStatus.OK,
                {
                    "artifact_kind": "platform_specspace_state_service_health",
                    "ok": True,
                    "status": "ready",
                    "contract_ref": specspace_state_backend.SERVICE_CONTRACT_REF,
                    "record_contract_ref": specspace_state_backend.RECORD_CONTRACT_REF,
                    "adapter": "postgresql",
                    "workspace_scoped": True,
                    "cas_required": True,
                    "authority_boundary": boundary,
                },
            )
            return
        if not self._authorized():
            self._write(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        query = urllib.parse.parse_qs(parsed.query)
        workspace_id = query.get("workspace_id", [None])[0]
        record_key = query.get("record_key", [None])[0]
        if parsed.path == "/v1/specspace-state/records":
            records = [
                record
                for (candidate_workspace, candidate_key), record in type(self).records.items()
                if (workspace_id is None or candidate_workspace == workspace_id)
                and (record_key is None or candidate_key == record_key)
            ]
            self._write(
                HTTPStatus.OK,
                {
                    "artifact_kind": "platform_specspace_state_record_collection",
                    "ok": True,
                    "records": records,
                    "authority_boundary": authority_boundary(),
                },
            )
            return
        if parsed.path == "/v1/specspace-state/record":
            record = type(self).records.get((workspace_id, record_key))
            if record is None:
                self._write(
                    HTTPStatus.NOT_FOUND,
                    {"error": "state_record_not_found"},
                )
                return
            self._write(
                HTTPStatus.OK,
                {
                    "artifact_kind": "platform_specspace_state_record_report",
                    "ok": True,
                    "record": record,
                    "authority_boundary": authority_boundary(),
                },
            )
            return
        self._write(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_PUT(self) -> None:
        if not self._authorized():
            self._write(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length))
        key = (payload["workspace_id"], payload["record_key"])
        current = type(self).records.get(key)
        current_revision = current["revision"] if current is not None else 0
        if type(self).force_conflict or payload["expected_revision"] != current_revision:
            self._write(
                HTTPStatus.CONFLICT,
                {"error": "state_revision_conflict"},
            )
            return
        revision = current_revision + 1
        record = {
            "contract_ref": specspace_state_backend.RECORD_CONTRACT_REF,
            "workspace_id": payload["workspace_id"],
            "record_key": payload["record_key"],
            "revision": revision,
            "content_sha256": payload["content_sha256"],
            "lifecycle_state": payload["lifecycle_state"],
            "content": payload["content"],
        }
        type(self).records[key] = record
        self._write(
            HTTPStatus.OK,
            {
                "artifact_kind": "platform_specspace_state_mutation_report",
                "ok": True,
                "record": {
                    key: value for key, value in record.items() if key != "content"
                },
                "authority_boundary": authority_boundary(),
            },
        )


@contextmanager
def state_service():
    StateServiceHandler.records = {}
    StateServiceHandler.force_conflict = False
    StateServiceHandler.trusted_health = True
    server = ThreadingHTTPServer(("127.0.0.1", 0), StateServiceHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


class SpecSpaceStateBackendTests(unittest.TestCase):
    def test_file_backend_preserves_other_workspace_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            backend = specspace_state_backend.FileStateBackend(root)
            backend.write(
                FILENAME,
                workspace_id="workspace-a",
                state=state("workspace-a", "private-a"),
            )
            backend.write(
                FILENAME,
                workspace_id="workspace-b",
                state=state("workspace-b", "private-b"),
            )

            workspace_a = backend.read(FILENAME, workspace_id="workspace-a")
            workspace_b = backend.read(FILENAME, workspace_id="workspace-b")
            combined = backend.read(FILENAME, workspace_id=None)
            workspace_a_ref_exists = backend.ref_exists(
                f"specspace-state://{FILENAME}",
                workspace_id="workspace-a",
            )
            foreign_ref_exists = backend.ref_exists(
                f"specspace-state://{FILENAME}",
                workspace_id="workspace-c",
            )

        self.assertEqual(workspace_a["requests"][0]["raw_idea"], "private-a")
        self.assertEqual(workspace_b["requests"][0]["raw_idea"], "private-b")
        self.assertEqual(len(combined["requests"]), 2)
        self.assertTrue(workspace_a_ref_exists)
        self.assertFalse(foreign_ref_exists)

    def test_file_backend_rejects_confirmation_outside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            backend = specspace_state_backend.FileStateBackend(Path(temp_dir))

            with self.assertRaises(specspace_state_backend.StateBackendError):
                backend.write_record(
                    "confirmations/workspace-b/review_status_execute/value.json",
                    workspace_id="workspace-a",
                    content={"confirmed": True},
                )

    def test_external_backend_is_workspace_scoped_and_restart_persistent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, state_service() as base_url:
            root = Path(temp_dir)
            backend = specspace_state_backend.ExternalHTTPStateBackend(
                config=specspace_state_backend.ExternalStateConfig(
                    base_url=base_url,
                    token=TOKEN,
                    timeout_seconds=2,
                ),
                materialization_root=root / "cache-a",
            )
            self.assertTrue(backend.health()["ready"])
            backend.write(
                FILENAME,
                workspace_id="workspace-a",
                state=state("workspace-a", "private-a"),
            )
            backend.write(
                FILENAME,
                workspace_id="workspace-b",
                state=state("workspace-b", "private-b"),
            )

            restarted = specspace_state_backend.ExternalHTTPStateBackend(
                config=backend.config,
                materialization_root=root / "cache-b",
            )
            workspace_a = restarted.read(
                FILENAME,
                workspace_id="workspace-a",
            )
            workspace_b = restarted.read(
                FILENAME,
                workspace_id="workspace-b",
            )
            materialized = restarted.materialize(
                FILENAME,
                workspace_id="workspace-a",
            )
            materialized_exists = materialized is not None and materialized.is_file()
            workspace_a_ref_exists = restarted.ref_exists(
                f"specspace-state://{FILENAME}",
                workspace_id="workspace-a",
            )
            foreign_ref_exists = restarted.ref_exists(
                f"specspace-state://{FILENAME}",
                workspace_id="workspace-c",
            )

        self.assertEqual(workspace_a["requests"][0]["raw_idea"], "private-a")
        self.assertEqual(workspace_b["requests"][0]["raw_idea"], "private-b")
        self.assertEqual(
            materialized,
            (root / "cache-b" / "workspace-a" / FILENAME).resolve(),
        )
        self.assertTrue(materialized_exists)
        self.assertTrue(workspace_a_ref_exists)
        self.assertFalse(foreign_ref_exists)

    def test_external_backend_rejects_stale_revision(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, state_service() as base_url:
            root = Path(temp_dir)
            config = specspace_state_backend.ExternalStateConfig(
                base_url=base_url,
                token=TOKEN,
                timeout_seconds=2,
            )
            first = specspace_state_backend.ExternalHTTPStateBackend(
                config=config,
                materialization_root=root / "first",
            )
            second = specspace_state_backend.ExternalHTTPStateBackend(
                config=config,
                materialization_root=root / "second",
            )
            first.write(
                FILENAME,
                workspace_id="workspace-a",
                state=state("workspace-a", "version-1"),
            )
            second.read(FILENAME, workspace_id="workspace-a")
            first.write(
                FILENAME,
                workspace_id="workspace-a",
                state=state("workspace-a", "version-2"),
            )

            with self.assertRaises(specspace_state_backend.StateBackendConflict):
                second.write(
                    FILENAME,
                    workspace_id="workspace-a",
                    state=state("workspace-a", "stale-version"),
                )

    def test_external_backend_health_fails_closed_for_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, state_service() as base_url:
            StateServiceHandler.trusted_health = False
            backend = specspace_state_backend.ExternalHTTPStateBackend(
                config=specspace_state_backend.ExternalStateConfig(
                    base_url=base_url,
                    token=TOKEN,
                    timeout_seconds=2,
                ),
                materialization_root=Path(temp_dir),
            )

            health = backend.health()

        self.assertFalse(health["ready"])
        self.assertEqual(health["status"], "untrusted")

    def test_state_api_fails_closed_when_external_provider_is_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            server = SimpleNamespace(
                specspace_state_dir=Path(temp_dir),
                specspace_state_backend=specspace_state_backend.ExternalHTTPStateBackend(
                    config=specspace_state_backend.ExternalStateConfig(
                        base_url="http://127.0.0.1:1",
                        token=TOKEN,
                        timeout_seconds=0.2,
                    ),
                    materialization_root=Path(temp_dir),
                ),
            )

            status, payload = real_idea_entry_requests.read_state(
                server,
                workspace_id="workspace-a",
            )

        self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertEqual(payload["reason"], "external_state_unavailable")

    def test_materialization_path_distinguishes_file_and_external_backends(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            file_server = SimpleNamespace(
                specspace_state_dir=root / "file",
                specspace_state_backend=specspace_state_backend.FileStateBackend(
                    root / "file"
                ),
            )
            external_server = SimpleNamespace(
                specspace_state_dir=root / "cache",
                specspace_state_backend=specspace_state_backend.ExternalHTTPStateBackend(
                    config=specspace_state_backend.ExternalStateConfig(
                        base_url="http://127.0.0.1:1",
                        token=TOKEN,
                        timeout_seconds=0.2,
                    ),
                    materialization_root=root / "cache",
                ),
            )

            file_path = specspace_state_backend.materialization_path(
                file_server,
                FILENAME,
                workspace_id="workspace-a",
            )
            external_path = specspace_state_backend.materialization_path(
                external_server,
                FILENAME,
                workspace_id="workspace-a",
            )

        self.assertEqual(file_path, root / "file" / FILENAME)
        self.assertEqual(
            external_path,
            root / "cache" / "workspace-a" / FILENAME,
        )

    def test_migration_is_workspace_scoped_idempotent_and_content_private(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, state_service() as base_url:
            root = Path(temp_dir)
            source = root / "legacy"
            source.mkdir()
            source_state = {
                "artifact_kind": "specspace_real_idea_entry_request_state",
                "schema_version": 1,
                "state_owner": "SpecSpace",
                "state_path": str(source / FILENAME),
                "requests": [
                    {
                        "workspace_id": "workspace-a",
                        "request_id": "entry-a",
                        "status": "requested",
                        "raw_idea": "private migration idea a",
                    },
                    {
                        "workspace_id": "workspace-b",
                        "request_id": "entry-b",
                        "status": "requested",
                        "raw_idea": "private migration idea b",
                    },
                ],
            }
            (source / FILENAME).write_text(
                json.dumps(source_state),
                encoding="utf-8",
            )
            confirmation = (
                source
                / "confirmations"
                / "workspace-a"
                / "promotion_review_execute"
                / "confirmation.json"
            )
            confirmation.parent.mkdir(parents=True)
            confirmation.write_text(
                json.dumps(
                    {
                        "workspace_id": "workspace-a",
                        "confirmation": "private confirmation",
                    }
                ),
                encoding="utf-8",
            )
            backend = specspace_state_backend.ExternalHTTPStateBackend(
                config=specspace_state_backend.ExternalStateConfig(
                    base_url=base_url,
                    token=TOKEN,
                    timeout_seconds=2,
                ),
                materialization_root=root / "cache",
            )

            planned = migrate_specspace_state.plan_records(source)
            dry_run = migrate_specspace_state.migrate(
                planned,
                backend=backend,
                apply=False,
            )
            applied = migrate_specspace_state.migrate(
                planned,
                backend=backend,
                apply=True,
            )
            replay = migrate_specspace_state.migrate(
                planned,
                backend=backend,
                apply=True,
            )
            migration_report = migrate_specspace_state.report(
                apply=True,
                records=applied,
                status="migration_completed",
            )

        self.assertEqual(
            [item["action"] for item in dry_run],
            ["planned", "planned", "planned"],
        )
        self.assertEqual(
            [item["action"] for item in applied],
            ["imported", "imported", "imported"],
        )
        self.assertEqual(
            [item["action"] for item in replay],
            ["unchanged", "unchanged", "unchanged"],
        )
        encoded_report = json.dumps(migration_report)
        self.assertNotIn("private migration idea", encoded_report)
        self.assertNotIn("private confirmation", encoded_report)
        self.assertEqual(len(StateServiceHandler.records), 3)

    def test_migration_rejects_unscoped_state_entry(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / FILENAME).write_text(
                json.dumps(
                    {
                        "requests": [
                            {
                                "request_id": "missing-workspace",
                                "raw_idea": "private",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(migrate_specspace_state.MigrationError):
                migrate_specspace_state.plan_records(root)

    def test_migration_does_not_overwrite_newer_external_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, state_service() as base_url:
            root = Path(temp_dir)
            source = root / "legacy"
            source.mkdir()
            (source / FILENAME).write_text(
                json.dumps(state("workspace-a", "legacy private idea")),
                encoding="utf-8",
            )
            backend = specspace_state_backend.ExternalHTTPStateBackend(
                config=specspace_state_backend.ExternalStateConfig(
                    base_url=base_url,
                    token=TOKEN,
                    timeout_seconds=2,
                ),
                materialization_root=root / "cache",
            )
            planned = migrate_specspace_state.plan_records(source)
            backend.write(
                FILENAME,
                workspace_id="workspace-a",
                state=state("workspace-a", "newer private idea"),
            )

            with self.assertRaises(
                migrate_specspace_state.MigrationError,
                msg="migration must not overwrite live destination state",
            ):
                migrate_specspace_state.migrate(
                    planned,
                    backend=backend,
                    apply=True,
                )


if __name__ == "__main__":
    unittest.main()
