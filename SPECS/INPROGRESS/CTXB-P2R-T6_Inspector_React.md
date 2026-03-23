# CTXB-P2R-T6 — Migrate inspector overlay to React component

## Objective Summary

Create a slide-in inspector overlay panel that shows conversation details when a graph node is selected, and checkpoint details when a message node is clicked. Click-on-empty-canvas dismisses the inspector.

## Deliverables

1. `InspectorOverlay.tsx` — slide-in panel showing conversation details and checkpoint details.
2. Node click → fetch `/api/conversation?conversation_id=X` → show inspector.
3. Message node click → fetch `/api/checkpoint?conversation_id=X&message_id=Y` → show checkpoint details.
4. Click-on-empty-canvas → dismiss inspector.
5. Lineage display with parent/child edges.

## Acceptance Criteria

1. Conversation inspector slides in when a node is selected.
2. Checkpoint inspector appears when a message is selected.
3. Clicking empty canvas dismisses both.
4. Lineage navigation shows parent and child edges.
