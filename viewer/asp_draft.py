"""Opt-in application-side ASP draft experiment. No production conformance claim."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import secrets
import time

from viewer import operator_auth, real_idea_entry_requests as native, specspace_provider
from viewer.asp_draft_wire import ASP, LOCAL, Reject, canonical, closed, digest, digest_identifier, envelope, identifier, object_hash, require

READ = "specspace.raw-idea.read"
PROPOSE = "specspace.raw-idea.propose"
EXPOSURE = {"classes": ["specspace.raw-idea"], "redaction": {"mode": "none"},
            "retention": {"mode": "transient", "delete_on_grant_end": True}}
SCHEMA_BASE = {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": False}
IDENTIFIER = {"type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$"}
WORKSPACE_IDENTIFIER = {"type": "string", "pattern": specspace_provider.PRODUCT_WORKSPACE_ID_RE.pattern}


def schema(properties):
    return {**SCHEMA_BASE, "properties": properties, "required": list(properties)}


SCHEMAS = {
    "read-input": schema({"workspace_id": WORKSPACE_IDENTIFIER}),
    "propose-input": schema({"workspace_id": WORKSPACE_IDENTIFIER, "request_id": IDENTIFIER,
                             "idea_text": {"type": "string", "minLength": 1, "maxLength": 8000},
                             "snapshot_hash": {"type": "string", "pattern": "^sha-256:[A-Za-z0-9_-]{43}$"}}),
    "read-output": schema({"workspace_id": WORKSPACE_IDENTIFIER, "snapshot_hash": {"type": "string"},
                           "drafts": {"type": "array", "items": schema({"request_id": IDENTIFIER,
                                     "idea_text": {"type": "string"}, "status": {"const": "draft"}})}}),
    "propose-output": schema({"workspace_id": WORKSPACE_IDENTIFIER, "request_id": IDENTIFIER,
                              "idea_text": {"type": "string"}, "status": {"const": "draft"}}),
}


def manifest(origin):
    actions = []
    for mode, action_id in (("read", READ), ("propose", PROPOSE)):
        declaration = {"id": action_id, "scope": action_id, "risk": mode, "side_effect": False,
                       "approval": "app" if mode == "propose" else "none",
                       "execution": {"mode": mode, "operation_id": action_id},
                       "input_schema": origin + "/asp/schemas/" + mode + "-input",
                       "input_schema_hash": object_hash("action-input-schema", SCHEMAS[mode + "-input"]),
                       "output_schema": origin + "/asp/schemas/" + mode + "-output",
                       "data_exposure": copy.deepcopy(EXPOSURE), "input_hash_profile": "asp-jcs-sha-256"}
        if mode == "propose":
            declaration.update(idempotency="required", idempotency_normalization={"profile": "asp-json-normalization-v1"})
            declaration["execution"]["persisted"] = True
        actions.append(declaration)
    result = {"protocol": "agent-surface/0.1", "app_id": "specspace.local", "issuer": origin,
              "surface_url": origin + "/.well-known/agent-surface.json",
              "compatibility": {"schema_dialect": "https://json-schema.org/draft/2020-12/schema",
                  "agent_identity_evidence_profiles": [{"profile": ASP + "profiles/agent-identity-evidence/v1",
                      "format_profile": LOCAL + "identity-format", "artifact_digest_profile": LOCAL + "identity-artifact-jcs-sha256",
                      "verification_profiles": [LOCAL + "identity-ed25519-pinned-issuer"],
                      "key_binding_profiles": [LOCAL + "subject-spki-sha256"],
                      "freshness_profiles": [LOCAL + "identity-current-transaction"],
                      "status_profiles": [LOCAL + "identity-app-status"], "max_artifact_bytes": 16384}]},
              "surface_version": "asp-draft-experiment-1", "surface_mode": "proposal_only",
              "agent_api": {"credential_audience": origin + "/asp",
                            "action_url": origin + "/asp/actions",
                            "session_control_url": origin + "/asp/sessions",
                            "grant_introspection_url": origin + "/asp/grant"},
              "auth": {"type": "app_issued", "credential_profiles": ["compatibility_bearer"]},
              "scopes": [{"id": action, "description": action} for action in (READ, PROPOSE)],
              "data_classes": [{"id": "specspace.raw-idea", "classification": "private",
                                "label": "Local raw idea drafts", "description": "Private draft text in one workspace."}],
              "resources": [], "events": [], "actions": actions}
    result["surface_hash"] = object_hash("manifest", result)
    return result


def iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z")


class DraftService:
    def __init__(self, server, origin, workspace_id, runtime_id, agent_id, identity_verifier, clock=time.time):
        self.server, self.store, self.origin = server, server.specspace_state_backend, origin
        canonical_workspace = specspace_provider.normalize_workspace_id(workspace_id)
        require(canonical_workspace == workspace_id, "workspace_invalid")
        self.workspace = identifier(workspace_id)
        self.runtime, self.agent = identifier(runtime_id), identifier(agent_id)
        self.clock, self.identity_verifier = clock, identity_verifier
        self.manifest = manifest(origin)
        self.identity, self.identity_expiry = identity_verifier(int(clock()))
        self.identity_hash = object_hash("agent-identity-evidence", self.identity)
        self.subject = operator_auth.operator_profile_ref(server)
        require(self.subject is not None)
        binding = {"surface": self.manifest, "workspace": self.workspace, "runtime": self.runtime,
                   "agent": self.agent, "identity": self.identity, "subject": self.subject}
        with self.store.transaction():
            previous = self.store.get("config", "binding")
            require(previous is None or previous == binding, "deployment_binding_changed")
            self.store.put("config", "binding", binding)
            if self.store.get("identity", "status") is None:
                self.store.put("identity", "status", {"state": "active", "revision": 1})

    def _identity(self):
        evidence, expiry = self.identity_verifier(int(self.clock()))
        require(evidence == self.identity and self.clock() < expiry, "identity_evidence_invalid", 403)
        status = self.store.get("identity", "status")
        require(status is not None and status["state"] == "active", "identity_evidence_invalid", 403)
        return {"identity_evidence": evidence, "identity_evidence_hash": self.identity_hash,
                "state": status["state"], "revision": status["revision"], "checked_at": int(self.clock()),
                "valid_until": min(int(self.clock()) + 1, expiry), "agent_id": self.agent,
                "executable_binding": "not_verified"}

    def consent(self):
        with self.store.transaction():
            return {"surface_hash": self.manifest["surface_hash"], "workspace_id": self.workspace,
                    "runtime_id": self.runtime, "identity": self._identity(), "actions": [READ, PROPOSE],
                    "credential_profile": "compatibility_bearer", "max_seconds": 600,
                    "boundary": "Local synthetic state; drafts only; no submit, execution, export or credentials."}

    def issue(self, payload):
        closed(payload, ("surface_hash", "identity_evidence_hash", "workspace_id", "runtime_id", "agent_id", "expires_in", "accept"))
        with self.store.transaction():
            self._identity()
            require(payload["accept"] is True, "approval_required", 403)
            require((payload["surface_hash"], payload["identity_evidence_hash"], payload["workspace_id"],
                     payload["runtime_id"], payload["agent_id"]) ==
                    (self.manifest["surface_hash"], self.identity_hash, self.workspace, self.runtime, self.agent),
                    "integrity_mismatch", 409)
            ttl = payload["expires_in"]
            require(type(ttl) is int and 1 <= ttl <= 600)
            require(len(self.store.all("grant")) < 32, "quota_exceeded", 429)
            expires = min(int(self.clock()) + ttl, self.identity_expiry)
            grant = {"grant_id": "grant-" + secrets.token_hex(16), "subject": {"user": self.subject},
                     "delegate": {"runtime": self.runtime, "agent": self.agent, "identity_evidence": self.identity},
                     "resource_server": {"app_id": self.manifest["app_id"], "issuer": self.origin,
                                         "surface_version": self.manifest["surface_version"],
                                         "surface_hash": self.manifest["surface_hash"]},
                     "locations": [self.origin + "/asp/actions"], "actions": [READ, PROPOSE], "scopes": [READ, PROPOSE],
                     "constraints": {"expires_at": iso(expires), "workspace_id": self.workspace,
                                     "credential_release": {"mode": "deny"}},
                     "credential_profile": "compatibility_bearer",
                     "credential_binding": {"method": "bearer", "runtime_id": self.runtime,
                                            "agent_id": self.agent, "identity_evidence": self.identity},
                     "data_exposure": [{"source": {"kind": "action", "id": action}, **copy.deepcopy(EXPOSURE)}
                                       for action in (READ, PROPOSE)], "audit": {}}
            grant["grant_hash"] = object_hash("grant", grant)
            token = secrets.token_urlsafe(32)
            self.store.put("grant", digest(token.encode()), {"grant": grant, "active": True, "expires": expires,
                           "audience": self.origin + "/asp", "proposal_count": 0})
            return {"grant": grant, "credential": token, "identity_status": self._identity()}

    def authenticate(self, token):
        require(isinstance(token, str) and 32 <= len(token) <= 128, "grant_invalid", 401)
        record = self.store.get("grant", digest(token.encode()))
        require(record is not None, "grant_invalid", 401)
        require(record["active"], "grant_revoked", 403)
        require(self.clock() < record["expires"], "grant_expired", 403)
        require(record["audience"] == self.origin + "/asp", "grant_invalid", 401)
        self._identity()
        grant = record["grant"]
        require(grant["grant_hash"] == object_hash("grant", grant), "integrity_mismatch", 409)
        require(grant["resource_server"]["surface_hash"] == self.manifest["surface_hash"], "integrity_mismatch", 409)
        require(grant["delegate"] == {"runtime": self.runtime, "agent": self.agent, "identity_evidence": self.identity},
                "integrity_mismatch", 409)
        return record

    def revoke(self, payload):
        closed(payload, ("grant_id",))
        with self.store.transaction() as db:
            rows = list(db.execute("SELECT key FROM records WHERE kind='grant'"))
            for (key,) in rows:
                record = self.store.get("grant", key)
                if record["grant"]["grant_id"] == payload["grant_id"]:
                    record["active"] = False
                    self.store.put("grant", key, record)
            return {"revoked": True}  # Non-enumerating, idempotent management result.

    def _tuple(self, p, grant):
        require((p.get("grant_id"), p.get("grant_hash")) == (grant["grant_id"], grant["grant_hash"]), "integrity_mismatch", 409)
        identifier(p.get("session_id"))
        require(type(p.get("session_generation")) is int and p["session_generation"] == 1, "session_invalid", 409)

    def session(self, token, body):
        closed(body, ("type", "payload"))
        p = body["payload"]
        with self.store.transaction():
            grant = self.authenticate(token)["grant"]
            require(isinstance(p, dict))
            self._tuple(p, grant)
            existing = self.store.get("session", p["session_id"])
            if body["type"] == "session.start":
                closed(p, ("session_id", "session_generation", "trace_id", "span_id", "grant_id", "grant_hash",
                           "runtime_id", "agent_id", "identity_evidence_hash", "initiated_by", "surface", "task"))
                require((p["runtime_id"], p["agent_id"], p["identity_evidence_hash"], p["initiated_by"]) ==
                        (self.runtime, self.agent, self.identity_hash, "runtime"), "session_invalid", 409)
                require(p["surface"] == {key: self.manifest[key] for key in ("app_id", "surface_version", "surface_hash")},
                        "session_invalid", 409)
                closed(p["task"], ("kind", "goal", "inputs"))
                require(p["task"] == {"kind": "raw-idea.draft", "goal": "Prepare a private idea draft", "inputs": {"workspace_id": self.workspace}})
                if existing:
                    require(existing["start"] == body, "session_transition_invalid", 409)
                    return existing["state"]
                require(len(self.store.all("session")) < 32, "quota_exceeded", 429)
                require(not any(row["start"]["payload"]["grant_id"] == grant["grant_id"] and
                                row["state"]["payload"]["state"] in ("active", "interrupted")
                                for row in self.store.all("session")),
                        "session_transition_invalid", 409)
                state = envelope("session.state", {**{k: p[k] for k in ("session_id", "session_generation", "grant_id", "grant_hash",
                                                   "runtime_id", "agent_id", "identity_evidence_hash")},
                            "surface_hash": self.manifest["surface_hash"], "state": "active", "transition_reason": "start_accepted"})
                self.store.put("session", p["session_id"], {"start": body, "state": state})
                return state
            if body["type"] == "session.pause":
                closed(p, ("pause_id", "session_id", "session_generation", "grant_id", "grant_hash", "surface_hash", "reason", "guard_id"))
                identifier(p["pause_id"])
                identifier(p["guard_id"])
                require(p["reason"] == "runaway_guard" and p["surface_hash"] == self.manifest["surface_hash"],
                        "session_transition_invalid", 409)
                require(existing is not None and existing["start"]["payload"]["grant_id"] == grant["grant_id"],
                        "session_transition_invalid", 409)
                if "pause" in existing:
                    require(existing["pause"] == body, "session_transition_invalid", 409)
                    return existing["pause_response"]
                require(existing["state"]["payload"]["state"] == "active", "session_transition_invalid", 409)
                existing["state"]["payload"].update(state="interrupted", transition_reason="runaway_guard",
                                                     pause_id=p["pause_id"], guard_id=p["guard_id"])
                existing["pause"], existing["pause_response"] = body, copy.deepcopy(existing["state"])
                self.store.put("session", p["session_id"], existing)
                return existing["state"]
            closed(p, ("session_id", "session_generation", "grant_id", "grant_hash", "surface_hash"))
            require(body["type"] in ("session.cancel", "session.query"), "session_transition_invalid", 409)
            require(existing is not None and existing["start"]["payload"]["grant_id"] == grant["grant_id"] and
                    p["surface_hash"] == self.manifest["surface_hash"], "session_invalid", 409)
            if body["type"] == "session.cancel":
                existing["state"]["payload"].update(state="cancelled", transition_reason="cancelled")
                self.store.put("session", p["session_id"], existing)
            return existing["state"]

    def _snapshot(self):
        status, state = native.read_state(self.server, workspace_id=self.workspace)
        require(status == 200, "service_unavailable", 503)
        # Hash all selected native records, including non-draft state, without
        # exporting that state. A native change must invalidate a pending draft.
        return state["requests"], digest(canonical({"domain": LOCAL + "workspace-snapshot", "object": state["requests"]}))

    def _request(self, body, grant, idempotency_header, *, allow_interrupted=False):
        closed(body, ("type", "payload"))
        require(body["type"] == "action.request")
        p = body["payload"]
        require(isinstance(p, dict))
        self._tuple(p, grant)
        require(p.get("surface_hash") == self.manifest["surface_hash"], "integrity_mismatch", 409)
        require(p.get("action_id") in (READ, PROPOSE), "action_unknown", 404)
        propose = p["action_id"] == PROPOSE
        keys = {"session_id", "session_generation", "trace_id", "span_id", "grant_id", "grant_hash", "surface_hash", "action_id", "input_hash", "execution", "input"}
        closed(p, keys | ({"idempotency_key"} if propose else set()))
        closed(p["execution"], ("mode", "execution_id"))
        identifier(p["execution"]["execution_id"])
        require(p["execution"]["mode"] == ("propose" if propose else "read"), "execution_mode_invalid", 409)
        closed(p["input"], SCHEMAS[("propose" if propose else "read") + "-input"]["required"])
        require(identifier(p["input"]["workspace_id"]) == self.workspace, "scope_denied", 403)
        if propose:
            identifier(p["input"]["request_id"])
            text = p["input"]["idea_text"]
            require(isinstance(text, str) and 1 <= len(text) <= 8000)
            # Native cleanup is not ASP normalization. Reject instead of
            # saving bytes different from the exact input the user approved.
            require(native._clean_text(text) == text, "input_not_normalized", 400)
            require(isinstance(p["input"]["snapshot_hash"], str) and len(p["input"]["snapshot_hash"]) == 51)
            identifier(p["idempotency_key"])
            require(idempotency_header == p["idempotency_key"])
        else:
            require(idempotency_header is None)
        require(object_hash("action-input", p["input"]) == p["input_hash"], "integrity_mismatch", 409)
        session = self.store.get("session", p["session_id"])
        allowed = ("active", "interrupted") if allow_interrupted else ("active",)
        require(session is not None and session["start"]["payload"]["grant_id"] == grant["grant_id"] and
                session["state"]["payload"]["state"] in allowed, "session_invalid", 409)
        return p

    def _fingerprint(self, p):
        # Excludes tracing only. Approval is exact to every authority/input/
        # execution member, not a reusable permission for a similar draft.
        return digest(canonical({k: v for k, v in p.items() if k not in ("trace_id", "span_id")}))

    def request_approval(self, token, body, header):
        with self.store.transaction():
            p = self._request(body, self.authenticate(token)["grant"], header)
            require(p["action_id"] == PROPOSE)
            fingerprint = self._fingerprint(p)
            existing = self.store.get("approval", fingerprint)
            if existing:
                return {"approval_id": fingerprint, "request": p, "approved": existing["approved"]}
            require(len(self.store.all("approval")) < 64, "quota_exceeded", 429)
            _, snapshot = self._snapshot()
            require(snapshot == p["input"]["snapshot_hash"], "precondition_failed", 409)
            self.store.put("approval", fingerprint, {"request": p, "approved": False, "expires": int(self.clock()) + 120})
            return {"approval_id": fingerprint, "request": p, "approved": False}

    def approve(self, body):
        closed(body, ("approval_id", "input_hash", "accept"))
        digest_identifier(body["approval_id"])
        with self.store.transaction():
            self._identity()
            row = self.store.get("approval", body["approval_id"])
            require(row is not None and self.clock() < row["expires"], "approval_expired", 403)
            require(body["input_hash"] == row["request"]["input_hash"], "integrity_mismatch", 409)
            require(body["accept"] is True, "approval_required", 403)
            _, snapshot = self._snapshot()
            require(snapshot == row["request"]["input"]["snapshot_hash"], "precondition_failed", 409)
            row["approved"] = True
            self.store.put("approval", body["approval_id"], row)
            return {"approved": True, "approval_id": body["approval_id"]}

    def action(self, token, body, header):
        with self.store.transaction():
            record = self.authenticate(token)
            p = self._request(body, record["grant"], header, allow_interrupted=True)
            session_state = self.store.get("session", p["session_id"])["state"]["payload"]["state"]
            if p["action_id"] == READ:
                require(session_state == "active", "session_invalid", 409)
                rows, snapshot = self._snapshot()
                output = {"workspace_id": self.workspace, "snapshot_hash": snapshot,
                          "drafts": [{key: row[key] for key in ("request_id", "idea_text", "status")}
                                     for row in rows if row["status"] == "draft"]}
                return self._result(p, output)
            key = digest(canonical([p["grant_id"], p["action_id"], p["idempotency_key"]]))
            execution_key = digest(canonical([p["grant_id"], p["execution"]["execution_id"]]))
            fingerprint = self._fingerprint(p)
            existing = self.store.get("result", key)
            execution = self.store.get("execution", execution_key)
            require(execution is None or execution == {"key": key}, "idempotency_conflict", 409)
            if existing:
                require(existing["fingerprint"] == fingerprint, "idempotency_conflict", 409)
                return existing["response"]
            require(session_state == "active", "session_invalid", 409)
            approval = self.store.get("approval", fingerprint)
            require(approval is not None and approval["approved"], "approval_required", 403)
            require(self.clock() < approval["expires"], "approval_expired", 403)
            rows, snapshot = self._snapshot()
            require(snapshot == p["input"]["snapshot_hash"], "precondition_failed", 409)
            require(not any(row["request_id"] == p["input"]["request_id"] for row in rows), "precondition_failed", 409)
            require(record["proposal_count"] < 8, "quota_exceeded", 429)
            status, state = native.save_request(self.server, {"workspace_id": self.workspace,
                "request_id": p["input"]["request_id"], "idea_text": p["input"]["idea_text"],
                "status": "draft", "operator_ref": self.subject}, workspace_id=self.workspace)
            require(status == 200, "service_unavailable", 503)
            saved = next(row for row in state["requests"] if row["request_id"] == p["input"]["request_id"])
            require(saved["status"] == "draft" and saved["idea_text"] == p["input"]["idea_text"], "integrity_mismatch", 409)
            output = {key: saved[key] for key in ("workspace_id", "request_id", "idea_text", "status")}
            response = self._result(p, output)
            self.store.put("result", key, {"fingerprint": fingerprint, "response": response})
            self.store.put("execution", execution_key, {"key": key})
            record["proposal_count"] += 1
            self.store.put("grant", digest(token.encode()), record)
            return response

    def _result(self, p, output):
        # Output comes from mutable native state too; do not advertise a schema
        # then export a native record that violates it.
        identifier(output["workspace_id"])
        if p["action_id"] == READ:
            for row in output["drafts"]:
                identifier(row["request_id"])
                require(row["status"] == "draft" and isinstance(row["idea_text"], str))
        else:
            identifier(output["request_id"])
            require(output["status"] == "draft" and isinstance(output["idea_text"], str))
        payload = {k: v for k, v in p.items() if k != "input"}
        payload.update(span_id=secrets.token_hex(8), result="success", output=output)
        return envelope("action.result", payload)
