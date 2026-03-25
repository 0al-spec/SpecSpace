## REVIEW REPORT — Hyperprompt compiler invocation (CTXB-P4-T3)

**Scope:** main..HEAD (feature/CTXB-P4-T3-hyperprompt-compiler-invocation)
**Files:** 3 changed (viewer/server.py, tests/test_compile.py, SPECS/*)

### Summary Verdict
- [x] Approve with comments

### Critical Issues

None.

### Secondary Issues

- [Medium] **Compile error response shape is asymmetric.** On success the caller gets a flat response with a `"compile"` key. On failure the server returns a non-200 status but still wraps the compile error inside `"compile"`. This means callers must look in two places: `response["compile"]["error"]` on failure vs `response["compile"]["compiled_md"]` on success. A more consistent approach would be to always return 200 and use a `"compile_status"` field, or to always surface the error at the top level. The current contract works but will need documentation for T4.

- [Low] **`DEFAULT_HYPERPROMPT_BINARY` is a hardcoded macOS path.** It will not work out of the box on other machines. Consider reading from a `.flow/params.yaml` field or an env var as the fallback, rather than a hardcoded path.

- [Low] **Timeout of 60 seconds is undocumented.** The compile subprocess timeout is 60 s with no configuration knob. Future contributors won't know why this value was chosen. A comment or a constant would clarify intent.

### Architectural Notes

- `invoke_hyperprompt` is a pure function — takes `export_dir` and `binary_path`, returns a status/payload tuple. This mirrors the design of `export_graph_nodes` and makes unit testing clean. Good pattern to continue.
- `compile_graph_nodes` composing export + compile in one call is correct; it means the API surface stays minimal for T4.
- The `--hyperprompt-binary` CLI arg makes the binary path injectable at server startup, which is the right seam for CI/CD or multi-machine use.

### Tests

- 7 unit tests cover `invoke_hyperprompt` directly (missing binary, missing hc, success, exit codes 1–4).
- 5 integration tests cover `/api/compile` (bad conv id, unknown conv, success, missing binary, compile failure).
- All 92 tests pass.
- Shell-script stub binaries written in `setUp` keep tests hermetic and fast. No external binary required.

### Next Steps

- CTXB-P4-T4: expose compile results in the UI (compile button, result panel, path display).
- Consider documenting the error response shape in a follow-up API contract spec.
- Low priority: make `DEFAULT_HYPERPROMPT_BINARY` configurable via env var or read from `.flow/params.yaml` at startup.
- No FOLLOW-UP tasks required from this review.
