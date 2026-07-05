# Idea-to-Spec Product Workspace Workplan

Status: active planning
Updated: 2026-07-05

## Purpose

Track the SpecSpace-facing work needed to make `product_idea_to_spec` usable as
a guided Product Workspace flow. This file is the tactical UI/product backlog
for the browser experience. It complements, but does not replace:

- Platform runbooks for proven end-to-end smoke procedures;
- SpecGraph roadmaps for producer-side artifacts, contracts, and pipeline
  behavior;
- cross-repo roadmap documents for sequencing across SpecGraph, SpecSpace, and
  Platform.

## Current Focus

End-to-end UI-started product idea flow:

```text
user enters raw idea in SpecSpace
  -> SpecSpace stores operator-owned local state
  -> Platform executes the controlled intake handoff
  -> SpecGraph emits intake / clarification artifacts
  -> user answers clarification requests in SpecSpace
  -> Platform executes the controlled answer continuation handoff
  -> SpecGraph emits clarified intake / active candidate review artifacts
  -> user saves repair drafts in SpecSpace
  -> Platform/SpecGraph run controlled repair rerun and repaired handoff
  -> user reviews project-local ontology terms in SpecSpace
  -> Platform materializes candidate approval and promotion request
  -> Platform runs Git Service promotion dry-run
  -> SpecSpace refreshes the Product Workspace lifecycle through each handoff
```

SpecSpace must remain an inspect/request surface. It must not execute
SpecGraph, Platform, Git Service, mutate candidate/canonical specs, write
Ontology packages, accept ontology terms, create branches, open PRs, merge
reviews, or publish read models.

## Recently Closed

- Raw idea entry state in SpecSpace.
- Browser E2E for raw idea submit into SpecSpace-owned mutable state.
- Workspace and `guided_flow` refresh after successful raw idea submit.
- Visible handoff command for controlled Platform intake execution.
- Product Workspace visibility for the Platform real idea intake execution
  report, including operations and generated output artifacts.
- Browser E2E for projected intake clarification publication and
  SpecSpace-owned clarification answer save.
- Browser E2E refresh through a runs-watch change event instead of page reload
  for projected external intake/continuation publication.
- Env-gated browser E2E for real Platform/SpecGraph intake execution after raw
  idea submit. This keeps the browser inspect/request-only while the harness
  runs Platform externally, validates the execution report, publishes selected
  output artifacts into the test runs directory, and refreshes through
  runs-watch.
- Env-gated browser E2E for real Platform/SpecGraph answer continuation after
  SpecSpace-owned clarification answers. The harness passes the persisted
  SpecSpace answer state into Platform, Platform rebases run-local handoff refs,
  SpecGraph imports the answers, and the UI refreshes to active candidate
  review-required state.
- Template-backed intake answer shape alignment. Generic template `value`
  fields are expanded to concrete payload keys such as `value.entries[]` or
  `value.refs[]`, so SpecSpace saves answers in the shape SpecGraph can
  materialize.
- Env-gated browser E2E for the repair/approval/promotion dry-run chain after
  answer continuation. The harness now drives controlled Platform/SpecGraph
  execution outside browser authority and publishes the resulting artifacts so
  the browser verifies candidate graph, Pre-SIB, repair review, repair rerun,
  repaired handoff, approval readiness, approval decision, promotion request,
  and Git Service dry-run status.
- Project-local ontology review is part of approval readiness. Approval intent
  stays unavailable while ontology seed review is required and no effective
  project-local decision effect exists.
- Project-local ontology decisions are now saved through the Product Workspace
  browser controls in the execution-backed e2e, not by direct API writes.
- Product/spec repair drafts are now saved through structured Product
  Workspace browser controls in the execution-backed e2e, alongside ontology
  gap repair drafts.
- Fast clarification-answer browser tests now create raw idea entry state
  through the same Product Workspace submit UI instead of seeding that mutable
  state with direct API POSTs.
- Isolated run-dir project-local ontology imports accept the canonical
  `runs/project_local_ontology_review_lane.json` decision ref as a safe alias
  for `runs/<run-dir>/project_local_ontology_review_lane.json`.
