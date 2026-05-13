# CTXB-P9-T7 - SpecNode visual signal unification

## Problem

GraphSpace currently renders the canvas `SpecNodeCard` and hover preview as
separate visual systems. The hover preview is meant to help inspect a distant
node without opening the inspector, so it should look like a richer version of
the node rather than an unrelated tooltip.

The current surfaces also underuse available node signals:

- maturity has no quality tone beyond the raw percentage;
- graph status values such as `linked`, `reviewed`, and `frozen` are not
  visually distinguishable;
- status and maturity treatments are not shared between canvas, hover preview,
  and navigator rows.

## Scope

- Add a shared `SpecNode` visual signal model for status and maturity tones.
- Apply maturity color to node quality bars.
- Render status as a tone-aware badge on node-facing surfaces.
- Reuse the `SpecNodeCard` visual language for the hover preview.
- Keep the changes frontend-only and bounded to GraphSpace.

## Acceptance

- Hover preview reads as an enlarged/richer SpecNode card.
- Maturity below 50%, 50-79%, and 80%+ have distinct tones.
- `linked`, `reviewed`, and `frozen` statuses have distinct tones.
- Existing selection, hover preview, lifecycle badge, and navigator behavior
  remains unchanged.
