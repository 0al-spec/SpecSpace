"""Markdown export and compile provenance helpers."""

from __future__ import annotations

import json
import shutil
from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import schema
from viewer.graph import (
    BlockedConversationIndex,
    GraphCheckpoint,
    GraphEdgeIndex,
    GraphNodeIndex,
    GraphSnapshot,
)


def generate_hc_root(
    conversations: list[dict[str, Any]],
    titles_by_conv: dict[str, str],
    provenance_file: str | None = None,
) -> str:
    """Generate root.hc content with a single depth-0 root node."""
    lines: list[str] = ["# ContextBuilder export", '"ContextBuilder export root"']
    if provenance_file:
        lines.append('    "ContextBuilder compile provenance"')
        lines.append(f'    "{provenance_file}"')
    for conv_entry in conversations:
        if not conv_entry["files"]:
            continue
        conv_id = conv_entry["conversation_id"]
        title = titles_by_conv.get(conv_id) or conv_id
        lines.append(f'    "{title}"')
        for filename in conv_entry["files"]:
            lines.append(f'    "nodes/{conv_id}/{filename}"')
    return "\n".join(lines) + "\n"


def _render_node_markdown(conversation_id: str, checkpoint: GraphCheckpoint) -> str:
    """Render one checkpoint as a Markdown node file with a provenance comment."""
    parts = [
        f"conversation_id: {conversation_id}",
        f"message_id: {checkpoint['message_id']}",
        f"role: {checkpoint['role']}",
    ]
    if checkpoint.get("turn_id"):
        parts.append(f"turn_id: {checkpoint['turn_id']}")
    if checkpoint.get("source"):
        parts.append(f"source: {checkpoint['source']}")
    comment = "<!-- " + "  ".join(parts) + " -->"
    return comment + "\n\n" + checkpoint["content"] + "\n"


def build_compile_provenance(
    *,
    compile_target: schema.CompileTargetPayload,
    conversations_written: list[dict[str, Any]],
    nodes_by_conversation: GraphNodeIndex,
) -> dict[str, Any]:
    """Build deterministic provenance metadata for export + compiled artifacts."""
    source_conversations: list[dict[str, Any]] = []
    for conversation in conversations_written:
        conv_id = conversation["conversation_id"]
        node = nodes_by_conversation.get(conv_id)
        source_conversations.append(
            {
                "conversation_id": conv_id,
                "file_name": node["file_name"] if node is not None else None,
                "title": node["title"] if node is not None else "",
                "node_dir": conversation["node_dir"],
                "node_files": list(conversation["files"]),
            }
        )

    target = {
        "scope": compile_target.get("scope"),
        "conversation_id": compile_target.get("target_conversation_id"),
        "message_id": compile_target.get("target_message_id"),
        "kind": compile_target.get("target_kind"),
        "checkpoint_index": compile_target.get("target_checkpoint_index"),
        "checkpoint_role": compile_target.get("target_checkpoint_role"),
        "export_dir": compile_target.get("export_dir"),
    }
    lineage = {
        "conversation_ids": list(compile_target.get("lineage_conversation_ids", [])),
        "edge_ids": list(compile_target.get("lineage_edge_ids", [])),
        "paths": list(compile_target.get("lineage_paths", [])),
        "root_conversation_ids": list(compile_target.get("root_conversation_ids", [])),
        "merge_parent_conversation_ids": list(compile_target.get("merge_parent_conversation_ids", [])),
        "unresolved_parent_edge_ids": list(compile_target.get("unresolved_parent_edge_ids", [])),
        "is_complete": bool(compile_target.get("is_lineage_complete", False)),
    }
    return {
        "schema": "contextbuilder.compile_provenance.v1",
        "target": target,
        "lineage": lineage,
        "source_conversations": source_conversations,
    }