- Intake answer validation findings now preserve and render `finding_id`,
  `target_ref`, `source_ref`, and `next_action`, so invalid-answer diagnostics
  point to the affected request/source instead of showing only a generic
  message.
- Env-gated browser E2E now includes a non-demo workspace route smoke for
  `/household-pantry-rotation`. It verifies that a UI-submitted raw idea creates
  `real-idea-entry.household-pantry-rotation...`, Platform/SpecGraph handoff
  reaches active candidate generation, raw idea text stays out of generated
  public-safe artifacts, and `team-decision-log` fixture terms do not leak into
  the new candidate artifacts.
- The raw idea form is promoted to the first Product Workspace lifecycle block
  and has a stable `#idea-to-spec-start-raw-idea` anchor. It is labelled
  `Start here: raw product idea` so the entry point is not hidden behind Guided
  Flow / Candidate Overview / Workflow sections.
- Guided clarification continuation is now a single Product Workspace path
  rather than a scattered set of technical rows. It shows question count,
  saved/validated answers, request state, continuation readiness, active
  candidate refs, and the next safe action; the request button writes only the
  SpecSpace-owned continuation execution request while the browser keeps zero
  Platform/SpecGraph execution authority.
- Guided candidate repair is now a dedicated Product Workspace path rather than
  a scattered repair dashboard. The UI shows product/spec answer progress,
  ontology decision progress, project-local ontology review, rerun request/gate
  state, repaired handoff state, blockers, evidence refs, and target anchors
  without giving the browser Platform/SpecGraph execution authority.
- Guided approval and promotion is now a dedicated Product Workspace path rather
  than a scattered set of approval readiness and controlled-promotion sections.
  The UI shows approval intent, Platform approval materialization, promotion
  request, promotion execution, repository review, read-model publication,
  blockers, evidence refs, and target anchors without giving the browser
  Platform/Git Service execution authority.

## Next Tasks

### 1. UI-Started Intake Execution Visibility

Show the result of the controlled intake handoff after an operator submits a raw
idea.

Status: closed for intake execution. SpecSpace shows the Platform intake
execution report when the artifact is published, and the browser smoke now has
an env-gated execution-backed path using local Platform and SpecGraph checkouts.

Acceptance criteria:

- Platform execution report is visible in the Product Workspace. Done.
- SpecGraph intake session / clarification request artifacts are reflected in
  `real_idea_intake`. Done.
- `guided_flow` advances from `entry_submitted` to the appropriate
  clarification or candidate-source stage. Done for execution-backed intake.
- Missing or failed execution is shown as an actionable blocker, not as silent
  stale state.

### 2. Browser E2E: Submit -> Platform Execute -> Clarification Requests

Extend the Playwright smoke from entry persistence to the first external
handoff.

Status: closed with two modes. Browser E2E covers raw idea submit followed by a
projected publication in normal CI, and an env-gated execution-backed mode runs
the real Platform subprocess against a local SpecGraph checkout when
`SPECG_E2E_PLATFORM_DIR` and `SPECG_E2E_SPECG_DIR` are provided.

Acceptance criteria:

- The test uses the browser for raw idea entry. Done.
- The test harness may run Platform/SpecGraph outside the browser.
- The browser never receives execution authority. Done.
- After artifact publication/refresh, the UI shows clarification requests or a
  ready candidate-source state. Done with projected publication and
  execution-backed intake publication.

Execution-backed local smoke:

```bash
SPECG_E2E_PLATFORM_DIR=../Platform \
SPECG_E2E_SPECG_DIR=../SpecGraph \
UI_PORT=5190 make ui-e2e-raw-idea-entry
```

The harness passes SpecSpace-owned state paths into Platform, validates the
produced Platform report, publishes selected SpecGraph output artifacts into
the test `runsDir`, and emits a runs-watch change event. Browser code still
does not execute Platform or SpecGraph.

### 3. Clarification Answer UI E2E

Cover the next user-facing loop after intake questions appear.

