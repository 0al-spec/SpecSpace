# Validation Report — CTXB-P2-T1

**Task:** CTXB-P2-T1 — Render the conversation graph on a canvas
**Date:** 2026-03-22
**Verdict:** PASS

## Deliverables Checked

1. `viewer/index.html` now presents a graph-first viewer shell with a dedicated graph canvas, state legend, graph summary, canvas panning, and click selection tied to the existing transcript view.
2. The graph canvas is driven by `GET /api/graph` and renders root, branch, merge, and broken-lineage states directly from the graph snapshot.
3. `tests/test_smoke.py` now locks the presence of the graph canvas shell, graph API wiring, and panning state hooks in the shipped viewer HTML.
4. `README.md` now documents the graph-first workflow, node-state meanings, and the continued role of the sidebar file controls.

## Validation Steps

### 1. Project Test Suite

Command:

```bash
make test
```

Result:

- PASS
- 37 tests executed successfully

### 2. Project Lint / Syntax Validation

Command:

```bash
make lint
```

Result:

- PASS
- Python syntax compilation succeeded for runtime and test files

### 3. Standalone Pytest Run

Command:

```bash
pytest
```

Result:

- PASS
- 37 tests executed successfully under the standalone pytest runner

### 4. Ruff Static Checks

Command:

```bash
ruff check viewer tests
```

Result:

- PASS
- No lint violations remained in the runtime or test files

### 5. Coverage Gate

Command:

```bash
pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90
```

Result:

- PASS
- Total coverage reached 91.39%

### 6. Browser Validation

Environment:

- `python3 viewer/server.py --port 8010 --dialog-dir /Users/egor/Development/GitHub/0AL/ContextBuilder/real_examples/canonical_json`
- Playwright against `http://127.0.0.1:8010/viewer/index.html`

Checks:

1. Verified the graph canvas rendered the canonical root, branch, and merge nodes with distinct states.
2. Clicked the branch node and confirmed the transcript panel updated to `Trust Social Branding Branch`.
3. Dragged the graph viewport background and confirmed the stage transform changed from `translate(411 205)` to `translate(511 305.00001525878906)`, verifying panning behavior.

Result:

- PASS
- Graph selection and panning behaved as expected in the browser

## Notes

1. The only browser console error during manual validation was the expected missing `/favicon.ico` static request; the graph UI itself rendered and interacted correctly.
2. The graph canvas intentionally reuses the existing transcript renderer for selected conversations so later detail-panel work can build on the same selection state rather than duplicating conversation loading logic.
