#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
target_file="${TIMEWEB_TARGET_COMPOSE:-docker-compose.yml}"
remote="${TIMEWEB_DEPLOY_REMOTE:-}"
artifact_base_url="${TIMEWEB_REQUIRED_ARTIFACT_BASE_URL:-https://specgraph.tech}"
require_manifest_only="${TIMEWEB_REQUIRE_MANIFEST_ONLY:-0}"

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
first_service="$(
  awk '
    /^services:[[:space:]]*$/ { in_services = 1; next }
    in_services && /^[^[:space:]]/ { exit }
    in_services && /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ {
      service = $1
      sub(":", "", service)
      print service
      exit
    }
  ' <<<"$compose_text"
)"

if [[ "$first_service" != "app" ]]; then
  cat >&2 <<EOF
$deploy_ref:$target_file must declare the UI service as the first service named
'app'. Timeweb proxies the primary domain to the first compose service.

Detected first service: ${first_service:-<none>}
EOF
  exit 1
fi

if grep -Eq '^[[:space:]]*volumes:' <<<"$compose_text"; then
  echo "$deploy_ref:$target_file contains volumes, which Timeweb rejects." >&2
  exit 1
fi

if grep -Eq '\$\{[^}]*\?' <<<"$compose_text"; then
  echo "$deploy_ref:$target_file contains required env interpolation, which breaks zero-config Timeweb boot." >&2
  exit 1
fi

if ! grep -Fq -- "--artifact-base-url" <<<"$compose_text"; then
  echo "$deploy_ref:$target_file must configure the HTTP artifact provider with --artifact-base-url." >&2
  exit 1
fi

if ! grep -Fq -- "$artifact_base_url" <<<"$compose_text"; then
  echo "$deploy_ref:$target_file must point at the configured artifact base URL: $artifact_base_url" >&2
  exit 1
fi

if grep -Fq -- "/app/deploy/specspace-demo" <<<"$compose_text"; then
  echo "$deploy_ref:$target_file still references bundled demo artifacts." >&2
  exit 1
fi

if [[ "$require_manifest_only" == "1" ]]; then
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/specspace-timeweb-check.XXXXXX")"
  trap 'rm -rf "$tmp_dir"' EXIT
  git archive "$deploy_ref" | tar -x -C "$tmp_dir"
  TIMEWEB_TARGET_COMPOSE="$target_file" \
    TIMEWEB_REQUIRED_ARTIFACT_BASE_URL="$artifact_base_url" \
    scripts/check-timeweb-deploy-tree.sh "$tmp_dir"
  echo "Timeweb deploy branch OK: $deploy_ref is manifest-only and uses HTTP artifacts from $artifact_base_url."
else
  echo "Timeweb deploy branch OK: $deploy_ref:$target_file is no-volume and uses HTTP artifacts from $artifact_base_url."
fi
