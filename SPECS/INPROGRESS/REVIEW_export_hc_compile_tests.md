## REVIEW REPORT — export_hc_compile_tests

**Scope:** main..HEAD (feature/CTXB-P5-T3-export-compile-integration-tests)
**Files:** 1 new (tests/test_export.py) + 4 SPECS updates

### Summary Verdict
- [x] Approve with comments
- [ ] Approve
- [ ] Request changes
- [ ] Block

### Critical Issues

None.

### Secondary Issues

- [Low] `ExportGraphNodesTests.setUpClass` writes root, branch, and merge into a shared temp dir. Tests that call `export_graph_nodes` for `ROOT_ID` will create export artifacts inside that temp dir. Since `export_graph_nodes` calls `shutil.rmtree` on the export dir before writing, tests in this class that both export root are not truly independent — the second export wipes what the first produced. All current tests are self-contained assertions (they each read only what they just wrote), so this is fine. But a future test that exports root and then tries to assert something about a *different* export in the same temp dir should use its own `TemporaryDirectory`.

- [Nit] `make_stub_binary` takes a `write_output` and `exit_code` parameter but the `exit_code` parameter only works when `write_output=False`. If someone calls `make_stub_binary(d, exit_code=2)`, the success script runs (ignoring exit_code). The function works correctly for all current callers, but the API is misleading. Could be split into `make_success_stub` / `make_failing_stub` in a future cleanup.

### Architectural Notes

- `_render_node_markdown` and `generate_hc_root` are tested as pure functions (no I/O), which is the right approach — these are the most fragile parts of the pipeline (output format directly consumed by the Hyperprompt compiler).
- `ExportGraphNodesTests` mixes unit-style assertions (file naming, directory structure) with integration assertions (full round-trip including re-export idempotence). The mixture is appropriate given the small surface of `export_graph_nodes`.
- The checkpoint-scope truncation tests explicitly check both the boundary case (first message only) and the full-inclusion case (all messages), providing clear regression coverage for the `checkpoints[: target_checkpoint_index + 1]` slice.

### Tests

- Total: 184 tests (up from 154), 0 failures.
- `make lint` passes cleanly.
- 30 new tests in `test_export.py` covering: provenance comment rendering, .hc format, directory structure, file naming, re-export idempotence, checkpoint truncation, error returns, and end-to-end compile.

### Next Steps

- No blocking follow-ups required.
- `CTXB-P5-T4` (documentation update, P1) is the next suggested task.
