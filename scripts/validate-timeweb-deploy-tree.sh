#!/usr/bin/env bash
set -euo pipefail

deploy_root="${1:-.}"

scripts/check-timeweb-deploy-tree.sh "$deploy_root"
docker compose -f "$deploy_root/docker-compose.yml" config >/dev/null

echo "Timeweb deploy tree compose config OK: $deploy_root"
