# ContextBuilder Workplan

## Phase 1: Reliability Foundation

#### CTXB-001: Add automated smoke coverage for viewer and API
- **Description:** Expand basic verification so changes to the HTTP API and static viewer shell are caught before manual testing.
- **Priority:** P0
- **Dependencies:** None
- **Parallelizable:** no
- **Acceptance Criteria:**
  - Automated tests cover file listing and file read/write/delete behavior against a temporary dialog directory
  - A smoke check verifies the viewer shell loads without missing required DOM hooks
  - `make test` passes locally without external services

#### CTXB-002: Harden dialog validation and save semantics
- **Description:** Validate incoming JSON payloads and prevent malformed dialogs from being persisted silently.
- **Priority:** P0
- **Dependencies:** CTXB-001
- **Parallelizable:** no
- **Acceptance Criteria:**
  - Server rejects invalid filenames and malformed dialog payloads with actionable error messages
  - Required dialog fields are normalized or validated before save
  - Regression tests cover invalid write scenarios

## Phase 2: Editing Workflow

#### CTXB-003: Improve file navigation for larger dialog folders
- **Description:** Add search, sorting, and clearer metadata in the sidebar so large import folders remain usable.
- **Priority:** P1
- **Dependencies:** CTXB-001
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - Sidebar supports filtering files by filename
  - Files can be sorted by name and modification time
  - Current selection and file metadata remain clear on refresh

#### CTXB-004: Add safer branch editing UX
- **Description:** Reduce accidental overwrites and make branch creation more transparent during editing.
- **Priority:** P1
- **Dependencies:** CTXB-002
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - Editor clearly distinguishes create-vs-overwrite actions
  - Unsaved changes are surfaced before destructive actions
  - Branch metadata shown in the editor matches what will be written to disk

## Phase 3: Operational Polish

#### CTXB-005: Document development and release workflow
- **Description:** Capture the local development loop, content folder setup, and Flow-based task process for contributors.
- **Priority:** P2
- **Dependencies:** CTXB-001
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - README includes development verification commands and Flow usage notes
  - Contributor setup covers local content folders and port overrides
  - Archived task artifacts have enough context for handoff

#### CTXB-006: Add browser-level smoke testing for critical flows
- **Description:** Exercise the local UI in a browser to verify open, branch, save, and delete flows end to end.
- **Priority:** P2
- **Dependencies:** CTXB-003, CTXB-004
- **Parallelizable:** no
- **Acceptance Criteria:**
  - Browser automation covers at least one happy-path edit flow
  - Test fixtures are isolated from real dialog folders
  - Failures point to the user-visible flow that regressed

## Task Status Legend

- **Not Started** — Task defined but not yet begun
- **INPROGRESS** — Task currently being worked on
- **✅ Complete** — Task finished and archived
