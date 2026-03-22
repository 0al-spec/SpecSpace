# ContextBuilder Workplan

## Overview

This workplan implements the product defined in [SPECS/PRD.md](/Users/egor/Development/GitHub/0AL/ContextBuilder/SPECS/PRD.md): a local-first conversation graph tool that reads JSON conversation files from disk, preserves lineage between branches and merges, lets the user choose a thought direction on a canvas, and compiles that selection into a Hyperprompt-backed Markdown context artifact for continuation with an external LLM or agent.

### Key Assumptions and Constraints

- JSON files on disk are the only required conversation persistence layer for v1.
- Stable `conversation_id` and `message_id` values are required for graph integrity.
- ContextBuilder owns graph structure, validation, selection, export, and compile orchestration, but not model execution.
- Browser support target is the latest stable desktop Safari and the latest stable desktop Chrome.
- Hyperprompt is an external local compiler dependency that must be configured or discoverable.
- Refresh safety, deterministic export, and lineage preservation take precedence over permissive writes.

### Non-Goals

- Running LLMs, agents, prompts, or tool execution inside ContextBuilder.
- Semantic retrieval or inferred graph construction from arbitrary corpora in v1.
- Browser capture, raw HTML parsing, auth, collaboration, or cloud sync.
- Automatic semantic merging or summarization of conversation content in v1.

## Phase 1: Canonical Graph Foundation

Intent: establish the deterministic data model, validation rules, and graph API required by every later workflow, including authoring and context compilation.

### ✅ CTXB-P1-T1 — Define the canonical conversation and lineage schema
- **Description:** Specify the required JSON contract for root, branch, and merge conversations, including stable conversation identifiers, message identifiers, and parent reference metadata.
- **Priority:** P0
- **Dependencies:** none
- **Parallelizable:** no
- **Outputs / Artifacts:** schema rules in docs, example JSON fixtures, server-side schema helpers
- **Acceptance Criteria:**
  - Root, branch, and merge conversations share one documented contract.
  - Parent references require `conversation_id`, `message_id`, and `link_type`.
  - The contract matches PRD sections §4.2, §4.4, and §6.

### ✅ CTXB-P1-T2 — Normalize imported conversations into graph roots or linked nodes
- **Description:** Implement deterministic rules for classifying externally supplied files as valid roots, valid linked conversations, or invalid inputs that require normalization.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** normalization logic, import classification path, fixture coverage for valid and invalid imports
- **Acceptance Criteria:**
  - Files with sufficient identifiers but no lineage metadata become explicit graph roots.
  - Files missing stable conversation or message identity are rejected with actionable errors.
  - No imported file enters the graph with ambiguous provenance.

### ✅ CTXB-P1-T3 — Validate lineage integrity and reject ambiguous graph state
- **Description:** Add validation for duplicate conversation IDs, duplicate message IDs in lineage contexts, missing parent references, invalid filenames, and malformed lineage payloads.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** validation layer in `viewer/server.py`, integrity error payloads, regression tests for invalid cases
- **Acceptance Criteria:**
  - Ambiguous or malformed files are rejected before save or graph inclusion.
  - Broken lineage references are reported explicitly instead of being silently ignored.
  - Validation covers PRD FR-7, FR-8, NFR-5, and NFR-7.

### ✅ CTXB-P1-T4 — Build the conversation graph index and diagnostics model
- **Description:** Convert the validated file set into an in-memory graph model that resolves conversation nodes, checkpoint relationships, parent edges, child edges, merge edges, and broken-link diagnostics.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T2, CTXB-P1-T3
- **Parallelizable:** no
- **Outputs / Artifacts:** graph indexing logic in `viewer/server.py`, graph payload model, fixture tests
- **Acceptance Criteria:**
  - The server returns graph-ready data for valid roots, branches, and merges.
  - Broken edges remain visible as diagnostics in the model.
  - Graph indexing satisfies PRD FR-1 and lineage rules in §4.2.

