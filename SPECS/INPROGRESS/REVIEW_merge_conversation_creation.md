## REVIEW REPORT — merge_conversation_creation

**Scope:** main..HEAD (CTXB-P3-T2)
**Files:** 4 source files changed (MergeDialog.tsx, MergeDialog.css, InspectorOverlay.tsx, InspectorOverlay.css) + 1 test file, 10 total files touched

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

---

### Critical Issues

None.

---

### Secondary Issues

**[Medium] MergeDialog fetches full graph on every open**
`MergeDialog` fetches `/api/graph` in a `useEffect` on mount to populate the second-parent conversation list. On large workspaces this could be slow (NFR: 200ms). The graph payload includes all node metadata; a lighter `/api/files` response would suffice for just the conversation list.

*Fix suggestion:* Use `/api/files` to list conversations, or pass the graph nodes as a prop from the parent `InspectorOverlay` (which already has them available from App state).

**[Low] No visual distinction between "no conversations available" and "loading"**
If the `/api/graph` fetch is in flight, the select dropdown shows `— select conversation —` with no loading indicator. If there is only one conversation in the graph (the current one), the dropdown renders empty after filtering out `parent1ConversationId`.

*Fix suggestion:* Add a brief "Loading…" option or a disabled state while fetching, and a "No other conversations available" option when `otherNodes` is empty.

**[Low] Merge button color uses CSS variable fallback `#7c3aed`**
`--merge-line` is used in both `MergeDialog.css` and `InspectorOverlay.css` with a hardcoded fallback. If the design tokens ever change, the fallback may diverge from the token.

*Fix suggestion:* Define `--merge-line` in the global CSS variables file alongside `--branch-line` rather than relying on the fallback syntax.

---

### Architectural Notes

- The dialog follows the same shape as `BranchDialog` — the `onCreated` / `onCancel` prop pattern and the `POST /api/file` write path are consistent with existing conventions.
- The two-parent constraint is currently enforced only server-side. The UI doesn't prevent a user from selecting the same conversation as both parents — the server will reject it, but the error will only surface after submit. This is acceptable for now.
- No changes to `server.py` or `schema.py` were needed — the existing API already handled multi-parent merge payloads.

---

### Tests

- 5 new tests in `MergeCreationApiTests`: happy path + 4 rejection cases (single parent, duplicate parents, missing parent conversation, duplicate file name).
- All 59 tests pass.
- No frontend tests exist (React components are not covered by the Python test suite), consistent with the rest of the UI codebase.

---

### Next Steps

- Consider defining `--merge-line` in the global CSS token file (nit, no blocker).
- If graph performance becomes a concern, refactor `MergeDialog` to accept node list as a prop instead of fetching `/api/graph` independently.
- No FOLLOW-UP tasks required — all findings are low-priority nits or future-work considerations.
