# CTXB-P10-T9 — Add Sidebar spec node navigator

## Status

INPROGRESS

## Context

The GraphSpace Sidebar now works as a hidden canvas-level surface, but it only
contains utility panel launchers and live artifact diagnostics. The next useful
role is the old ContextBuilder Sidebar role: navigation through graph items.

The navigator should not become a second inspector. It should help locate and
select a spec node, then let the existing Spec Inspector show detailed content.

## Deliverables

- Add a reusable `widgets/spec-node-navigator` slice.
- Filter nodes by id, title, and file name.
- Show compact scanning metadata for each node.
- Wire row selection to the existing selected node state.
- Lift SpecGraph state so canvas and Sidebar consume the same response.

## Acceptance Criteria

- Sidebar shows a searchable, stable list of nodes.
- Selecting a node row selects the canvas node and opens Spec Inspector.
- Search no-match and empty graph states are readable and compact.
- Navigator rows show id, title, kind/status, and gap/diagnostic signal.
- The canvas and navigator do not independently fetch `/api/spec-graph`.

## Validation Plan

- Add unit tests for navigator filtering and ordering.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run lint:fsd`.
- Browser-smoke the Sidebar search/selection path at `http://localhost:5173/`.
