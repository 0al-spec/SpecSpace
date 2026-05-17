#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
target_file="${TIMEWEB_TARGET_COMPOSE:-docker-compose.yml}"
remote="${TIMEWEB_DEPLOY_REMOTE:-}"
artifact_base_url="${TIMEWEB_REQUIRED_ARTIFACT_BASE_URL:-https://specgraph.tech}"
specpm_registry_url="${TIMEWEB_REQUIRED_SPECPM_REGISTRY_URL:-https://specpm.dev}"
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

COMPOSE_TEXT="$compose_text" python3 - "$deploy_ref" "$target_file" "$artifact_base_url" "$specpm_registry_url" <<'PY'
from __future__ import annotations

import os
import re
import sys


deploy_ref = sys.argv[1]
target_file = sys.argv[2]
artifact_base_url = sys.argv[3]
specpm_registry_url = sys.argv[4]
lines = os.environ["COMPOSE_TEXT"].splitlines()


def service_blocks() -> dict[str, list[str]]:
    in_services = False
    current: str | None = None
    blocks: dict[str, list[str]] = {}

    for line in lines:
        if line == "services:":
            in_services = True
            continue
        if not in_services:
            continue
        if line and not line.startswith(" "):
            break
        match = re.match(r"^  ([A-Za-z0-9_.-]+):\s*$", line)
        if match:
            current = match.group(1)
            blocks[current] = []
            continue
        if current is not None:
            blocks[current].append(line)

    return blocks


def command_for(service_name: str) -> list[str]:
    values: list[str] = []
    in_command = False

    for line in service_blocks().get(service_name, []):
        if re.match(r"^    command:\s*$", line):
            in_command = True
            continue
        if in_command:
            match = re.match(r"^      -\s*(.*?)\s*$", line)
            if match:
                values.append(match.group(1).strip().strip('"').strip("'"))
                continue
            if line.strip() and not line.startswith("      "):
                break

    return values


def command_value_after(command: list[str], flag: str) -> str | None:
    try:
        index = command.index(flag)
    except ValueError:
        return None
    if index + 1 >= len(command):
        return None
    return command[index + 1]


api_command = command_for("specspace-api")
if not api_command:
    raise SystemExit(f"{deploy_ref}:{target_file} specspace-api must declare a command list.")

actual_artifact_base_url = command_value_after(api_command, "--artifact-base-url")
if actual_artifact_base_url is None:
    raise SystemExit(
        f"{deploy_ref}:{target_file} must configure --artifact-base-url on specspace-api."
    )
if actual_artifact_base_url != artifact_base_url:
    raise SystemExit(
        f"{deploy_ref}:{target_file} specspace-api command must point at "
        f"artifact base URL {artifact_base_url}, got {actual_artifact_base_url}."
    )

if specpm_registry_url and specpm_registry_url != "0":
    actual_specpm_registry_url = command_value_after(
        api_command,
        "--specpm-registry-url",
    )
    if actual_specpm_registry_url is None:
        raise SystemExit(
            f"{deploy_ref}:{target_file} must configure --specpm-registry-url "
            "on specspace-api."
        )
    if actual_specpm_registry_url != specpm_registry_url:
        raise SystemExit(
            f"{deploy_ref}:{target_file} specspace-api command must point at "
            f"SpecPM registry URL {specpm_registry_url}, got "
            f"{actual_specpm_registry_url}."
        )
PY

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
    TIMEWEB_REQUIRED_SPECPM_REGISTRY_URL="$specpm_registry_url" \
    scripts/check-timeweb-deploy-tree.sh "$tmp_dir"
  if [[ "$specpm_registry_url" == "0" ]]; then
    echo "Timeweb deploy branch OK: $deploy_ref is manifest-only and uses HTTP artifacts from $artifact_base_url. SpecPM registry URL check skipped."
  else
    echo "Timeweb deploy branch OK: $deploy_ref is manifest-only and uses HTTP artifacts from $artifact_base_url plus SpecPM registry metadata from $specpm_registry_url."
  fi
else
  if [[ "$specpm_registry_url" == "0" ]]; then
    echo "Timeweb deploy branch OK: $deploy_ref:$target_file is no-volume and uses HTTP artifacts from $artifact_base_url. SpecPM registry URL check skipped."
  else
    echo "Timeweb deploy branch OK: $deploy_ref:$target_file is no-volume and uses HTTP artifacts from $artifact_base_url plus SpecPM registry metadata from $specpm_registry_url."
  fi
fi
