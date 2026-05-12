# UI Development

## Shared UI Kit

**Build and use shared UI Kit components.**
Before creating a new button, card, badge, toggle, or overlay, check whether
a shared component already exists (`PanelBtn`, `.panel-btn`, `.timeline-overlay`
pattern, etc.) and reuse or extend it. New interactive controls must match the
existing visual style (border radius, colours, hover transitions) and be placed
in a shared file if they will be used in more than one place.

## SpecSpace FSD Methodology

**Follow the local FSD rules when working on the SpecSpace subproject.**
SpecSpace frontend code should follow
[FSD Rules For Web Application Development](../../FSD.md). The document defines
the Feature-Sliced Design layer boundaries, import direction, public APIs, and
placement rules for UI, API, and state code.