### ✅ CTXB-P1-T5 — Expose graph-aware API contracts for UI and compilation
- **Description:** Extend the local HTTP API so the UI and export pipeline can fetch graph data, checkpoint metadata, integrity issues, and compile-relevant selection metadata safely.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T4
- **Parallelizable:** no
- **Outputs / Artifacts:** API endpoints or payload extensions, API tests, contract documentation
- **Acceptance Criteria:**
  - The client can retrieve graph data, node metadata, checkpoint metadata, and blocking issues through the API.
  - API responses clearly separate valid graph data from blocking validation errors.
  - The contract supports PRD FR-1, FR-3, FR-11, and FR-16.

### CTXB-P1-T6 — Correct compile-target root metadata for incomplete lineage
- **Description:** Ensure graph selections with unresolved parent edges expose partial lineage honestly and never label the selected conversation as a reachable root unless it is a true root conversation.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** compile-target helper adjustment in `viewer/server.py`, regression tests for broken-lineage selection metadata, README contract clarification
- **Acceptance Criteria:**
  - Incomplete lineage selections do not include synthetic roots in `root_conversation_ids`.
  - The API contract clearly distinguishes reachable roots from partial or broken ancestry.
  - Regression tests cover broken-parent and missing-parent-message compile-target responses.

## Phase 2: Graph Navigation and Orientation UX

Intent: replace the flat file-browser mental model with a canvas-based graph experience that makes lineage visible, keeps the user oriented, and exposes the information needed to select a continuation path.

### ✅ CTXB-P2-T1 — Render the conversation graph on a canvas
- **Description:** Replace the current flat sidebar-first browsing flow with a canvas that renders conversation nodes, branch edges, merge edges, and node state.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** no
- **Outputs / Artifacts:** graph canvas in `viewer/index.html`, rendering logic, visual states for roots, branches, merges, and broken links
- **Acceptance Criteria:**
  - Users can visually distinguish root conversations, branch conversations, and merge conversations.
  - The canvas supports panning and node selection.
  - The rendered graph reflects the lineage data returned by the API.

### ✅ CTXB-P2-T2 — Add conversation detail and checkpoint inspection panels
- **Description:** When a conversation node is selected, show transcript messages, checkpoint metadata, lineage information, and available navigation or authoring actions.
- **Priority:** P0
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** detail panel UI in `viewer/index.html`, selection state management, transcript rendering for graph nodes
- **Acceptance Criteria:**
  - Selecting a node reveals its messages and lineage metadata.
  - The detail panel exposes checkpoint-level actions for branch, merge, and compile workflows.
  - The task satisfies PRD FR-3 and the inspection portions of Flow A.

### CTXB-P2-T3 — Implement ancestor and sibling lineage navigation
- **Description:** Add explicit navigation actions that jump from a derived conversation to its parent checkpoint and from that checkpoint to related sibling branches or merge-related nodes.
- **Priority:** P0
- **Dependencies:** CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** navigation controls in `viewer/index.html`, graph-centering logic, checkpoint highlighting behavior
- **Acceptance Criteria:**
  - A user can navigate from a branch to its ancestor checkpoint in one action.
  - A user can continue from the ancestor context to sibling branches without manual file lookup.
  - The implementation satisfies PRD FR-6 and Flow D.

### CTXB-P2-T4 — Preserve graph context across hard refresh
- **Description:** Persist and restore the active conversation, active checkpoint, and canvas viewport across `Cmd+R` or manual reload when those objects still exist after the refresh.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T1, CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** browser-side restoration logic, storage keys or URL strategy, refresh restoration tests
- **Acceptance Criteria:**
  - Reload restores the previous graph context when the referenced conversation and checkpoint still exist.
  - If the prior objects were removed externally, the UI falls back to the nearest valid state with a clear notice.
  - The behavior satisfies PRD FR-9, NFR-6, and Flow E.

### CTXB-P2-T5 — Surface integrity issues directly in the graph UI
- **Description:** Show broken references, duplicate IDs, unsupported files, and compile-blocking validation errors in the UI so the user can distinguish data issues from missing content.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T3, CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** UI error states in `viewer/index.html`, graph badges or notices, integrity summaries
- **Acceptance Criteria:**
  - Broken lineage is visible on the canvas and in the details UI.
  - Unsupported files or blocking errors are explicit and actionable.
  - The UI does not silently suppress graph inconsistencies.

## Phase 3: Authoring and Compile Target Selection

Intent: implement the workflows that mutate graph structure safely and let the user mark a concrete line of reasoning as the target for context compilation.

