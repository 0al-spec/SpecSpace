from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from viewer import project_local_ontology_review_decisions


def _server(tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(specspace_state_dir=tmp_path, repo_root=tmp_path)


def _workspace_payload() -> dict:
    return {
        "workspace": {"id": "team-decision-log"},
        "repair_session": {
            "session": {
                "session_id": "repair-session.team-decision-log",
                "candidate_id": "team-decision-log",
            }
        },
        "artifacts": {
            "project_local_ontology_review": {
                "path": "runs/project_local_ontology_review_lane.json"
            }
        },
        "project_local_ontology_review": {
            "available": True,
            "terms": [
                {
                    "id": "project-local-ontology-term.decision-record",
                    "term": "Decision Record",
                    "term_key": "decisionrecord",
                    "status": "unreviewed",
                    "suggested_actions": [
                        "keep_project_local",
                        "bind_existing",
                        "alias",
                        "reject",
                        "request_workspace_promotion",
                        "defer",
                    ],
                }
            ],
        },
    }


def _lane_artifact() -> dict:
    return {
        "artifact_kind": "project_local_ontology_review_lane",
        "context": {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repair-session.team-decision-log",
        },
        "review_decision_schema": {
            "supported_actions": [
                "keep_project_local",
                "bind_existing",
                "alias",
                "reject",
                "request_workspace_promotion",
                "defer",
            ]
        },
        "terms": _workspace_payload()["project_local_ontology_review"]["terms"],
    }


def test_project_local_decision_state_starts_empty(tmp_path: Path) -> None:
    status, payload = project_local_ontology_review_decisions.read_state(
        _server(tmp_path),
        workspace_id="team-decision-log",
    )

    assert status == 200
    assert payload["artifact_kind"] == "specspace_project_local_ontology_review_decision_state"
    assert payload["summary"]["decision_count"] == 0
    assert payload["authority_boundary"]["ontology_authority"] is False


def test_save_project_local_decision_records_operator_intent(tmp_path: Path) -> None:
    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "team-decision-log",
            "term_key": "decisionrecord",
            "action": "keep_project_local",
            "decision_value": {"reason": "Product-specific wording."},
        },
        _workspace_payload(),
        workspace_id="team-decision-log",
    )

    assert status == 200
    assert payload["summary"]["decision_count"] == 1
    decision = payload["decisions"][0]
    assert decision["review_action"] == "keep_project_local"
    assert decision["decision_value"]["term_scope"] == "project_local"
    assert decision["writes_ontology_package"] is False
    assert decision["accepts_ontology_terms"] is False


def test_save_project_local_decision_uses_lane_context_identity(tmp_path: Path) -> None:
    workspace_payload = _workspace_payload()
    workspace_payload["workspace"] = {"id": "household-pantry-rotation"}
    lane = _lane_artifact()
    lane["context"] = {
        "workspace_id": "household-pantry-rotation",
        "candidate_id": "household-pantry-rotation",
        "repair_session_id": "repair-session.household-pantry-rotation",
    }
    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "household-pantry-rotation",
            "term_key": "decisionrecord",
            "action": "keep_project_local",
            "decision_value": {"reason": "Project-local household term."},
        },
        workspace_payload,
        workspace_id="household-pantry-rotation",
        lane_artifact=lane,
    )

    assert status == 200
    decision = payload["decisions"][0]
    assert decision["workspace_id"] == "household-pantry-rotation"
    assert decision["candidate_id"] == "household-pantry-rotation"
    assert decision["repair_session_id"] == "repair-session.household-pantry-rotation"


def test_bind_existing_requires_ontology_ref(tmp_path: Path) -> None:
    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "team-decision-log",
            "term_key": "decisionrecord",
            "action": "bind_existing",
            "decision_value": {},
        },
        _workspace_payload(),
        workspace_id="team-decision-log",
    )

    assert status == 400
    assert payload["error"] == "bind_existing requires decision_value.ontology_ref"


def test_save_project_local_decision_blocks_authority_expansion(tmp_path: Path) -> None:
    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "team-decision-log",
            "term_key": "decisionrecord",
            "action": "keep_project_local",
            "may_write_ontology_package": True,
            "decision_value": {},
        },
        _workspace_payload(),
        workspace_id="team-decision-log",
    )

    assert status == 400
    assert payload["field"] == "may_write_ontology_package"


def test_save_project_local_decision_uses_lane_supported_actions(
    tmp_path: Path,
) -> None:
    lane = _lane_artifact()
    lane["review_decision_schema"]["supported_actions"] = ["keep_project_local"]

    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "team-decision-log",
            "term_key": "decisionrecord",
            "action": "bind_existing",
            "decision_value": {"ontology_ref": "ontology://core/DecisionRecord"},
        },
        _workspace_payload(),
        workspace_id="team-decision-log",
        lane_artifact=lane,
    )

    assert status == 400
    assert payload["allowed_actions"] == ["keep_project_local"]


def test_save_project_local_decision_uses_unbounded_lane_terms(
    tmp_path: Path,
) -> None:
    lane = _lane_artifact()
    lane["terms"] = [
        {
            "id": f"project-local-ontology-term.term-{index}",
            "term": f"Term {index}",
            "term_key": f"term{index}",
            "suggested_actions": ["keep_project_local"],
        }
        for index in range(41)
    ]
    display_payload = _workspace_payload()
    display_payload["project_local_ontology_review"]["terms"] = lane["terms"][:40]

    status, payload = project_local_ontology_review_decisions.save_decision(
        _server(tmp_path),
        {
            "workspace_id": "team-decision-log",
            "term_key": "term40",
            "action": "keep_project_local",
            "decision_value": {"reason": "Keep this workspace-local."},
        },
        display_payload,
        workspace_id="team-decision-log",
        lane_artifact=lane,
    )

    assert status == 200
    assert payload["decisions"][0]["term_key"] == "term40"


def test_read_state_reports_dropped_invalid_decisions(tmp_path: Path) -> None:
    path = tmp_path / "project_local_ontology_review_decisions.json"
    state = project_local_ontology_review_decisions.empty_state(path)
    state["decisions"] = [
        {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "term_key": "decisionrecord",
            "review_action": "keep_project_local",
            "decision_value": {"term": "Decision Record"},
        },
        {
            "workspace_id": "team-decision-log",
            "term_key": "broken",
            "review_action": "keep_project_local",
            "decision_value": {"term": "Broken"},
        },
    ]
    path.write_text(
        json.dumps(state, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    status, payload = project_local_ontology_review_decisions.read_state(
        _server(tmp_path),
        workspace_id="team-decision-log",
    )

    assert status == 200
    assert payload["summary"]["decision_count"] == 1
    assert payload["summary"]["invalid_decision_count"] == 1
    assert payload["summary"]["dropped_decision_count"] == 1
    assert payload["invalid_decisions"][0]["reason"] == "missing_required_fields"
