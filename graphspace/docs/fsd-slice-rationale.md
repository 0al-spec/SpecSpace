# GraphSpace FSD Slice Rationale

`fsd/insignificant-slice` is kept enabled by default. The slices below are
explicit exceptions because the Viewer page has stabilized into several large
composition boundaries that are expected to evolve independently even before a
second page consumes them.

## Retained Entity Slices

| Slice | Decision | Rationale |
| --- | --- | --- |
| `entities/implementation-work` | Keep | Domain entity for implementation handoff entries. It owns readiness tone logic, row rendering, and the `WorkItem` contract used by the panel and sample data. |
| `entities/proposal-trace` | Keep | Domain entity for proposal trace entries. It owns trace tone logic, row rendering, and the public `ProposalTraceEntry` contract. |
| `entities/recent-change` | Keep | Domain entity for recent activity events. It owns event tone, time formatting, row rendering, and the `RecentChange` contract shared by filtering/search and the panel. |
| `entities/spec-edge` | Keep | Domain alias for SpecGraph edge contracts. It keeps canvas and inspector code independent from the raw shared transport schema names. |
| `entities/spec-node` | Keep | Core SpecGraph domain entity. It owns node visual signals, graph-aware spec reference resolution, status badges, and reusable node card UI. |
| `entities/specpm-lifecycle` | Keep | Domain entity for SpecPM lifecycle badges. It owns lifecycle badge tone logic and the badge contract consumed by canvas and inspector surfaces. |

## Retained Feature Slices

| Slice | Decision | Rationale |
| --- | --- | --- |
| `features/filter-by-tone` | Keep | User-facing activity filter with reusable model, pure filtering logic, and toolbar UI. It is not owned by the Recent changes panel because the page uses the same state for captions, empty states, and utility-panel controls. |
| `features/search-by-spec` | Keep | User-facing spec search action with graph-aware filtering and search UI. It remains separate from the panel because spec search already affects feed filtering and can naturally extend to other spec-aware surfaces. |

## Retained Widget Slices

| Slice | Decision | Rationale |
| --- | --- | --- |
| `widgets/implementation-work-panel` | Keep | Utility panel around a live artifact read model. It composes entity rows and owns loading/error/empty states for the implementation work artifact. |
| `widgets/proposal-trace` | Keep | Utility panel around proposal trace artifacts. It has its own read model and UI state independent from recent activity and implementation work. |
| `widgets/recent-changes-panel` | Keep | Activity surface panel with its own read model and entity composition. The page coordinates filters, but the panel owns presentation of recent change entries. |
| `widgets/spec-graph-canvas` | Keep | Primary graph workspace boundary. It owns graph loading, flow element mapping, selection helpers, hover previews, focus math, lifecycle badge loading, and canvas UI. Merging it into `pages/viewer` would recreate the god-page shape that `CTXB-P7-T9` removed. |
| `widgets/spec-inspector` | Keep | Detail inspection workspace boundary. It owns node detail loading, inspector model building, and large content rendering separately from canvas selection. |
| `widgets/spec-node-navigator` | Keep | Sidebar navigator boundary. It owns filtering, scroll behavior, and node list presentation independently from the canvas and inspector. |

## Rule Policy

- New `fsd/insignificant-slice` diagnostics should be treated as real design
  feedback.
- Add a new exception only when the slice has a clear product boundary,
  documented ownership, and enough internal complexity to justify not keeping
  it inside `pages/viewer`.
- Page-local code without that boundary should stay under `pages/viewer`.
