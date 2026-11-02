"""Publish counts from the complete, successful CI static-analysis report."""

import argparse
import hashlib
import importlib.util
import json
import os
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("stack_badges", ROOT / "quality/badges.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load badge publisher")
badges = importlib.util.module_from_spec(spec)
spec.loader.exec_module(badges)

METRICS = {
    "ruff": "Ruff findings",
    "basedpyright": "Python type findings",
    "eslint": "ESLint findings",
    "bandit": "Bandit findings",
}
TOOLS = {
    "ruff",
    "python-format",
    "basedpyright",
    "bandit",
    "eslint",
    "stylelint",
    "prettier",
    "markdownlint",
    "html-validate",
    "yamllint",
    "shellcheck",
    "shfmt",
    "actionlint",
    "hadolint",
    "gitleaks",
}


def build(report_bytes: bytes, revision: str, run_id: str) -> dict[str, str]:
    if not re.fullmatch(r"[0-9a-f]{40}", revision) or not re.fullmatch(r"[0-9]+", run_id):
        raise ValueError("A full revision and workflow run ID are required")
    report = json.loads(report_bytes)
    if (
        report.get("schema_version") != 1
        or set(report.get("completed", [])) != TOOLS
        or report.get("errors") != []
        or report.get("new_findings") != []
        or not re.fullmatch(r"[0-9a-f]{64}", report.get("profile_digest", ""))
    ):
        raise ValueError("Expected a complete successful static-analysis report")
    counts = Counter(item["tool"] for item in report["findings"])
    if dict(counts) != report["summary"]:
        raise ValueError("Report counts do not match findings")
    values = {tool: counts[tool] for tool in METRICS}
    files = {
        f"{tool}.svg": badges.svg(label, str(values[tool]), revision)
        for tool, label in METRICS.items()
    }
    files["manifest.json"] = (
        json.dumps(
            {
                "artifact_kind": "specspace_static_quality_metrics",
                "schema_version": 1,
                "source_revision": revision,
                "workflow_run_id": run_id,
                "profile_digest": report["profile_digest"],
                "report_sha256": hashlib.sha256(report_bytes).hexdigest(),
                "findings": values,
            },
            indent=2,
        )
        + "\n"
    )
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    files = build(args.report.read_bytes(), args.revision, args.run_id)
    args.output.mkdir(parents=True, exist_ok=False)
    for name, content in files.items():
        (args.output / name).write_text(content, encoding="utf-8")
    if args.publish:
        if os.environ.get("GITHUB_RUN_ID") != args.run_id:
            raise ValueError("Report run ID must match the current workflow run")
        setattr(badges, "BRANCH", "quality-metrics-badges")
        badges.publish(files, args.revision)


if __name__ == "__main__":
    main()