### CTXB-P3-T1 — Implement branch creation from any checkpoint
- **Description:** Add the UI and API workflow that creates a new conversation file from a selected checkpoint while preserving the exact parent conversation and parent message identifiers.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** branch creation controls in `viewer/index.html`, safe write path in `viewer/server.py`, branch creation tests
- **Acceptance Criteria:**
  - A user can create a new conversation from any checkpoint message.
  - The created file includes valid lineage metadata and appears as a child node after reload.
  - Branch creation satisfies PRD FR-4 and Flow B.

### CTXB-P3-T2 — Implement merge conversation creation with multi-parent lineage
- **Description:** Add the workflow that creates a new conversation file referencing two or more parent checkpoints without attempting to synthesize or auto-merge message bodies.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** merge selection UI, multi-parent save logic, merge workflow tests
- **Acceptance Criteria:**
  - A user can create a merge conversation from multiple checkpoints.
  - The created file records every parent reference deterministically.
  - The resulting node renders with multiple inbound edges and no implicit transcript synthesis.

### CTXB-P3-T3 — Define the compile target model and export workspace layout
- **Description:** Specify what a selected branch means for compilation, how merge parents are represented, and where generated export artifacts are written on disk.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** compile-target contract, export directory contract, API and UI data model updates
- **Acceptance Criteria:**
  - The product can represent a chosen branch or lineage path as a deterministic compile target.
  - Export artifacts have a stable local directory structure.
  - Merge provenance is preserved explicitly in the selection model.

### CTXB-P3-T4 — Let the user select the active branch as a compile target
- **Description:** Add UI actions and state handling so the user can mark the active conversation or checkpoint lineage as the branch to compile into external context.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3
- **Parallelizable:** no
- **Outputs / Artifacts:** compile target selection UI, selection persistence, API request payloads
- **Acceptance Criteria:**
  - The user can choose a concrete thought direction for compilation from the graph UI.
  - The selected target is unambiguous and serializable.
  - The workflow satisfies PRD FR-11 and Flow D / Flow E preconditions.

### CTXB-P3-T5 — Re-index and reconcile external file changes
- **Description:** Allow the user to refresh or re-index the workspace so that file additions, edits, or deletions performed by external agents or tools become visible without restarting the application.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T4, CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** refresh/re-index controls in `viewer/index.html`, server-side re-read logic, external-change tests
- **Acceptance Criteria:**
  - Newly added files appear after a refresh or re-index.
  - Deleted or modified files update the graph and current selection safely.
  - The implementation satisfies PRD FR-10 and NFR-8.

## Phase 4: Hyperprompt Export and Compilation Pipeline

Intent: turn the selected branch into actual filesystem artifacts that Hyperprompt can compile, then produce the final continuation-ready Markdown context.

### CTXB-P4-T1 — Export selected graph nodes into deterministic Markdown files
- **Description:** Materialize the selected branch as a set of Markdown node files, each carrying source provenance and original content in a stable representation.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3, CTXB-P3-T4
- **Parallelizable:** no
- **Outputs / Artifacts:** generated `.md` export nodes, export metadata, deterministic file naming rules
- **Acceptance Criteria:**
  - Repeated export of unchanged inputs yields identical Markdown node files.
  - Each export node preserves source `conversation_id`, `message_id`, role, and content.
  - The output satisfies PRD FR-12 and §6.4.

### CTXB-P4-T2 — Generate a valid Hyperprompt root file for the selected branch
- **Description:** Build a root `.hc` file that references the exported Markdown nodes in deterministic order and nesting, matching Hyperprompt syntax requirements.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** generated `.hc` file, root-file generation logic, syntax validation path
- **Acceptance Criteria:**
  - The `.hc` file references only generated `.md` or `.hc` files inside the export root.
  - The file is valid Hyperprompt syntax with no path traversal or circular structure.
  - The generated structure satisfies PRD FR-13 and §6.5.

### CTXB-P4-T3 — Integrate Hyperprompt compiler invocation
- **Description:** Invoke a configured local Hyperprompt compiler executable to compile the generated `.hc` file into a final Markdown context artifact and optional manifest.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** subprocess integration, compiled `.md` output, optional manifest, compile diagnostics
- **Acceptance Criteria:**
  - Successful compile produces a final Markdown artifact from the generated `.hc`.
  - Missing compiler binaries or non-zero exits surface actionable errors.
  - The integration satisfies PRD FR-14, FR-15, and NFR-11.

