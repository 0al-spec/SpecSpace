LOCAL_PYTHON := .venv/bin/python
PYTHON ?= $(if $(wildcard $(LOCAL_PYTHON)),$(LOCAL_PYTHON),python)
DEFAULT_PLATFORM_DIR := $(abspath ../Platform)
DEFAULT_SPECG_DIR := $(abspath ../SpecGraph)
PORT ?= 8000
API_PORT ?= 8001
UI_PORT ?= 5173
CLAUDE_DIALOG_DIR ?= /Users/egor/Development/GitHub/ChatGPTDialogs/canonical_json
CLAUDE_SPEC_DIR ?= /Users/egor/Development/GitHub/0AL/SpecGraph/specs/nodes
CLAUDE_SPECGRAPH_DIR ?= /Users/egor/Development/GitHub/0AL/SpecGraph
CLAUDE_HYPERPROMPT_BINARY ?= /Users/egor/Development/GitHub/0AL/Hyperprompt/.build/arm64-apple-macosx/release/hyperprompt
DIALOG_DIR ?=
OUTPUT_DIR ?=
CANONICAL_DIR ?= $(CLAUDE_DIALOG_DIR)
SPEC_DIR ?= $(CLAUDE_SPEC_DIR)
SPECGRAPH_DIR ?= $(CLAUDE_SPECGRAPH_DIR)
HYPERPROMPT_BINARY ?= $(CLAUDE_HYPERPROMPT_BINARY)
AGENT ?= 1

.PHONY: help serve api ui legacy-ui dev legacy-dev start stop specspace-start specspace-stop specspace-restart specspace-status ui-e2e-raw-idea-entry ui-e2e-product-demo ui-e2e-product-demo-live test lint canonicalize canon quickstart

help:
	@echo "Targets:"
	@echo "  make quickstart              Canonicalize + run API + UI (all-in-one)"
	@echo "  make serve DIALOG_DIR=/absolute/path/to/dialogs [PORT=8000]"
	@echo "  make canonicalize DIALOG_DIR=/path/to/import_json OUTPUT_DIR=/path/to/canonical_json"
	@echo "  make canon DIALOG_DIR=/path/to/import_json [OUTPUT_DIR=/tmp/canonical_json]"
	@echo "  make api [DIALOG_DIR=/tmp/canonical_json] [API_PORT=8001]"
	@echo "  make ui [UI_PORT=5173]     Run GraphSpace SpecSpace UI"
	@echo "  make legacy-ui [UI_PORT=5173] Run deprecated ContextBuilder UI"
	@echo "  make start                  Run API + GraphSpace UI using launch defaults"
	@echo "  make dev [DIALOG_DIR=...] [API_PORT=8001] [UI_PORT=5173]"
	@echo "  make legacy-dev [...]       Run API + deprecated ContextBuilder UI"
	@echo "  make stop [API_PORT=8001] [UI_PORT=5173]"
	@echo "  make specspace-restart     Restart SpecSpace API + GraphSpace dev UI in detached screen sessions"
	@echo "  make specspace-status      Show SpecSpace dev screen sessions and port listeners"
	@echo "  make ui-e2e-raw-idea-entry Run Playwright UI-started raw idea entry smoke"
	@echo "  make ui-e2e-product-demo   Run deterministic Playwright product demo E2E"
	@echo "  make ui-e2e-product-demo-live Run headed product demo E2E and pause at the final route"
	@echo "  make test"
	@echo "  make lint"

serve:
	@if [ -z "$(DIALOG_DIR)" ]; then \
		echo "DIALOG_DIR is required"; \
		echo "Example: make serve DIALOG_DIR=/absolute/path/to/ChatGPTDialogs/import_json"; \
		exit 1; \
	fi
	@$(PYTHON) viewer/server.py --port $(PORT) --dialog-dir "$(DIALOG_DIR)" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,)

canonicalize:
	@if [ -z "$(DIALOG_DIR)" ] || [ -z "$(OUTPUT_DIR)" ]; then \
		echo "DIALOG_DIR and OUTPUT_DIR are required"; \
		echo "Example: make canonicalize DIALOG_DIR=/path/to/import_json OUTPUT_DIR=/path/to/canonical_json"; \
		exit 1; \
	fi
	@$(PYTHON) viewer/canonicalize.py "$(DIALOG_DIR)" "$(OUTPUT_DIR)"

canon:
	@$(MAKE) canonicalize DIALOG_DIR="$(DIALOG_DIR)" OUTPUT_DIR="$(if $(strip $(OUTPUT_DIR)),$(OUTPUT_DIR),$(CANONICAL_DIR))"

api:
	@$(MAKE) serve PORT="$(API_PORT)" DIALOG_DIR="$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))"

ui:
	@npm run dev --prefix graphspace -- --host 127.0.0.1 --port "$(UI_PORT)"

legacy-ui:
	@npm run dev --prefix viewer/app -- --host 127.0.0.1 --port "$(UI_PORT)"

dev:
	@npm install --prefix graphspace
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,) & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix graphspace -- --host 127.0.0.1 --port "$(UI_PORT)"

legacy-dev:
	@npm install --prefix viewer/app
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,) & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix viewer/app -- --host 127.0.0.1 --port "$(UI_PORT)"

