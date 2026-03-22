# CTXB-P2-T7 — Remove the "Graph canvas" heading from the graph panel

## Objective Summary

Remove the static "Graph canvas" eyebrow and "Conversation lineage" heading from the graph panel. The graph summary line and legend provide sufficient orientation.

## Deliverables

1. Remove the eyebrow (`<div class="eyebrow">Graph canvas</div>`) and heading (`<h2>Conversation lineage</h2>`) from the graph panel.
2. Update any tests that assert on the removed text.

## Acceptance Tests

1. The "Graph canvas" eyebrow and "Conversation lineage" heading no longer appear in the UI.
2. The graph summary, legend, and canvas remain fully functional.
3. All tests pass.
