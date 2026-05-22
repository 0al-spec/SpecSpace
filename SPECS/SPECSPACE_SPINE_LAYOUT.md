# SpecSpace Spine Layout

## Intent

`Spine` is a deterministic SpecGraph canvas layout for readable large-graph
maps. It preserves the hand-arranged shape operators naturally build when they
place a primary left-to-right hierarchy and fan child groups above and below
their parent.

It is not a force simulation. It should remain reproducible across reloads and
safe for Safari/mobile smoke.

## Rules

1. Hierarchy depth determines the column:
   - `x = depth * columnGap`.
   - Depth comes from resolved `refines` hierarchy edges.
   - `depends_on` and `relates_to` stay as visible links but do not move nodes.
2. Each parent owns one primary child group.
3. Child groups are placed as compact subtrees.
4. A parent is centered on the vertical span of its child group when possible.
5. Non-overlap and deterministic ordering win over perfect symmetry.
6. Multiple parents are reduced to one primary parent for layout purposes.
7. Secondary edges should rely on existing edge detail/routing controls instead
   of changing node placement.

## Algorithm

The first implementation uses two deterministic passes:

1. Bottom-up span pass:
   - leaves occupy one row;
   - a parent subtree occupies the sum of its child subtree spans;
   - child order is stable by `node_id`.
2. Top-down placement pass:
   - roots are stacked with one spacer row between root subtrees;
   - child subtrees are assigned adjacent row spans;
   - parent `y` is placed at the center of the child group span.

This produces a tidy hierarchy without D3 ticks, animation, or random initial
positions.

## Follow-Ups

- Tune the primary parent choice if SpecGraph starts emitting meaningful
  hierarchy priorities.
- Add layout-specific edge visibility defaults if `Spine + All` becomes too
  visually dense.
- Consider subtree collapse once operators need to navigate larger graphs.
