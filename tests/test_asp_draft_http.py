import base64
import json
import http.client
import ssl
import subprocess
import tempfile
import threading
import unittest
from unittest import mock
from http import HTTPStatus
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from viewer import asp_draft_http, operator_auth
from viewer.asp_draft_wire import object_hash
from viewer.server import ViewerHandler


class AspDraftHttpTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="asp-http-test-")
        root = Path(self.tmp.name)
        self.cert = root / "cert.pem"
        self.key = root / "key.pem"
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(self.key), "-out", str(self.cert), "-days", "1",
            "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.identity = {
            "profile": "https://github.com/0al-spec/agent-surface/profiles/agent-identity-evidence/v1",
            "format_profile": "https://specspace.local/identity-format",
            "artifact_digest": {"profile": "https://specspace.local/identity-artifact", "value": "sha-256:" + "A" * 43},
            "issuer": "specspace-local-experiment", "subject": "synthetic-agent",
            "verification_profile": "https://specspace.local/identity-ed25519",
            "key_binding": {"profile": "https://specspace.local/subject-key", "value": "sha-256:" + "B" * 43},
            "lifecycle": {"freshness_profile": "https://specspace.local/current", "status_profile": "https://specspace.local/status", "status_ref": "synthetic-status"},
        }
        self.identity_artifact = root / "identity.json"
        self.identity_artifact.write_text(json.dumps({"synthetic": True}))
        self.issuer_key = root / "issuer.pub"
        self.issuer_key.write_text("synthetic")
        self.state = root / "state"
        self.config = root / "config.json"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), ViewerHandler)
        self.server.operator_auth_enabled = True
        self.server.operator_auth_username = "operator"
        self.server.operator_auth_password_digest = operator_auth.password_digest("password")
        self.server.operator_auth_allowed_origin = None
        self.server.external_state_enabled = False
        self.server.platform_execution_enabled = False
        self.server.hosted_managed_execution_enabled = False
        self.server.specspace_state_dir = self.state
        config = {"tls_cert": str(self.cert), "tls_key": str(self.key), "issuer_public_key": str(self.issuer_key),
                  "identity_artifact": str(self.identity_artifact), "workspace_id": "workspace-1",
                  "runtime_id": "runtime-1", "agent_id": "agent-1"}
        self.config.write_text(json.dumps(config))
        args = SimpleNamespace(asp_draft_config=str(self.config), host="127.0.0.1", specspace_state_dir=str(self.state))
        self.verifier_patch = mock.patch("viewer.asp_draft_http.asp_draft_identity.verify", return_value=(self.identity, 4102444800))
        self.verifier_patch.start()
        self.addCleanup(self.verifier_patch.stop)
        asp_draft_http.configure(self.server, args)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = self.server.asp_draft.origin
        self.context = ssl.create_default_context(cafile=str(self.cert))
        service = self.server.asp_draft
        issued = service.issue({"surface_hash": service.manifest["surface_hash"], "identity_evidence_hash": service.identity_hash,
            "workspace_id": "workspace-1", "runtime_id": "runtime-1", "agent_id": "agent-1", "expires_in": 60, "accept": True})
        self.token, self.grant = issued["credential"], issued["grant"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.tmp.cleanup()

    def request(self, path, *, method="GET", body=None, headers=None):
        data = None if body is None else json.dumps(body).encode()
        request = Request(self.origin + path, data=data, method=method, headers=headers or {})
        try:
            with urlopen(request, context=self.context, timeout=2) as response:
                return response.status, response.headers, json.load(response)
        except HTTPError as exc:
            with exc:
                return exc.code, exc.headers, json.load(exc)

    def test_discovery_is_https_and_manifest_is_proposal_only(self):
        status, _, payload = self.request("/.well-known/agent-surface.json")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["surface_mode"], "proposal_only")
        self.assertEqual(payload["surface_hash"], object_hash("manifest", {k: v for k, v in payload.items() if k != "surface_hash"}))

    def test_reserved_route_is_404_when_experiment_disabled(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), ViewerHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with self.assertRaises(HTTPError) as caught:
                urlopen(f"http://127.0.0.1:{server.server_port}/.well-known/agent-surface.json", timeout=2)
            self.assertEqual(caught.exception.code, HTTPStatus.NOT_FOUND)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_missing_auth_rejected_before_body(self):
        connection = http.client.HTTPSConnection("127.0.0.1", self.server.server_port, context=self.context, timeout=1)
        try:
            connection.putrequest("POST", "/asp/actions")
            connection.putheader("Content-Type", "application/json")
            connection.putheader("Content-Length", "65536")
            connection.endheaders()  # No body: an auth guard after reading would time out.
            response = connection.getresponse()
            self.assertEqual(response.status, HTTPStatus.UNAUTHORIZED)
            self.assertEqual(json.loads(response.read())["payload"]["code"], "grant_invalid")
        finally:
            connection.close()

    def test_native_api_does_not_accept_bearer(self):
        status, _, _ = self.request("/api/v1/real-idea-entry-requests", headers={"Authorization": "Bearer token"})
        self.assertEqual(status, HTTPStatus.UNAUTHORIZED)

    def test_other_routes_static_and_intake_are_not_asp(self):
        for path in ("/", "/static/app.js", "/api/v1/real-idea-intake-execution-requests"):
            status, _, _ = self.request(path, method="POST", body={})
            self.assertNotEqual(status, HTTPStatus.OK)

    def test_host_and_origin_mismatch_are_denied(self):
        status, _, payload = self.request("/asp/grant", headers={"Host": "evil.example"})
        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(payload["payload"]["code"], "grant_proof_invalid")
        status, _, payload = self.request("/asp/grant", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(payload["payload"]["code"], "grant_proof_invalid")

    def test_duplicate_auth_and_content_length_are_rejected(self):
        for duplicate in ("Authorization", "Content-Length"):
            with self.subTest(duplicate=duplicate):
                connection = http.client.HTTPSConnection("127.0.0.1", self.server.server_port, context=self.context, timeout=2)
                try:
                    connection.putrequest("POST", "/asp/actions")
                    connection.putheader("Authorization", "Bearer " + self.token)
                    connection.putheader("Content-Type", "application/json")
                    connection.putheader("Content-Length", "2")
                    connection.putheader(duplicate, "2" if duplicate == "Content-Length" else "Bearer " + self.token)
                    connection.endheaders(b"{}")
                    response = connection.getresponse()
                    self.assertEqual(response.status, 400)
                    self.assertEqual(json.loads(response.read())["payload"]["code"], "schema_invalid")
                finally:
                    connection.close()

    def test_invalid_json_and_idempotency_mismatch_have_no_success(self):
        headers = {"Authorization": "Bearer " + self.token, "Content-Type": "application/json", "Idempotency-Key": "a"}
        request = Request(self.origin + "/asp/actions", data=b"not-json", method="POST", headers=headers)
        with self.assertRaises(HTTPError) as caught:
            urlopen(request, context=self.context, timeout=2)
        self.assertEqual(caught.exception.code, 400)
        self.assertEqual(json.loads(caught.exception.read())["payload"]["code"], "schema_invalid")
        service = self.server.asp_draft
        value = {"workspace_id": "workspace-1", "request_id": "draft", "idea_text": "Text", "snapshot_hash": service._snapshot()[1]}
        p = {"session_id": "session-1", "session_generation": 1, "trace_id": "1" * 32, "span_id": "2" * 16,
             "grant_id": self.grant["grant_id"], "grant_hash": self.grant["grant_hash"],
             "surface_hash": service.manifest["surface_hash"], "action_id": "specspace.raw-idea.propose",
             "input": value, "input_hash": object_hash("action-input", value), "idempotency_key": "different",
             "execution": {"mode": "propose", "execution_id": "exec-1"}}
        headers["traceparent"] = "00-" + p["trace_id"] + "-" + p["span_id"] + "-00"
        status, _, result = self.request("/asp/actions", method="POST", body={"type": "action.request", "payload": p}, headers=headers)
        self.assertEqual(status, 400)
        self.assertEqual(result["payload"]["code"], "schema_invalid")
        self.assertEqual(service.store.all("result"), [])
        self.assertEqual(service.store.all("native"), [])

    def test_known_asp_hash_and_negative_json_vectors(self):
        self.assertEqual(object_hash("grant", {"grant_id": "grant_123", "scopes": ["read"]}),
                         "sha-256:Xbq37_fP9PBiWI3Bv7Ch0t8TV5ikJGm55MxncSeA38Y")
        with self.assertRaises(ValueError):
            object_hash("grant", {"value": float("inf")})

    def test_operator_approval_rejects_malformed_ids_before_store_access(self):
        headers = {
            "Authorization": "Basic " + base64.b64encode(b"operator:password").decode(),
            "Content-Type": "application/json",
            "Origin": self.origin,
        }
        service = self.server.asp_draft
        before = service.store.all("approval")
        for approval_id in (None, [], {}, 7, True, "not-a-hash", "sha-256:" + "A" * 42,
                            "sha-256:" + "+" * 43):
            with self.subTest(approval_id=approval_id):
                with mock.patch.object(service.store, "get", wraps=service.store.get) as store_get:
                    status, _, result = self.request("/asp/operator/approve", method="POST",
                        body={"approval_id": approval_id, "input_hash": "unused", "accept": True}, headers=headers)
                    store_get.assert_not_called()
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(result["payload"]["code"], "schema_invalid")
                self.assertEqual(service.store.all("approval"), before)

    def test_operator_approval_unknown_well_formed_hash_keeps_not_found_semantics(self):
        headers = {
            "Authorization": "Basic " + base64.b64encode(b"operator:password").decode(),
            "Content-Type": "application/json",
            "Origin": self.origin,
        }
        status, _, result = self.request("/asp/operator/approve", method="POST",
            body={"approval_id": "sha-256:" + "A" * 43, "input_hash": "unused", "accept": True}, headers=headers)
        self.assertEqual(status, HTTPStatus.FORBIDDEN)
        self.assertEqual(result["payload"]["code"], "approval_expired")


if __name__ == "__main__":
    unittest.main()
