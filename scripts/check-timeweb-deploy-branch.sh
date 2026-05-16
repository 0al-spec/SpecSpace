#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
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

current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ "$current_branch" != "$deploy_branch" && -e "$target_file" ]]; then
  cat >&2 <<EOF
$target_file exists on branch '$current_branch'.

The Timeweb compose entrypoint must live only on '$deploy_branch'. Keep
compose.specspace.yml in the main line and publish $target_file through the
deploy branch.
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

compose_text="$(git show "$deploy_ref:$target_file")"

if grep -Eq '^[[:space:]]*volumes:' <<<"$compose_text"; then
  echo "$deploy_ref:$target_file contains volumes, which Timeweb rejects." >&2
  exit 1
fi

if grep -Eq '\$\{[^}]*\?' <<<"$compose_text"; then
  echo "$deploy_ref:$target_file contains required env interpolation, which breaks zero-config Timeweb boot." >&2
  exit 1
fi

required_paths=(
  "/app/deploy/specspace-demo/specs/nodes"
  "/app/deploy/specspace-demo/runs"
)

for required_path in "${required_paths[@]}"; do
  if ! grep -Fq -- "$required_path" <<<"$compose_text"; then
    echo "$deploy_ref:$target_file does not reference bundled demo path: $required_path" >&2
    exit 1
  fi
done

echo "Timeweb deploy branch OK: $deploy_ref:$target_file is no-volume and uses bundled demo artifacts."
