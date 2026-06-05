"""SpecSpace Hyperprompt compile helpers for readonly SpecGraph exports."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import hyperprompt_compile, spec_compile

BUNDLE_PREFIX = "specspace-"
BUNDLE_SENTINEL = ".specspace-hyperprompt-bundle"
DEFAULT_BUNDLE_RETENTION_COUNT = 20


def _safe_stem(value: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._-")
    return stem or "spec-export"


def render_spec_markdown_root_hc(markdown_file_name: str) -> str:
    """Render a minimal Hyperprompt root for one SpecSpace Markdown export."""
    return "\n".join([
        "# SpecSpace SpecGraph export",
        '"SpecSpace SpecGraph export"',
        f'    "{markdown_file_name}"',
        "",
    ])


def _owned_bundle_dirs(work_dir: Path) -> list[Path]:
    try:
        candidates = list(work_dir.iterdir())
    except OSError:
        return []
    return [
        candidate
        for candidate in candidates
        if candidate.is_dir()
        and candidate.name.startswith(BUNDLE_PREFIX)
        and (candidate / BUNDLE_SENTINEL).is_file()
    ]


def prune_specspace_compile_bundles(
    work_dir: Path,
    *,
    keep_latest: int = DEFAULT_BUNDLE_RETENTION_COUNT,
) -> None:
    """Best-effort cleanup for old SpecSpace-owned compile bundles."""
    def _mtime(path: Path) -> float:
        try:
            return path.stat().st_mtime
        except OSError:
            return 0.0

    owned = sorted(
        _owned_bundle_dirs(work_dir),
        key=_mtime,
        reverse=True,
    )
    for bundle_dir in owned[max(1, keep_latest):]:
        try:
            shutil.rmtree(bundle_dir)
        except OSError:
            continue


def write_spec_markdown_export_bundle(
    *,
    work_dir: Path,
    root_id: str,
    scope: str,
    markdown: str,
    manifest: dict[str, Any],
    source: dict[str, Any],
    options: spec_compile.CompileOptions,
) -> dict[str, Any]:
    """Write the generated Markdown export into a local Hyperprompt bundle."""
    export_dir = Path(tempfile.mkdtemp(prefix=f"{BUNDLE_PREFIX}{_safe_stem(root_id)}-", dir=str(work_dir)))
    markdown_file = export_dir / "export.md"
    root_hc = export_dir / "root.hc"
    export_manifest = export_dir / "export_manifest.json"
    (export_dir / BUNDLE_SENTINEL).write_text(
        "SpecSpace Hyperprompt compile bundle. Safe to delete.\n",
        encoding="utf-8",
    )

    markdown_file.write_text(markdown, encoding="utf-8")
    root_hc.write_text(render_spec_markdown_root_hc(markdown_file.name), encoding="utf-8")
    export_manifest.write_text(
        json.dumps(
            {
                "artifact_kind": "specspace_spec_markdown_compile_export",
                "root_id": root_id,
                "scope": scope,
                "source": source,
                "manifest": manifest,
                "options": {
                    "max_depth": options.max_depth,
                    "include_objective": options.include_objective,
                    "include_acceptance": options.include_acceptance,
                    "include_depends_on_refs": options.include_depends_on_refs,
                    "include_prompt": options.include_prompt,
                    "include_children": options.include_children,
                },
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return {
        "export_dir": str(export_dir),
        "root_hc": str(root_hc),
        "markdown_file": str(markdown_file),
        "export_manifest": str(export_manifest),
    }


def _read_json_file(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compile_spec_markdown_export(
    *,
    work_dir: Path,
    root_id: str,
    scope: str,
    markdown: str,
    manifest: dict[str, Any],
    source: dict[str, Any],
    options: spec_compile.CompileOptions,
    binary_path: str,
    default_hyperprompt_binary: str,
    repo_root: Path,
    timeout_seconds: int = 60,
    max_input_bytes: int = 1_048_576,
    max_output_bytes: int = 2_097_152,
    bundle_retention_count: int = DEFAULT_BUNDLE_RETENTION_COUNT,
) -> tuple[int, dict[str, Any]]:
    """Compile a SpecSpace-generated Markdown export with Hyperprompt."""
    input_bytes = len(markdown.encode("utf-8"))
    if input_bytes > max_input_bytes:
        return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {
            "error": "Generated Spec Markdown export exceeds Hyperprompt input limit.",
            "input_bytes": input_bytes,
            "max_input_bytes": max_input_bytes,
        }

    try:
        bundle = write_spec_markdown_export_bundle(
            work_dir=work_dir,
            root_id=root_id,
            scope=scope,
            markdown=markdown,
            manifest=manifest,
            source=source,
            options=options,
        )
        prune_specspace_compile_bundles(work_dir, keep_latest=bundle_retention_count)
    except OSError as exc:
        return HTTPStatus.INTERNAL_SERVER_ERROR, {
            "error": "Failed to write SpecSpace Hyperprompt export bundle.",
            "detail": str(exc),
        }

    status, compile_payload = hyperprompt_compile.invoke_hyperprompt(
        Path(bundle["export_dir"]),
        binary_path,
        default_hyperprompt_binary=default_hyperprompt_binary,
        repo_root=repo_root,
        timeout_seconds=timeout_seconds,
    )
    compile_payload = {
        **compile_payload,
        **bundle,
        "timeout_seconds": timeout_seconds,
        "max_input_bytes": max_input_bytes,
        "max_output_bytes": max_output_bytes,
    }

    compiled_md = compile_payload.get("compiled_md")
    if status == HTTPStatus.OK and isinstance(compiled_md, str):
        compiled_path = Path(compiled_md)
        try:
            if compiled_path.stat().st_size > max_output_bytes:
                return HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {
                    "error": "Hyperprompt compiled output exceeds API response limit.",
                    "compile": compile_payload,
                }
            compile_payload["compiled_markdown"] = compiled_path.read_text(encoding="utf-8")
        except OSError as exc:
            return HTTPStatus.INTERNAL_SERVER_ERROR, {
                "error": "Hyperprompt compiled output could not be read.",
                "detail": str(exc),
                "compile": compile_payload,
            }

    manifest_json = compile_payload.get("manifest_json")
    if status == HTTPStatus.OK and isinstance(manifest_json, str):
        manifest_path = Path(manifest_json)
        try:
            compile_payload["compiler_manifest"] = _read_json_file(manifest_path)
        except (OSError, json.JSONDecodeError) as exc:
            return HTTPStatus.INTERNAL_SERVER_ERROR, {
                "error": "Hyperprompt manifest output could not be read.",
                "detail": str(exc),
                "compile": compile_payload,
            }

    return status, compile_payload
