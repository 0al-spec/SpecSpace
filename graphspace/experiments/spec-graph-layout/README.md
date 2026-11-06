# Specification graph layout experiment

This is a reproducible, offline comparison; it does not change the viewer. The
fixture is a minimal projection of the public `specgraph-bootstrap` endpoint,
collected on 2026-11-06. Its manifest identifies SpecGraph revision
`1bc0e6f21862b9969496b1180ba3cec261eb53a3`. The normalized fixture SHA-256 is
`5cd1f38430f2bf0649e4e403614aa4512bc0337d7b959c886d0fc2c77b7a8d97`.
It contains only node IDs and statuses and edge IDs, kinds, endpoints and
statuses; it is not a full artifact or an authoritative current graph.

From `graphspace`, run:

```sh
npm test -- src/widgets/spec-graph-canvas/__tests__/layout-experiment.spec.ts
```

Tree and Spine use the actual SpecSpace functions. Dagre 1.1.5 is an
experimental test-only candidate with `refines` as its only ranking input;
secondary links do not influence any candidate's node positions. It does not
integrate or benchmark ELK. It sorts nodes and edges before layout and uses
220×126 node dimensions and 140 / 46 gaps. All other lines remain available
for measurement. The two small synthetic inputs contain respectively a node
with two parents and a cycle with a secondary edge.

Crossings count strict intersections between straight centre-to-centre
segments with no shared endpoint. Collinear overlaps and paths intersecting a
third node are not counted. This is a ranking proxy for the same edge set,
not a measurement of the viewer's Bézier or orthogonal rendered routes. Area
is the bounding box of fixed-size nodes. Overlaps use these same fixed sizes;
neither measure includes edges or labels. `hierarchy_not_forward` counts
resolved `refines` edges whose parent is not strictly left of its child.

Stability inserts a single leaf under the lexicographically first node and
counts pre-existing nodes whose positions change after aligning that anchor.
It does not represent other edits, real user dragging, or perceptual cost.
All measurements include secondary edges even if a UI filter would hide them.

Snapshot results on the current checkout:

| Measure                                    |       Tree |      Spine |      Dagre |
| ------------------------------------------ | ---------: | ---------: | ---------: |
| Straight-line crossing proxy               |        724 |        169 |        158 |
| Node overlaps                              |          0 |          0 |          0 |
| Hierarchy links not forward                |          0 |          0 |          0 |
| Bounding box area (px²)                    | 12,965,080 | 29,391,080 | 18,221,400 |
| Existing nodes moved in one leaf insertion |          0 |         71 |         71 |

These numbers do not establish that one viewer is more usable: routes, labels,
zoom, interactive behavior, and incremental stability across multiple edits
remain unmeasured. In the cycle case all three layouts necessarily leave one
hierarchy edge non-forward; the multi-parent case has zero crossings under this
proxy for all three. Compare the generated output when code or fixtures change.
