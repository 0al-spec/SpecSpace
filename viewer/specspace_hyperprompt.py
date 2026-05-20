"""SpecSpace Hyperprompt compile helpers for readonly SpecGraph exports."""

from __future__ import annotations

import json
import re
import tempfile
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import hyperprompt_compile, spec_compile


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
    export_dir = Path(tempfile.mkdtemp(prefix=f"{_safe_stem(root_id)}-", dir=str(work_dir)))
    markdown_file = export_dir / "export.md"
    root_hc = export_dir / "root.hc"
    export_manifest = export_dir / "export_manifest.json"

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
) -> tuple[int, dict[str, Any]]:
    """Compile a SpecSpace-generated Markdown export with Hyperprompt."""
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
    )
    compile_payload = {**compile_payload, **bundle}

    compiled_md = compile_payload.get("compiled_md")
    if status == HTTPStatus.OK and isinstance(compiled_md, str):
        compiled_path = Path(compiled_md)
        try:
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
