from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
import re
import tempfile
import unittest

from viewer import operator_auth, real_idea_entry_requests
from viewer.asp_draft import DraftService, PROPOSE, READ, SCHEMAS
from viewer.asp_draft_store import DraftStore
from viewer.asp_draft_wire import Reject, canonical, digest, envelope, object_hash


ORIGIN = "https://specspace.test"
IDENTITY = {"type": "agent.identity", "payload": {
    "agent_id": "agent-a", "issuer": "https://issuer.test", "subject": "agent-a",
    "claims": {"capabilities": ["specspace.raw-idea.read", "specspace.raw-idea.propose"]},
}}


class Clock:
    def __init__(self, value: int = 100):
        self.value = value

    def __call__(self) -> int:
        return self.value


def _server(root: Path, store: DraftStore) -> SimpleNamespace:
    return SimpleNamespace(
        repo_root=root,
        specspace_state_dir=root,
        specspace_state_backend=store,
        operator_auth_enabled=True,
        operator_auth_username="operator",
        operator_auth_password_digest=operator_auth.password_digest("s" * 48),
        operator_auth_allowed_origin=ORIGIN,
    )


def _service(root: Path, clock: Clock | None = None) -> tuple[DraftService, DraftStore, Clock]:
    clock = clock or Clock()
    store = DraftStore(root)
    server = _server(root, store)
    verifier = lambda _now: (IDENTITY, 1000)
    return DraftService(server, ORIGIN, "workspace-a", "runtime-a", "agent-a", verifier, clock), store, clock


def _grant(service: DraftService) -> tuple[str, dict]:
    issued = service.issue({
        "surface_hash": service.manifest["surface_hash"],
        "identity_evidence_hash": service.identity_hash,
        "workspace_id": "workspace-a",
        "runtime_id": "runtime-a",
        "agent_id": "agent-a",
        "expires_in": 60,
        "accept": True,
    })
    return issued["credential"], issued["grant"]


def _session(service: DraftService, token: str, grant: dict, session_id: str = "session-a") -> dict:
    payload = {
        "session_id": session_id, "session_generation": 1, "trace_id": "a" * 32, "span_id": "b" * 16,
        "grant_id": grant["grant_id"], "grant_hash": grant["grant_hash"], "runtime_id": "runtime-a",
        "agent_id": "agent-a", "identity_evidence_hash": service.identity_hash, "initiated_by": "runtime",
        "surface": {key: service.manifest[key] for key in ("app_id", "surface_version", "surface_hash")},
        "task": {"kind": "raw-idea.draft", "goal": "Prepare a private idea draft", "inputs": {"workspace_id": "workspace-a"}},
    }
    return service.session(token, envelope("session.start", payload))


def _request(service: DraftService, grant: dict, *, snapshot: str, text: str = "idea a",
             workspace: str = "workspace-a", request_id: str = "draft-a", action: str = PROPOSE,
             execution_id: str = "execution-a", idempotency_key: str = "idempotency-a") -> dict:
    input_value = ({"workspace_id": workspace} if action == READ else {
        "workspace_id": workspace, "request_id": request_id, "idea_text": text, "snapshot_hash": snapshot,
    })
    payload = {
        "session_id": "session-a", "session_generation": 1, "trace_id": "a" * 32, "span_id": "b" * 16,
        "grant_id": grant["grant_id"], "grant_hash": grant["grant_hash"], "surface_hash": service.manifest["surface_hash"],
        "action_id": action, "input_hash": object_hash("action-input", input_value),
        "execution": {"mode": "read" if action == READ else "propose", "execution_id": execution_id},
        "input": input_value,
    }
    if action == PROPOSE:
        payload["idempotency_key"] = idempotency_key
    return envelope("action.request", payload)


