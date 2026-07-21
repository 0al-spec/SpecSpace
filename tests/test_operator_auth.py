import base64
from dataclasses import dataclass
import json
import tempfile
import threading
from http import HTTPStatus
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from viewer import operator_auth, routes, server_runtime
from viewer.http_response import json_response
from viewer.server import ViewerHandler


USERNAME = "operator"
PASSWORD = "a" * 48
ORIGIN = "https://specgraph.space"


class AccessControlTestHandler(ViewerHandler):
    def handle_v1_health(self) -> None:
        json_response(self, HTTPStatus.OK, {"status": "ok"})

    def handle_v1_real_idea_entry_requests(self, _parsed) -> None:
        json_response(self, HTTPStatus.OK, {"idea_text": "private"})

    def handle_v1_real_idea_entry_request_post(self, _parsed) -> None:
        payload = self.read_json_body()
        if payload is not None:
            json_response(self, HTTPStatus.OK, {"saved": True})


def _authorization(username: str = USERNAME, password: str = PASSWORD) -> str:
    encoded = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {encoded}"


def _start_server(*, auth_enabled: bool = True) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), AccessControlTestHandler)
    server.operator_auth_enabled = auth_enabled
    server.operator_auth_username = USERNAME if auth_enabled else None
    server.operator_auth_password_digest = (
        operator_auth.password_digest(PASSWORD) if auth_enabled else None
    )
    server.operator_auth_allowed_origin = ORIGIN if auth_enabled else None
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://127.0.0.1:{server.server_port}"


def _stop_server(server: ThreadingHTTPServer, thread: threading.Thread) -> None:
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


@dataclass(frozen=True)
class ErrorResponse:
    code: int
    headers: object
    payload: dict[str, object]


def _error(request: Request) -> ErrorResponse:
    try:
        urlopen(request, timeout=2)
    except HTTPError as exc:
        try:
            return ErrorResponse(
                code=exc.code,
                headers=exc.headers,
                payload=json.load(exc),
            )
        finally:
            exc.close()
    raise AssertionError("request unexpectedly succeeded")


def test_public_route_remains_anonymous() -> None:
    server, thread, base_url = _start_server()
    try:
        with urlopen(f"{base_url}/api/v1/health", timeout=2) as response:
            assert response.status == HTTPStatus.OK
            assert json.load(response) == {"status": "ok"}
    finally:
        _stop_server(server, thread)


def test_private_get_rejects_before_handler_reads_state_without_browser_prompt() -> None:
    server, thread, base_url = _start_server()
    try:
        error = _error(Request(f"{base_url}/api/v1/real-idea-entry-requests"))

        assert error.code == HTTPStatus.UNAUTHORIZED
        assert error.headers["WWW-Authenticate"] is None
        assert error.headers["Cache-Control"] == "no-store"
        assert error.payload["reason"] == "operator_authentication_required"
    finally:
        _stop_server(server, thread)


def test_sensitive_projection_gets_require_operator_access() -> None:
    server, thread, base_url = _start_server()
    try:
        for path in (
            "/api/v1/artifacts/content?path=runs/private.json",
            "/api/v1/idea-to-spec-workspace-state-hygiene?workspace=private",
        ):
            error = _error(Request(f"{base_url}{path}"))
            assert error.code == HTTPStatus.UNAUTHORIZED
            assert error.payload["reason"] == "operator_authentication_required"
    finally:
        _stop_server(server, thread)


def test_private_get_rejects_wrong_credentials_and_accepts_operator() -> None:
    server, thread, base_url = _start_server()
    try:
        wrong = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            headers={"Authorization": _authorization(password="wrong")},
        )
        assert _error(wrong).code == HTTPStatus.UNAUTHORIZED

        non_ascii = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            headers={"Authorization": _authorization(username="é")},
        )
        assert _error(non_ascii).code == HTTPStatus.UNAUTHORIZED

        valid = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            headers={"Authorization": _authorization()},
        )
        with urlopen(valid, timeout=2) as response:
            assert response.status == HTTPStatus.OK
            assert response.headers["Cache-Control"] == "no-store"
            assert json.load(response)["idea_text"] == "private"
    finally:
        _stop_server(server, thread)


def test_operator_session_provides_a_browser_login_target() -> None:
    server, thread, base_url = _start_server()
    try:
        error = _error(Request(f"{base_url}/api/v1/operator-session"))
        assert error.code == HTTPStatus.UNAUTHORIZED
        assert error.headers["WWW-Authenticate"] == (
            'Basic realm="SpecSpace operator", charset="UTF-8"'
        )

        request = Request(
            f"{base_url}/api/v1/operator-session",
            headers={"Authorization": _authorization()},
        )
        with urlopen(request, timeout=2) as response:
            assert response.status == HTTPStatus.OK
            assert json.load(response)["status"] == "operator_authenticated"
    finally:
        _stop_server(server, thread)


def test_private_post_authenticates_before_parsing_body() -> None:
    server, thread, base_url = _start_server()
    try:
        request = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            data=b"not-json",
            method="POST",
        )
        error = _error(request)

        assert error.code == HTTPStatus.UNAUTHORIZED
        assert error.payload["reason"] == "operator_authentication_required"
    finally:
        _stop_server(server, thread)


