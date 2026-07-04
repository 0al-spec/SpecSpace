# Idea-to-Spec Product Workspace Workplan

Status: active planning
Updated: 2026-07-04

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

- Platform now has a first-class
  `product-real-idea-continuation execute --answer-state <SpecSpace state>`
  handoff, so operator-owned answer state does not need to be copied into a
  SpecGraph run directory by hand.
- Platform rebases answer-state source refs to the selected SpecGraph run dir
  and derives the missing top-level workspace id from answer rows when
  SpecSpace persisted state was written before a filtered read.
- SpecSpace expands generic template `value` fields using
  `value_templates_by_action`, so event-storming answers save as `entries` and
  domain-frame answers save as `refs`.

Execution-backed follow-up preconditions:

- The harness runs `product-real-idea-continuation execute` outside the browser.
  Done.
- The produced import preview and continuation report are copied into the same
  artifact base that `/api/v1/idea-to-spec-workspace` reads. Done for the local
  e2e harness.
- The browser observes the update through runs-watch, not `page.reload()`. Done.

Acceptance criteria:

- User fills clarification answers in SpecSpace. Done.
- SpecSpace-owned answer state is saved and validated. Done for the browser
  save path.
- Import preview / continuation lane is visible. Done with projected and
  execution-backed publication.
- Invalid or missing answers produce clear UI diagnostics. Partially covered
  for required template refs and template shape mismatch; broader server-side
  invalid-answer surfacing can still improve.

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
request, and dry-run promotion execution.

Acceptance criteria:

- Copyable command hints are paired with source refs and expected outputs. Done
  for the UI-started chain through Git dry-run.
- Last execution report is shown next to the current lifecycle stage. Done for
  intake, answer continuation, repair rerun, approval, promotion request, and
  promotion execution surfaces.
- Next safe step, blockers, and authority boundary stay aligned. Done for the
  UI-started chain through dry-run promotion execution.

Follow-up scope:

- Replace remaining direct API writes in the e2e harness with browser-level UI
  interactions where the Product Workspace already has forms.
- Keep repair/promotion command hints read-only until Platform owns each
  controlled execution wrapper.

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

## Known Friction

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
  The runtime now reports this through workspace state hygiene; the remaining
  work is documentation/runbook clarity, not a hidden UI mutation.

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
