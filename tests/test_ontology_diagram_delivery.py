"""Read-only publication boundary for optional compiler diagrams."""
import hashlib
import json
from http import HTTPStatus
from pathlib import Path

from viewer.specspace_provider import FileSpecGraphProvider, ProductWorkspaceFileProvider, decode_artifact_content


def test_content_digest_binds_actual_utf8_bytes():
    text = '{"meaning": "Смысл"}\n'
    result = decode_artifact_content(path="runs/ontology.graph.json", text=text, source={"read_only": True})
    assert result["sha256"] == hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert result["data"] == json.loads(text)


def test_optional_diagram_is_scoped_and_allowlisted(tmp_path: Path):
    selected = tmp_path / "selected"; foreign = tmp_path / "foreign"
    selected.mkdir(); foreign.mkdir()
    (selected / "ontology.graph.json").write_text('{"id":"selected"}')
    (selected / "private.json").write_text('{"private":true}')
    (foreign / "ontology.graph.json").write_text('{"id":"foreign"}')
    delegate = FileSpecGraphProvider(spec_nodes_dir=None, runs_dir=selected)
    status, catalog = delegate.read_artifact_catalog()
    assert status == HTTPStatus.OK
    assert {item["path"] for item in catalog["artifacts"]} == {"runs/ontology.graph.json"}
    product = ProductWorkspaceFileProvider(delegate=delegate, workspace_id="team-decision-log", artifact_run_dir_ref="runs/team-decision-log")
    status, catalog = product.read_artifact_catalog()
    assert status == HTTPStatus.OK
    assert catalog["source"]["workspace_id"] == "team-decision-log"
    assert {item["path"] for item in catalog["artifacts"]} == {"runs/team-decision-log/ontology.graph.json"}
    status, content = product.read_artifact_content("runs/team-decision-log/ontology.graph.json")
    assert status == HTTPStatus.OK and content["data"]["id"] == "selected"
    assert content["source"]["workspace_id"] == "team-decision-log"
    assert product.read_artifact_content("runs/foreign/ontology.graph.json")[0] == HTTPStatus.NOT_FOUND
    assert delegate.read_artifact_content("runs/private.json")[0] == HTTPStatus.NOT_FOUND
