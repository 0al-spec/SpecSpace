#!/usr/bin/env bash
set -euo pipefail

FIXTURE_ROOT="${1:-${SPECSPACE_SMOKE_FIXTURE_ROOT:-}}"
if [[ -z "$FIXTURE_ROOT" ]]; then
  FIXTURE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/specspace-smoke.XXXXXX")"
fi

SPEC_NODES_DIR="$FIXTURE_ROOT/specs/nodes"
RUNS_DIR="$FIXTURE_ROOT/runs"

mkdir -p "$SPEC_NODES_DIR" "$RUNS_DIR"

cat > "$SPEC_NODES_DIR/SG-SPEC-0001.yaml" <<'YAML'
id: SG-SPEC-0001
title: SpecSpace CI Smoke Fixture
kind: spec
status: linked
maturity: 1.0
acceptance:
  - Docker smoke reads SpecGraph fixture
acceptance_evidence:
  - criterion: Docker smoke reads SpecGraph fixture
    evidence: CI smoke reads this fixture through /api/v1/spec-graph.
inputs:
  - specs/nodes/SG-SPEC-0001.yaml
specification:
  decisions: []
depends_on: []
refines: []
relates_to: []
YAML

cat > "$RUNS_DIR/20260515T120000Z-SG-SPEC-0001-abcdef1.json" <<'JSON'
{
  "title": "SpecSpace CI Smoke Fixture",
  "run_kind": "deployment_smoke",
  "completion_status": "ok",
  "run_duration_sec": 1.0,
  "execution_profile": "ci",
  "child_model": ""
}
JSON

echo "SPECSPACE_SMOKE_FIXTURE_ROOT=$FIXTURE_ROOT"
echo "SPECSPACE_SPEC_NODES_DIR=$SPEC_NODES_DIR"
echo "SPECSPACE_RUNS_DIR=$RUNS_DIR"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "SPECSPACE_SMOKE_FIXTURE_ROOT=$FIXTURE_ROOT"
    echo "SPECSPACE_SPEC_NODES_DIR=$SPEC_NODES_DIR"
    echo "SPECSPACE_RUNS_DIR=$RUNS_DIR"
  } >> "$GITHUB_ENV"
fi