Status: closed for the first execution-backed loop. Browser E2E now saves a template-backed intake
clarification answer through the Product Workspace UI, verifies the
SpecSpace-owned answer state, checks that missing required refs keep the save
action disabled, and has an env-gated execution-backed path for real
Platform/SpecGraph continuation after saved answers.

Closed execution-backed findings:

- SpecSpace now has a request-only
  `real_idea_answer_continuation_execution_requests.json` state artifact.
  Browser UI can request continuation without executing Platform or SpecGraph.
- Platform now has a first-class
  `product-real-idea-continuation execute-requested --execution-request <SpecSpace state>`
  handoff, so operator-owned answer state is consumed through a validated
  request artifact rather than a direct browser-to-executor action.
- The lower-level
  `product-real-idea-continuation execute --answer-state <SpecSpace state>`
  handoff remains available for operator/debug use.
- Platform rebases answer-state source refs to the selected SpecGraph run dir
  and derives the missing top-level workspace id from answer rows when
  SpecSpace persisted state was written before a filtered read.
- SpecSpace expands generic template `value` fields using
  `value_templates_by_action`, so event-storming answers save as `entries` and
  domain-frame answers save as `refs`.

Execution-backed follow-up preconditions:

- The harness clicks the Product Workspace request button and then runs
  `product-real-idea-continuation execute-requested` outside the browser.
  Done.
- The produced import preview and continuation report are copied into the same
  artifact base that `/api/v1/idea-to-spec-workspace` reads. Done for the local
  e2e harness.
- The browser observes the update through runs-watch, not `page.reload()`. Done.
- Product Workspace has a guided clarification path that consolidates answer
  progress, continuation request state, import preview, continuation report,
  and active candidate refs. Done.

Acceptance criteria:

- User fills clarification answers in SpecSpace. Done.
- SpecSpace-owned answer state is saved and validated. Done for the browser
  save path.
- Import preview / continuation lane is visible. Done with projected and
  execution-backed publication.
- Invalid or missing answers produce clear UI diagnostics. Done for required
  template refs, template shape mismatch, and server-side answer findings with
  stable finding/source/target/next-action detail.

### 4. Artifact Refresh And Runs-Watch Hardening

Make the Product Workspace update predictably after external Platform/SpecGraph
execution.

Status: closed for intake and answer continuation. Browser E2E now emits a runs-watch `change` event and
verifies that the Product Workspace refetches the projected intake execution and
answer continuation state without `page.reload()`. The env-gated E2E also
exercises the same refresh path with real Platform/SpecGraph output artifacts.

Acceptance criteria:

- UI refreshes relevant idea-to-spec surfaces after artifact changes. Done for
  projected runs-watch publication.
- Manual reload is not the normal happy path. Done for the UI-started browser
  smoke projection.
- Workspace artifact base, SpecSpace state directory, and SpecGraph run
  directory drift are visible as diagnostics. Done through workspace state
  hygiene, source-ref stale checks, consumed-source-state handling after
  repaired handoff, and the execution-backed browser smoke's isolated
  `state`/`runs` directories.

### 5. Operator Handoff UX

Make controlled handoffs understandable without giving SpecSpace execution
authority.

Status: closed for the UI-started chain through Git dry-run. The Product
Workspace shows copyable Platform commands, source refs, output refs, execution
reports, and next-step state for raw idea entry, intake execution, answer
continuation, repair rerun, project-local ontology review, approval, promotion
request, and dry-run promotion execution. Approval and promotion also have a
dedicated guided path that sequences approval intent, approval materialization,
promotion request, promotion execution, repository review, and read-model
publication.

Acceptance criteria:

- Copyable command hints are paired with source refs and expected outputs. Done
  for the UI-started chain through Git dry-run.
- Last execution report is shown next to the current lifecycle stage. Done for
  intake, answer continuation, repair rerun, approval, promotion request, and
  promotion execution surfaces.
- Next safe step, blockers, and authority boundary stay aligned. Done for the
  UI-started chain through dry-run promotion execution.
