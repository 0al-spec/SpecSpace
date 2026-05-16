#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage: scripts/render-timeweb-deploy-branch.sh OUTPUT_DIR

Required environment:
  SPECSPACE_API_IMAGE_REF  Digest-pinned API image ref, e.g.
                           ghcr.io/0al-spec/specspace-api@sha256:<digest>
  SPECSPACE_UI_IMAGE_REF   Digest-pinned UI image ref, e.g.
                           ghcr.io/0al-spec/specspace-ui@sha256:<digest>

Optional environment:
  SPECSPACE_ARTIFACT_BASE_URL  Defaults to https://specgraph.tech
  SPECSPACE_RELEASE_COMMIT     Defaults to the current git commit
  SPECSPACE_RELEASE_CREATED_AT Defaults to current UTC timestamp
EOF
}

if [[ -z "$output_dir" ]]; then
  usage
  exit 2
fi

case "$output_dir" in
  / | . | ..)
    echo "Refusing to render Timeweb deploy branch into unsafe output path: $output_dir" >&2
    exit 2
    ;;
esac

api_image_ref="${SPECSPACE_API_IMAGE_REF:-}"
ui_image_ref="${SPECSPACE_UI_IMAGE_REF:-}"
artifact_base_url="${SPECSPACE_ARTIFACT_BASE_URL:-https://specgraph.tech}"
release_commit="${SPECSPACE_RELEASE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
release_created_at="${SPECSPACE_RELEASE_CREATED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

require_digest_ref() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "$name must be set." >&2
    exit 2
  fi

  if [[ "$value" == *":latest"* ]]; then
    echo "$name must not use the mutable latest tag: $value" >&2
    exit 2
  fi

  if [[ ! "$value" =~ @sha256:[0-9a-f]{64}$ ]]; then
    echo "$name must be digest-pinned with @sha256:<64 hex chars>: $value" >&2
    exit 2
  fi
}

require_digest_ref SPECSPACE_API_IMAGE_REF "$api_image_ref"
require_digest_ref SPECSPACE_UI_IMAGE_REF "$ui_image_ref"

mkdir -p "$output_dir"
find "$output_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

cat > "$output_dir/docker-compose.yml" <<EOF
name: specspace

services:
  app:
    image: "$ui_image_ref"
    ports:
      - "\${SPECSPACE_UI_PORT:-5173}:80"
    depends_on:
      - specspace-api

  specspace-api:
    image: "$api_image_ref"
    environment:
      SPECSPACE_API_IMAGE_REF: "$api_image_ref"
      SPECSPACE_UI_IMAGE_REF: "$ui_image_ref"
      SPECSPACE_RELEASE_COMMIT: "$release_commit"
      SPECSPACE_RELEASE_CREATED_AT: "$release_created_at"
    command:
      - python
      - viewer/server.py
      - --host
      - 0.0.0.0
      - --port
      - "8001"
      - --dialog-dir
      - /data/dialogs
      - --artifact-base-url
      - "$artifact_base_url"
    ports:
      - "\${SPECSPACE_API_PORT:-8001}:8001"
EOF

cat > "$output_dir/README.md" <<EOF
# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: \`$release_commit\`
- Generated at: \`$release_created_at\`
- API image: \`$api_image_ref\`
- UI image: \`$ui_image_ref\`
- SpecGraph artifact source: \`$artifact_base_url\`

## Rollback

To roll back, restore \`docker-compose.yml\` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named \`app\` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through \`--artifact-base-url\`.
- This branch should not contain application source files.
EOF

echo "Rendered Timeweb deploy manifest into $output_dir"
