#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/specspace-dev.sh <start|stop|restart|status>

Environment:
  API_PORT                  Backend port. Default: 8001
  UI_PORT                   GraphSpace dev server port. Default: 5173
  DIALOG_DIR                Canonical dialog directory. Required for start.
  SPEC_DIR                  Optional SpecGraph specs/nodes directory.
  SPECGRAPH_DIR             Optional SpecGraph repository directory.
  HYPERPROMPT_BINARY        Optional Hyperprompt binary path.
  AGENT                     Enable --agent when truthy. Default: 1
  PYTHON                    Python executable. Default: python3
  SPECSPACE_BACKEND_SCREEN  Backend screen session. Default: specspace_backend
  SPECSPACE_UI_SCREEN       UI screen session. Default: specspace_graphspace
  SPECSPACE_DEV_LOG_DIR     Log directory. Default: .specspace-dev
  SPECSPACE_DEV_NPM_INSTALL Run npm install --prefix graphspace before start when 1.
USAGE
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_port="${API_PORT:-8001}"
ui_port="${UI_PORT:-5173}"
dialog_dir="${DIALOG_DIR:-}"
spec_dir="${SPEC_DIR:-}"
specgraph_dir="${SPECGRAPH_DIR:-}"
hyperprompt_binary="${HYPERPROMPT_BINARY:-}"
agent="${AGENT:-1}"
python_bin="${PYTHON:-python3}"
backend_screen="${SPECSPACE_BACKEND_SCREEN:-specspace_backend}"
ui_screen="${SPECSPACE_UI_SCREEN:-specspace_graphspace}"
log_dir="${SPECSPACE_DEV_LOG_DIR:-$repo_root/.specspace-dev}"

quote_args() {
  local quoted=""
  printf -v quoted "%q " "$@"
  printf "%s" "$quoted"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

resolve_command() {
  local command_name="$1"
  if [[ "$command_name" == */* ]]; then
    printf "%s" "$command_name"
    return 0
  fi
  command -v "$command_name"
}

is_truthy() {
  local value
  value="$(printf "%s" "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

screen_quit() {
  local session="$1"
  screen -S "$session" -X quit >/dev/null 2>&1 || true
}

listeners_for_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  fi
}

kill_port_listeners() {
  local port="$1"
  local pids=""
  pids="$(listeners_for_port "$port")"
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "Stopping listeners on :$port: $pids"
  # shellcheck disable=SC2086
  kill $pids >/dev/null 2>&1 || true
  sleep 1

  pids="$(listeners_for_port "$port")"
  if [ -n "$pids" ]; then
    echo "Force-stopping listeners on :$port: $pids"
    # shellcheck disable=SC2086
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

stop_services() {
  screen_quit "$backend_screen"
  screen_quit "$ui_screen"
  kill_port_listeners "$api_port"
  kill_port_listeners "$ui_port"
  echo "Stopped SpecSpace dev services on ports $api_port and $ui_port."
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts=30
  local delay=0.5

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is ready: $url"
      return 0
    fi
    sleep "$delay"
  done

  echo "$label did not become ready: $url" >&2
  return 1
}

start_services() {
  require_command screen
  require_command curl
  require_command npm
  require_command "$python_bin"
  local npm_bin
  local resolved_python
  npm_bin="$(resolve_command npm)"
  resolved_python="$(resolve_command "$python_bin")"

  if [ -z "$dialog_dir" ]; then
    echo "DIALOG_DIR is required for start/restart." >&2
    exit 1
  fi

  mkdir -p "$log_dir"

  if [ "${SPECSPACE_DEV_NPM_INSTALL:-0}" = "1" ]; then
    "$npm_bin" install --prefix "$repo_root/graphspace"
  fi

  local api_cmd=(
    "$resolved_python"
    viewer/server.py
    --port "$api_port"
    --dialog-dir "$dialog_dir"
  )
  if [ -n "$spec_dir" ]; then
    api_cmd+=(--spec-dir "$spec_dir")
  fi
  if [ -n "$specgraph_dir" ]; then
    api_cmd+=(--specgraph-dir "$specgraph_dir")
  fi
  if [ -n "$hyperprompt_binary" ]; then
    api_cmd+=(--hyperprompt-binary "$hyperprompt_binary")
  fi
  if is_truthy "$agent"; then
    api_cmd+=(--agent)
  fi

  local api_launch="cd $(printf "%q" "$repo_root") && exec $(quote_args "${api_cmd[@]}") >>$(printf "%q" "$log_dir/backend.log") 2>&1"
  screen -dmS "$backend_screen" bash -lc "$api_launch"

  local ui_cmd=("$npm_bin" run dev -- --host 127.0.0.1 --port "$ui_port")
  local ui_launch="cd $(printf "%q" "$repo_root/graphspace") && exec $(quote_args "${ui_cmd[@]}") >>$(printf "%q" "$log_dir/graphspace.log") 2>&1"
  screen -dmS "$ui_screen" bash -lc "$ui_launch"

  wait_for_url "http://127.0.0.1:$api_port/api/v1/health" "SpecSpace API"
  wait_for_url "http://127.0.0.1:$ui_port/" "GraphSpace UI"

  echo "Backend log: $log_dir/backend.log"
  echo "GraphSpace log: $log_dir/graphspace.log"
}

status_services() {
  echo "Screen sessions:"
  screen -ls || true
  echo
  echo "Port listeners:"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$api_port" -sTCP:LISTEN || true
    lsof -nP -iTCP:"$ui_port" -sTCP:LISTEN || true
  else
    echo "lsof is not available."
  fi
}

command="${1:-}"
case "$command" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    start_services
    ;;
  status)
    status_services
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
