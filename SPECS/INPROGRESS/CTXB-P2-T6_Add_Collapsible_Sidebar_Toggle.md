# CTXB-P2-T6 — Add Collapsible Sidebar Toggle

## Objective Summary

Add a toggle button that collapses/expands the sidebar so the graph canvas and inspectors can use the full viewport width.

## Deliverables

1. A toggle button visible at the top of the sidebar (or near it) that collapses the sidebar.
2. CSS class on the layout container that hides the sidebar and lets main content fill the width.
3. Sidebar state persisted in sessionStorage so it survives refresh.

## Acceptance Tests

1. Clicking the toggle hides the sidebar and expands the main area.
2. Clicking again restores the sidebar.
3. All tests pass, lint clean, coverage >=90%.
