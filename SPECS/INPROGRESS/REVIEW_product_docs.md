## REVIEW REPORT — product_docs

**Scope:** main..HEAD (CTXB-P5-T4)
**Files:** 1 changed (README.md)

### Summary Verdict
- [x] Approve

### Critical Issues

None.

### Secondary Issues

1. **[Low] Hyperprompt GitHub URL is placeholder** — The README links to `https://github.com/0AL/Hyperprompt`. If the actual repo URL differs, this link will 404 for readers. Verify the URL is correct before merging.

2. **[Low] `make serve` does not accept `--hyperprompt-binary`** — The README says "edit the Makefile `serve` target" to pass the binary flag, but the Makefile `serve` target has no `HYPERPROMPT_BINARY` variable yet. A contributor following the docs would have to modify the Makefile manually. Consider adding `HYPERPROMPT_BINARY ?= ...` to the Makefile or clarifying that direct `python3 viewer/server.py` invocation is the recommended path for custom binary paths.

3. **[Nit] `scripts/` directory listed in layout was empty** — The repo layout section omits `scripts/` (it is empty), which is correct. No action needed.

### Architectural Notes

- The README now accurately positions ContextBuilder as the compile orchestrator between raw JSON conversations and the external Hyperprompt compiler, with no model execution responsibility. This is a significant conceptual clarification from the prior README which described the tool as a "viewer/editor".
- The compile pipeline diagram (`GET /api/graph → POST /api/export → POST /api/compile → compiled.md`) is a useful contributor orientation anchor.
- Compile target field table consolidates fields previously scattered across API docs into one scannable reference.

### Tests

- No test changes. This task was documentation-only.
- 184 tests pass. Lint clean.

### Next Steps

- [Actionable] CTXB-P5-T2-follow-up: Add `HYPERPROMPT_BINARY` variable to the Makefile `serve` target so the documented `make serve` path is self-contained.
- CTXB-P5-T5 (already in workplan): Add end-to-end operator guide for handing compiled context to an external agent.