def test_private_post_requires_exact_origin_and_json() -> None:
    server, thread, base_url = _start_server()
    try:
        missing_origin = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            data=b"{}",
            method="POST",
            headers={
                "Authorization": _authorization(),
                "Content-Type": "application/json",
            },
        )
        error = _error(missing_origin)
        assert error.code == HTTPStatus.FORBIDDEN
        assert error.payload["reason"] == "operator_origin_not_allowed"

        wrong_content_type = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            data=b"{}",
            method="POST",
            headers={
                "Authorization": _authorization(),
                "Content-Type": "text/plain",
                "Origin": ORIGIN,
            },
        )
        error = _error(wrong_content_type)
        assert error.code == HTTPStatus.UNSUPPORTED_MEDIA_TYPE
        assert error.payload["reason"] == "operator_json_content_type_required"

        valid = Request(
            f"{base_url}/api/v1/real-idea-entry-requests",
            data=b"{}",
            method="POST",
            headers={
                "Authorization": _authorization(),
                "Content-Type": "application/json",
                "Origin": ORIGIN,
            },
        )
        with urlopen(valid, timeout=2) as response:
            assert response.status == HTTPStatus.OK
            assert json.load(response) == {"saved": True}
    finally:
        _stop_server(server, thread)


def test_auth_disabled_preserves_local_development_routes() -> None:
    server, thread, base_url = _start_server(auth_enabled=False)
    try:
        with urlopen(
            f"{base_url}/api/v1/real-idea-entry-requests",
            timeout=2,
        ) as response:
            assert response.status == HTTPStatus.OK
    finally:
        _stop_server(server, thread)


class OperatorAuthContractTests(unittest.TestCase):
    """Keep the access-control contract visible to unittest-based remote CI."""

    def test_public_route_remains_anonymous(self) -> None:
        test_public_route_remains_anonymous()

    def test_private_get_rejects_before_state_access(self) -> None:
        test_private_get_rejects_before_handler_reads_state_without_browser_prompt()

    def test_sensitive_projection_gets_require_operator(self) -> None:
        test_sensitive_projection_gets_require_operator_access()

    def test_private_get_accepts_only_operator_credentials(self) -> None:
        test_private_get_rejects_wrong_credentials_and_accepts_operator()

    def test_operator_session_is_explicit_login_target(self) -> None:
        test_operator_session_provides_a_browser_login_target()

    def test_private_post_authenticates_before_body_parse(self) -> None:
        test_private_post_authenticates_before_parsing_body()

    def test_private_post_requires_origin_and_json(self) -> None:
        test_private_post_requires_exact_origin_and_json()

    def test_auth_disabled_preserves_local_development(self) -> None:
        test_auth_disabled_preserves_local_development_routes()

    def test_all_mutation_routes_require_operator_access(self) -> None:
        for route in (*routes.POST_ROUTES.values(), *routes.DELETE_ROUTES.values()):
            self.assertIs(route.access, routes.RouteAccess.OPERATOR)

    def test_private_state_reads_require_operator_access(self) -> None:
        private_paths = {
            "/api/v1/agent-workbench/conversations",
            "/api/v1/artifacts/content",
            "/api/v1/idea-to-spec-candidate-approval-intents",
            "/api/v1/idea-to-spec-intake-clarification-answers",
            "/api/v1/idea-to-spec-repair-drafts",
            "/api/v1/idea-to-spec-repair-rerun-requests",
            "/api/v1/idea-to-spec-workspace-state-hygiene",
            "/api/v1/operator-session",
            "/api/v1/product-workspace-creation-requests",
            "/api/v1/project-local-ontology-review-decisions",
            "/api/v1/real-idea-answer-continuation-execution-requests",
            "/api/v1/real-idea-entry-requests",
            "/api/v1/real-idea-intake-execution-requests",
        }
        for path in private_paths:
            route = routes.route_for("GET", path)
            self.assertIsNotNone(route, path)
            self.assertIs(route.access, routes.RouteAccess.OPERATOR, path)

    def test_enabled_auth_without_password_fails_startup(self) -> None:
        environment = {
            "SPECSPACE_OPERATOR_AUTH_ENABLED": "true",
            "SPECSPACE_OPERATOR_AUTH_USERNAME": "operator",
            "SPECSPACE_OPERATOR_AUTH_ALLOWED_ORIGIN": "https://specgraph.space",
        }
        with patch.dict("os.environ", environment, clear=True):
            parser = server_runtime.build_arg_parser(
                description=None,
                default_hyperprompt_binary="/bin/hyperprompt",
            )
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                args = parser.parse_args(
                    ["--dialog-dir", str(root / "dialogs")]
                )

                with self.assertRaisesRegex(
                    ValueError,
                    "operator auth password must contain",
                ):
                    server_runtime.configure_server(
                        SimpleNamespace(),
                        args,
                        repo_root=root,
                        resolve_hyperprompt_binary=lambda binary: (
                            binary,
                            [],
                            "configured",
                        ),
                        workspace_watcher_factory=lambda path: (
                            "workspace",
                            path,
                        ),
                        spec_watcher_factory=lambda path: ("spec", path),
                        runs_watcher_factory=lambda path: ("runs", path),
                    )
