"""Wire primitives for the bounded draft experiment, not a general ASP SDK.

The schema subset has only strings, booleans, null and safe integer numbers.
Reject other JSON numbers instead of pretending Python float output is JCS.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re

ASP = "https://github.com/0al-spec/agent-surface/"
LOCAL = "https://github.com/0al-spec/SpecSpace/experiments/asp-draft/v1/"
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")


class Reject(ValueError):
    def __init__(self, code: str, status: int = 400):
        super().__init__(code)
        self.code = code
        self.status = status


def require(condition, code="schema_invalid", status=400):
    if not condition:
        raise Reject(code, status)


def closed(value, keys):
    require(isinstance(value, dict) and set(value) == set(keys))
    return value


def identifier(value):
    require(isinstance(value, str) and ID.fullmatch(value) is not None)
    return value


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def _integer(value):
    require(value != "-0")
    number = int(value)
    require(abs(number) <= 9007199254740991)
    return number


def _reject_number(_):
    raise Reject("schema_invalid")


def loads(raw):
    try:
        value = json.loads(raw, object_pairs_hook=_pairs, parse_int=_integer,
                           parse_float=_reject_number, parse_constant=_reject_number)
        canonical(value)  # Also reject escaped lone surrogates/noncharacters.
        return value
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise Reject("schema_invalid") from exc


def canonical(value):
    if value is None or type(value) is bool:
        return json.dumps(value).encode()
    if type(value) is int:
        require(abs(value) <= 9007199254740991)
        return str(value).encode()
    if isinstance(value, str):
        require(all(not (0xD800 <= ord(c) <= 0xDFFF or 0xFDD0 <= ord(c) <= 0xFDEF
                         or ord(c) & 0xFFFF in (0xFFFE, 0xFFFF)) for c in value))
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if isinstance(value, list):
        return b"[" + b",".join(canonical(item) for item in value) + b"]"
    if isinstance(value, dict):
        require(all(isinstance(key, str) for key in value))
        for key in value:
            canonical(key)
        keys = sorted(value, key=lambda key: key.encode("utf-16-be"))
        return b"{" + b",".join(canonical(key) + b":" + canonical(value[key]) for key in keys) + b"}"
    raise Reject("schema_invalid")


def digest(raw):
    return "sha-256:" + base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")


def object_hash(kind, value):
    exclusions = {"manifest": {"surface_hash"}, "grant": {"grant_hash", "type"}}
    if kind in exclusions:
        value = {key: item for key, item in value.items() if key not in exclusions[kind]}
    return digest(canonical({"domain": ASP + "hash/" + kind + "/v1", "object": value}))


def envelope(kind, payload):
    return {"type": kind, "payload": payload}
