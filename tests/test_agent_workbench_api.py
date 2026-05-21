from __future__ import annotations

import json
import shutil
from pathlib import Path
from types import SimpleNamespace

from viewer import agent_workbench

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "agent_workbench"


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _server(path: Path | None) -> SimpleNamespace:
    return SimpleNamespace(agent_workbench_dir=path)


def test_agent_workbench_index_requires_configured_store() -> None:
    status, payload = agent_workbench.read_agent_conversation_index(_server(None))

    assert status == 503
    assert payload["reason"] == "agent_workbench_store_unavailable"
    assert payload["source"]["status"] == "not_configured"


def test_agent_workbench_empty_store_returns_empty_index(tmp_path: Path) -> None:
    workbench = tmp_path / "workbench"
    workbench.mkdir()

    status, payload = agent_workbench.read_agent_conversation_index(_server(workbench))

    assert status == 200
    assert payload["source"]["status"] == "empty"
    assert payload["data"]["artifact_kind"] == "specspace_agent_conversation_index"
    assert payload["data"]["entry_count"] == 0
    assert payload["data"]["entries"] == []


def test_agent_workbench_missing_configured_root_is_unavailable(tmp_path: Path) -> None:
    status, payload = agent_workbench.read_agent_conversation_index(_server(tmp_path / "missing-workbench"))

    assert status == 503
    assert payload["source"]["status"] == "missing"


def test_agent_workbench_reads_index_and_conversation_artifact(tmp_path: Path) -> None:
    workbench = tmp_path / "workbench"
    conversation_dir = workbench / "conversations"
    conversation_dir.mkdir(parents=True)
    shutil.copyfile(FIXTURE_DIR / "index-v1.json", conversation_dir / "index.json")
    shutil.copyfile(FIXTURE_DIR / "conversation-v1.json", conversation_dir / "awb-conv-0001.json")

    index_status, index_payload = agent_workbench.read_agent_conversation_index(_server(workbench))
    conversation_status, conversation_payload = agent_workbench.read_agent_conversation(
        _server(workbench),
        "awb-conv-0001",
    )

    assert index_status == 200
    assert index_payload["source"]["status"] == "ok"
    assert index_payload["data"]["entry_count"] == 1
    assert conversation_status == 200
    assert conversation_payload["conversation_id"] == "awb-conv-0001"
    assert conversation_payload["data"]["artifact_kind"] == "specspace_agent_conversation"


def test_agent_workbench_rejects_path_like_conversation_id(tmp_path: Path) -> None:
    status, payload = agent_workbench.read_agent_conversation(_server(tmp_path / "workbench"), "../secret")

    assert status == 400
    assert "path separators" in payload["error"]


def test_agent_workbench_rejects_mismatched_conversation_artifact(tmp_path: Path) -> None:
    workbench = tmp_path / "workbench"
    conversation = json.loads((FIXTURE_DIR / "conversation-v1.json").read_text(encoding="utf-8"))
    conversation["conversation_id"] = "other-conversation"
    _write_json(workbench / "conversations" / "awb-conv-0001.json", conversation)

    status, payload = agent_workbench.read_agent_conversation(_server(workbench), "awb-conv-0001")

    assert status == 422
    assert payload["reason"] == "conversation_id_mismatch"
