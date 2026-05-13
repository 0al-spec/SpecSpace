"""Hyperprompt compile pipeline helpers."""

from __future__ import annotations

import subprocess
from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path
from typing import Any


EXIT_CODE_DESCRIPTIONS: dict[int, str] = {
    1: "IO error",
    2: "Syntax error",
    3: "Resolution/circular dependency error",
    4: "Internal compiler error",
}


def default_hyperprompt_fallbacks(default_binary: Path, *, repo_root: Path) -> list[tuple[str, Path]]:
    """Return additional candidate paths when the configured binary is not found.

    Searches for the binary in sibling architecture directories relative to the
    configured path (e.g. Swift multi-arch build output under a ``.build`` tree)
    and falls back to ``deps/hyperprompt`` at the repository root.
    """
    build_dir = default_binary.parent.parent
    candidates: list[tuple[str, Path]] = []
    for candidate in sorted(build_dir.glob("*/release/hyperprompt")):
        candidates.append(("fallback_glob", candidate))
    candidates.append(("fallback_deps", repo_root / "deps" / "hyperprompt"))
    return candidates


def resolve_hyperprompt_binary(
    configured_binary: str,
    *,
    default_hyperprompt_binary: str,
    repo_root: Path,
) -> tuple[str | None, list[str], str]:
    requested = Path(configured_binary).expanduser()
    default_binary = Path(default_hyperprompt_binary).expanduser()

    candidates: list[tuple[str, Path]] = [("configured", requested)]
    if requested == default_binary:
        candidates.extend(default_hyperprompt_fallbacks(default_binary, repo_root=repo_root))

    checked_paths: list[str] = []
    seen_paths: set[str] = set()
    for source, candidate in candidates:
        candidate_path = candidate.expanduser()
        candidate_text = str(candidate_path)
        if candidate_text in seen_paths:
            continue
        seen_paths.add(candidate_text)
        checked_paths.append(candidate_text)
        if candidate_path.exists() and candidate_path.is_file():
            return candidate_text, checked_paths, source

    return None, checked_paths, "missing"


def invoke_hyperprompt(
    export_dir: Path,
    binary_path: str,
    *,
    default_hyperprompt_binary: str,
    repo_root: Path,
) -> tuple[int, dict[str, Any]]:
    """Invoke the Hyperprompt compiler on the exported root.hc.

    Returns (http_status, payload). On success the payload contains
    compiled_md and manifest_json paths. On failure it contains error,
    exit_code, stderr, and stdout.
    """
    resolved_binary, checked_paths, resolution_source = resolve_hyperprompt_binary(
        binary_path,
        default_hyperprompt_binary=default_hyperprompt_binary,
        repo_root=repo_root,
    )
    if resolved_binary is None:
        checked_lines = "\n".join(f"- {path}" for path in checked_paths)
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "Hyperprompt not found",
            "details": f"Binary not found at: {binary_path}\nChecked paths:\n{checked_lines}",
            "exit_code": None,
            "checked_paths": checked_paths,
            "requested_binary": binary_path,
        }
    binary = Path(resolved_binary)

    hc_file = export_dir / "root.hc"
    if not hc_file.exists():
        return HTTPStatus.BAD_REQUEST, {
            "error": "root.hc not found in export directory",
            "details": f"Expected: {hc_file}",
            "exit_code": None,
        }

    compiled_md = export_dir / "compiled.md"
    manifest_json = export_dir / "manifest.json"

    cmd = [
        str(binary),
        str(hc_file),
        "--root", str(export_dir),
        "--output", str(compiled_md),
        "--manifest", str(manifest_json),
        "--stats",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        return HTTPStatus.INTERNAL_SERVER_ERROR, {
            "error": "Hyperprompt compiler timed out",
            "exit_code": None,
        }
    except Exception as exc:
        return HTTPStatus.INTERNAL_SERVER_ERROR, {
            "error": f"Failed to invoke Hyperprompt: {exc}",
            "exit_code": None,
        }

    if result.returncode != 0:
        description = EXIT_CODE_DESCRIPTIONS.get(result.returncode, "Unknown error")
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"Hyperprompt compiler failed: {description}",
            "exit_code": result.returncode,
            "stderr": result.stderr,
            "stdout": result.stdout,
        }

    return HTTPStatus.OK, {
        "compiled_md": str(compiled_md),
        "manifest_json": str(manifest_json),
        "exit_code": 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "binary_path": resolved_binary,
        "binary_resolution": resolution_source,
    }


def compile_graph_nodes(
    dialog_dir: Path,
    conversation_id: str,
    message_id: str | None,
    hyperprompt_binary: str,
    *,
    export_graph_nodes: Callable[[Path, str, str | None], tuple[int, dict[str, Any]]],
    invoke_hyperprompt: Callable[[Path, str], tuple[int, dict[str, Any]]],
) -> tuple[int, dict[str, Any]]:
    """Export lineage nodes and invoke the Hyperprompt compiler in one step."""
    export_status, export_response = export_graph_nodes(dialog_dir, conversation_id, message_id)
    if export_status != HTTPStatus.OK:
        return export_status, export_response

    export_dir = Path(export_response["export_dir"])
    compile_status, compile_response = invoke_hyperprompt(export_dir, hyperprompt_binary)
    if "provenance_json" in export_response:
        compile_response["provenance_json"] = export_response["provenance_json"]
    if "provenance_md" in export_response:
        compile_response["provenance_md"] = export_response["provenance_md"]

    combined = dict(export_response)
    combined["compile"] = compile_response
    return compile_status, combined
