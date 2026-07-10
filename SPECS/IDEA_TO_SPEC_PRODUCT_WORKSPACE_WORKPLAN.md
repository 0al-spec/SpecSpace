# Idea-to-Spec Product Workspace Workplan

Status: active planning
Updated: 2026-07-09

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
  -> Platform opens the controlled repository review PR after explicit operator confirmation
  -> Platform inspects review status and publishes the public read model after merge
  -> SpecSpace refreshes the Product Workspace lifecycle through each handoff
```

SpecSpace must remain an inspect/request surface. It must not execute
SpecGraph, Platform, Git Service, mutate candidate/canonical specs, write
Ontology packages, accept ontology terms, create branches, open PRs, merge
reviews, or publish read models.

Agent Surface is the intended future vocabulary for this managed lifecycle, but
not a production dependency yet. The current SpecSpace surface is an internal
managed-operation registry plus durable report evidence. It should evolve toward
Agent Surface action and receipt semantics only after the draft protocol and
local registry are versioned together. Until then, do not publish a stable
`/.well-known/agent-surface.json`, issue Agent Grants, or accept external agent
runtime action requests from Product Workspace routes.

## Recently Closed

- Managed Operations Contract and regression inventory. The Product Workspace
  backend-managed operations introduced across workspace initialization, intake,
  clarification continuation, repair rerun, candidate approval, promotion
  request/execution, review-status inspection, and read-model publication now
  have a single machine-readable registry in
  `viewer/managed_operations_registry.py` plus a human-readable contract in
  `docs/MANAGED_OPERATIONS_CONTRACT.md`. Tests verify operation ids, route and
  handler coverage, normalized UI state vocabulary, output evidence, idempotency
  metadata, and authority-flag policy before future managed actions can be
  added casually.
- Managed Operations Observability Panel. Product Workspace now exposes a
  read-only `managed_operations_observability` projection built from
  `viewer/managed_operations_registry.py` plus selected workspace artifact
  evidence. The UI groups operations by lifecycle phase, shows missing inputs,
  available output reports, retry/overwrite/timeout policy text, and status
  counts, while keeping all execution, Git, SpecGraph, Ontology, and
  publication authority flags explicitly false. This is operator telemetry, not
  a new permission source.
- Managed Mode Readiness Projection. Product Workspace now exposes
  `managed_mode_readiness` so local backend-managed execution and production
  read-only deployments are visibly different. The projection reports executor
  availability, Platform CLI presence, SpecSpace-owned state/runs directory
  readiness and writability, artifact provider status, product workspace
  artifact-base status, ready-now/not-ready operation counts derived from
  managed operation statuses, and unavailable reasons without exposing local
  checkout paths. It is report-only telemetry and keeps all execution, Git,
  SpecGraph, Ontology, and publication authority flags explicitly false.
- Playwright Product Demo Harness. `make ui-e2e-product-demo` now runs a
  focused execution-backed browser demo for a non-demo workspace
  (`local-pantry-demo`). The test creates the workspace through the sidebar,
  simulates controlled initialization evidence, submits a raw idea in the UI,
  requests intake execution, runs real Platform wrappers against a real
  SpecGraph checkout outside browser authority, saves clarification answers in
  SpecSpace, requests continuation, verifies the generated candidate artifacts,
  captures screenshots and Playwright trace/video output, and writes a durable
  `graphspace/test-results/product-demo/product-demo-report.json`. The report
  verifies that raw idea text is not published, the public summary/workspace id
  are present, `team-decision-log` fixture terms do not leak into the new
  candidate, and SpecGraph's product demo depth baseline is met with actors,
  domain events, policies, workflow edges, requirements, acceptance criteria,
  and non-missing Idea Maturity. `make ui-e2e-product-demo-live` runs the same
  harness headed with a short pause for live inspection.
- Idea Maturity structural depth observations. Product Workspace now surfaces
  Metrics-owned `groups.candidate_structure_depth` as a diagnostic panel inside
  Idea Maturity, showing actors, commands, domain events, policies,
  constraints, topology edges, workflow edges, requirements, and acceptance
  criteria without turning them into a score or a promotion gate.
- Idea Maturity structural depth interpretation. Product Workspace now renders
  SpecGraph-owned candidate-structure readiness explainers next to the raw depth
  counts, so shallow candidate narratives can point operators toward candidate
  overview/topology review while Metrics remains objective telemetry.
- Depth-driven clarification requests. SpecGraph proposal `0207` can turn
  shallow `groups.candidate_structure_depth` observations into ordinary
  `idea_to_spec_clarification_requests` with `event_storming_hints.*` targets.
  SpecSpace reuses the Product repair review lane and saves these answers as
  SpecSpace-owned repair drafts with typed `entries[]`, so existing
  import/rerun machinery can apply them as review-only event-storming hints.
  Browser authority remains request-only; SpecSpace still does not execute
  SpecGraph, mutate specs, write Ontology packages, or create Git artifacts.
- Safe workflow-topology repair. SpecGraph proposal `0208` handles the next
  structural-depth follow-up without asking operators to patch existing graph
  edges directly. When a candidate has commands plus actors/events/policies or
  constraints but no workflow edges, clarification requests target
  `event_storming_hints.workflow_relations` and expect typed relation rows such
  as `actor_triggers_command` or `command_emits_event` between already-published
  event-storming refs. SpecSpace preserves these rows in repair/intake answer
  drafts and keeps them request-only; SpecGraph validates relation type,
  endpoint existence, and endpoint kind before previewing review-only workflow
  topology edges.
- Depth repair effect visibility. Product Workspace now reads SpecGraph
  proposal `0209` `structural_depth_delta` from rerun materialization and shows
  a read-only `Depth impact` surface inside Idea Maturity. Operators can see
  before/after counts, added event-storming refs, added workflow relations,
  remaining shallow dimensions, and review-only boundary evidence without
  treating depth as a score, gate, or execution authority.
- Raw idea entry state in SpecSpace.
- Browser E2E for raw idea submit into SpecSpace-owned mutable state.
- Workspace and `guided_flow` refresh after successful raw idea submit.
- Backend-managed workspace initialization execution. SpecSpace can expose an
  opt-in backend endpoint that calls the allowlisted Platform workspace
  initialization operation, writes the Platform execution report, and refreshes
  Product Workspace lifecycle from the resulting artifact. Browser authority is
  still limited to requesting the SpecSpace backend operation.
- Backend-managed real idea intake execution. After the user saves raw idea
  state and requests controlled intake, SpecSpace can expose an opt-in backend
  endpoint that calls the allowlisted Platform
  `product-real-idea-intake execute-requested` operation, writes the Platform
  execution report, and refreshes Product Workspace lifecycle into
  clarification/intake state. Browser authority remains request-only.
- Backend-managed real idea answer continuation execution. After clarification
  answers are saved and the operator requests continuation, SpecSpace can expose
  an opt-in backend endpoint that calls the allowlisted Platform
  `product-real-idea-continuation execute-requested` operation, writes the
  Platform execution report, and refreshes Product Workspace lifecycle toward
  candidate review state. Browser authority remains request-only and SpecSpace
  does not apply answers directly.
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
- Backend-managed repair rerun request gate execution. After repair drafts are
  saved, imported, and the operator requests a repair rerun, SpecSpace can
  expose an opt-in backend endpoint that calls the allowlisted Platform
  `product-repair-rerun request-gate` operation, writes the request-gate and
  Platform execution reports, and refreshes the guided repair path from the
  resulting artifacts. Browser authority remains request-only and this step
  does not execute the repair rerun itself.
- Backend-managed repair rerun execution. After the request gate is ready,
  SpecSpace can expose an opt-in backend endpoint that calls the allowlisted
  Platform `product-repair-rerun plan` and
  `product-repair-rerun execute --build-repaired-handoff` operations, writes
  the plan/execution reports, and refreshes the guided repair path toward
  repaired handoff / publication. Browser authority remains request-only; this
  does not publish the public bundle, create Git artifacts, or mutate
  canonical specs/Ontology.
- Backend-managed repair rerun publication. After successful repair rerun
  execution, SpecSpace can expose an opt-in backend endpoint that calls the
  allowlisted Platform `product-repair-rerun publish` operation, writes the
  publication report, and refreshes the guided repair path from the published
  public-safe bundle evidence. Browser authority remains request-only; this
  does not create Git artifacts, publish read models, or mutate canonical
  specs/Ontology.
- Backend-managed candidate approval materialization. After the repaired
  candidate is approval-ready, repair rerun artifacts are published, and the
  operator records approval intent, SpecSpace can expose an opt-in backend
  endpoint that calls the allowlisted Platform
  `product-candidate-approval approve` operation, writes the candidate approval
  gate, `candidate_approval_decision.json`, and Platform approval execution
  report, then refreshes the guided approval path. Browser authority remains
  request-only; this does not create Git artifacts, open PRs, publish read
  models, or mutate canonical specs/Ontology.
- Backend-managed promotion request creation. After Platform materializes a
  ready `candidate_approval_decision.json`, SpecSpace can expose an opt-in
  backend endpoint that calls the allowlisted Platform
  `product-candidate-promotion request` operation and writes
  `graph_repository_promotion_request.json`. Browser authority remains
  request-only; this does not execute Git Service, create commits, open PRs,
  publish read models, or mutate canonical specs/Ontology.
- Backend-managed promotion execution dry-run. After a ready promotion request
  exists, SpecSpace can expose an opt-in backend endpoint that calls the
  allowlisted Platform `product-candidate-promotion execute --dry-run
  --open-review-dry-run` operation and writes product/Git Service execution
  reports. Browser authority remains request-only; this does not create
  worktrees, commits, PRs, read models, or mutate canonical specs/Ontology.
- Backend-managed promotion review execution. After a promotion dry-run report
  exists and the operator explicitly confirms review creation, SpecSpace can
  expose an opt-in backend endpoint that calls the allowlisted Platform
  non-dry-run `product-candidate-promotion execute` operation and writes the
  product/Git Service execution reports. Browser authority remains request-only;
  this may create the candidate worktree/branch, candidate commit, and review PR
  through Platform/Git Service, but it does not merge PRs, publish read models,
  or mutate Ontology packages.
- Backend-managed review-status inspection. After a non-dry-run promotion
  execution has opened a review PR, SpecSpace can expose an opt-in backend
  endpoint that calls the allowlisted Platform
  `product-candidate-promotion review-status` operation and writes
  `product_candidate_promotion_review_status_report.json`. Browser authority
  remains request-only; this does not merge PRs, publish read models, create
  Git artifacts, or mutate canonical specs/Ontology.
- Backend-managed read-model publication. After review status reports a merged
  product promotion PR, SpecSpace can expose an opt-in backend endpoint that
  calls the allowlisted Platform `product-candidate-promotion
  publish-read-model` operation and writes
  `product_candidate_promotion_read_model_publication_report.json`. Browser
  authority remains request-only; this only publishes the public read model and
  does not merge PRs, create Git artifacts, or mutate canonical specs/Ontology.
- Guided approval and promotion is now a dedicated Product Workspace path rather
  than a scattered set of approval readiness and controlled-promotion sections.
  The UI shows approval intent, Platform approval materialization, promotion
  request, promotion execution, repository review, read-model publication,
  blockers, evidence refs, and target anchors without giving the browser
  Platform/Git Service execution authority.
- Product Workspace lifecycle overview API/UI slice now acts as the top landing
  layer over the guided paths. It summarizes the current phase, progress,
  blockers, last successful handoff, confidence, and one next safe action across
  Workspace, Intake, Clarification, Candidate, Repair, Approval, and Publication
  without giving the browser execution or mutation authority. Route-only
  workspaces now point to the workspace creation request section before later
  lifecycle sections.
- Fresh workspace focus mode now keeps early workspaces on the current stage
  instead of rendering the full diagnostics wall. Route-only / creation-requested
  workspaces focus on creation and initialization; initialized/intake
  workspaces focus on raw idea intake; clarification workspaces focus on the
  guided clarification path. Later candidate, repair, approval, publication, and
  technical artifact sections stay accessible under collapsed diagnostics /
  advanced artifacts.
- Playwright lifecycle overview transition coverage now verifies the overview
  across route-only, workspace creation requested, initialized, clarification,
  repair, approval, and published states. It checks the current phase, next safe
  action anchors, early focus mode, and late full lifecycle sections.
- Execution-backed arbitrary-route browser smokes now create the product
  workspace request through the sidebar `New workspace` wizard instead of
  seeding `product_workspace_creation_requests.json` with a direct API POST.

## Next Tasks

### Immediate Priority: Quality-Guided Next Safe Action Ranking

Status: implemented.

The Product Workspace now has multiple accurate guided paths: workspace
initialization, real idea intake, clarification continuation, repair rerun,
approval, promotion, publication, managed operations, Idea Maturity, candidate
overview, and depth impact. The remaining UX risk is action competition: several
sections can publish a valid `next_safe_action` at the same time, and the top
overview currently chooses one action without a single lifecycle-wide priority
model.

Implemented behavior:

- Product Workspace exposes one primary next safe action plus a bounded list of
  secondary follow-up actions.
- Ranking is deterministic and conservative:
  stale or unsafe state hygiene before failed managed operations; failed
  managed operations before blocking clarification/repair; blocking
  clarification/repair before structural-depth improvement; structural-depth
  improvement before approval; approval before promotion; promotion before
  publication; publication before demo/presentation polish.
- The primary action never grants authority. It links to an existing section,
  request surface, or managed operation row and carries public-safe evidence
  refs only.
- UI copy distinguishes "must fix before lifecycle can advance" from
  "quality/depth improvement recommended".
- Backend and frontend tests cover conflicting signals, especially:
  stale mutable state plus structural-depth hints, failed Platform execution plus
  approval-ready candidate, blocking repair plus promotion readiness, and
  depth-only improvement after all blockers are closed.

This is a SpecSpace-only slice. Existing SpecGraph and Platform reports already
carry the evidence needed to rank safely.

The additive `product_workspace_overview.action_ranking` contract now exposes
one primary action and at most three secondary actions. The existing
`next_safe_action` and `primary_target_section` fields mirror the selected
primary action for backward compatibility. Ranking uses the existing
workspace-state hygiene, managed-operation reports, guided stages, and
SpecGraph-owned structural-depth explainers; it does not create a score, gate,
command surface, or execution authority. Backend and frontend regression tests
cover the four conflict cases above, and the overview UI labels required,
recommended-quality, and optional actions distinctly.

### Immediate Priority: Fallback-Free Real Idea Clarification Templates

Status: implemented with SpecGraph proposal `0210`; execution-backed browser
verification is part of the completion gate.

`make ui-e2e-product-demo` now disables deterministic clarification fallback.
SpecGraph emits workspace-bound `answers_required`,
`clarification_not_required`, or `clarification_blocked` outcomes, and SpecSpace
renders those outcomes without treating a missing template as a safe skip.

Acceptance criteria:

- SpecGraph real intake emits either:
  `real_idea_answer_template` with browser-answerable fields, or an explicit
  `clarification_not_required` state with enough evidence to continue safely.
- SpecSpace treats missing browser-answerable fields as a producer/gate problem,
  not a UI fixture problem.
- The product demo harness runs strict by default without
  `SPECSPACE_PRODUCT_DEMO_ALLOW_CLARIFICATION_FALLBACK=1`.
- If a fallback remains for debugging, it is opt-in, clearly labelled as
  non-product proof, and excluded from the normal `make ui-e2e-product-demo`
  success path.
- The final smoke still proves that the generated candidate belongs to the new
  workspace and not to `team-decision-log`.

### 0. Product Workspace Overview Follow-Ups

Status: mostly closed; lifecycle coverage still has explicit follow-up gaps.

Acceptance criteria:

- Add Playwright coverage that asserts overview transitions through:
  wizard -> initialization, initialized -> raw idea, intake -> clarification,
  repaired handoff -> approval, and publication -> published.
  Partially done through lifecycle overview transition e2e. Coverage now
  exercises route-only, creation-requested, initialized, clarification, repair,
  approval, and published states. Add explicit `intake` and `candidate_review`
  transition cases before closing this follow-up completely.
- Reduce the fresh-workspace "wall of empty sections" below the overview, while
  preserving access to diagnostic sections when they have evidence or blockers.
  Done through Fresh Workspace Focus Mode.
- Keep the overview inspect/request-only; it may link to existing request
  surfaces, but must not execute Platform, SpecGraph, Git Service, or mutate
  specs/ontology/read models.
  Done.

Follow-up note:

- Sidebar wizard coverage now exists for creating and opening a selected product
  workspace route. Some execution-backed arbitrary-route smokes still seed
  workspace creation requests through direct backend API setup so they can focus
  on downstream Platform/SpecGraph handoffs. Converting those mutating setup
  calls to wizard-driven setup remains open follow-up coverage.

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
  Done for workspace creation in the execution-backed arbitrary-route smokes;
  remaining direct writes are harness validation, external publication setup, or
  operations whose browser form is intentionally absent.
- Keep repair/promotion command hints read-only until Platform owns each
  controlled execution wrapper. The repair rerun request gate, full requested
  repair rerun execution, repair rerun publication, candidate approval
  materialization, promotion request creation, and promotion execution dry-run
  are now covered by backend-managed Platform wrappers. Non-dry-run promotion
  review execution is covered as an explicit confirmed action after dry-run
  evidence. Review-status inspection is covered after non-dry-run promotion
  execution, and read-model publication is covered after merged review status.
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

Status: closed, including the durable workspace binding rollout across
Platform, SpecGraph, and SpecSpace.

The `New workspace` wizard records backend-owned workspace creation request
state before opening a product workspace route. Platform-owned initialization
remains a separate controlled handoff and now publishes the durable binding
used by later managed operations.

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
  Done for SpecSpace-owned operator intent and controlled Platform-owned
  initialization execution. Durable artifact-base/state-namespace/run-dir and
  repository identity binding is implemented and verified through the v1
  initialization contract.
- The backend allocates or resolves a durable workspace id, display name,
  artifact base, SpecSpace state namespace, and run-dir binding.
  Implemented for the v1 initialization binding: Product Workspace exposes a
  sanitized projection, local providers resolve product runs from the binding,
  and managed readiness blocks missing or invalid bindings. Downstream repair,
  approval, promotion, review, and publication operations preserve the binding
  context. Execution-backed Playwright covers real initialization, browser
  reload, workspace-scoped runs, and raw-idea privacy.
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
  catalog/run-dir binding validation now rejects foreign, stale, or mismatched
  binding inputs before managed execution.
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
  Done for read-only visibility and opt-in backend-managed execution: SpecSpace
  exposes request status, requested operation, readiness, and idempotency
  evidence, and can call the allowlisted Platform initialization command when
  the backend is explicitly started with Platform execution enabled. The
  browser still does not execute Platform directly.
- The real idea intake surface can execute the controlled Platform intake
  handoff after the operator has saved raw idea state and requested intake
  execution. Done for opt-in backend-managed execution: SpecSpace validates the
  current workspace request, raw idea entry state, and workspace initialization
  report, then calls the allowlisted Platform
  `product-real-idea-intake execute-requested` wrapper. The browser still only
  requests the SpecSpace backend operation and does not execute Platform or
  SpecGraph directly.
- The guided clarification path can execute the controlled Platform answer
  continuation handoff after the operator has saved accepted answers and
  requested continuation. Done for opt-in backend-managed execution: SpecSpace
  validates the current continuation request, answer state, intake execution
  report, and workspace initialization report, then calls the allowlisted
  Platform `product-real-idea-continuation execute-requested` wrapper. The
  browser still only requests the SpecSpace backend operation and does not apply
  answers or run SpecGraph directly.
- The initial idea captured by the wizard is available only as selected
  workspace local UI state and is not exposed by the standalone
  `product-workspace-creation-requests` endpoint or public artifacts.
  Done: the direct state endpoint keeps root intent redacted, while the selected
  Product Workspace read model can prefill the raw idea draft.

Implemented repositories:

- SpecSpace: workspace creation UI/state projection, route status, hygiene,
  initialization request status, raw idea intake request, and clarification
  continuation request surfaces.
- Platform: controlled workspace initialization, real idea intake execution, and
  answer continuation wrappers.
- SpecGraph: existing real idea intake and candidate-source contracts used by
  the controlled execution wrappers.

### 12. Controlled SpecSpace Authority Transition

Status: strategy active; first managed-operation chain implemented for
product idea-to-spec workspace lifecycle.

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

Implemented in the current Product Workspace stack:

- UI actions save operator-owned request state or call SpecSpace backend-managed
  endpoints; React components do not execute Platform, SpecGraph, Git Service, or
  Ontology tools directly.
- Backend-managed endpoints exist for workspace initialization, real idea intake
  execution, answer continuation, repair rerun gate/execution/publication,
  candidate approval, promotion request, promotion dry-run, promotion review,
  review-status inspection, and read-model publication.
- Each managed endpoint is scoped to the current workspace, uses an allowlisted
  Platform wrapper, and returns durable execution/report evidence that the
  Product Workspace reads back through the normal artifact surface.
- Playwright coverage exercises the managed lifecycle through the user-facing
  Product Workspace controls, including workspace wizard creation, intake,
  clarification continuation, repair, approval, promotion dry-run/review, and
  publication states.
- Hosted managed mode now routes the same endpoints through an authenticated
  Platform enqueue/status service. SpecSpace stores compact queue state and
  displays transport status separately from authoritative Platform report
  readiness. Local and hosted executors are mutually exclusive.
- Platform now provides both the isolated SQLite queue used by local/browser
  tests and a PostgreSQL queue/store for production deployment. The service and
  long-running worker expose health/heartbeat evidence, and secret files keep
  database credentials and bearer tokens out of child process arguments.
- The execution-backed product demo now has a hosted variant that drives the
  real Platform HTTP service and worker from the SpecSpace browser flow. It
  requires authoritative Platform reports before advancing the lifecycle and
  verifies workspace binding, clarification continuation, candidate identity,
  public-safe raw-idea handling, and absence of demo-workspace fallback.

Remaining scope:

- Keep adding managed endpoints only when the upstream Platform/SpecGraph
  operation already has a typed contract, source-ref validation, idempotency, and
  report-only authority boundary.
- Keep write-capable browser actions out of scope. If a future operation needs
  stronger authority, add it as a backend/Platform capability first, then expose a
  request/execute surface with audit evidence.
- Keep external producer contracts synchronized when report schemas or source
  refs change, because the UI projections are intentionally strict about stale or
  write-capable artifacts.
- Exercise the documented local-to-hosted cutover and rollback procedure in a
  deployment-like recovery drill, including expired leases, quarantined
  consume-on-attempt work, and queue drain evidence.
- Define operational SLOs and alerts for queue age, lease recovery,
  quarantined requests, worker heartbeat, and authoritative report publication
  latency without treating queue success as lifecycle completion.

Non-goals:

- Browser-side execution of SpecGraph, Platform, Git Service, or Ontology tools.
- Direct writes to canonical specs, ontology packages, branches, PRs, or read
  models from React components.
- Treating a UI route as proof that a product workspace exists.

### 13. Fresh Workspace Focus Mode

Status: closed.

Fresh product workspaces no longer render as a full dashboard of empty or future
sections. The Product Workspace uses `product_workspace_overview.status` to
choose a focused early surface:

- `route_only` / `creation_requested`: overview, guided workspace
  initialization, and workspace creation status;
- `initialized` / `intake`: overview, initialization evidence, and raw idea
  entry;
- `clarification`: overview, real idea intake, and guided clarification path.

Candidate, repair, approval, publication, and technical artifact sections stay
accessible, but they are collapsed under `Diagnostics / advanced artifacts`
until the workspace reaches the corresponding lifecycle evidence.

Acceptance criteria:

- Fresh workspaces expose the current guided path and relevant form before
  diagnostics.
  Done.
- Future lifecycle sections remain accessible without becoming the primary
  screen.
  Done.
- Component coverage proves route-only, initialized/intake, and clarification
  focus ordering.
  Done.

Follow-up:

- Add the remaining Playwright lifecycle overview transition cases for `intake`
  and `candidate_review`. Current coverage exercises route-only,
  creation-requested, initialized, clarification, repair, approval, and
  published states.
- Product demo presentation view is now a read-only projection at
  `?view=demo`. It keeps the operator console intact while presenting the
  workspace story, lifecycle timeline, candidate summary, domain understanding,
  controlled execution evidence, and next safe action for pitch/live demo use.
  The product demo harness now captures `08-demo-view.png` and the live target
  pauses on the presentation projection rather than the dense operator console.
- Demo content quality is now covered by the local product demo harness. The
  presentation view renders a compact story sequence: original operator-owned
  idea, interpreted domain frame, generated candidate evidence, and next safe
  action. The E2E assertion checks that this story comes from the fresh
  `local-pantry-demo` workspace and not from the Team Decision Log demo
  artifacts.

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
- `make ui-e2e-product-demo` is the focused local proof for a UI-started
  product demo. It sets
  `SPECSPACE_PRODUCT_DEMO_ALLOW_CLARIFICATION_FALLBACK=0`, requires the
  SpecGraph producer template to match the new workspace, and records
  `clarification_fallback_used=false`. Direct Playwright debugging may still opt
  into the deterministic fixture with value `1`, but that run is explicitly not
  accepted as product proof.
- Product demo runbook and production demo smoke are covered. The local runbook
  documents `make ui-e2e-product-demo`, `make ui-e2e-product-demo-live`, output
  artifacts, fallback policy, and `?view=demo`. Production smoke now checks that
  the product presentation route returns the SpecSpace shell without legacy
  ContextBuilder markers while preserving `read_only` managed mode.
- The fallback-free E2E contract is authoritative through browser interaction,
  generated-template assertions, and `product-demo-report.json`. The current
  intermediate full-page screenshots keep the dense operator shell in frame and
  do not focus the clarification form reliably. A presentation-only harness
  follow-up should capture the clarification section itself; this does not block
  the execution-backed lifecycle proof.
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
- Feature Passport: external authority for future feature evidence receipt,
  ladder, and claim-evaluation semantics. SpecSpace Feature Evidence UI work
  must wait for SpecGraph safe derived artifacts and producer schemas aligned
  with `FP-RFC-0001` `0.2.0`.
- Agent Surface: future action/receipt/grant vocabulary for managed operations
  once the protocol draft is stable enough to version against.

When a cross-repo task lands, keep this workplan focused on the remaining
SpecSpace-facing behavior rather than duplicating full PR histories.