- Approval/promotion no longer requires the operator to infer the next step from
  separate `approval_readiness` and `controlled_promotion` blocks. Done through
  the guided approval path.

Follow-up scope:

- Replace remaining direct API writes in the e2e harness with browser-level UI
  interactions where the Product Workspace already has forms.
- Keep repair/promotion command hints read-only until Platform owns each
  controlled execution wrapper.
- If approval/promotion becomes request-driven from the browser, add
  SpecSpace-owned request artifacts first and keep Platform as the executor
  boundary.

### 6. Browser E2E: Project-Local Ontology Decision UI

Use the actual Product Workspace project-local ontology review controls in the
execution-backed browser smoke.

Status: closed. The e2e generates the project-local ontology review lane, then
uses the browser to select `keep_project_local`, fill the rationale, save each
decision, and continue through SpecGraph import preview plus decision effect.

Acceptance criteria:

- The browser selects `keep_project_local` for each surfaced project-local term.
  Done.
- The browser fills the decision rationale where the UI requires one.
  Done.
- The saved SpecSpace-owned state still feeds the existing SpecGraph import
  preview and decision effect report.
  Done.
- Approval intent remains unavailable before effective review and becomes
  available after effective review.
  Done.

### 7. Browser E2E: Repair Draft UI Coverage

Use the actual repair draft controls for product/spec gaps in the
execution-backed smoke instead of relying on pre-shaped helper payloads.

Status: closed. The execution-backed browser smoke fills an ontology gap repair
draft and a structured product/spec `provide_candidate_context` draft through
the Product Workspace UI before running import preview, rerun, repaired handoff,
approval, promotion request, and Git dry-run.

Acceptance criteria:

- The browser fills at least one structured `provide_candidate_context` or
  `answer_question` repair draft.
  Done.
- The browser saves ontology and product/spec repair drafts without direct API
  state construction for those targets.
  Done.
- The downstream import preview, rerun, repaired handoff, and approval
  readiness stay unchanged.
  Done.

## Open Friction / Next Fixes

### 8. Arbitrary Route Downstream Repair Lifecycle

Status: closed.

The `/household-pantry-rotation` execution-backed smoke proves the route,
SpecSpace-owned entry state, Platform intake handoff, SpecGraph clarification
flow, active candidate generation, repair loop, project-local ontology review,
candidate approval, promotion request, and Git dry-run are scoped to the
non-demo workspace.

Resolved failure modes:

- `active_idea_to_spec_candidate.json` in the isolated run dir is derived from
  the household pantry idea and is also verified after publication into the
  local SpecSpace backend runs surface;
- Product Workspace rejects mismatched active/repaired candidate identity for a
  selected arbitrary product workspace route instead of treating stale
  `team-decision-log` artifacts as current;
- project-local ontology decisions now derive candidate/session identity from
  the current review lane context, so arbitrary-route decisions feed the
  effective decision report instead of becoming `candidate_mismatch`.

Acceptance criteria:

- A non-demo workspace route can continue past active candidate into repair
  draft import preview, rerun request gate, repaired handoff, project-local
  ontology decision effect, candidate approval intent, approval decision,
  promotion request, and Git dry-run without falling back to
  `team-decision-log` identity.
- Workspace state hygiene treats the selected arbitrary workspace as current
  throughout the full lifecycle.
- The env-gated browser smoke can extend the `/household-pantry-rotation`
  scenario beyond active candidate without expected `candidate_mismatch`
  diagnostics.

Likely repositories:

- SpecSpace: implemented through selected workspace identity filtering,
  project-local decision identity binding, and the env-gated browser smoke.

### 9. Raw Idea Entry Usability Polish

Status: closed.

The raw idea entry existed in Product Workspace as `Start from raw idea`, but it
was visually buried after Guided Flow, Candidate Overview, and Workflow Lane.
For a user starting from a blank idea, that made the actual first input look
like an internal inspector row.

Acceptance criteria:

- Raw idea input is the first visible lifecycle block in Product Workspace.
- The block has a stable anchor for guided-flow / help links.
- The copy explains that SpecSpace only stores operator-owned local state and
  does not execute Platform/SpecGraph from the browser.
