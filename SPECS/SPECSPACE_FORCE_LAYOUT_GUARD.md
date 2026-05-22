# SpecSpace Force Layout Guard

## Context

Legacy ContextBuilder had a fourth SpecGraph view mode named `Force`.
It lived in `viewer/app/src/SpecForceGraph.tsx` and was not a React Flow
layout preset. The old canvas switched away from the normal React Flow surface
and rendered a separate D3 SVG force simulation.

The legacy behavior was useful for seeing organic graph clusters, but it also
had important constraints:

- it rendered all resolved graph edges in one animated force simulation;
- initial positions were random, so the same graph could settle differently;
- it used D3 ticks, drag, zoom, SVG markers, dashed edges, node labels, and
  native SVG title tooltips in a separate rendering stack;
- it did not share React Flow minimap, controls, edge inspector rendering,
  persisted node moves, or the current edge density controls;
- dense always-on edge rendering and long SVG edges were already known to be
  risky in Safari.

Because of that, SpecSpace should not restore Force as a normal fifth layout
button until the runtime guard and smoke criteria below are satisfied.

## Guard Contract

The current production canvas exposes deterministic presets only:

- `Tree`
- `Linear`
- `Canonical`
- `Status`

`Force` is a guarded experimental preset. It is represented by
`SPEC_GRAPH_FORCE_LAYOUT_PRESET = "force"` and evaluated by
`evaluateSpecGraphForceLayoutGuard(...)`, but it must stay outside
`SPEC_GRAPH_CANVAS_LAYOUT_PRESETS` until a follow-up PR deliberately wires the
runtime UI.

Initial budget:

| Limit | Value |
| --- | ---: |
| Max nodes | 80 |
| Max edges | 220 |

The guard must reject Force when:

- Force was not explicitly enabled by a future feature flag or equivalent
  operator action;
- the visible graph exceeds the node budget;
- the visible graph exceeds the edge budget.

The budget is intentionally conservative. It is high enough for the current
public SpecGraph scale, but low enough to prevent accidental rollout on larger
graphs before measurement.

## Implementation Requirements Before UI Exposure

The first runtime PR that exposes Force in the UI must keep these requirements:

1. Force is opt-in, not the default layout.
2. Force has a clear unavailable state when the guard rejects the graph.
3. Force either respects the existing edge detail/LOD model or implements an
   equivalent simplification inside its own renderer.
4. Force does not silently discard selected edge, selected node, or Agent
   Context workflows.
5. Random layout churn is either removed through deterministic seeding or made
   explicit through a reset action.
6. React Flow controls/minimap expectations are documented if Force remains a
   separate SVG surface.
7. Browser smoke covers desktop and mobile/narrow viewports.

## Smoke Criteria

Before Force can be treated as parity-complete:

- the current public SpecGraph renders a nonblank Force surface;
- no console errors appear during first render, layout settle, zoom, pan, node
  selection, and node drag;
- selected node state remains synchronized with Sidebar and Spec Inspector;
- selected edge/endpoint workflows have a documented equivalent or an explicit
  unavailable state;
- Auto/Main/Core/Links/All edge-density expectations are preserved or replaced
  by a Force-specific LOD rule;
- Safari or WebKit smoke verifies that interaction remains usable at the
  current SpecGraph scale.

## Follow-Up Plan

1. Add a hidden/explicit feature flag that can enable Force only when
   `evaluateSpecGraphForceLayoutGuard(...)` returns `available: true`.
2. Port or replace the legacy D3 renderer with a SpecSpace FSD boundary.
3. Add browser smoke for desktop and mobile/narrow viewports.
4. Review production behavior on the public SpecGraph before exposing Force as
   an ordinary layout choice.
