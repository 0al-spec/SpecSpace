#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${SPECSPACE_DEPLOY_LAB_COMPOSE_FILE:-compose.deploy-lab.yml}"
COMPOSE_PROJECT_NAME="${SPECSPACE_DEPLOY_LAB_PROJECT_NAME:-specspace_deploy_lab}"
API_PORT="${SPECSPACE_API_PORT:-8011}"
UI_PORT="${SPECSPACE_UI_PORT:-5183}"
SPECGRAPH_STATIC_PORT="${SPECGRAPH_STATIC_PORT:-8082}"
SPECPM_REGISTRY_PORT="${SPECPM_REGISTRY_PORT:-8081}"
API_BASE_URL="${SPECSPACE_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
UI_BASE_URL="${SPECSPACE_UI_BASE_URL:-http://127.0.0.1:${UI_PORT}}"
SPECGRAPH_STATIC_URL="${SPECGRAPH_STATIC_URL:-http://127.0.0.1:${SPECGRAPH_STATIC_PORT}}"
SPECPM_REGISTRY_URL="${SPECPM_REGISTRY_URL:-http://127.0.0.1:${SPECPM_REGISTRY_PORT}}"
PYTHON_BIN="${PYTHON:-python3}"

compose() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

require_static_roots() {
  local specgraph_public_dir="${SPECGRAPH_PUBLIC_DIR:-../SpecGraph/dist/specgraph-public}"
  local specpm_public_index_dir="${SPECPM_PUBLIC_INDEX_DIR:-../SpecPM/.specpm/public-index}"

  if [ ! -f "${specgraph_public_dir}/artifact_manifest.json" ]; then
    echo "Missing ${specgraph_public_dir}/artifact_manifest.json" >&2
    echo "Build or publish the local SpecGraph static artifact bundle first." >&2
    exit 2
  fi
  if [ ! -f "${specpm_public_index_dir}/v0/status/index.json" ]; then
    echo "Missing ${specpm_public_index_dir}/v0/status/index.json" >&2
    echo "Generate the local SpecPM public index first, for example:" >&2
    echo "  (cd ../SpecPM && make public-index-generate)" >&2
    exit 2
  fi
}

check_compose_boundary() {
  local config_json
  config_json="$(compose config --format json)"
  CONFIG_JSON="$config_json" "$PYTHON_BIN" - <<'PY'
import json
import os

config = json.loads(os.environ["CONFIG_JSON"])
services = config.get("services", {})
errors: list[str] = []

for service_name in (
    "specgraph-static",
    "specpm-registry",
    "specspace-api",
    "specspace-ui",
):
    service = services.get(service_name) or {}
    if service.get("read_only") is not True:
        errors.append(f"{service_name} must have read_only: true")

api = services.get("specspace-api") or {}
command = " ".join(str(part) for part in api.get("command", []))
if "--artifact-base-url http://specgraph-static:8080" not in command:
    errors.append("specspace-api must read SpecGraph through the static HTTP service")
if "--specpm-registry-url http://specpm-registry:8080" not in command:
    errors.append("specspace-api must read SpecPM through the registry HTTP service")

for service_name, target in (
    ("specgraph-static", "/usr/share/nginx/html"),
    ("specpm-registry", "/usr/share/nginx/html"),
):
    service = services.get(service_name) or {}
    volumes = {
        volume.get("target"): volume
        for volume in service.get("volumes", [])
        if isinstance(volume, dict)
    }
    volume = volumes.get(target)
    if volume is None:
        errors.append(f"{service_name} must mount {target}")
    elif volume.get("read_only") is not True:
        errors.append(f"{service_name}:{target} mount must be read_only")

if errors:
    raise SystemExit("\n".join(errors))
print("deploy lab compose boundary: ok")
PY
}

run_http_smoke() {
  "$PYTHON_BIN" - "$API_BASE_URL" "$UI_BASE_URL" "$SPECGRAPH_STATIC_URL" "$SPECPM_REGISTRY_URL" <<'PY'
import json
import http.client
import sys
import time
import urllib.error
import urllib.request

api_base = sys.argv[1].rstrip("/")
ui_base = sys.argv[2].rstrip("/")
specgraph_static = sys.argv[3].rstrip("/")
specpm_registry = sys.argv[4].rstrip("/")


def read(url: str, *, expect_json: bool) -> tuple[int, str | dict]:
    with urllib.request.urlopen(url, timeout=8) as response:
        body = response.read().decode("utf-8", errors="replace")
        if expect_json:
            return response.status, json.loads(body)
        return response.status, body


def wait_read(url: str, *, expect_json: bool) -> tuple[int, str | dict]:
    deadline = time.time() + 90
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            return read(url, expect_json=expect_json)
        except (
            ConnectionError,
            TimeoutError,
            http.client.HTTPException,
            urllib.error.URLError,
            json.JSONDecodeError,
        ) as exc:
            last_error = exc
            time.sleep(2)
    raise SystemExit(f"timed out waiting for {url}: {last_error}")


status, manifest = wait_read(f"{specgraph_static}/artifact_manifest.json", expect_json=True)
assert status == 200, status
assert isinstance(manifest, dict), manifest

status, registry_status = wait_read(f"{specpm_registry}/v0/status", expect_json=True)
assert status == 200, status
assert isinstance(registry_status, dict), registry_status
assert registry_status.get("apiVersion") == "specpm.registry/v0", registry_status

status, health = wait_read(f"{api_base}/api/v1/health", expect_json=True)
assert status == 200, status
assert isinstance(health, dict), health
assert health.get("api_version") == "v1", health
assert health.get("provider") == "http", health
sources = health.get("sources") or {}
assert sources.get("artifact_manifest", {}).get("status") == "ok", sources
assert sources.get("specpm_registry", {}).get("status") == "configured", sources

status, graph = wait_read(f"{api_base}/api/v1/spec-graph", expect_json=True)
assert status == 200, status
assert isinstance(graph, dict), graph
assert graph.get("api_version") == "v1", graph
assert isinstance((graph.get("summary") or {}).get("node_count"), int), graph

status, registry = wait_read(f"{api_base}/api/v1/specpm/registry", expect_json=True)
assert status == 200, status
assert isinstance(registry, dict), registry
assert registry.get("api_version") == "v1", registry

status, work = wait_read(f"{api_base}/api/v1/implementation-work-index", expect_json=True)
assert status == 200, status
assert isinstance(work, dict), work
assert work.get("data", {}).get("artifact_kind") == "implementation_work_index", work

status, html = wait_read(ui_base, expect_json=False)
assert status == 200, status
assert isinstance(html, str) and "<html" in html.lower(), html[:120]

status, proxied_health = wait_read(f"{ui_base}/api/v1/health", expect_json=True)
assert status == 200, status
assert isinstance(proxied_health, dict), proxied_health
assert proxied_health.get("provider") == "http", proxied_health

print("deploy lab http smoke: ok")
PY
}

case "${SPECSPACE_DEPLOY_LAB_MODE:-compose}" in
  compose)
    require_static_roots
    check_compose_boundary
    trap 'compose down --remove-orphans' EXIT
    compose up --build -d
    run_http_smoke
    ;;
  probe)
    require_static_roots
    check_compose_boundary
    run_http_smoke
    ;;
  *)
    echo "Unknown SPECSPACE_DEPLOY_LAB_MODE: ${SPECSPACE_DEPLOY_LAB_MODE}" >&2
    echo "Expected: compose or probe" >&2
    exit 2
    ;;
esac
