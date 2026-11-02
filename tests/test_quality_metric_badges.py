"""Quality badges must reflect a complete report, including accepted debt."""

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "metric_badges", ROOT / "scripts/quality_metric_badges.py"
)
assert spec and spec.loader
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)
REVISION = "a" * 40


def report():
    return {
        "schema_version": 1,
        "profile_digest": "b" * 64,
        "completed": sorted(metrics.TOOLS),
        "errors": [],
        "new_findings": [],
        "findings": [{"tool": "ruff"}, {"tool": "ruff"}, {"tool": "eslint"}],
        "summary": {"ruff": 2, "eslint": 1},
    }


def test_counts_and_provenance_are_derived_from_report():
    files = metrics.build(json.dumps(report()).encode(), REVISION, "42")
    manifest = json.loads(files["manifest.json"])
    assert manifest["findings"] == {"ruff": 2, "eslint": 1, "basedpyright": 0, "bandit": 0}
    assert manifest["source_revision"] == REVISION
    assert manifest["workflow_run_id"] == "42"
    assert "Ruff findings: 2" in files["ruff.svg"]
    assert len(manifest["report_sha256"]) == 64


@pytest.mark.parametrize(
    "field,value",
    [
        ("completed", ["ruff"]),
        ("errors", [{"tool": "eslint"}]),
        ("new_findings", [{"tool": "ruff"}]),
        ("summary", {"ruff": 0}),
    ],
)
def test_invalid_or_incomplete_reports_are_rejected(field, value):
    data = report()
    data[field] = value
    with pytest.raises(ValueError):
        metrics.build(json.dumps(data).encode(), REVISION, "42")


def test_invalid_revision_or_run_is_rejected():
    with pytest.raises(ValueError):
        metrics.build(json.dumps(report()).encode(), REVISION, "wrong")
