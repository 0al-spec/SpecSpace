#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

cp compose.specspace.yml docker-compose.yml
echo "Synced docker-compose.yml from compose.specspace.yml"
