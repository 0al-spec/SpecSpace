from __future__ import annotations

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
