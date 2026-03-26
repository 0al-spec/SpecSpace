# CTXB-P5-B2 — Compile fails with Hyperprompt syntax error: multiple root nodes in generated export

**Status:** Planned
**Priority:** P1
**Phase:** Phase 5 — Hardening, Tests, and Documentation
**Dependencies:** CTXB-P4-T2, CTXB-P4-T3

## Objective

Fix `root.hc` generation so every export has exactly one depth-0 root node. Ensure multi-conversation lineage exports compile successfully without Hyperprompt syntax errors.

## Reproduction

Compiling a conversation chain currently fails with Hyperprompt exit code 2:

- `Hyperprompt compiler failed: Syntax error`
- `Multiple root nodes (depth 0) found ... Hypercode documents must have exactly one root`

Current `generate_hc_root()` emits one top-level quoted node per conversation, creating multiple depth-0 roots for lineage exports with more than one conversation.

## Deliverables

1. Update `.hc` generation in `viewer/server.py` so output has a single root node and deterministic child ordering.
2. Add regression tests in `tests/test_export.py` validating:
   - exactly one depth-0 root node is emitted,
   - node-file includes are consistently nested under that root,
   - compile path succeeds for multi-conversation chains using a parser-validating stub.
3. Document expected root structure in `README.md`.

## Acceptance Criteria

- Compiling the affected chain no longer fails with `Multiple root nodes (depth 0)`.
- Generated `root.hc` has exactly one depth-0 root node.
- Conversation and message includes are emitted at a consistent indentation level beneath the root.
- Existing compile/export tests remain green.
- Quality gates pass: `make test`, `make lint`.

## Test-First Plan

1. Add failing tests that assert one-root structure and strict nesting.
2. Reproduce red state with targeted export tests.
3. Implement minimal `.hc` generator changes.
4. Re-run targeted tests, then full quality gates.

## Execution Notes

- Preserve deterministic ordering from `compile_target.lineage_conversation_ids`.
- Keep output format compatible with existing path references (`nodes/{conversation_id}/{filename}`).
- Keep provenance include under the same single-root tree.

---
**Archived:** 2026-03-26
**Verdict:** PASS
