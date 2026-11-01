"""Read-only publication boundary for optional compiler diagrams."""
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import patch
from http import HTTPStatus
from pathlib import Path

from viewer.specspace_provider import FileSpecGraphProvider, ProductWorkspaceFileProvider, decode_artifact_content, provider_from_server


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
    product = ProductWorkspaceFileProvider(delegate=delegate, workspace_id="team-decision-log", artifact_run_dir_ref="runs/team-decision-log", workspace_runs_verified=True)
    status, catalog = product.read_artifact_catalog()
    assert status == HTTPStatus.OK
    assert catalog["source"]["workspace_id"] == "team-decision-log"
    assert {item["path"] for item in catalog["artifacts"]} == {"runs/team-decision-log/ontology.graph.json"}
    status, content = product.read_artifact_content("runs/team-decision-log/ontology.graph.json")
    assert status == HTTPStatus.OK and content["data"]["id"] == "selected"
    assert content["source"]["workspace_id"] == "team-decision-log"
    assert product.read_artifact_content("runs/foreign/ontology.graph.json")[0] == HTTPStatus.NOT_FOUND
    assert delegate.read_artifact_content("runs/private.json")[0] == HTTPStatus.NOT_FOUND


def test_unbound_product_cannot_claim_global_diagram(tmp_path: Path):
    (tmp_path / "ontology.graph.json").write_text('{"id":"bootstrap"}')
    server = SimpleNamespace(runs_dir=tmp_path, spec_dir=None, specgraph_dir=None, repo_root=tmp_path)
    for workspace in ("foreign-product", "team-decision-log"):
        product = provider_from_server(server, workspace)
        status, catalog = product.read_artifact_catalog()
        assert status == HTTPStatus.OK
        assert not any(item["path"].endswith("ontology.graph.json") for item in catalog["artifacts"])
        assert product.read_artifact_content("runs/ontology.graph.json")[0] == HTTPStatus.NOT_FOUND
    bootstrap = provider_from_server(server, "specgraph-bootstrap")
    assert bootstrap.read_artifact_content("runs/ontology.graph.json")[0] == HTTPStatus.OK


def test_ready_binding_must_resolve_actual_run_root(tmp_path: Path):
    global_runs = tmp_path / "global"
    selected = global_runs / "foreign-product"
    for directory, identity in ((global_runs, "bootstrap"), (selected, "selected")):
        directory.mkdir()
        (directory / "ontology.graph.json").write_text(json.dumps({"id": identity}))
    server = SimpleNamespace(runs_dir=global_runs, spec_dir=None, specgraph_dir=None, repo_root=tmp_path)
    for bound_root in (None, global_runs, selected):
        with patch("viewer.product_workspace_binding.discover_binding", return_value={"status": "ready", "trusted": True}), patch("viewer.product_workspace_binding.workspace_runs_dir", return_value=bound_root):
            product = provider_from_server(server, "foreign-product")
            if bound_root != selected:
                assert product.read_artifact_catalog()[1]["artifacts"] == []
                assert product.read_artifact_content("runs/ontology.graph.json")[0] == HTTPStatus.NOT_FOUND
            else:
                status, content = product.read_artifact_content("runs/foreign-product/ontology.graph.json")
                assert status == HTTPStatus.OK
                assert content["data"]["id"] == "selected"
                assert content["source"]["workspace_id"] == "foreign-product"
