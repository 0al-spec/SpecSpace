## REVIEW REPORT — minimap_fix

**Scope:** main..HEAD (branch feature/CTXB-P2R-B1-minimap-fix)
**Files:** 4 (App.tsx, useGraphData.ts, layoutGraph.ts, theme.css)

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues
None.

### Secondary Issues

- **[Low] Redundant `width`/`height` on conversation nodes**: Setting both `width`/`height` props AND `style: { width, height }` on conversation nodes is slightly redundant. React Flow uses the props for its internal store and the style for DOM rendering — they should stay in sync but the duplication could confuse future maintainers. Consider documenting why both are needed or using only one if React Flow's internals allow it.

- **[Low] `onNodesChange` does not propagate to `useGraphData`**: The node positions/dimensions updated by `applyNodeChanges` stay in local `nodes` state and are discarded on the next `graphNodes` change (e.g. workspace refresh). This is acceptable for now since the graph re-derives layout from the API on each refresh. If drag-to-reposition is ever added, this state management pattern will need revisiting.

- **[Nit] `useEffect` sync pattern**: `useEffect(() => { setNodes(graphNodes); }, [graphNodes])` causes an extra render cycle on every API refresh. This is fine for current usage (low-frequency refresh), but if hot-reload frequency increases, memoizing the transformation inside `useGraphData` to return a stable reference could improve performance.

### Architectural Notes

- **Root cause of the MiniMap bug**: React Flow v12's MiniMap relies on the internal `nodeLookup` Map being populated with `measured` dimensions. This only happens when `onNodesChange` is provided (controlled mode), which triggers `adoptUserNodes` to copy user node data into the internal store. Without `onNodesChange`, React Flow operates in "uncontrolled" mode and the MiniMap never receives measured dimensions.

- **Controlled mode is the correct long-term approach**: Providing `onNodesChange` enables React Flow features like drag-and-drop, selection, and keyboard interactions that require the internal store to stay in sync with the rendered DOM.

- The `ReactFlowProvider` wrapper in `App()` correctly separates the store context from `AppInner()`, allowing `useReactFlow()` to work inside `FitViewShortcut`.

### Tests
- All 45 tests pass.
- No new tests added — visual verification via `preview_eval` confirmed 3 minimap rect elements with correct colors.
- Consider adding a smoke test for minimap presence in future test expansion.

### Next Steps
- No actionable issues warrant new tasks. FOLLOW-UP skipped.
- Proceed to T10 (expand/collapse button position fix).
- Proceed to T11 (cross-conversation edge routing to message nodes).
