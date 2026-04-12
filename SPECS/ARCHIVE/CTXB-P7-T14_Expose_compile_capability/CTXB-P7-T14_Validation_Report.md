# Validation Report — CTXB-P7-T14: Expose compile capability in /api/capabilities

**Date:** 2026-04-12  
**Verdict:** PASS

---

## Deliverables

| Artifact | Status |
|----------|--------|
| `viewer/server.py` — `main()`: cache `server.compile_available` via `resolve_hyperprompt_binary` at startup | ✅ |
| `viewer/server.py` — `handle_capabilities`: include `"compile": self.server.compile_available` | ✅ |
| `viewer/app/src/App.tsx` — `checkSpecAvailable` → `checkCapabilities` returning `{specAvailable, compileAvailable}` | ✅ |
| `viewer/app/src/App.tsx` — `compileAvailable` state added and passed to `InspectorOverlay` | ✅ |
| `viewer/app/src/InspectorOverlay.tsx` — `compileAvailable?: boolean` prop (default `true`) | ✅ |
| `viewer/app/src/InspectorOverlay.tsx` — Compile button disabled with tooltip when `compileAvailable` is false | ✅ |
| `viewer/app/src/InspectorOverlay.tsx` — Inline note shown when binary unavailable | ✅ |
| `viewer/app/src/InspectorOverlay.css` — `.inspector-compile-unavailable` styles | ✅ |
| `tests/test_specgraph.py` — `start_spec_test_server` accepts `compile_available` param | ✅ |
| `tests/test_specgraph.py` — 2 new tests: `test_compile_false_when_binary_unavailable`, `test_compile_true_when_binary_available` | ✅ |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `GET /api/capabilities` includes `"compile": true/false` | ✅ |
| AC2 | Compile button disabled with tooltip when `compile` is false | ✅ `disabled={compiling \|\| !compileAvailable}` + `title` |
| AC3 | Compile button works normally when `compile` is true (default `true` preserves existing behaviour) | ✅ |
| AC4 | All existing tests pass | ✅ 280 passed (+2 new) |
| AC5 | TypeScript build clean | ✅ `tsc -b && vite build` — no errors |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python -m pytest tests/` | ✅ 280 passed |
| Syntax | `python -m py_compile viewer/server.py` | ✅ Clean |
| TypeScript | `npm run build` | ✅ No type errors |

---

## Design Notes

- Binary resolution (`resolve_hyperprompt_binary`) runs once at server startup and caches the result in `server.compile_available`. This avoids re-probing the filesystem on every capabilities request.
- `compileAvailable` defaults to `true` in `InspectorOverlay` so existing integration tests that don't pass the prop are unaffected.
- The inline note beneath the button gives users enough context to fix the issue without reading documentation.
