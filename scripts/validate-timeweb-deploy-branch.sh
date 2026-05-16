#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
remote="${TIMEWEB_DEPLOY_REMOTE:-}"

if [[ -z "$remote" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    remote="origin"
  elif git remote get-url specspace >/dev/null 2>&1; then
    remote="specspace"
  else
    echo "No git remote found for Timeweb deploy branch lookup." >&2
    exit 1
  fi
fi

scripts/check-timeweb-deploy-branch.sh

deploy_ref="$remote/$deploy_branch"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/specspace-timeweb.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

git archive "$deploy_ref" | tar -x -C "$tmp_dir"

export SPECSPACE_SPEC_NODES_DIR="$tmp_dir/specgraph/specs/nodes"
export SPECSPACE_RUNS_DIR="$tmp_dir/specgraph/runs"
export SPECSPACE_DIALOG_DIR="$tmp_dir/dialogs"

mkdir -p "$SPECSPACE_SPEC_NODES_DIR" "$SPECSPACE_RUNS_DIR" "$SPECSPACE_DIALOG_DIR"

(
  cd "$tmp_dir"
  docker compose -f docker-compose.yml config >/dev/null
)

echo "Timeweb deploy branch compose config OK: $deploy_ref"
