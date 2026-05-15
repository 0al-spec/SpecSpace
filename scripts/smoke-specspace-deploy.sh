#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${SPECSPACE_COMPOSE_FILE:-compose.specspace.yml}"
SMOKE_MODE="${SPECSPACE_SMOKE_MODE:-probe}"
API_PORT="${SPECSPACE_API_PORT:-8001}"
UI_PORT="${SPECSPACE_UI_PORT:-5173}"
API_BASE_URL="${SPECSPACE_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
UI_BASE_URL="${SPECSPACE_UI_BASE_URL:-http://127.0.0.1:${UI_PORT}}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

require_compose_env() {
  : "${SPECSPACE_SPECGRAPH_DIR:?Set SPECSPACE_SPECGRAPH_DIR to the SpecGraph repository root}"
  : "${SPECSPACE_SPEC_NODES_DIR:?Set SPECSPACE_SPEC_NODES_DIR to the SpecGraph specs/nodes directory}"
  : "${SPECSPACE_RUNS_DIR:?Set SPECSPACE_RUNS_DIR to the SpecGraph runs directory}"
  : "${SPECSPACE_DIALOG_DIR:?Set SPECSPACE_DIALOG_DIR to an existing dialog directory}"
}

check_compose_readonly_boundary() {
  require_compose_env
  local config_json
  config_json="$(compose config --format json)"
  CONFIG_JSON="$config_json" python - <<'PY'
import json
import os

config = json.loads(os.environ["CONFIG_JSON"])
services = config.get("services", {})
api = services.get("specspace-api") or {}
ui = services.get("specspace-ui") or {}
errors: list[str] = []

if api.get("read_only") is not True:
    errors.append("specspace-api must have read_only: true")
if ui.get("read_only") is not True:
    errors.append("specspace-ui must have read_only: true")

volumes = {
    volume.get("target"): volume
    for volume in api.get("volumes", [])
    if isinstance(volume, dict)
}
for target in (
    "/mnt/specgraph/specs/nodes",
    "/mnt/specgraph/runs",
    "/mnt/specgraph-root",
):
    volume = volumes.get(target)
    if volume is None:
        errors.append(f"missing readonly bind mount for {target}")
    elif volume.get("read_only") is not True:
        errors.append(f"{target} mount must be read_only")

if errors:
    raise SystemExit("\n".join(errors))
print("compose readonly boundary: ok")
PY
}

run_http_smoke() {
  python - "$API_BASE_URL" "$UI_BASE_URL" <<'PY'
import json
import sys
import time
import urllib.error
import urllib.request

api_base = sys.argv[1].rstrip("/")
ui_base = sys.argv[2].rstrip("/")


def read(url: str, *, expect_json: bool) -> tuple[int, str | dict]:
    with urllib.request.urlopen(url, timeout=5) as response:
        body = response.read().decode("utf-8", errors="replace")
        if expect_json:
            return response.status, json.loads(body)
        return response.status, body


def wait_read(url: str, *, expect_json: bool) -> tuple[int, str | dict]:
    deadline = time.time() + 60
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            return read(url, expect_json=expect_json)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(2)
    raise SystemExit(f"timed out waiting for {url}: {last_error}")


status, health = wait_read(f"{api_base}/api/v1/health", expect_json=True)
assert status == 200, status
assert isinstance(health, dict), health
assert health.get("api_version") == "v1", health
assert health.get("provider") == "file", health
assert health.get("read_only") is True, health
sources = health.get("sources") or {}
assert sources.get("spec_nodes", {}).get("status") in {"ok", "empty"}, sources
assert sources.get("runs", {}).get("status") in {"ok", "empty"}, sources

status, graph = wait_read(f"{api_base}/api/v1/spec-graph", expect_json=True)
assert status == 200, status
assert isinstance(graph, dict), graph
assert graph.get("api_version") == "v1", graph
assert isinstance((graph.get("summary") or {}).get("node_count"), int), graph

status, runs = wait_read(f"{api_base}/api/v1/runs/recent?limit=1", expect_json=True)
assert status == 200, status
assert isinstance(runs, dict), runs
assert runs.get("api_version") == "v1", runs
assert isinstance(runs.get("events"), list), runs

status, html = wait_read(ui_base, expect_json=False)
assert status == 200, status
assert isinstance(html, str) and "<html" in html.lower(), html[:120]

status, proxied_health = wait_read(f"{ui_base}/api/v1/health", expect_json=True)
assert status == 200, status
assert isinstance(proxied_health, dict), proxied_health
assert proxied_health.get("api_version") == "v1", proxied_health

status, proxied_runs = wait_read(f"{ui_base}/api/v1/runs/recent?limit=1", expect_json=True)
assert status == 200, status
assert isinstance(proxied_runs, dict), proxied_runs
assert proxied_runs.get("api_version") == "v1", proxied_runs
assert isinstance(proxied_runs.get("events"), list), proxied_runs

print("http smoke: ok")
PY
}

case "$SMOKE_MODE" in
  probe)
    check_compose_readonly_boundary
    run_http_smoke
    ;;
  compose)
    require_compose_env
    check_compose_readonly_boundary
    compose up --build -d
    trap 'compose down --remove-orphans' EXIT
    run_http_smoke
    ;;
  *)
    echo "Unknown SPECSPACE_SMOKE_MODE: $SMOKE_MODE" >&2
    echo "Expected: probe or compose" >&2
    exit 2
    ;;
esac