### CTXB-P4-T4 — Expose compile results and artifact locations
- **Description:** Show compile status, output paths, and failure details in the UI and API so the user can immediately use the generated context artifact with an external agent.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** result panel or artifact summary UI, compile status payloads
- **Acceptance Criteria:**
  - The user can find the generated `.hc` and final compiled `.md` without manual filesystem inspection.
  - Failed compiles show actionable diagnostics instead of silent failure.
  - The task satisfies PRD FR-15 and Flow D.

### CTXB-P4-T5 — Preserve provenance from compiled artifact back to graph selection
- **Description:** Ensure that the generated artifacts remain traceable to the originating graph selection and source conversation files.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T1, CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** traceability metadata, artifact naming or metadata conventions
- **Acceptance Criteria:**
  - A user can determine which compile target produced a given compiled Markdown artifact.
  - Artifact provenance survives refresh and repeated compilation.
  - The implementation satisfies PRD FR-16 and §6.6.

## Phase 5: Hardening, Tests, and Documentation

Intent: lock down graph and compile behavior with regression coverage and make the end-to-end workflow understandable for contributors and operators.

### CTXB-P5-T1 — Add automated tests for schema validation and graph integrity failures
- **Description:** Extend the test suite to cover invalid imports, duplicate IDs, missing parents, malformed lineage, and graph diagnostics.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** expanded test fixtures and server tests
- **Acceptance Criteria:**
  - Duplicate IDs, missing parents, and malformed lineage are covered by automated tests.
  - The suite fails when graph integrity behavior regresses.

### CTXB-P5-T2 — Add automated tests for branch, merge, and compile target selection workflows
- **Description:** Cover the authoring and selection flows that create or choose the reasoning branch to export.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** authoring and selection test coverage
- **Acceptance Criteria:**
  - Branch and merge workflows are protected by automated tests.
  - Compile target selection is deterministic and regression-tested.

### CTXB-P5-T3 — Add automated tests for Markdown export, `.hc` generation, and Hyperprompt compile integration
- **Description:** Cover export node generation, root `.hc` creation, compiler invocation, missing compiler failures, and successful compiled artifact output.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** export and compile integration tests, Hyperprompt-backed fixtures or mocks
- **Acceptance Criteria:**
  - The pipeline catches broken references, invalid compiler setup, and incorrect artifact generation.
  - Successful compile flows are covered end-to-end.

### CTXB-P5-T4 — Update product and contributor documentation for the graph-to-context workflow
- **Description:** Rewrite repository documentation so it matches the graph product scope, the canonical file contract, the Hyperprompt dependency, and the compile workflow.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** `README.md` and supporting docs
- **Acceptance Criteria:**
  - The docs explain what ContextBuilder owns and what external agents own.
  - The docs describe root, branch, merge, export node, `.hc`, and compiled artifact concepts.
  - A contributor can understand the local graph-to-context pipeline.

### CTXB-P5-T5 — Add end-to-end verification guidance for handing compiled context to an external agent
- **Description:** Document the local operator flow from JSON conversations to final compiled Markdown so the compiled artifact can be used immediately in downstream agent workflows.
- **Priority:** P1
- **Dependencies:** CTXB-P5-T3, CTXB-P5-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** workflow notes, validation checklist, operator guidance
- **Acceptance Criteria:**
  - A user can follow the documented local workflow from JSON conversations to final compiled context output.
  - The final handoff path to an external agent is explicit and reproducible.

## Dependency Summary

- Phase 1 establishes the schema, integrity rules, graph index, and API contract required by all later work.
- Phase 2 depends on the graph-ready API and turns lineage into a usable visual model.
- Phase 3 depends on both the graph foundation and the inspection UI because authoring and compile selection operate on selected checkpoints.
- Phase 4 depends on the compile target model and turns the selected branch into Hyperprompt-compatible filesystem artifacts.
- Phase 5 validates and documents the complete graph-to-context workflow.

## Task Status Legend

- **Not Started** — Task defined but not yet begun
- **INPROGRESS** — Task currently being worked on
- **✅ Complete** — Task finished and archived
