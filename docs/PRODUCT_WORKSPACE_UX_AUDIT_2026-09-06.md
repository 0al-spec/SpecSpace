# Product Workspace: Task-First Authoring UX Audit

Date: 2026-09-06
Status: initial observations retained; authoring implementation and bounded
Chrome verification are recorded in the implementation follow-up below.

## Scope And Evidence

The operator asked whether the actual local UI guides a person through drafting
and repair, rather than presenting disconnected artifact panels.

The local Mac profile was stopped and started with the official Platform Make
targets. Existing persistent operator state was retained. The walkthrough used
Safari computer use and the existing authenticated session, not API requests as
a substitute for UI testing.

Checked revisions:

- SpecSpace: `1e227af8c625cf61eab6900eda4082d6450be60b`.
- Platform: `6add7082ee0ef655ac9dccca7aaf6190c2da7c37`.
- SpecGraph: `af7524dac1a7727172e4316500b945980cf42089`.

Screens inspected: normal canvas/sidebar layout, expanded Product Workspace,
overview and timeline, guided repair path, saved draft forms, rerun/publication
status, specification picker, Demo View, and the new-workspace wizard.
The wizard received synthetic unsaved text and was cancelled. No workspace was
created and no user draft was submitted or overwritten. No new repair execution,
approval, promotion, or Git action was performed.

Evidence consists of screenshots captured during the Safari conversation and
source inspection. Screenshots containing private original idea text are not
committed. Native accessibility did not expose the large operator panel's inner
controls reliably, and coordinate clicks/scrolling returned `noWindowsAvailable`.
The walkthrough therefore used accessible native controls, keyboard paging, and
Safari Find as well as screenshots. This tooling limitation is not classified
as an application defect. There are no DOM rectangle measurements and no claim
of exhaustive keyboard accessibility, fresh lifecycle E2E, or post-save behavior
verification in this audit.

## Current State Observed

The saved workspace has a completed repair, not an ongoing failed rerun:

- guided repair: `repaired_ready`, open answers `0`, drafts `usable`;
- request `consumed`, gate `usable`, execution `completed`;
- repair publication `published`, missing public outputs `0`;
- overview: phase `Approval`, progress `5/7`, status `blocked`;
- maturity: `approval_ready`; approval intent is still a required follow-up.

The data needed for a useful resume screen already exists. The problem is how
current work, original-session history, recommendations, and execution details
are combined on screen.

## Findings

### UX-01: Authoring Is A Utility Panel, Not The Main Task

The normal route gives most of its space to a graph and a wide mostly empty
sidebar. The authoring surface is a narrow right-hand utility panel. Expanding
it helps width, but the 16 summary metrics, status strip, and authority fields
remain above the independently scrolling task area. In the captured expanded
view they occupy roughly half of the application height.

Evidence in code: `IdeaToSpecWorkspacePanel.tsx` renders summary, surface header,
and posture before `styles.entries`; `OntologySemanticReviewPanel.module.css`
gives the earlier blocks fixed flex sizing while only `.entries` scrolls.

Impact: operators spend screen space and attention on diagnostics before they
can read or answer a question. The initial route labels the project with a
generated identity instead of providing memorable idea context.

### UX-02: Several Statuses Compete To Describe The Same Moment

The visible header says `blocked` while repair is ready/published and maturity
is `approval_ready`. Overview includes three blockers, including future
promotion and dry-run prerequisites. Its headline recommends topology repair;
the required approval follow-up is secondary. The recommendation is explicitly
not a gate, but that distinction requires reading several separate blocks.

This ordering matches the implemented quality-before-approval ranking. It is a
product-policy tradeoff, not proof that an execution gate failed.

Required change: show the current required task first, optional quality work in
a separate lane, and later prerequisites as upcoming steps rather than making
the whole project look broken. Keep real safety/runtime blockers dominant.

### UX-03: Historical Answers Still Look Like Outstanding Work

A source-session aggregate card simultaneously shows
`covered_by_repair_context`, `answer_needed`, and an empty `Save draft` form.
Other cards show `open` and `draft_saved` with `Update draft`, despite the guided
repair path reporting zero open answers and successful publication.

The editor currently computes its extra badge from draft existence alone
(`draft ? "draft_saved" : "answer_needed"`). Draft presence does not establish
whether a current task remains or whether a matching rerun applied the answer.

Required change: separate the source request's historical status from current
effective task state. Use matching session/revision/digest evidence; never hide
a reopened or invalidated question merely because an old draft exists.

### UX-04: Counts And Publication Feedback Need A Common Meaning

