"""Single-operator access control for private SpecSpace HTTP routes."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
from collections.abc import Mapping
from http import HTTPStatus
from typing import Any, Protocol

from viewer.http_response import json_response


OPERATOR_REALM = "SpecSpace operator"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class OperatorAuthServer(Protocol):
    operator_auth_enabled: bool
    operator_auth_username: str | None
    operator_auth_password_digest: bytes | None
    operator_auth_allowed_origin: str | None


class OperatorAuthHandler(Protocol):
    server: OperatorAuthServer
    headers: Any
    path: str


def password_digest(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def _basic_credentials(headers: Mapping[str, str]) -> tuple[str, str] | None:
    value = headers.get("Authorization")
    if not isinstance(value, str):
        return None
    scheme, separator, encoded = value.partition(" ")
    if separator != " " or scheme.lower() != "basic" or not encoded.strip():
        return None
    try:
        decoded = base64.b64decode(encoded.strip(), validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return None
    username, separator, password = decoded.partition(":")
    if separator != ":":
        return None
    return username, password


def request_is_operator(
    server: OperatorAuthServer,
    headers: Mapping[str, str],
) -> bool:
    if getattr(server, "operator_auth_enabled", False) is not True:
        return True
    credentials = _basic_credentials(headers)
    expected_username = getattr(server, "operator_auth_username", None)
    expected_password_digest = getattr(
        server,
        "operator_auth_password_digest",
        None,
    )
    if (
        credentials is None
        or not isinstance(expected_username, str)
        or not isinstance(expected_password_digest, bytes)
    ):
        return False
    username, password = credentials
    return hmac.compare_digest(username, expected_username) and hmac.compare_digest(
        password_digest(password),
        expected_password_digest,
    )


def _reject(
    handler: OperatorAuthHandler,
    status: HTTPStatus,
    *,
    error: str,
    reason: str,
    authenticate: bool = False,
) -> None:
    headers = {}
    if authenticate:
        headers["WWW-Authenticate"] = f'Basic realm="{OPERATOR_REALM}", charset="UTF-8"'
    json_response(
        handler,
        status,
        {
            "error": error,
            "reason": reason,
        },
        headers=headers,
    )


def authorize_operator_request(
    handler: OperatorAuthHandler,
    *,
    method: str,
) -> bool:
    server = handler.server
    if getattr(server, "operator_auth_enabled", False) is not True:
        return True
    headers = handler.headers
    if not request_is_operator(server, headers):
        request_path = str(getattr(handler, "path", "")).partition("?")[0]
        _reject(
            handler,
            HTTPStatus.UNAUTHORIZED,
            error="Operator authentication is required.",
            reason="operator_authentication_required",
            authenticate=request_path == "/api/v1/operator-session",
        )
        return False
    if method not in UNSAFE_METHODS:
        return True

    expected_origin = getattr(server, "operator_auth_allowed_origin", None)
    request_origin = headers.get("Origin")
    if (
        not isinstance(expected_origin, str)
        or not isinstance(request_origin, str)
        or not hmac.compare_digest(request_origin, expected_origin)
    ):
        _reject(
            handler,
            HTTPStatus.FORBIDDEN,
            error="The request origin is not allowed for operator mutations.",
            reason="operator_origin_not_allowed",
        )
        return False

    content_type = headers.get("Content-Type")
    media_type = (
        content_type.split(";", 1)[0].strip().lower()
        if isinstance(content_type, str)
        else ""
    )
    if media_type != "application/json":
        _reject(
            handler,
            HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
            error="Operator mutations require application/json.",
            reason="operator_json_content_type_required",
        )
        return False
    return True
