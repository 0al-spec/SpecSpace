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

These first-experiment numbers do not establish that one viewer is more usable:
labels, zoom, and interactive behavior remain unmeasured. In the cycle case all three layouts necessarily leave one
hierarchy edge non-forward; the multi-parent case has zero crossings under this
proxy for all three. Compare the generated output when code or fixtures change.

## React Flow routes and edit scenarios

The test also generates paths using the production viewer's React Flow
`getBezierPath` and `getSmoothStepPath`, the same handle sides and per-kind
curvature. For the snapshot it uses node sizes observed on the live site:
220×158 for 70 nodes and 220×132 for `SG-SPEC-0020` and `SG-SPEC-0046`.
Synthetic fixtures use 220×126. The model reconstructs routes from test layout
coordinates and does not account for viewport filtering. `refines` is projected parent to child,
as in Tree and Spine. All resolved edges are included.

Each Q/C segment is approximated with 16 equal parameter steps; the curved case
is additionally evaluated at 32. Counts are pairs of edges with at least one
non-collinear segment intersection or contact, including contacts at sampled
segment endpoints. Pairs sharing a graph endpoint and collinear overlaps are
excluded; multiple intersections between the same pair count once. Rounded
orthogonal corners are sampled as quadratic curves. Sampling and floating-point
tests may miss or misclassify tangencies and close contacts, so counts are
estimates and should not be interpreted as exact visible crossings.

| Measure                          |  Tree | Spine | Dagre |
| -------------------------------- | ----: | ----: | ----: |
| Curved route pairs, 16 steps     |   964 |   250 |   251 |
| Curved route pairs, 32 steps     |   970 |   251 |   252 |
| Orthogonal route pairs, 16 steps | 1,425 |   407 |   415 |

The difference between 16 and 32 is evidence of sampling sensitivity, not a
statistical confidence interval. In particular, Spine's advantage over Dagre in
this small comparison is too narrow to justify selecting either on crossings.

The position-stability experiment now counts existing nodes that move relative
to the same anchor after four independent changes: adding a child to the first
node, adding a child to the rightmost node (according to each layout), adding an
isolated node, or adding a secondary link. The rightmost-node operation is not
necessarily the same target across algorithms. Counts on the snapshot:

| Change                  | Tree | Spine | Dagre |
| ----------------------- | ---: | ----: | ----: |
| Child of first node     |    0 |    71 |    71 |
| Child of rightmost node |    0 |     0 |     0 |
| Isolated node           |    0 |     0 |    30 |
| Secondary link          |    0 |     0 |     0 |

These are controlled synthetic edits on one snapshot. They do not measure
manual overrides or performance, and do not predict stability for arbitrary
changes. The original straight-line table remains useful only for comparison
with the first experiment, not as an estimate of rendered edge crossings.

## Observed production SVG paths

On 2026-11-06, the live public canvas reported 72 nodes and 187 visible edges
after selecting **All**, with SpecGraph source revision `1bc0e6f`. Sampling
the actual curved SVG paths in the browser at 32 equal-distance intervals
reported **965 intersecting pairs for Tree** and **250 for Spine**. This is
a point-in-time observation, not a benchmark of Dagre, which is not in the UI.
The browser sampler is `sample-live-dom.js`: on the public canvas select Tree
or Spine, Curve and All, then evaluate the file's expression in the browser
console. Restore previous UI settings afterward. The source revision, UI
revision, node dimensions, manual position overrides and filters can change the
result. Equal-distance DOM samples and equal-parameter reconstructed samples
are different approximations; counts can differ.
