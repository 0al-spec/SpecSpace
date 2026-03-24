PYTHON ?= python3
PORT ?= 8000
API_PORT ?= 8001
UI_PORT ?= 5173
DIALOG_DIR ?=
OUTPUT_DIR ?=
CANONICAL_DIR ?= /tmp/canonical_json

.PHONY: help serve api ui dev test lint canonicalize canon

help:
	@echo "Targets:"
	@echo "  make serve DIALOG_DIR=/absolute/path/to/dialogs [PORT=8000]"
	@echo "  make canonicalize DIALOG_DIR=/path/to/import_json OUTPUT_DIR=/path/to/canonical_json"
	@echo "  make canon DIALOG_DIR=/path/to/import_json [OUTPUT_DIR=/tmp/canonical_json]"
	@echo "  make api [DIALOG_DIR=/tmp/canonical_json] [API_PORT=8001]"
	@echo "  make ui [UI_PORT=5173]"
	@echo "  make dev [DIALOG_DIR=/tmp/canonical_json] [API_PORT=8001] [UI_PORT=5173]"
	@echo "  make test"
	@echo "  make lint"

serve:
	@if [ -z "$(DIALOG_DIR)" ]; then \
		echo "DIALOG_DIR is required"; \
		echo "Example: make serve DIALOG_DIR=/absolute/path/to/ChatGPTDialogs/import_json"; \
		exit 1; \
	fi
	@$(PYTHON) viewer/server.py --port $(PORT) --dialog-dir "$(DIALOG_DIR)"

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
	@$(PYTHON) viewer/server.py --port "$(API_PORT)" --dialog-dir "$(if $(strip $(DIALOG_DIR)),$(DIALOG_DIR),$(CANONICAL_DIR))" & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	npm run dev --prefix viewer/app -- --host 127.0.0.1 --port "$(UI_PORT)"

test:
	@$(PYTHON) -m unittest discover -s tests -p 'test_*.py'

lint:
	@$(PYTHON) -m py_compile viewer/server.py viewer/schema.py tests/test_*.py