def render_compile_provenance_markdown(provenance: dict[str, Any]) -> str:
    """Render compile-target provenance as deterministic markdown included in root.hc."""
    target = provenance.get("target", {})
    source_conversations = provenance.get("source_conversations", [])
    lineage = provenance.get("lineage", {})
    lineage_ids = lineage.get("conversation_ids", [])
    if isinstance(lineage_ids, list) and lineage_ids:
        lineage_text = " -> ".join(str(item) for item in lineage_ids)
    else:
        lineage_text = "(none)"

    message_id = target.get("message_id")
    if isinstance(message_id, str) and message_id:
        message_value = message_id
    else:
        message_value = "(none)"

    parts: list[str] = [
        "<!-- contextbuilder_provenance schema=contextbuilder.compile_provenance.v1 -->",
        "",
        "# ContextBuilder Compile Provenance",
        "",
        f"- Scope: {target.get('scope', 'unknown')}",
        f"- Target conversation_id: {target.get('conversation_id', '')}",
        f"- Target message_id: {message_value}",
        f"- Target kind: {target.get('kind', '')}",
        f"- Lineage complete: {'yes' if lineage.get('is_complete') else 'no'}",
        f"- Lineage conversations: {lineage_text}",
        "",
        "## Source Conversations",
    ]
    for item in source_conversations:
        conversation_id = item.get("conversation_id", "")
        file_name = item.get("file_name", "")
        node_files = item.get("node_files", [])
        node_count = len(node_files) if isinstance(node_files, list) else 0
        parts.append(f"- `{conversation_id}` from `{file_name}` ({node_count} node files)")
    if not source_conversations:
        parts.append("- (none)")
    parts.append("")
    return "\n".join(parts)


def _resolve_export_dir(dialog_dir: Path, export_dir_value: Any) -> tuple[Path | None, dict[str, Any] | None]:
    export_root = (dialog_dir / "export").resolve()
    export_dir = Path(str(export_dir_value)).expanduser()
    if not export_dir.is_absolute():
        export_dir = dialog_dir / export_dir
    resolved = export_dir.resolve()

    try:
        resolved.relative_to(export_root)
    except ValueError:
        return None, {
            "error": "Export directory resolves outside dialog export root",
            "export_dir": str(export_dir),
            "resolved_export_dir": str(resolved),
            "export_root": str(export_root),
        }

    if resolved == export_root:
        return None, {
            "error": "Export directory must be a child of dialog export root",
            "export_dir": str(export_dir),
            "resolved_export_dir": str(resolved),
            "export_root": str(export_root),
        }

    return resolved, None


