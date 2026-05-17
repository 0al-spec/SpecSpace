from __future__ import annotations

import json
from pathlib import Path
from typing import Any


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "agent_workbench"
ALLOWED_CONTEXT_KINDS = {
    "spec_node",
    "spec_edge",
    "gap",
    "proposal",
    "metric",
    "specpm_package",
    "external_link",
}
ALLOWED_OUTPUT_KINDS = {
    "analysis",
    "proposal_draft",
    "implementation_handoff",
    "metric_note",
}
ALLOWED_ROLES = {"operator", "agent", "system", "tool"}


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_agent_workbench_conversation_fixture_pins_contract_boundary() -> None:
    fixture = _load_fixture("conversation-v1.json")

    assert fixture["api_version"] == "v1"
    assert fixture["artifact_kind"] == "specspace_agent_conversation"
    assert fixture["schema_version"] == 1
    assert fixture["storage"]["owner"] == "specspace"
    assert fixture["storage"]["mutation_authority"] == "specspace_workbench_only"
    assert "messages" not in fixture
    assert "lineage" not in fixture


def test_agent_workbench_context_covers_graph_and_registry_refs() -> None:
    fixture = _load_fixture("conversation-v1.json")
    context_sets = fixture["context_sets"]
    assert len(context_sets) == 1

    kinds = {item["kind"] for item in context_sets[0]["items"]}
    assert kinds <= ALLOWED_CONTEXT_KINDS
    assert {
        "spec_node",
        "spec_edge",
        "gap",
        "proposal",
        "metric",
        "specpm_package",
    } <= kinds


def test_agent_workbench_outputs_trace_to_existing_turn_and_context() -> None:
    fixture = _load_fixture("conversation-v1.json")
    turn_ids = {turn["turn_id"] for turn in fixture["turns"]}
    context_set_ids = {context["context_set_id"] for context in fixture["context_sets"]}

    for turn in fixture["turns"]:
        assert turn["role"] in ALLOWED_ROLES
        assert set(turn.get("context_set_ids", [])) <= context_set_ids

    for output in fixture["outputs"]:
        assert output["kind"] in ALLOWED_OUTPUT_KINDS
        assert output["origin_turn_id"] in turn_ids
        assert set(output.get("context_set_ids", [])) <= context_set_ids

    proposal_outputs = [output for output in fixture["outputs"] if output["kind"] == "proposal_draft"]
    assert proposal_outputs
    assert proposal_outputs[0]["proposal"]["status"] == "draft"
    assert proposal_outputs[0]["proposal"]["target_spec_ids"] == ["SG-SPEC-0021"]


def test_agent_workbench_index_matches_conversation_summary() -> None:
    conversation = _load_fixture("conversation-v1.json")
    index = _load_fixture("index-v1.json")

    assert index["api_version"] == "v1"
    assert index["artifact_kind"] == "specspace_agent_conversation_index"
    assert index["entry_count"] == len(index["entries"])
    entry = index["entries"][0]
    context_item_count = sum(len(context["items"]) for context in conversation["context_sets"])
    proposal_output_count = sum(1 for output in conversation["outputs"] if output["kind"] == "proposal_draft")

    assert entry["conversation_id"] == conversation["conversation_id"]
    assert entry["turn_count"] == len(conversation["turns"])
    assert entry["context_item_count"] == context_item_count
    assert entry["output_count"] == len(conversation["outputs"])
    assert entry["proposal_output_count"] == proposal_output_count
