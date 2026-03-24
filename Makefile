PYTHON ?= python3
PORT ?= 8000
DIALOG_DIR ?=
OUTPUT_DIR ?=

.PHONY: help serve test lint canonicalize

help:
	@echo "Targets:"
	@echo "  make serve DIALOG_DIR=/absolute/path/to/dialogs [PORT=8000]"
	@echo "  make canonicalize DIALOG_DIR=/path/to/import_json OUTPUT_DIR=/path/to/canonical_json"
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

test:
	@$(PYTHON) -m unittest discover -s tests -p 'test_*.py'

lint:
	@$(PYTHON) -m py_compile viewer/server.py viewer/schema.py tests/test_*.py
