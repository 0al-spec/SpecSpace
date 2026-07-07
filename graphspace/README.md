# SpecSpace UI

The SpecSpace UI for readonly SpecGraph and SpecPM artifact inspection,
organised by [Feature-Sliced Design v2.1](https://feature-sliced.design/).

## Status

Currently contains:

- FSD layer skeleton (`app / pages / widgets / features / entities / shared`).
- Design tokens extracted from the legacy `theme.css`.
- Three baseline `shared/ui` components used everywhere in the legacy viewer:
  `Panel`, `PanelBtn`, `Overlay`.
- Live artifact panels for recent activity, implementation work, proposal
  traces, and artifact diagnostics.
- A primary SpecGraph canvas rendered with React Flow.

`graphspace/` is not the conversation-authoring UI. Legacy ContextBuilder
conversation flows stay in `viewer/app` and legacy routes. Runtime SpecSpace UI
data reads should use the versioned SpecSpace API boundary, `/api/v1/*`.

See [`docs/SPECSPACE_BOUNDARY.md`](../docs/SPECSPACE_BOUNDARY.md) for the
product boundary and [`docs/SPECSPACE_API_V1.md`](../docs/SPECSPACE_API_V1.md)
for the HTTP contract.

## Workspace routes

The planned public deployment keeps one SpecSpace UI with route-level workspace
selection:

- `/` renders the SpecGraph bootstrap/showcase workspace.
- `/team-decision-log` renders the Team Decision Log `product_idea_to_spec`
  pilot workspace.

The route should select workspace metadata and the artifact manifest consumed by
`/api/v1/*`. It must not grant write authority to the UI; candidate promotion
continues through the Graph Repository Service boundary.

The current UI resolves `/team_decision_log` to `/team-decision-log`, opens the
Idea-to-Spec workspace panel by default, and passes
`workspace=team-decision-log` to the Idea-to-Spec read model.

## Canvas layout

The default SpecGraph canvas layout is **Refinement Ladder Layout**.

- Primary axis: resolved `refines` relationships define depth. Parent specs are
  placed to the left; specs that refine them move one rank to the right.
- Stable rows: nodes inside the same rank are sorted by `node_id`, so unchanged
  data keeps the same visual positions across refreshes.
- Visual direction: `refines` edges are drawn parent -> child for readability,
  while the raw SpecGraph edge data still preserves the semantic
  `child refines parent` direction.
- Overlay links: `depends_on`, `relates_to`, and broken references are styled as
  cross-links. They do not change placement in this layout.

Future layout experiments should be introduced as explicit alternate modes
instead of silently replacing this default.

Users can drag nodes to create local layout overrides. These overrides are
stored in browser `localStorage` under a key derived from `spec_dir`, graph
revision metadata when present, and the sorted node/edge identity set. They are
SpecSpace UI state only: they must not be written back into SpecGraph specs,
runs, or readonly deployment mounts. The canvas reset action removes the local
override and returns to Refinement Ladder Layout.

## Run

```sh
cd graphspace
npm install
npm run dev          # http://localhost:5175
npm run lint:fsd     # Steiger architecture lint
```

## Browser E2E

UI-started product flows need a real browser check, not only API and render
tests. The first smoke covers the raw idea entry path:

```sh
cd graphspace
npx playwright install chromium
npm run e2e:ui-started
```

From the repository root the same smoke is available as:

```sh
make ui-e2e-raw-idea-entry
```

The smoke starts the GraphSpace Vite app, opens `/team-decision-log`, starts a
temporary Python SpecSpace backend for the SpecSpace-owned mutable state API,
submits a raw idea request through the browser UI, and verifies the submitted
state plus the next Platform handoff command are visible. Readonly product
workspace artifacts are fixture-backed in the default mode so the test stays
focused on the UI-started entry boundary. It does not run SpecGraph, Platform,
Git Service, or any mutation-capable handoff.

For the execution-backed local smoke, provide sibling checkouts explicitly:

```sh
SPECG_E2E_PLATFORM_DIR=../Platform \
SPECG_E2E_SPECG_DIR=../SpecGraph \
UI_PORT=5190 make ui-e2e-raw-idea-entry
```

That mode still keeps browser authority read-only. The Playwright harness runs
Platform and SpecGraph as external operator actions, then publishes selected
public-safe artifacts into the temporary backend `runs` directory and emits a
`change` event on `/api/v1/runs-watch`.

## Product Demo Harness

Use the product demo harness when preparing a live demonstration of the
UI-started idea-to-spec flow:

```sh
SPECG_E2E_PLATFORM_DIR=../Platform \
SPECG_E2E_SPECG_DIR=../SpecGraph \
UI_PORT=5190 make ui-e2e-product-demo
```

For a headed browser that pauses on the final presentation screen:

```sh
SPECG_E2E_PLATFORM_DIR=../Platform \
SPECG_E2E_SPECG_DIR=../SpecGraph \
UI_PORT=5190 make ui-e2e-product-demo-live
```

The harness creates a fresh `local-pantry-demo` workspace, enters the raw idea
through SpecSpace, runs the controlled Platform/SpecGraph handoffs externally,
saves clarification answers through the UI, and opens the final presentation
route:

```text
/local-pantry-demo?view=demo
```

Artifacts are written under:

```text
graphspace/test-results/product-demo/
```

Expected outputs:

- `product-demo-report.json`;
- screenshots under `screenshots/`, including `08-demo-view.png`;
- Playwright trace/video under `playwright-output/`.

The final presentation screen is meant to support a short demo script:

1. **Original idea** - the submitted idea is visible as operator-owned state, not
   as a public/canonical artifact.
2. **What the system understood** - the frame is summarized as actors,
   commands, events, and constraints.
3. **Candidate generated** - SpecGraph evidence is shown as nodes,
   requirements, acceptance criteria, and topology.
4. **Next safe action** - SpecSpace points to the next lifecycle step while
   Platform remains the execution boundary.

The Make target sets `SPECSPACE_PRODUCT_DEMO_ALLOW_CLARIFICATION_FALLBACK=1`.
That fallback is intentional for the demo harness: current real intake may not
always emit browser-answerable clarification fields. Direct Playwright runs
without that flag fail at `real_intake_clarification_fields_missing` instead of
silently masking a producer-side regression.

Local demo mode and production demo mode are different:

- local demo mode generates a fresh candidate from the Playwright harness;
- production `/team-decision-log?view=demo` renders the published product
  workspace state from the workspace-specific artifact base.

The production smoke checks the route is renderable and not legacy
ContextBuilder, while the local Playwright harness verifies rendered candidate
summary, raw idea protection, and controlled execution evidence.

### State And Run-Dir Hygiene

Manual UI-started smoke runs are easiest to reason about when these three paths
belong to the same run:

- SpecSpace-owned mutable state directory;
- SpecGraph `--run-dir`;
- product artifact base / backend `runs` directory.

If they drift, the Product Workspace should not be treated as broken. It will
surface the mismatch in **Workspace state preflight** via `workspace_state_hygiene`
and recommended actions such as rebuilding an import preview, recreating a rerun
request, or recreating an approval intent. Those actions are operator hints only:
SpecSpace does not clear stale state, run Platform, run SpecGraph, mutate specs,
write ontology packages, create branches, or publish read models.

When debugging a confusing local smoke, prefer starting with a fresh temp state
directory and a fresh SpecGraph run directory. If reusing state intentionally,
verify that the current repair session, candidate id, workspace id, and source
refs shown in **Workspace state preflight** match the run you are about to
continue.

## Layer rules (Steiger-enforced)

```
app → pages → widgets → features → entities → shared
```

Imports go top-down only. Slices on the same layer never import each other —
collect them one layer up. Every slice exposes a `index.ts` public API; never
reach into a slice's internals.

## Where to put code

| Question | Goes to |
|---|---|
| App-wide initialisation, providers, global styles | `app` |
| A whole screen / route | `pages` |
| A large self-contained UI block | `widgets` |
| A user action with business value (verb) | `features` |
| A business entity (noun: node, run, recent-change) | `entities` |
| UI kit, HTTP client, generic lib, config | `shared` |

When in doubt: keep it in `pages/` until something else needs it.
