#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
source_file="${TIMEWEB_SOURCE_COMPOSE:-compose.specspace.yml}"
target_file="${TIMEWEB_TARGET_COMPOSE:-docker-compose.yml}"
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

if [[ ! -f "$source_file" ]]; then
  echo "Missing source compose file: $source_file" >&2
  exit 1
fi

current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ "$current_branch" != "$deploy_branch" && -e "$target_file" ]]; then
  cat >&2 <<EOF
$target_file exists on branch '$current_branch'.

The Timeweb compose entrypoint must live only on '$deploy_branch'. Keep
$source_file in the main line and publish $target_file through the deploy branch.
EOF
  exit 1
fi

git fetch --quiet "$remote" "$deploy_branch" || {
  echo "Could not fetch $remote/$deploy_branch." >&2
  echo "Create or update it from the current release before deploying to Timeweb." >&2
  exit 1
}

deploy_ref="$remote/$deploy_branch"
if ! git cat-file -e "$deploy_ref:$target_file" 2>/dev/null; then
  echo "Missing $target_file in $deploy_ref." >&2
  exit 1
fi

source_hash="$(shasum -a 256 "$source_file" | awk '{print $1}')"
target_hash="$(git show "$deploy_ref:$target_file" | shasum -a 256 | awk '{print $1}')"

if [[ "$source_hash" != "$target_hash" ]]; then
  cat >&2 <<EOF
Timeweb deploy branch compose drift detected.

$source_file sha256: $source_hash
$deploy_ref:$target_file sha256: $target_hash

Update $deploy_branch so $target_file is byte-for-byte identical to
$source_file before pushing or deploying.
EOF
  exit 1
fi

echo "Timeweb deploy branch sync OK: $deploy_ref:$target_file matches $source_file ($source_hash)"