class AspDraftServiceTests(unittest.TestCase):
    def test_workspace_schemas_match_native_canonical_shape(self) -> None:
        for name, schema in SCHEMAS.items():
            pattern = schema["properties"]["workspace_id"]["pattern"]
            for value in ("workspace-a", "asp-draft-demo", "specgraph-bootstrap"):
                with self.subTest(schema=name, value=value):
                    self.assertIsNotNone(re.fullmatch(pattern, value))
            for value in ("Workspace-A", "workspace_a", "ab", "workspace.a"):
                with self.subTest(schema=name, value=value):
                    self.assertIsNone(re.fullmatch(pattern, value))

    def test_workspace_binding_requires_native_canonical_id(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            for workspace_id in ("Workspace-A", "workspace_a", "ab", "bootstrap", "specgraph"):
                with self.subTest(workspace_id=workspace_id):
                    store = DraftStore(Path(directory) / workspace_id)
                    with self.assertRaisesRegex(Reject, "workspace_invalid"):
                        DraftService(_server(Path(directory) / workspace_id, store), ORIGIN,
                                     workspace_id, "runtime-a", "agent-a", lambda _now: (IDENTITY, 1000))
                    self.assertEqual(store.all("config"), [])
            for workspace_id in ("workspace-a", "asp-draft-demo", "specgraph-bootstrap"):
                with self.subTest(workspace_id=workspace_id):
                    root = Path(directory) / ("canonical-" + workspace_id)
                    store = DraftStore(root)
                    service = DraftService(_server(root, store), ORIGIN, workspace_id, "runtime-a", "agent-a",
                                           lambda _now: (IDENTITY, 1000))
                    self.assertEqual(service.workspace, workspace_id)

    def test_runaway_pause_fences_new_session_after_restart_but_replay_survives(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            service, store, _ = _service(root)
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            service.approve({"approval_id": approval["approval_id"],
                             "input_hash": proposal["payload"]["input_hash"], "accept": True})
            completed = service.action(token, proposal, "idempotency-a")
            pause = {"type": "session.pause", "payload": {
                "pause_id": "pause-a", "session_id": "session-a", "session_generation": 1,
                "grant_id": grant["grant_id"], "grant_hash": grant["grant_hash"],
                "surface_hash": service.manifest["surface_hash"], "reason": "runaway_guard", "guard_id": "guard-a",
            }}
            interrupted = service.session(token, pause)
            self.assertEqual(interrupted["payload"]["state"], "interrupted")
            self.assertEqual(service.action(token, proposal, "idempotency-a"), completed)
            with self.assertRaisesRegex(Reject, "session_transition_invalid"):
                _session(service, token, grant, "session-b")

            restarted = DraftService(service.server, ORIGIN, "workspace-a", "runtime-a", "agent-a",
                                     lambda _now: (IDENTITY, 1000), Clock())
            with self.assertRaisesRegex(Reject, "session_transition_invalid"):
                _session(restarted, token, grant, "session-b")
            self.assertEqual(restarted.session(token, store.get("session", "session-a")["start"]), interrupted)
            self.assertEqual(restarted.action(token, proposal, "idempotency-a"), completed)
            with self.assertRaisesRegex(Reject, "session_invalid"):
                restarted.action(token, _request(restarted, grant, snapshot="unused", action=READ), None)
            self.assertEqual(store.get("session", "session-a")["state"]["payload"]["state"], "interrupted")
            token2, grant2 = _grant(restarted)
            _session(restarted, token2, grant2, "session-c")
            self.assertIsNotNone(store.get("session", "session-c"))
            self.assertIsNone(store.get("session", "session-b"))

    def test_issue_session_read_propose_approval_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service, store, _ = _service(Path(directory))
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            self.assertFalse(approval["approved"])
            approved = service.approve({"approval_id": approval["approval_id"],
                                        "input_hash": proposal["payload"]["input_hash"], "accept": True})
            result = service.action(token, proposal, "idempotency-a")
            self.assertTrue(approved["approved"])
            self.assertEqual(result["payload"]["output"]["idea_text"], "idea a")
            self.assertIsNotNone(store.get("execution", digest(canonical([grant["grant_id"], "execution-a"]))))

    def test_propose_requires_approval_and_rejects_changed_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service, _, clock = _service(Path(directory))
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            with self.assertRaisesRegex(Reject, "approval_required"):
                service.action(token, proposal, "idempotency-a")
            changed = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            changed["payload"]["input"]["idea_text"] = "changed"
            with self.assertRaisesRegex(Reject, "integrity_mismatch"):
                service.request_approval(token, changed, "idempotency-a")
            wrong_workspace = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"], workspace="workspace-b")
            with self.assertRaisesRegex(Reject, "scope_denied"):
                service.request_approval(token, wrong_workspace, "idempotency-a")
            wrong_mode = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            wrong_mode["payload"]["execution"]["mode"] = "read"
            with self.assertRaisesRegex(Reject, "execution_mode_invalid"):
                service.request_approval(token, wrong_mode, "idempotency-a")
            approval = service.request_approval(token, proposal, "idempotency-a")
            clock.value = 221
            with self.assertRaisesRegex(Reject, "approval_expired"):
                service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})

    def test_revoked_and_expired_grants_are_denied(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            clock = Clock()
            service, _, _ = _service(Path(directory), clock)
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})
            successful = service.action(token, proposal, "idempotency-a")
            service.revoke({"grant_id": grant["grant_id"]})
            with self.assertRaisesRegex(Reject, "grant_revoked"):
                service.action(token, proposal, "idempotency-a")
            self.assertEqual(successful["payload"]["result"], "success")

            service2, _, clock2 = _service(Path(directory) / "second", Clock())
            token2, grant2 = _grant(service2)
            _session(service2, token2, grant2)
            read2 = service2.action(token2, _request(service2, grant2, snapshot="unused", action=READ), None)
            proposal2 = _request(service2, grant2, snapshot=read2["payload"]["output"]["snapshot_hash"])
            approval2 = service2.request_approval(token2, proposal2, "idempotency-a")
            service2.approve({"approval_id": approval2["approval_id"], "input_hash": proposal2["payload"]["input_hash"], "accept": True})
            clock2.value = 161
            with self.assertRaisesRegex(Reject, "grant_expired"):
                service2.action(token2, proposal2, "idempotency-a")

    def test_snapshot_stale_and_create_only_prevent_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            service, _, _ = _service(root)
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            server = service.server
            real_idea_entry_requests.save_request(server, {"workspace_id": "workspace-a", "request_id": "native", "idea_text": "native", "status": "draft"}, workspace_id="workspace-a")
            with self.assertRaisesRegex(Reject, "precondition_failed"):
                service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})

            service2, _, _ = _service(root / "second")
            token2, grant2 = _grant(service2)
            _session(service2, token2, grant2)
            read2 = service2.action(token2, _request(service2, grant2, snapshot="unused", action=READ), None)
            p2 = _request(service2, grant2, snapshot=read2["payload"]["output"]["snapshot_hash"], request_id="same")
            a2 = service2.request_approval(token2, p2, "idempotency-a")
            service2.approve({"approval_id": a2["approval_id"], "input_hash": p2["payload"]["input_hash"], "accept": True})
            first = service2.action(token2, p2, "idempotency-a")
            read3 = service2.action(token2, _request(service2, grant2, snapshot="unused", action=READ, execution_id="execution-c"), None)
            p2_changed = _request(service2, grant2, snapshot=read3["payload"]["output"]["snapshot_hash"], request_id="same", text="changed", execution_id="execution-b", idempotency_key="idempotency-b")
            a2_changed = service2.request_approval(token2, p2_changed, "idempotency-b")
            service2.approve({"approval_id": a2_changed["approval_id"], "input_hash": p2_changed["payload"]["input_hash"], "accept": True})
            with self.assertRaisesRegex(Reject, "precondition_failed"):
                service2.action(token2, p2_changed, "idempotency-b")
            self.assertEqual(first["payload"]["output"]["request_id"], "same")

    def test_idempotent_retry_returns_original_result_and_conflicts_on_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service, _, _ = _service(Path(directory))
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})
            first = service.action(token, proposal, "idempotency-a")
            real_idea_entry_requests.save_request(service.server, {"workspace_id": "workspace-a", "request_id": "draft-a", "idea_text": "edited later", "status": "draft"}, workspace_id="workspace-a")
            self.assertEqual(service.action(token, proposal, "idempotency-a"), first)
            current = real_idea_entry_requests.read_state(service.server, workspace_id="workspace-a")[1]
            self.assertEqual(current["requests"][0]["idea_text"], "edited later")
            conflict = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"], text="different")
            with self.assertRaisesRegex(Reject, "idempotency_conflict"):
                service.action(token, conflict, "idempotency-a")
            current_read = service.action(token, _request(service, grant, snapshot="unused", action=READ, execution_id="execution-b"), None)
            proposal2 = _request(service, grant, snapshot=current_read["payload"]["output"]["snapshot_hash"], request_id="draft-b", execution_id="execution-a", idempotency_key="idempotency-b")
            approval2 = service.request_approval(token, proposal2, "idempotency-b")
            service.approve({"approval_id": approval2["approval_id"], "input_hash": proposal2["payload"]["input_hash"], "accept": True})
            with self.assertRaisesRegex(Reject, "idempotency_conflict"):
                service.action(token, proposal2, "idempotency-b")

    def test_restart_durable_result_and_workspace_isolation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            service, store, _ = _service(root)
            token, grant = _grant(service)
            _session(service, token, grant)
            real_idea_entry_requests.save_request(service.server, {"workspace_id": "workspace-b", "request_id": "secret", "idea_text": "workspace-b secret", "status": "draft"}, workspace_id="workspace-b")
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})
            first = service.action(token, proposal, "idempotency-a")
            restarted = DraftStore(root)
            restarted_service = DraftService(service.server, ORIGIN, "workspace-a", "runtime-a", "agent-a", lambda _now: (IDENTITY, 1000), Clock())
            replay = restarted_service.action(token, proposal, "idempotency-a")
            self.assertEqual(restarted.get("result", digest(canonical([grant["grant_id"], PROPOSE, "idempotency-a"])))['response'], first)
            self.assertEqual(replay, first)
            scoped = restarted_service.action(token, _request(restarted_service, grant, snapshot="unused", action=READ, execution_id="execution-b"), None)
            self.assertNotIn("workspace-b secret", str(scoped))

    def test_transaction_failure_rolls_back_draft(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service, store, _ = _service(Path(directory))
            token, grant = _grant(service)
            _session(service, token, grant)
            read = service.action(token, _request(service, grant, snapshot="unused", action=READ), None)
            proposal = _request(service, grant, snapshot=read["payload"]["output"]["snapshot_hash"])
            approval = service.request_approval(token, proposal, "idempotency-a")
            service.approve({"approval_id": approval["approval_id"], "input_hash": proposal["payload"]["input_hash"], "accept": True})
            original_put = store.put
            def fail_after_draft(kind, key, value):
                if kind == "result":
                    raise RuntimeError("injected failure")
                original_put(kind, key, value)
            store.put = fail_after_draft
            with self.assertRaisesRegex(RuntimeError, "injected failure"):
                service.action(token, proposal, "idempotency-a")
            self.assertIsNone(store.get("native", "real_idea_entry_requests.json"))


if __name__ == "__main__":
    unittest.main()
