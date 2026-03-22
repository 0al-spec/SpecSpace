# CTXB-P2-T9 — Remove the redundant file toolbar block

## Objective Summary

Remove the block that shows the selected file name, message count, kind label, and the "Save current file", "Save as new file", "Delete current file" buttons. This information duplicates the conversation inspector and the sidebar.

## Deliverables

1. Remove the file toolbar HTML block from `viewer/index.html`.
2. Remove or relocate any JS that only served the toolbar.
3. Clean up orphaned CSS if any.

## Acceptance Tests

1. The file toolbar block is removed from the page.
2. No functionality is lost — equivalent actions remain accessible from the sidebar or inspectors.
3. All existing tests continue to pass.
