#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

source_file="compose.specspace.yml"
timeweb_file="docker-compose.yml"

if [[ ! -f "$source_file" ]]; then
  echo "Missing source compose file: $source_file" >&2
  exit 1
fi

if [[ ! -f "$timeweb_file" ]]; then
  echo "Missing Timeweb compose file: $timeweb_file" >&2
  echo "Run: scripts/sync-timeweb-compose.sh" >&2
  exit 1
fi

source_hash="$(shasum -a 256 "$source_file" | awk '{print $1}')"
timeweb_hash="$(shasum -a 256 "$timeweb_file" | awk '{print $1}')"

if [[ "$source_hash" != "$timeweb_hash" ]]; then
  cat >&2 <<EOF
Timeweb compose drift detected.

$source_file sha256: $source_hash
$timeweb_file sha256: $timeweb_hash

Keep both files byte-for-byte identical so Timeweb sees the same Compose stack
as local/operator deployments. To resync:

  scripts/sync-timeweb-compose.sh

EOF
  exit 1
fi

echo "Timeweb compose sync OK: $timeweb_file matches $source_file ($source_hash)"