- Browser/component tests prevent the entry point from drifting below
  diagnostic panels again.

### 10. New Idea Workspace Entry Point

Status: closed.

Arbitrary product workspace routes already existed, but users had to know and
type the route manually. The Product Workspace flow now has a visible SpecSpace
shell entry point for opening a new idea workspace before submitting the raw
idea. The initial fast slice used an inline sidebar form; the current UI uses a
compact workspace dropdown plus a fullscreen `New workspace` wizard.

Acceptance criteria:

- The SpecSpace sidebar exposes a compact workspace dropdown and `+` button.
  Done.
- The `+` button opens a fullscreen `New workspace` wizard rather than placing
  creation fields inside the Team Decision Log or other current workspace UI.
  Done.
- The wizard derives or requests a safe product workspace route such as
  `/cash-flow-control` without running Platform / SpecGraph from the browser.
  Done.
- Opening the route lands in a Product idea-to-spec workspace where the raw
  idea entry is the first lifecycle block.
  Done.
- Browser coverage prevents the entry point from regressing back into
  route-by-hand behavior.
  Done.

### 11. Backend-Backed Workspace Creation

Status: in progress, cross-repo.

The `New workspace` wizard records backend-owned workspace creation request
state before opening a product workspace route. Platform-owned initialization
and durable workspace binding remain separate controlled handoff steps.

Current SpecSpace slice:

- `product_workspace_creation_requests.json` records SpecSpace-owned creation
  intent.
- `GET/POST /api/v1/product-workspace-creation-requests` exposes the request
  state with authority guards.
- The fullscreen `New workspace` wizard saves creation intent before opening the
  route.
- Product Workspace shows `route_only_workspace` or
  `workspace_creation_requested` status from backend state.
- Product Workspace exposes a `Guided workspace initialization` path that
  summarizes route-only, initialization-needed, waiting-for-Platform,
  initialized, and blocked states.
- Initial idea text entered in the wizard is reused as the raw idea draft after
  the workspace becomes initialized; the user does not need to type the same
  idea twice.
- SpecSpace still does not initialize workspace files, mutate SpecGraph, update
  Platform catalogs, or run Git Service.

Acceptance criteria:

- Submitting a new workspace request writes a SpecSpace-owned operator intent or
  calls a Platform-owned workspace creation endpoint; it must not mutate
  SpecGraph or Git directly from the browser.
  Done for SpecSpace-owned operator intent; Platform-owned initialization
  remains open.
- The backend allocates or resolves a durable workspace id, display name,
  artifact base, SpecSpace state namespace, and run-dir binding.
  Partially done for workspace id, display name, and route; artifact base,
  state namespace, and run-dir binding remain open for Platform/SpecGraph.
- `guided_flow` and `workspace_state_hygiene` can distinguish:
  route-only workspace, workspace creation requested, workspace initialized,
  intake-ready, and blocked creation.
  Done for the Product Workspace guided initialization projection. Existing
  workspace state hygiene remains the diagnostic surface for stale mutable
  state rather than a creation executor.
- Duplicate, reserved, malformed, or already-initialized workspace ids produce
  visible diagnostics and do not silently fall back to `team-decision-log`.
  Done at the SpecSpace request boundary for malformed, reserved,
  already-initialized, and published catalog workspace ids. Platform-owned
  catalog/run-dir binding validation remains a separate downstream concern.
- Human-facing workspace display name and raw idea text are separated from the
  route slug. The backend should allocate or validate an ASCII route id for
  non-English ideas instead of forcing the user to hand-craft a Latin slug.
  Done for display name vs route id and backend-allocated non-English routes:
  the sidebar can submit a non-English display name without a hand-authored
  Latin slug, and the backend allocates a safe `idea-<digest>` workspace route.
- The UI entry point refreshes from backend state after creation instead of
  treating the route as sufficient evidence that a workspace exists.
  Done for creation-request state and controlled initialization publication:
  the opened workspace refreshes from `runs-watch` after the Platform
  initialization report appears and only then unlocks raw idea intake.