def export_graph_nodes(
    dialog_dir: Path,
    conversation_id: str,
    message_id: str | None = None,
    *,
    collect_workspace_listing: Callable[[Path], dict[str, Any]],
    build_graph_indexes: Callable[[GraphSnapshot], tuple[GraphNodeIndex, GraphEdgeIndex, BlockedConversationIndex]],
    build_compile_target: Callable[..., schema.CompileTargetPayload],
    export_sentinel: str,
) -> tuple[int, dict[str, Any]]:
    """Export lineage nodes for the given compile target as deterministic Markdown files."""
    if not conversation_id:
        return HTTPStatus.BAD_REQUEST, {"error": "conversation_id is required"}

    workspace = collect_workspace_listing(dialog_dir)
    graph = workspace["graph"]
    nodes_by_conversation, _, _ = build_graph_indexes(graph)

    node = nodes_by_conversation.get(conversation_id)
    if node is None:
        return HTTPStatus.NOT_FOUND, {"error": "Conversation not found", "conversation_id": conversation_id}

    checkpoint: GraphCheckpoint | None = None
    if message_id is not None:
        checkpoint = next((cp for cp in node["checkpoints"] if cp["message_id"] == message_id), None)
        if checkpoint is None:
            return HTTPStatus.NOT_FOUND, {
                "error": "Checkpoint not found",
                "conversation_id": conversation_id,
                "message_id": message_id,
            }

    scope = "checkpoint" if message_id is not None else "conversation"
    compile_target = build_compile_target(
        graph,
        conversation_id,
        scope=scope,
        dialog_dir=dialog_dir,
        target_message_id=message_id,
        checkpoint=checkpoint,
    )

    export_dir, export_dir_error = _resolve_export_dir(dialog_dir, compile_target["export_dir"])
    if export_dir_error is not None or export_dir is None:
        return HTTPStatus.BAD_REQUEST, export_dir_error or {"error": "Invalid export directory"}
    nodes_dir = export_dir / "nodes"

    # Clean export dir to guarantee determinism on re-export.
    # Before deleting, verify the sentinel file is present so we never
    # accidentally rmtree a directory that was not created by this pipeline.
    if export_dir.exists():
        sentinel = export_dir / export_sentinel
        if not sentinel.exists():
            return HTTPStatus.INTERNAL_SERVER_ERROR, {
                "error": "Export directory missing safety sentinel — aborting",
                "details": (
                    f"Directory '{export_dir}' exists but does not contain"
                    f" '{export_sentinel}'. It was not created by ContextBuilder"
                    " and will not be deleted. Remove it manually or ensure it"
                    f" contains '{export_sentinel}'."
                ),
                "export_dir": str(export_dir),
            }
        shutil.rmtree(export_dir)
    nodes_dir.mkdir(parents=True)
    # Write sentinel so future re-exports can verify ownership.
    (export_dir / export_sentinel).write_text(
        "ContextBuilder export directory — do not remove this file.\n",
        encoding="utf-8",
    )

    target_conv_id = compile_target["target_conversation_id"]
    target_checkpoint_index: int | None = compile_target.get("target_checkpoint_index")

    conversations_written: list[dict[str, Any]] = []
    total_node_count = 0

    for conv_id in compile_target["lineage_conversation_ids"]:
        conv_node = nodes_by_conversation.get(conv_id)
        if conv_node is None:
            continue

        checkpoints: list[GraphCheckpoint] = conv_node["checkpoints"]
        if scope == "checkpoint" and conv_id == target_conv_id and target_checkpoint_index is not None:
            checkpoints = checkpoints[: target_checkpoint_index + 1]

        conv_dir = nodes_dir / conv_id
        conv_dir.mkdir()

        files_written: list[str] = []
        for cp in checkpoints:
            filename = f"{cp['index']:04d}_{cp['message_id']}.md"
            (conv_dir / filename).write_text(_render_node_markdown(conv_id, cp), encoding="utf-8")
            files_written.append(filename)
            total_node_count += 1

        conversations_written.append({
            "conversation_id": conv_id,
            "node_dir": f"nodes/{conv_id}/",
            "files": files_written,
        })

    titles_by_conv = {
        conv_id: nodes_by_conversation[conv_id].get("title", "") or conv_id
        for conv_id in compile_target["lineage_conversation_ids"]
        if conv_id in nodes_by_conversation
    }
    provenance = build_compile_provenance(
        compile_target=compile_target,
        conversations_written=conversations_written,
        nodes_by_conversation=nodes_by_conversation,
    )
    provenance_json_file = export_dir / "provenance.json"
    provenance_json_file.write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    provenance_md_file = export_dir / "provenance.md"
    provenance_md_file.write_text(render_compile_provenance_markdown(provenance), encoding="utf-8")

    hc_content = generate_hc_root(
        conversations_written,
        titles_by_conv,
        provenance_file="provenance.md",
    )
    hc_file = export_dir / "root.hc"
    hc_file.write_text(hc_content, encoding="utf-8")

    return HTTPStatus.OK, {
        "export_dir": str(export_dir),
        "hc_file": str(hc_file),
        "provenance_json": str(provenance_json_file),
        "provenance_md": str(provenance_md_file),
        "node_count": total_node_count,
        "conversations": conversations_written,
        "compile_target": compile_target,
    }
