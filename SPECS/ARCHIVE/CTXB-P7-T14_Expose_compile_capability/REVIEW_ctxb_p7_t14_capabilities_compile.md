## REVIEW REPORT — CTXB-P7-T14: Expose compile capability in /api/capabilities

**Scope:** main..HEAD (feature/CTXB-P7-T14-capabilities-compile)  
**Files:** 5 changed (server.py, App.tsx, InspectorOverlay.tsx, InspectorOverlay.css, test_specgraph.py)

### Summary Verdict
- [x] Approve with comments
- [ ] Approve
- [ ] Request changes
- [ ] Block

---

### Critical Issues

None.

---

### Secondary Issues

**[Low] `compile_available` cached at startup — binary deleted mid-run is not reflected**  
The binary availability is probed once at startup and cached in `server.compile_available`. If the binary is later deleted (or installed after startup), the capability value goes stale until the server restarts.  
*Fix suggestion:* This is acceptable for a local dev tool. Re-probing on every request would add latency and the scenario is rare. Document in server startup log that compile availability is checked once. Non-blocking.

**[Nit] Startup log doesn't mention compile availability**  
The server prints `"Dialog folder: …"` and `"Spec graph: …"` but doesn't log whether Hyperprompt was found.  
*Fix suggestion:* Add `print(f"Compile available: {server.compile_available}")` in `main()`. Minor UX improvement.

**[Nit] `checkCapabilities` default is `compileAvailable: false` but compile may be flaky on network error**  
If the `fetch("/api/capabilities")` call fails (network issue, slow startup), `compileAvailable` defaults to `false` and the button stays permanently disabled for that session without a way to retry.  
*Note:* This matches the existing pattern for `specAvailable`. Both are intentional design decisions for a local tool — consistent and acceptable.

---

### Architectural Notes

- Caching `compile_available` on the server at startup is the right pattern — it mirrors how `spec_dir` is set once and exposed via `spec_graph`.
- Renaming `checkSpecAvailable` → `checkCapabilities` and returning a structured `{ specAvailable, compileAvailable }` object is good forward-looking design. Adding a third capability later (e.g., `agent`) is a one-liner.
- The `compileAvailable = true` default in `InspectorOverlay` preserves all existing integration tests transparently.
- The test helper `start_spec_test_server` now accepts `compile_available: bool = False` — the default of `False` is correct because the test binary (`""`) won't resolve.

---

### Tests

- 280 tests pass (278 + 2 new for the `compile` capability field).
- Both new tests are integration tests that spin up a real HTTP server — consistent with existing `CapabilitiesEndpointTests` pattern.
- No frontend tests (no framework configured) — TypeScript type safety verified via `tsc -b`.

---

### Next Steps

- Nit: add a startup log line for `compile_available` (low priority, can be done in T16 or as a separate nit fix).
- T16 (Hide AgentChat behind feature flag) can now proceed — it depends on T14 ✅.

**FOLLOW-UP: SKIPPED** — no actionable blockers or high-severity findings.
