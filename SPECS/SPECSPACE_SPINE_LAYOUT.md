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
4. Sibling anchors are evenly distributed around the parent when possible.
5. A child's own descendants expand around that child anchor.
6. Non-overlap and deterministic ordering win over perfect symmetry.
7. Multiple parents are reduced to one primary parent for layout purposes.
8. Secondary edges should rely on existing edge detail/routing controls instead
   of changing node placement.

## Algorithm

The implementation uses deterministic relative subtree placement:

1. Each subtree is computed relative to its own root center.
2. Leaves occupy the root center.
3. Two-child groups use symmetric anchors above and below the parent.
4. Larger sibling groups start from symmetric offsets and relax only enough to
   avoid overlap.
5. Roots are shifted into global rows with spacer rows between root subtrees.

This produces a tidy hierarchy without D3 ticks, animation, or random initial
positions.

## Follow-Ups

- Tune the primary parent choice if SpecGraph starts emitting meaningful
  hierarchy priorities.
- Add layout-specific edge visibility defaults if `Spine + All` becomes too
  visually dense.
- Consider subtree collapse once operators need to navigate larger graphs.