- The workspace creation surface shows Platform's managed initialization
  execution request handoff when
  `runs/product_workspace_initialization_execution_request.json` is present.
  Done for read-only visibility: SpecSpace exposes request status, requested
  operation, readiness, and idempotency evidence without executing Platform.
- The initial idea captured by the wizard is available only as selected
  workspace local UI state and is not exposed by the standalone
  `product-workspace-creation-requests` endpoint or public artifacts.
  Done: the direct state endpoint keeps root intent redacted, while the selected
  Product Workspace read model can prefill the raw idea draft.

Likely repositories:

- SpecSpace: workspace creation UI/state projection, route status, hygiene.
- Platform: workspace catalog / creation request endpoint or wrapper.
- SpecGraph: product workspace initializer contract if canonical workspace
  files are required before intake.

### 12. Controlled SpecSpace Authority Transition

Status: open, cross-repo strategy.

SpecSpace is currently an inspect/request surface. That boundary is correct for
the current product flow, but the roadmap needs an explicit transition strategy
for moving from read-only visibility to controlled management of lower layers.
The transition must happen through typed backend commands and durable reports,
not by letting the browser mutate SpecGraph, Platform, Git Service, or Ontology
state directly.

Phased strategy:

1. **Read-only inspect**: show artifacts, reports, metrics, lifecycle state, and
   next actions.
2. **Local operator state**: store drafts, answers, ontology decisions, approval
   intents, and workspace creation intents as SpecSpace-owned mutable state.
3. **Validated handoff request**: convert SpecSpace-owned state into typed
   handoff artifacts that another layer can validate.
4. **Controlled execution request**: call a backend/Platform executor that runs
   only allowlisted operations and returns durable execution reports.
5. **Managed operation surface**: expose selected operations in the UI only when
   their gate reports say the request is ready and the authority boundary is
   explicit.
6. **Audited lifecycle management**: every execution-capable action must have
   idempotency, source refs, policy checks, audit report, and public-safe
   read-model publication.

Non-goals:

- Browser-side execution of SpecGraph, Platform, Git Service, or Ontology tools.
- Direct writes to canonical specs, ontology packages, branches, PRs, or read
  models from React components.
- Treating a UI route as proof that a product workspace exists.

## Accepted Constraints And Runbook Notes

The items below are accepted authority boundaries or operator runbook notes, not
hidden UI mutations.

- UI submit persists raw idea entry, but does not execute the intake pipeline.
  This is an intentional authority boundary, not a bug.
- E2E currently proves entry, execution-backed intake execution when local
  Platform/SpecGraph checkouts are provided, clarification answer save,
  execution-backed answer continuation, repair rerun, project-local ontology
  review import/effect, approval materialization, promotion request, Git
  Service dry-run, and runs-watch refresh.
- Fast browser tests still use fixture-backed `/api/v1/idea-to-spec-workspace`
  projections for UI-only coverage. Keep the env-gated execution-backed smoke as
  the authority for real cross-repo lifecycle behavior, and only replace a fast
  projection with real artifact fixtures when it catches a lifecycle bug that
  the projection can mask.
- Manual smoke runs can still become confusing when an operator mixes old
  browser state with a new SpecGraph run directory or product artifact base.
  The runtime now reports this through workspace state hygiene, and
  `graphspace/README.md` documents the expected state/run-dir alignment and the
  safe interpretation of `Workspace state preflight` recommended actions. This
  remains an operator runbook concern, not a hidden UI mutation.

## Cross-Repo Coordination

Use this file for SpecSpace UX tasks only. When a task requires producer-side
contracts or execution boundaries, update the corresponding repo as well:

- SpecGraph: artifact contracts, Make targets, validators, public bundle
  surfaces, candidate lifecycle reports.
- Platform: controlled execution wrappers, Git Service handoff, product
  runbooks, smoke profiles.
- Metrics: idea maturity schema/validator contracts.

When a cross-repo task lands, keep this workplan focused on the remaining
SpecSpace-facing behavior rather than duplicating full PR histories.
