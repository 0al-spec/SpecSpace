## REVIEW REPORT — Message Title Decorator

**Scope:** main..HEAD
**Files:** 13

### Summary Verdict
- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues
- None found.

### Secondary Issues
- None found.

### Architectural Notes
- Expanded conversations now own their header decoration at the group-node level, which removes the separate draggable header node and keeps edge handles with the container instead of the title row.
- The regression check is source-level rather than a browser DOM assertion, which matches the repo's current lightweight test setup but leaves the visual overlap risk covered mainly by build and code review rather than an automated UI harness.

### Tests
- `python3 -m unittest tests.test_smoke.ContextBuilderSmokeTests.test_expanded_subflow_title_is_decorative_not_a_node`
- `make test`
- `make lint`
- `npm run build`
- Manual browser smoke was not recorded in this session.

### Next Steps
- FOLLOW-UP is skipped because no actionable findings were identified.
- Archive this review report after the task archive is finalized.
