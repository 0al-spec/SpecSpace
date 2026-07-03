# Idea-to-Spec Product Workspace Workplan

Status: active planning
Updated: 2026-07-03

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
  -> SpecSpace refreshes the Product Workspace lifecycle
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

Status: partially closed. Browser E2E now saves a template-backed intake
clarification answer through the Product Workspace UI, verifies the
SpecSpace-owned answer state, checks that missing required refs keep the save
action disabled, and verifies that continuation readiness only appears after
external answer continuation publication. Remaining work is to replace the
projected continuation publication with a real Platform/SpecGraph subprocess in
the E2E harness.

Latest execution-backed finding: Platform needs a first-class
`product-real-idea-continuation execute --answer-state <SpecSpace state>` handoff
so the operator-owned answer state does not have to be copied into a SpecGraph
run directory by hand. After that handoff exists, the next blocker is semantic:
the generated real-idea answer template and the SpecSpace structured answer UI
must produce answers that SpecGraph imports as continuation-ready rather than
`specspace_real_idea_answers_review_required`.

Execution-backed follow-up preconditions:

- The harness must run `product-real-idea-continuation execute` or an equivalent
  fixed Platform wrapper outside the browser.
- The produced import preview and continuation report must be copied or served
  from the same artifact base that `/api/v1/idea-to-spec-workspace` reads.
- The browser must observe the update through runs-watch, not `page.reload()`.

Acceptance criteria:

- User fills clarification answers in SpecSpace. Done.
- SpecSpace-owned answer state is saved and validated. Done for the browser
  save path.
- Import preview / continuation lane is visible. Done with projected
  publication; still needs an execution-backed E2E slice.
- Invalid or missing answers produce clear UI diagnostics. Partially covered
  for required template refs; server-side invalid-answer surfacing still needs
  execution-backed coverage.

### 4. Artifact Refresh And Runs-Watch Hardening

Make the Product Workspace update predictably after external Platform/SpecGraph
execution.

Status: partially closed. Browser E2E now emits a runs-watch `change` event and
verifies that the Product Workspace refetches the projected intake execution and
answer continuation state without `page.reload()`. Remaining work is to exercise
the same refresh path with real Platform/SpecGraph output artifacts.

Acceptance criteria:

- UI refreshes relevant idea-to-spec surfaces after artifact changes. Done for
  projected runs-watch publication.
- Manual reload is not the normal happy path. Done for the UI-started browser
  smoke projection.
- Workspace artifact base, SpecSpace state directory, and SpecGraph run
  directory drift are visible as diagnostics.

### 5. Operator Handoff UX

Make controlled handoffs understandable without giving SpecSpace execution
authority.

Acceptance criteria:

- Copyable command hints are paired with source refs and expected outputs.
- Last execution report is shown next to the current lifecycle stage.
- Next safe step, blockers, and authority boundary stay aligned.

## Known Friction

- UI submit persists raw idea entry, but does not execute the intake pipeline.
- E2E currently proves entry, execution-backed intake execution when local
  Platform/SpecGraph checkouts are provided, projected continuation readiness,
  clarification answer save, and runs-watch refresh. Continuation after saved
  answers is not yet execution-backed.
- Some browser tests still use a fixture-backed `/api/v1/idea-to-spec-workspace`
  projection while only mutable state APIs are real.
- Local state directory, SpecGraph run directory, and product workspace artifact
  base can drift during manual smoke runs.
- Continuation/import-preview after saved intake answers is covered by
  projection but not yet by execution-backed browser E2E.

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