start:
	@npm install --prefix graphspace
	@$(MAKE) stop API_PORT="$(API_PORT)" UI_PORT="$(UI_PORT)" >/dev/null
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,) & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix graphspace -- --port "$(UI_PORT)"

stop:
	@lsof -ti:$(API_PORT) | xargs kill 2>/dev/null || true
	@lsof -ti:$(UI_PORT) | xargs kill 2>/dev/null || true
	@echo "Stopped servers on ports $(API_PORT) and $(UI_PORT)"

specspace-start:
	@PYTHON="$(PYTHON)" \
	API_PORT="$(API_PORT)" \
	UI_PORT="$(UI_PORT)" \
	DIALOG_DIR="$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" \
	SPEC_DIR="$(SPEC_DIR)" \
	SPECGRAPH_DIR="$(SPECGRAPH_DIR)" \
	HYPERPROMPT_BINARY="$(HYPERPROMPT_BINARY)" \
	AGENT="$(AGENT)" \
	scripts/specspace-dev.sh start

specspace-stop:
	@API_PORT="$(API_PORT)" \
	UI_PORT="$(UI_PORT)" \
	scripts/specspace-dev.sh stop

specspace-restart:
	@PYTHON="$(PYTHON)" \
	API_PORT="$(API_PORT)" \
	UI_PORT="$(UI_PORT)" \
	DIALOG_DIR="$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" \
	SPEC_DIR="$(SPEC_DIR)" \
	SPECGRAPH_DIR="$(SPECGRAPH_DIR)" \
	HYPERPROMPT_BINARY="$(HYPERPROMPT_BINARY)" \
	AGENT="$(AGENT)" \
	scripts/specspace-dev.sh restart

specspace-status:
	@API_PORT="$(API_PORT)" \
	UI_PORT="$(UI_PORT)" \
	scripts/specspace-dev.sh status

ui-e2e-raw-idea-entry:
	@PYTHON="$(PYTHON)" SPECSPACE_E2E_PORT="$(UI_PORT)" npm run e2e:ui-started --prefix graphspace

ui-e2e-product-demo:
	@test -f "$${SPECG_E2E_PLATFORM_DIR:-$(DEFAULT_PLATFORM_DIR)}/scripts/platform.py" || (printf '%s\n' 'SPECG_E2E_PLATFORM_DIR must point at a Platform checkout.' >&2; exit 2)
	@test -f "$${SPECG_E2E_SPECG_DIR:-$(DEFAULT_SPECG_DIR)}/Makefile" || (printf '%s\n' 'SPECG_E2E_SPECG_DIR must point at a SpecGraph checkout.' >&2; exit 2)
	@rm -rf graphspace/test-results/product-demo
	@mkdir -p graphspace/test-results/product-demo
	@PYTHON="$(PYTHON)" \
		SPECG_E2E_PLATFORM_DIR="$${SPECG_E2E_PLATFORM_DIR:-$(DEFAULT_PLATFORM_DIR)}" \
		SPECG_E2E_SPECG_DIR="$${SPECG_E2E_SPECG_DIR:-$(DEFAULT_SPECG_DIR)}" \
		SPECSPACE_E2E_PORT="$(UI_PORT)" \
		SPECSPACE_E2E_TRACE=on \
		SPECSPACE_E2E_VIDEO=on \
		SPECSPACE_E2E_HEADLESS="$${SPECSPACE_E2E_HEADLESS:-1}" \
		SPECSPACE_E2E_OUTPUT_DIR=test-results/product-demo/playwright-output \
		SPECSPACE_PRODUCT_DEMO_ARTIFACT_DIR="$(CURDIR)/graphspace/test-results/product-demo" \
		SPECSPACE_PRODUCT_DEMO_ALLOW_CLARIFICATION_FALLBACK="$${SPECSPACE_PRODUCT_DEMO_ALLOW_CLARIFICATION_FALLBACK:-1}" \
		SPECSPACE_PRODUCT_DEMO_PAUSE_MS="$${SPECSPACE_PRODUCT_DEMO_PAUSE_MS:-0}" \
		npm run e2e:ui-started --prefix graphspace -- --grep "product demo harness"

ui-e2e-product-demo-live:
	@$(MAKE) ui-e2e-product-demo \
		UI_PORT="$(UI_PORT)" \
		SPECSPACE_PRODUCT_DEMO_PAUSE_MS="$${SPECSPACE_PRODUCT_DEMO_PAUSE_MS:-30000}" \
		SPECSPACE_E2E_HEADLESS=0

test:
	@$(PYTHON) -m unittest discover -s tests -p 'test_*.py'

lint:
	@$(PYTHON) -m py_compile $$(find viewer tests -name '*.py' | sort)

quickstart:
	@if [ -z "$(DIALOG_DIR)" ]; then \
		echo "DIALOG_DIR is required for quickstart"; \
		echo "Example: make quickstart DIALOG_DIR=/path/to/import_json"; \
		exit 1; \
	fi
	@$(MAKE) canon DIALOG_DIR="$(DIALOG_DIR)"
	@echo "✓ Canonicalized"
	@$(MAKE) api & api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	$(MAKE) ui
