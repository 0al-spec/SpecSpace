# ContextBuilder — Claude Development Rules

## UI Development

**Build and use shared UI Kit components.**
Before creating a new button, card, badge, toggle, or overlay, check whether
a shared component already exists (`PanelBtn`, `.panel-btn`, `.timeline-overlay`
pattern, etc.) and reuse or extend it. New interactive controls must match the
existing visual style (border radius, colours, hover transitions) and be placed
in a shared file if they will be used in more than one place.