Guided repair displays `Answers 19/8` and `Ontology decisions 11/12`, while open
answers and open ontology are zero. These may count different sets, but the UI
does not name those sets. The publication block says `published` while a child
execution step still says `blocked until publication`.

Required change: name the units, distinguish accepted aggregate evidence from
individual targets, and label historical execution steps. Derive effective
completion only from matching authoritative publication evidence; do not
rewrite historical reports or suppress actual failures.

### UX-05: Saving, Applying, And Reviewing Are Separate Destinations

The answer editor, rerun request control, execution report, publication result,
approval readiness, and specification picker live in separate sections. The
rerun area exposes a Make command, import status, journal status, digests, and
Platform step names. The operator must understand the pipeline to connect them.

There is no prominent answer-to-result journey: context/question, saved answer,
validation, matching rerun, affected specification. The specification picker is
useful, but its default empty selection and long artifact paths do not tell the
returning author what changed because of their answers. Opening a specific YAML
row was not verified because of the native automation limitation.

### UX-06: Entry And Presentation Do Not Continue Into Authoring

The new-workspace wizard is more focused than the main panel, but its third
numbered column is an authority explanation, not a user task. Its command is
`Create workspace request`, exposing implementation terminology at entry.

Demo View surfaces original idea context and a compact timeline, but it is a
read-only presentation view, not a place to continue drafting. It also repeats
the optional topology recommendation as the next action. Do not solve authoring
by sending users to Demo View and back.

## Proposed Experience

Use one task-first authoring page, initially for repair of an existing candidate:

```text
Project name / private idea context / saved state
Questions -> Review answers -> Update candidate -> Review specification

Current step: one question or one review task
Context: affected requirement, reason for question, existing answer
Progress: named outstanding/saved/validated/applied counts
Primary action: save and next, or the next permitted controlled operation
Secondary: previous, review saved answers, optional improvements

Additional views: Specification | Graph | History | Diagnostics
```

This is a resumable workbench with wizard-style guidance, not a modal that forces
linear completion or hides previous work. Do not add a sixth guided panel.
Do not implement another independent lifecycle state machine in the frontend.
Reuse the existing projections and make inconsistencies explicit upstream.

The update step can initially group existing explicit request/gate/execute/
publish controls without changing execution behavior. A future single command
must be a separately reviewed bounded backend operation with durable step state,
idempotency, timeout/recovery rules, and existing allowlists. No implicit retry
of consume-on-attempt operations and no automatic approval or Git review.

## Delivery And Acceptance

1. Reconcile current tasks versus historical evidence and optional advice.
   Regression cases: published repair, genuine follow-up, changed draft, stale
   or foreign publication, unmeasured depth, and failed operation.
2. Build the task-first shell in the UI catalog, then wire it to the existing
   workspace. Returning users see project context and one actionable task in
   the first viewport; diagnostics are not required to orient themselves.
3. Add the contextual answer inbox with save-and-next and explicit persistence
   states. Reload retains saved answers; leaving an unsaved edit is explained;
   history remains accessible without making completed questions look open.
4. Group controlled update progress in a stable step. A successful request does
   not pretend execution completed; timeouts explain the permitted recovery.
5. Connect the applied answer set to the matching candidate revision and review
   result. Show unresolved tasks and optional improvements separately, then
   offer approval as an explicit subsequent decision.

For each slice: verify isolated states visually, add focused state tests, and
repeat a real Safari operator walkthrough. Execution-backed E2E is necessary
when changing operation sequencing, not a replacement for usability review.

The next implementation should start with steps 1 and 2, not a new orchestration
framework or a rewrite of all lifecycle panels. Existing operator state must
remain intact; the audit authorizes no migration or production rollout.
## Implementation Follow-Up

The initial observations below describe the pre-change Safari audit. A subsequent
implementation added a full-width authoring surface, Questions / Update candidate /
Specification / Diagnostics views, current-vs-source-history grouping, mandatory
action priority, and exact target-to-spec navigation. All panes stay mounted to
preserve unsaved fields. Existing managed execution guards remain unchanged.

Bounded authenticated Chrome verification confirmed the required approval next
step and source session history on the existing local workspace without saving
answers or executing operations. Desktop and narrow-viewport screenshots were
inspected locally and are not checked in. Focused Playwright fixture tests cover
tab persistence, keyboard navigation and requirement links.

Validation of a particular saved answer revision is still not a producer-owned
receipt. The interface distinguishes saved draft, reported accepted answer and
materialized target evidence instead of asserting per-answer application. The
workplan records this contract limitation and optional background endpoint errors.
