#!/usr/bin/env python3
"""Reject legacy ContextBuilder API routes in runtime GraphSpace source."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
GRAPHSPACE_SRC = REPO_ROOT / "graphspace" / "src"

SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}
IGNORED_PARTS = {"__tests__", "fixtures"}

FORBIDDEN_ENDPOINTS = (
    "/api/file",
    "/api/files",
    "/api/graph",
    "/api/conversation",
    "/api/checkpoint",
    "/api/export",
    "/api/compile",
    "/api/watch",
    "/api/spec-watch",
    "/api/spec-node",
    "/api/spec-graph",
    "/api/spec-activity",
    "/api/implementation-work-index",
    "/api/proposal-spec-trace-index",
    "/api/runs-watch",
)

NON_VERSIONED_API_LITERAL = re.compile(r"(?P<quote>['\"`])(?P<path>/api/(?!v1/)[^'\"`\s]*)")


@dataclass(frozen=True)
class Violation:
    path: Path
    line_number: int
    token: str
    reason: str


def is_runtime_source(path: Path) -> bool:
    if path.suffix not in SOURCE_SUFFIXES:
        return False
    return not any(part in IGNORED_PARTS for part in path.parts)


def line_violations(path: Path, line_number: int, line: str) -> list[Violation]:
    violations: list[Violation] = []

    for endpoint in FORBIDDEN_ENDPOINTS:
        if endpoint in line:
            violations.append(
                Violation(
                    path=path,
                    line_number=line_number,
                    token=endpoint,
                    reason="legacy ContextBuilder endpoint",
                )
            )

    for match in NON_VERSIONED_API_LITERAL.finditer(line):
        api_path = match.group("path")
        if not any(api_path.startswith(endpoint) for endpoint in FORBIDDEN_ENDPOINTS):
            violations.append(
                Violation(
                    path=path,
                    line_number=line_number,
                    token=api_path,
                    reason="non-versioned API literal",
                )
            )

    return violations


def scan() -> list[Violation]:
    violations: list[Violation] = []
    for path in sorted(GRAPHSPACE_SRC.rglob("*")):
        if not path.is_file() or not is_runtime_source(path):
            continue
        text = path.read_text(encoding="utf-8")
        for line_number, line in enumerate(text.splitlines(), start=1):
            violations.extend(line_violations(path, line_number, line))
    return violations


def main() -> int:
    violations = scan()
    if not violations:
        return 0

    print("GraphSpace API boundary violations:", file=sys.stderr)
    for violation in violations:
        rel_path = violation.path.relative_to(REPO_ROOT)
        print(
            f"- {rel_path}:{violation.line_number}: {violation.token} "
            f"({violation.reason})",
            file=sys.stderr,
        )
    print(
        "Runtime graphspace source must consume SpecSpace API v1. "
        "Move legacy endpoint coverage into explicit tests/fixtures.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
