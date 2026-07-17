"""SpecSpace-owned acknowledgement state for Ontology owner decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_state_backend

ACKNOWLEDGEMENT_ARTIFACT_KIND = "specspace_ontology_owner_decision_acknowledgement_state"
ACKNOWLEDGEMENT_SCHEMA_VERSION = 1
ACKNOWLEDGEMENT_FILENAME = "ontology_owner_decision_acknowledgements.json"
ONTOLOGY_WORKBENCH_WORKSPACE_ID = "ontology-workbench"
TOP_LEVEL_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "tracked_artifacts_written",
)
CONSUMER_FALSE_FIELDS = (
    "may_execute_prompt_agent",
    "may_write_ontology_package",
    "may_update_ontology_lockfile",
    "may_mutate_canonical_specs",
    "may_apply_preview",
    "may_import_into_specgraph",
    "may_close_semantic_gate",
)
AUTHORITY_FALSE_FIELDS = (
    "acknowledgement_state_is_authority",
    "ontology_package_authority",
    "specgraph_import_authority",
    "semantic_gate_authority",
    "canonical_mutations_allowed",
)
ACKNOWLEDGEMENT_FALSE_FIELDS = (
    "canonical_mutations_allowed",
    "imports_into_specgraph",
    "closes_semantic_gate",
    "mutates_canonical_specs",
    "writes_ontology_package",
    "updates_ontology_lockfile",
)


def state_path(server: Any) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / ACKNOWLEDGEMENT_FILENAME


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def empty_state(path: Path) -> dict[str, Any]:
    return {
        "artifact_kind": ACKNOWLEDGEMENT_ARTIFACT_KIND,
        "schema_version": ACKNOWLEDGEMENT_SCHEMA_VERSION,
        "state_owner": "SpecSpace",
        "state_path": str(path),
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source_artifacts": {},
        "acknowledgements": [],
        "summary": {
            "status": "no_acknowledgements",
            "acknowledgement_count": 0,
            "next_gap": "operator_review_acknowledgements_available",
        },
        "consumer_boundary": {
            "specspace_owned_state": True,
            "for_operator_review_workflow": True,
            "may_execute_prompt_agent": False,
            "may_write_ontology_package": False,
            "may_update_ontology_lockfile": False,
            "may_mutate_canonical_specs": False,
            "may_apply_preview": False,
            "may_import_into_specgraph": False,
            "may_close_semantic_gate": False,
        },
        "authority_boundary": {
            "acknowledgement_state_is_authority": False,
            "ontology_package_authority": False,
            "specgraph_import_authority": False,
            "semantic_gate_authority": False,
            "canonical_mutations_allowed": False,
        },
    }


def normalize_state(raw: Any, path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(raw, dict):
        return None, {"error": f"{ACKNOWLEDGEMENT_FILENAME} must contain a JSON object"}
    if raw.get("artifact_kind") != ACKNOWLEDGEMENT_ARTIFACT_KIND:
        return None, {"error": "Invalid acknowledgement state artifact_kind"}
    if raw.get("schema_version") != ACKNOWLEDGEMENT_SCHEMA_VERSION:
        return None, {"error": "Unsupported acknowledgement state schema_version"}
    if raw.get("state_owner") != "SpecSpace":
        return None, {"error": "Acknowledgement state must be owned by SpecSpace"}

    mutation_field = _first_true(raw, TOP_LEVEL_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Acknowledgement state cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("consumer_boundary"), CONSUMER_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Acknowledgement consumer_boundary cannot claim {mutation_field}"}
    mutation_field = _first_true(raw.get("authority_boundary"), AUTHORITY_FALSE_FIELDS)
    if mutation_field is not None:
        return None, {"error": f"Acknowledgement authority_boundary cannot claim {mutation_field}"}

    state = empty_state(path)
    acknowledgements = []
    for entry in raw.get("acknowledgements", []):
        if not isinstance(entry, dict):
            continue
        mutation_field = _first_true(entry, ACKNOWLEDGEMENT_FALSE_FIELDS)
        if mutation_field is not None:
            return None, {
                "error": f"Acknowledgement record cannot claim {mutation_field}",
            }
        preview_id = _text(entry.get("preview_id"))
        decision_id = _text(entry.get("decision_id"))
        candidate_id = _text(entry.get("candidate_id"))
        if preview_id is None or decision_id is None or candidate_id is None:
            continue
        acknowledgements.append({
            **entry,
            "workspace_id": ONTOLOGY_WORKBENCH_WORKSPACE_ID,
            "preview_id": preview_id,
            "decision_id": decision_id,
            "candidate_id": candidate_id,
        })
    acknowledgements.sort(key=lambda entry: entry["preview_id"])
    state["acknowledgements"] = acknowledgements
    state["source_artifacts"] = raw.get("source_artifacts") if isinstance(raw.get("source_artifacts"), dict) else {}
    state["summary"] = {
        "status": "acknowledgements_recorded" if acknowledgements else "no_acknowledgements",
        "acknowledgement_count": len(acknowledgements),
        "next_gap": "operator_review_acknowledgements_available",
    }
    return state, None


def read_state(server: Any) -> tuple[HTTPStatus, dict[str, Any]]:
    path = state_path(server)
    try:
        state_backend = specspace_state_backend.backend(server)
        raw = specspace_state_backend.read_state(
            server,
            ACKNOWLEDGEMENT_FILENAME,
            workspace_id=(
                ONTOLOGY_WORKBENCH_WORKSPACE_ID
                if state_backend.kind == "external_http"
                else None
            ),
        )
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecSpace state provider is unavailable.",
            "reason": "specspace_state_provider_unavailable",
        }
    if raw is None:
        return HTTPStatus.OK, empty_state(path)
    state, error = normalize_state(raw, path)
    if error is not None:
        error["path"] = str(path)
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    assert state is not None
    return HTTPStatus.OK, state


def acknowledge_owner_decision(
    server: Any,
    payload: dict[str, Any],
    review_payload: dict[str, Any],
) -> tuple[HTTPStatus, dict[str, Any]]:
    preview_id = _text(payload.get("preview_id"))
    if preview_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Missing required request field: preview_id",
            "field": "preview_id",
        }

    review_data = review_payload.get("data")
    if not isinstance(review_data, dict):
        return HTTPStatus.CONFLICT, {
            "error": "Ontology owner decision review artifact is not readable.",
            "reason": "source_review_unavailable",
        }

    previews = [
        item
        for item in review_data.get("decision_import_previews", [])
        if isinstance(item, dict) and item.get("preview_id") == preview_id
    ]
    if not previews:
        return HTTPStatus.NOT_FOUND, {
            "error": f"Owner decision preview '{preview_id}' not found.",
            "preview_id": preview_id,
        }
    preview = previews[0]

    status, state = read_state(server)
    if status != HTTPStatus.OK:
        return status, state

    path = state_path(server)
    acknowledged_by = _text(payload.get("acknowledged_by")) or "local_operator"
    operator_note = _text(payload.get("operator_note"))
    record = {
        "acknowledgement_id": f"specspace-ack::{preview_id}",
        "workspace_id": ONTOLOGY_WORKBENCH_WORKSPACE_ID,
        "preview_id": preview_id,
        "decision_id": preview["decision_id"],
        "candidate_id": preview["candidate_id"],
        "intake_id": preview["intake_id"],
        "decision_state": preview.get("decision_state"),
        "preview_state": preview.get("preview_state"),
        "required_human_action": preview.get("required_human_action"),
        "acknowledged_by": acknowledged_by,
        "acknowledged_at": now_iso(),
        "operator_note": operator_note,
        "source_artifact": review_payload.get("path") or review_data.get("output_artifact"),
        "source_mtime_iso": review_payload.get("mtime_iso"),
        "canonical_mutations_allowed": False,
        "imports_into_specgraph": False,
        "closes_semantic_gate": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "updates_ontology_lockfile": False,
    }

    by_preview = {
        entry["preview_id"]: entry
        for entry in state.get("acknowledgements", [])
        if isinstance(entry, dict) and isinstance(entry.get("preview_id"), str)
    }
    by_preview[preview_id] = record
    state["acknowledgements"] = sorted(by_preview.values(), key=lambda entry: entry["preview_id"])
    state["source_artifacts"] = {
        "ontology_decision_import_preview": review_payload.get("path") or review_data.get("output_artifact"),
    }
    state["summary"] = {
        "status": "acknowledgements_recorded",
        "acknowledgement_count": len(state["acknowledgements"]),
        "next_gap": "operator_review_acknowledgements_available",
    }

    try:
        specspace_state_backend.write_state(
            server,
            ACKNOWLEDGEMENT_FILENAME,
            workspace_id=ONTOLOGY_WORKBENCH_WORKSPACE_ID,
            state=state,
        )
    except specspace_state_backend.StateBackendConflict:
        return HTTPStatus.CONFLICT, {
            "error": "SpecSpace state changed concurrently. Reload and retry.",
            "reason": "specspace_state_revision_conflict",
        }
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "SpecSpace state provider is unavailable.",
            "reason": "specspace_state_provider_unavailable",
        }
    return HTTPStatus.OK, state


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _first_true(value: Any, fields: tuple[str, ...]) -> str | None:
    if not isinstance(value, dict):
        return None
    return next((field for field in fields if value.get(field) is True), None)
