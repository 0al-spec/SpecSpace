## REVIEW REPORT — Compile Target Model and Export Workspace Layout

**Scope:** main..feature/CTXB-P3-T3-compile-target-model
**Files:** 5 (viewer/schema.py, viewer/server.py, viewer/app/src/types.ts, viewer/app/src/InspectorOverlay.tsx, tests/test_api_contracts.py)

### Summary Verdict
- [x] Approve

### Critical Issues

None.

### Secondary Issues

- [Low] `CompileTargetPayload` in `schema.py` uses `total=False` so all keys are optional, but `scope`, `target_conversation_id`, `target_kind`, `lineage_conversation_ids`, `is_lineage_complete`, and `export_dir` are always present. A stricter split (required base + optional extension for checkpoint fields) would give better static-analysis coverage, but the current form is consistent with the project's informal typing style and carries no runtime risk.

- [Low] The `export_dir` path is absolute and tied to the OS filesystem at the moment the API is called. If `dialog_dir` moves, the path becomes stale in any cached API response. This is acceptable for v1 (responses are not cached by the server) but worth noting before any client-side caching is added.

- [Nit] `CompileTargetPayload.target_message_id` is typed `str | None` but TypedDict fields cannot express `None` as a literal default — the field is simply absent in conversation-scope payloads. The type annotation is still useful documentation; no action needed.

### Architectural Notes

- The `export_dir` contract (`{dialog_dir}/export/{conversation_id}` and `{dialog_dir}/export/{conversation_id}--{message_id}`) is deterministic and simple. The `--` separator avoids nested subdirectories for checkpoint scope, which is the right trade-off.
- `build_compile_target` now owns all compile-target shape knowledge. Phase 4 export tasks should read `export_dir` from this payload rather than recomputing it.
- The TypeScript `CompileTarget` interface exactly mirrors the Python payload. This symmetry is valuable and should be maintained as future fields are added.

### Tests

- Two new tests added covering conversation scope and checkpoint scope `export_dir` values.
- Tests verify the absolute path format, not just existence of the key.
- Existing 59 tests continue to pass (61 total).

### Next Steps

- No actionable issues found — FOLLOW-UP is skipped.
- `CTXB-P3-T4` (compile target selection UI) can now consume `export_dir` from the inspector payload without further server changes.
- Phase 4 tasks (CTXB-P4-T1 et al.) should use `compile_target.export_dir` as the root for all generated Markdown node files and the `.hc` root file.
