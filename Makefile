PYTHON ?= python3
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

.PHONY: help serve api ui dev start stop test lint canonicalize canon quickstart

help:
	@echo "Targets:"
	@echo "  make quickstart              Canonicalize + run API + UI (all-in-one)"
	@echo "  make serve DIALOG_DIR=/absolute/path/to/dialogs [PORT=8000]"
	@echo "  make canonicalize DIALOG_DIR=/path/to/import_json OUTPUT_DIR=/path/to/canonical_json"
	@echo "  make canon DIALOG_DIR=/path/to/import_json [OUTPUT_DIR=/tmp/canonical_json]"
	@echo "  make api [DIALOG_DIR=/tmp/canonical_json] [API_PORT=8001]"
	@echo "  make ui [UI_PORT=5173]"
	@echo "  make start                  Run API + UI using .claude launch defaults"
	@echo "  make dev [DIALOG_DIR=...] [API_PORT=8001] [UI_PORT=5173]"
	@echo "  make stop [API_PORT=8001] [UI_PORT=5173]"
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
	@npm run dev --prefix viewer/app -- --host 127.0.0.1 --port "$(UI_PORT)"

dev:
	@npm install --prefix viewer/app
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,) & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix viewer/app -- --host 127.0.0.1 --port "$(UI_PORT)"

start:
	@npm install --prefix viewer/app
	@$(MAKE) stop API_PORT="$(API_PORT)" UI_PORT="$(UI_PORT)" >/dev/null
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" $(if $(strip $(SPEC_DIR)),--spec-dir "$(SPEC_DIR)",) $(if $(strip $(SPECGRAPH_DIR)),--specgraph-dir "$(SPECGRAPH_DIR)",) $(if $(strip $(HYPERPROMPT_BINARY)),--hyperprompt-binary "$(HYPERPROMPT_BINARY)",) $(if $(filter 1 true yes,$(AGENT)),--agent,) & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix viewer/app -- --port "$(UI_PORT)"

stop:
	@lsof -ti:$(API_PORT) | xargs kill 2>/dev/null || true
	@lsof -ti:$(UI_PORT) | xargs kill 2>/dev/null || true
	@echo "Stopped servers on ports $(API_PORT) and $(UI_PORT)"

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
