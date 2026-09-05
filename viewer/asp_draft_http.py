"""HTTPS-only opt-in routes inside SpecSpace's existing ViewerHandler."""
from __future__ import annotations

import os
from pathlib import Path
import re
import sqlite3
import ssl
import subprocess

from viewer import asp_draft_identity, operator_auth
from viewer.asp_draft import DraftService, SCHEMAS
from viewer.asp_draft_store import DraftStore
from viewer.asp_draft_wire import Reject, closed, envelope, loads, require
from viewer.http_response import json_response

DISCOVERY = "/.well-known/agent-surface.json"
NATIVE = "/api/v1/real-idea-entry-requests"


def configure(server, args):
    path = getattr(args, "asp_draft_config", None)
    if path is None:
        return
    if (args.host != "127.0.0.1" or not server.operator_auth_enabled or server.external_state_enabled
            or server.platform_execution_enabled or server.hosted_managed_execution_enabled):
        raise ValueError("ASP draft experiment requires loopback, operator auth and local non-executing storage")
    if getattr(args, "specspace_state_dir", None) is None:
        raise ValueError("ASP draft experiment requires an explicit private synthetic state directory")
    root = Path(args.specspace_state_dir).expanduser()
    if root.is_symlink():
        raise ValueError("ASP draft state directory must not be a symlink")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise ValueError("ASP draft state directory must be owned by this user and mode 0700")
    config = loads(Path(path).read_bytes())
    closed(config, ("tls_cert", "tls_key", "issuer_public_key", "identity_artifact", "workspace_id", "runtime_id", "agent_id"))
    origin = "https://127.0.0.1:" + str(server.server_address[1])
    if server.operator_auth_allowed_origin not in (None, origin):
        raise ValueError("ASP operator origin must equal the direct HTTPS origin")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(config["tls_cert"], config["tls_key"])
    server.operator_auth_allowed_origin = origin
    server.specspace_state_backend = DraftStore(root)
    server.asp_draft = DraftService(server, origin, config["workspace_id"], config["runtime_id"], config["agent_id"],
        lambda now: asp_draft_identity.verify(Path(config["identity_artifact"]), Path(config["issuer_public_key"]), now))
    server.socket = context.wrap_socket(server.socket, server_side=True)


def _body(handler):
    require(handler.headers.get("Content-Type", "").split(";")[0].strip().lower() == "application/json", status=415)
    require(len(handler.headers.get_all("Content-Length", [])) == 1 and "Transfer-Encoding" not in handler.headers)
    raw_length = handler.headers.get("Content-Length", "")
    require(re.fullmatch(r"[0-9]{1,6}", raw_length) is not None)
    length = int(raw_length)
    require(0 < length <= 65536, status=413)
    raw = handler.rfile.read(length)
    require(len(raw) == length)
    return loads(raw)


def _trace(handler, body):
    if not isinstance(body, dict) or body.get("type") not in ("action.request", "session.start"):
        return
    p = body.get("payload", {})
    trace, span = p.get("trace_id"), p.get("span_id")
    require(isinstance(trace, str) and re.fullmatch("[0-9a-f]{32}", trace) is not None and int(trace, 16) != 0)
    require(isinstance(span, str) and re.fullmatch("[0-9a-f]{16}", span) is not None and int(span, 16) != 0)
    require(handler.headers.get("traceparent") == "00-" + trace + "-" + span + "-00")
    require("tracestate" not in handler.headers)  # Closed experiment privacy policy.


def dispatch(handler, method, parsed):
    service = getattr(handler.server, "asp_draft", None)
    reserved = parsed.path.startswith("/asp/") or parsed.path == DISCOVERY
    if service is None:
        if reserved:
            json_response(handler, 404, {"error": "Not found"}, headers={"Cache-Control": "no-store"})
        return reserved
    handler._asp_request = True
    handler.connection.settimeout(5)
    try:
        require(isinstance(handler.connection, ssl.SSLSocket), "grant_proof_invalid", 403)
        require(len(handler.headers.get_all("Host", [])) == 1 and handler.headers.get("Host") == service.origin[8:],
                "grant_proof_invalid", 403)
        require("Origin" not in handler.headers or handler.headers.get("Origin") == service.origin, "grant_proof_invalid", 403)
        # The experiment is an isolated deployment, not a switch that grants
        # agent access to the existing application router, filesystem or intake.
        if parsed.path == NATIVE and method in ("GET", "POST"):
            return False  # Existing OPERATOR route, native business logic.
        require(reserved and not parsed.query and not parsed.fragment, "action_unknown", 404)
        for name in ("Authorization", "Idempotency-Key", "traceparent", "Origin"):
            require(len(handler.headers.get_all(name, [])) <= 1)
        if method == "GET" and parsed.path == DISCOVERY:
            result = service.manifest
        elif method == "GET" and parsed.path.startswith("/asp/schemas/"):
            name = parsed.path.removeprefix("/asp/schemas/")
            require(name in SCHEMAS, "action_unknown", 404)
            result = SCHEMAS[name]
        elif parsed.path.startswith("/asp/operator/"):
            if not operator_auth.authorize_operator_request(handler, method=method):
                return True
            operation = parsed.path.removeprefix("/asp/operator/")
            if method == "GET" and operation == "consent":
                result = service.consent()
            elif method == "GET" and operation == "approvals":
                result = {"approvals": service.store.all("approval")}
            elif method == "POST" and operation in ("grant", "approve", "revoke"):
                body = _body(handler)
                result = {"grant": service.issue, "approve": service.approve, "revoke": service.revoke}[operation](body)
            else:
                raise Reject("action_unknown", 404)
        else:
            authorization = handler.headers.get("Authorization", "")
            require(authorization.startswith("Bearer "), "grant_invalid", 401)
            token = authorization[7:]
            # Cheap boundary rejection before body read; the service repeats
            # authoritative checks inside the mutation's SQLite transaction.
            with service.store.transaction():
                service.authenticate(token)
            if method == "GET" and parsed.path == "/asp/grant":
                with service.store.transaction():
                    result = {"grant": service.authenticate(token)["grant"], "identity_status": service._identity()}
            else:
                require(method == "POST", "action_unknown", 404)
                body = _body(handler)
                _trace(handler, body)
                if parsed.path == "/asp/sessions":
                    result = service.session(token, body)
                elif parsed.path == "/asp/actions":
                    result = service.action(token, body, handler.headers.get("Idempotency-Key"))
                elif parsed.path == "/asp/approval-request":
                    result = service.request_approval(token, body, handler.headers.get("Idempotency-Key"))
                else:
                    raise Reject("action_unknown", 404)
        headers = {}
        if isinstance(result, dict) and result.get("type") == "action.result":
            p = result["payload"]
            headers["traceparent"] = "00-" + p["trace_id"] + "-" + p["span_id"] + "-00"
        json_response(handler, 200, result, headers=headers)
    except Reject as exc:
        json_response(handler, exc.status, envelope("error", {"code": exc.code, "description": exc.code, "retryable": False}))
    except (OSError, sqlite3.Error, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        # No exception text, private file paths, statements, keys or credentials.
        json_response(handler, 503, envelope("error", {"code": "service_unavailable", "description": "Local state unavailable", "retryable": False}))
    return True
